const cron = require('node-cron');
const TeamSLService = require('./teamSLService');

class CronService {
  constructor() {
    this.teamSLCronJobs = {
      w1: null,
      w3: null,
      all: null
    };
    this.isRunning = {
      w1: false,
      w3: false,
      all: false
    };
  }

  startTeamSLCronJobs() {
    // W1 Cron-Job - Jede Minute
    if (this.teamSLCronJobs.w1) {
      console.log('W1 Cron-Job läuft bereits');
    } else {
      console.log('Starte W1 Cron-Job (alle 5 Minuten)...');
      
      this.teamSLCronJobs.w1 = cron.schedule('*/5 * * * *', async () => {
        if (this.isRunning.w1) {
          console.log('W1 Cron-Job läuft bereits, überspringe...');
          return;
        }

        this.isRunning.w1 = true;
        const startTime = new Date();
        
        try {
          console.log(`W1 Cron-Job gestartet um ${startTime.toISOString()}`);
          
          const result = await TeamSLService.processGamesData("w1");
          
          const endTime = new Date();
          const duration = endTime - startTime;
          
          console.log(`W1 Cron-Job erfolgreich abgeschlossen um ${endTime.toISOString()}`);
          console.log(`Dauer: ${duration}ms`);
          console.log(`Ergebnis: ${result.gamesCount} Spiele verarbeitet`);
          
        } catch (error) {
          const endTime = new Date();
          const duration = endTime - startTime;
          
          console.error(`W1 Cron-Job fehlgeschlagen um ${endTime.toISOString()}`);
          console.error(`Dauer: ${duration}ms`);
          console.error('Fehler:', error.message);
          
        } finally {
          this.isRunning.w1 = false;
        }
      }, {
        scheduled: true,
        timezone: "Europe/Berlin"
      });
      
      console.log('W1 Cron-Job erfolgreich gestartet');
    }

    // W3 Cron-Job - Alle 15 Minuten
    if (this.teamSLCronJobs.w3) {
      console.log('W3 Cron-Job läuft bereits');
    } else {
      console.log('Starte W3 Cron-Job (alle 15 Minuten)...');
      
      this.teamSLCronJobs.w3 = cron.schedule('*/15 * * * *', async () => {
        if (this.isRunning.w3) {
          console.log('W3 Cron-Job läuft bereits, überspringe...');
          return;
        }

        this.isRunning.w3 = true;
        const startTime = new Date();
        
        try {
          console.log(`W3 Cron-Job gestartet um ${startTime.toISOString()}`);
          
          const result = await TeamSLService.processGamesData("w3");
          
          const endTime = new Date();
          const duration = endTime - startTime;
          
          console.log(`W3 Cron-Job erfolgreich abgeschlossen um ${endTime.toISOString()}`);
          console.log(`Dauer: ${duration}ms`);
          console.log(`Ergebnis: ${result.gamesCount} Spiele verarbeitet`);
          
        } catch (error) {
          const endTime = new Date();
          const duration = endTime - startTime;
          
          console.error(`W3 Cron-Job fehlgeschlagen um ${endTime.toISOString()}`);
          console.error(`Dauer: ${duration}ms`);
          console.error('Fehler:', error.message);
          
        } finally {
          this.isRunning.w3 = false;
        }
      }, {
        scheduled: true,
        timezone: "Europe/Berlin"
      });
      
      console.log('W3 Cron-Job erfolgreich gestartet');
    }

    // All Cron-Job - Jede Stunde
    if (this.teamSLCronJobs.all) {
      console.log('All Cron-Job läuft bereits');
    } else {
      console.log('Starte All Cron-Job (jede halbe Stunde)...');
      
      this.teamSLCronJobs.all = cron.schedule('*/30 * * * *', async () => {
        if (this.isRunning.all) {
          console.log('All Cron-Job läuft bereits, überspringe...');
          return;
        }

        this.isRunning.all = true;
        const startTime = new Date();
        
        try {
          console.log(`All Cron-Job gestartet um ${startTime.toISOString()}`);
          
          const result = await TeamSLService.processGamesData("all");
          
          const endTime = new Date();
          const duration = endTime - startTime;
          
          console.log(`All Cron-Job erfolgreich abgeschlossen um ${endTime.toISOString()}`);
          console.log(`Dauer: ${duration}ms`);
          console.log(`Ergebnis: ${result.gamesCount} Spiele verarbeitet`);
          
        } catch (error) {
          const endTime = new Date();
          const duration = endTime - startTime;
          
          console.error(`All Cron-Job fehlgeschlagen um ${endTime.toISOString()}`);
          console.error(`Dauer: ${duration}ms`);
          console.error('Fehler:', error.message);
          
        } finally {
          this.isRunning.all = false;
        }
      }, {
        scheduled: true,
        timezone: "Europe/Berlin"
      });
      
      console.log('All Cron-Job erfolgreich gestartet');
    }
  }

  stopTeamSLCronJob() {
    if (this.teamSLCronJob) {
      this.teamSLCronJob.stop();
      this.teamSLCronJob = null;
      this.isRunning = false;
      console.log('TeamSL Cron-Job gestoppt');
    }
  }

  getTeamSLCronJobStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.teamSLCronJob !== null,
      nextRun: this.teamSLCronJob ? this.teamSLCronJob.nextDate().toISOString() : null
    };
  }
}

module.exports = new CronService();
