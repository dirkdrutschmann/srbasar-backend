const { sequelize } = require('../config/database');

class HealthService {
  async checkDatabaseHealth() {
    try {
      await sequelize.authenticate();
      return { status: 'healthy', message: 'Datenbankverbindung erfolgreich' };
    } catch (error) {
      return { status: 'unhealthy', message: 'Datenbankverbindung fehlgeschlagen', error: error.message };
    }
  }

  async getSystemInfo() {
    const dbHealth = await this.checkDatabaseHealth();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  async performHealthCheck() {
    const dbHealth = await this.checkDatabaseHealth();
    const overallStatus = dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth
      }
    };
  }
}

module.exports = new HealthService();
