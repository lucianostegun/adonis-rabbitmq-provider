# adonis-rabbitmq-provider
This package is intended to be use as a provider for AdonisJS 4.1 in order to connect, publish and consume messages on RabbitMQ service.

**INSTALATION**

    npm install adonis-rabbitmq-provider
    
**CONFIGURATION**

1. Create a configuration file ***config/queue.js***
    
```javascript
'use strict'

module.exports = {
  url: 'amqp://<username>:<password>@<hostname>:<port>',
  prefix: 'foo'
}
```

The key "prefix" is optional. If defined it will be used to prepend the queue name on publishing/consuming operations.

2. Edit the providers list inside the file ***start/app.js***

```javascript
const providers = [
  '@adonisjs/framework/providers/AppProvider',
  '@adonisjs/auth/providers/AuthProvider',
  [...]
  'adonis-rabbitmq-provider/providers/RabbitMQProvider' // Add this line to the providers array
];
```

**USAGE**

```javascript
const RabbitMQProvider = use('RabbitMQProvider');

// Publishing messages
RabbitMQProvider.send(queueName, payload[, options]);
```

Example:

```javascript
var jobId = await RabbitMQProvider.send('myQueueName', {foo: 'bar'});
```

Getting one message syncronously

```javascript
RabbitMQProvider.get(queueName);
```

Example:

```javascript
// Retrieving a single message from the queue
const message = await RabbitMQProvider.getMessage(queue);

// Parsing the payload
let payload = JSON.parse(message.content.toString());

// Acknowledging the message
RabbitMQProvider.ack(queueName, message);

// Or rejecting the message and putting it back to the queue
RabbitMQProvider.nack(queueName, message);
```

**TESTS**

There is no tests configured yet
