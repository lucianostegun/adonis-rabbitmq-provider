const amqp   = require('amqplib/callback_api');
const uuid   = require('uuid');
const moment = require('moment');

class RabbitMQ {

  constructor (Config) {
    this.connectUrl  = Config.get('queue.url');
    this.queuePrefix = Config.get('queue.prefix');
    this.connection  = null;
    this.channelList = {length: 0};
    this.connected   = false;
  }

  connect() {

    return new Promise((resolve, reject) => {

      if (this.connected) {
        resolve();
        return;
      }

      amqp.connect(this.connectUrl, async (err, connection) => {

        if (err) {
          this.connected = false;
          return reject(err);
        }

        this.connection = connection;

        this.connected = true;
        resolve(this);

        process.on('exit', code => {
        
          if (this.connected) {
            
            for (let channelName in this.channelList) {
              if (channelName !== 'length') {
                this.channelList[channelName].close();
                delete this.channelList[channelName];
                this.channelList.length--;
              }
            };
  
            this.connection.close();
            this.connected = false;
          }
  
          console.log(`Closing connection with RabbitMQ`);
        });
      });
    });
  }

  createChannel(channelName) {

    if (!this.checkConnection()) {
      return false;
    }

    return new Promise((resolve, reject) => {

      if (this.channelList.hasOwnProperty(channelName)) {
        return resolve();;
      }
      
      this.connection.createChannel(async (err, channel) => {

        if (err) {
          return reject(err);
        }
        
        this.channelList[channelName] = channel;
        this.channelList.length++;
        
        resolve();
      });
    });
  }

  completeQueueName(queueName) {
    return `${this.queuePrefix}/${queueName}`;
  }

  async send(queueName, payload, options, channelName='DEFAULT') {
    
    if (!this.checkConnection()) {
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

    if (!this.checkConnection()) {
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

    if (!this.checkConnection()) {
      return false;
    }

    await this.createChannel(channelName);
    
    queueName = this.completeQueueName(queueName);

    this.channelList[channelName].prefetch(1);
    this.channelList[channelName].consume(queueName, callback)
  }

  async ack(queueName, data, channelName='DEFAULT') {

    if (!this.checkConnection()) {
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

    if (!this.checkConnection()) {
      return false;
    }

    await this.createChannel(channelName);

    queueName = this.completeQueueName(queueName);

    this.channelList[channelName].assertQueue(queueName, {
      durable: true,
    });

    this.channelList[channelName].nack(data);
  }

  checkConnection() {
    
    if (!this.connected) {
      console.warn('RabbitMQProvider: Not connected');
      return false;
    }

    return true;
  }
}

module.exports = RabbitMQ