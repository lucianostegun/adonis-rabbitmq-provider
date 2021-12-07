'use strict'

const { ServiceProvider } = require('@adonisjs/fold')

class RabbitMQProvider extends ServiceProvider {
  /**
   * Register namespaces to the IoC container
   *
   * @method register
   *
   * @return {void}
   */
  register () {
    this.app.singleton('RabbitMQProvider', () => {
      
      const Config = this.app.use('Adonis/Src/Config');
      
      return (new (require('../src/RabbitMQ'))(Config)).connect().catch((err) => {
        console.warn(`Could not connect to RabbitMQ service: ${err}`);
      });
    });
  }

  /**
   * Attach context getter when all providers have
   * been registered
   *
   * @method boot
   *
   * @return {void}
   */
  boot () {
  }
}

module.exports = RabbitMQProvider
