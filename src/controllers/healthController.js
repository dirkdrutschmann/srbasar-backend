const healthService = require('../services/healthService');
const bbnService = require('../services/teamSLService');

class HealthController {
  async getHealth(req, res) {
    try {
      const healthStatus = await healthService.performHealthCheck();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Fehler bei der Gesundheitsprüfung',
        error: error.message
      });
    }
  }

  async getSystemInfo(req, res) {
    try {
      const systemInfo = await healthService.getSystemInfo();
      res.status(200).json(systemInfo);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Fehler beim Abrufen der Systeminformationen',
        error: error.message
      });
    }
  }

  async getDatabaseHealth(req, res) {
    try {
      const dbHealth = await healthService.checkDatabaseHealth();
      const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json(dbHealth);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Fehler bei der Datenbank-Gesundheitsprüfung',
        error: error.message
      });
    }
  }

  async getBBNHealth(req, res) {
    try {
      const bbnHealth = await bbnService.getBBNHealth();
      res.status(200).json(bbnHealth);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Fehler bei der BBN-Gesundheitsprüfung',
        error: error.message
      });
    }
  }
}

module.exports = new HealthController();
