const amqp   = require('amqplib/callback_api');
const uuid   = require('uuid');
const moment = require('moment');

class RabbitMQ {

  constructor (Config) {
    this.connectUrl  = Config.get('queue.url');
    this.queuePrefix = Config.get('queue.prefix');
    this.connection  = null;
    this.channelList = {};
    this.connectionPromise = null;
    this.connected   = false;
  }

  connect() {

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {

      if (this.connected) {
        resolve();
        this.connectionPromise = null
        return;
      }

      amqp.connect(this.connectUrl, async (err, connection) => {

        if (err) {
          this.connected = false;
          return reject(err);
        }

        this.connection        = connection;
        this.connectionPromise = null;

        this.connected = true;
        resolve(this);

        process.on('exit', code => {
        
          if (this.connected) {
            
            for (let channelName in this.channelList) {
              this.channelList[channelName].close();
              delete this.channelList[channelName];
            };
  
            this.connection.close();
            this.connected = false;
          }
  
          console.log(`Closing connection with RabbitMQ`);
        });
      });
    });

    return this.connectionPromise;
  }

  async createChannel(channelName) {

    if (!(await this.checkConnection())) {
      return false;
    }

    if (this.channelList.hasOwnProperty(channelName)) {
      return await this.channelList[channelName];
    }

    this.channelList[channelName] = new Promise((resolve, reject) => {

      this.connection.createChannel(async (err, channel) => {

        if (err) {
          return reject(err);
        }
        
        resolve(channel);
      });
    });

    this.channelList[channelName] = await this.channelList[channelName];
  }

  completeQueueName(queueName) {
    return `${this.queuePrefix}/${queueName}`;
  }

  async send(queueName, payload, options, channelName='DEFAULT') {
    
    if (!(await this.checkConnection())) {
      return false;
    }

    await this.createChannel(channelName);

    options = options || {};
    options.priority  = options.priority || 5;
    options.messageId = uuid.v4();
    options.timestamp = moment().unix();

    queueName = this.completeQueueName(queueName);

    if (typeof(payload) == 'object') {

      if (!payload.hasOwnProperty('attempts')) {
        payload.attempts = 0;
      } else {
        payload.attempts++;
      }
      
      payload = JSON.stringify(payload);
      options.contentType = 'application/json';
    }

    this.channelList[channelName].assertQueue(queueName, {
      durable: true,
    });

    await this.channelList[channelName].sendToQueue(queueName, Buffer.from(payload), options);

    return options.messageId;
  }
  
  async getMessage(queueName, channelName='DEFAULT') {

    if (!(await this.checkConnection())) {
      return false;
    }

    await this.createChannel(channelName);
    
    queueName = this.completeQueueName(queueName);

    const promise = new Promise((resolve, reject) => {
      
      this.channelList[channelName].assertQueue(queueName, {
        durable: true,
      });

      this.channelList[channelName].get(queueName, {noAck: false}, (err, data) => {

        if (data) {
          resolve(data);
        } else {
          resolve(false);
        }
      });
    });

    return promise;
  }
  
  async consume(queueName, callback, channelName='DEFAULT') {

    if (!(await this.checkConnection())) {
      return false;
    }

    await this.createChannel(channelName);
    
    queueName = this.completeQueueName(queueName);

    this.channelList[channelName].assertQueue(queueName, {
      durable: true,
    });

    this.channelList[channelName].prefetch(1);
    this.channelList[channelName].consume(queueName, callback)
  }

  async ack(queueName, data, channelName='DEFAULT') {

    if (!(await this.checkConnection())) {
      return false;
    }

    await this.createChannel(channelName);

    queueName = this.completeQueueName(queueName);

    this.channelList[channelName].assertQueue(queueName, {
      durable: true,
    });

    this.channelList[channelName].ack(data);
  }

  async nack(queueName, data, channelName='DEFAULT') {

    if (!(await this.checkConnection())) {
      return false;
    }

    await this.createChannel(channelName);

    queueName = this.completeQueueName(queueName);

    this.channelList[channelName].assertQueue(queueName, {
      durable: true,
    });

    this.channelList[channelName].nack(data);
  }

  async checkConnection() {
    
    if (!this.connected) {
      if (!(await this.connect())) {
        console.warn('RabbitMQProvider: Not connected');
        return false;
      }
    }

    return true;
  }
}

module.exports = RabbitMQ