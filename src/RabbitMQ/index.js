const amqp   = require('amqplib/callback_api');
const uuid   = require('uuid');
const moment = require('moment');

class RabbitMQ {
  constructor (Config) {
    this.connectUrl  = Config.get('queue.url');
    this.queuePrefix = Config.get('queue.prefix');
    this.connection  = null;
    this.channel     = null;
    this.connected   = false;
  }

  connect() {

    amqp.connect(this.connectUrl, async (err, connection) => {

      this.connection = connection;

      connection.createChannel(async (err, channel) => {
        this.channel = channel;
      });
    });

    process.on('exit', code => {
      this.channel.close();
      this.connection.close();
      console.log(`Closing connection with RabbitMQ`);
    });
  }

  completeQueueName(queue) {
    return `${this.queuePrefix}/${queue}`;
  }

  async send(queue, message, options) {
    
    options = options || {};
    options.priority  = options.priority || 5;
    options.messageId = uuid.v4();
    options.timestamp = moment().unix();

    queue = this.completeQueueName(queue);

    if (typeof(message) == 'object') {
      message = JSON.stringify(message);
      options.contentType = 'application/json';
    }

    this.channel.assertQueue(queue, {
      durable: true,
    });

    await this.channel.sendToQueue(queue, Buffer.from(message), options);

    return options.messageId;
  }
  
  getMessage(queue) {
    
    queue = this.completeQueueName(queue);

    const promise = new Promise((resolve, reject) => {
      
      this.channel.assertQueue(queue, {
        durable: true,
      });

      this.channel.get(queue, {noAck: false}, (err, data) => {

        if (data) {
          resolve(data);
        } else {
          resolve(false);
        }
      });
    });

    return promise;
  }

  ack(queue, data) {

    queue = this.completeQueueName(queue);

    this.channel.assertQueue(queue, {
      durable: true,
    });

    this.channel.ack(data);
  }

  nack(queue, data) {

    queue = this.completeQueueName(queue);

    this.channel.assertQueue(queue, {
      durable: true,
    });

    this.channel.nack(data);
  }
}

module.exports = RabbitMQ