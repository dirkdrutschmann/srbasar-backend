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
    this.globalRunning = false; // Globale Laufzeit-Überwachung
  }

  // Prüft ob irgendein Cronjob läuft
  isAnyJobRunning() {
    return this.isRunning.w1 || this.isRunning.w3 || this.isRunning.all || this.globalRunning;
  }

  // Setzt globale Laufzeit-Überwachung
  setGlobalRunning(running) {
    this.globalRunning = running;
  }

  startTeamSLCronJobs() {
    // W1 Cron-Job - Jede Minute
    if (this.teamSLCronJobs.w1) {
      console.log('W1 Cron-Job läuft bereits');
    } else {
      console.log('Starte W1 Cron-Job (5,10,20,25,35,40,50,55 Minuten)...');
      
      this.teamSLCronJobs.w1 = cron.schedule('5,10,20,25,35,40,50,55 7-23 * * *', async () => {
        if (this.isRunning.w1) {
          console.log('W1 Cron-Job läuft bereits, überspringe...');
          return;
        }

        // Prüfe ob ein anderer Cronjob läuft
        if (this.isAnyJobRunning()) {
          console.log('W1 Cron-Job übersprungen: Ein anderer Cronjob läuft bereits');
          return;
        }

        this.isRunning.w1 = true;
        this.setGlobalRunning(true);
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
          this.setGlobalRunning(false);
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
      console.log('Starte W3 Cron-Job (15,45 Minuten)...');
      
      this.teamSLCronJobs.w3 = cron.schedule('15,45 7-23 * * *', async () => {
        if (this.isRunning.w3) {
          console.log('W3 Cron-Job läuft bereits, überspringe...');
          return;
        }

        // Prüfe ob ein anderer Cronjob läuft
        if (this.isAnyJobRunning()) {
          console.log('W3 Cron-Job übersprungen: Ein anderer Cronjob läuft bereits');
          return;
        }

        this.isRunning.w3 = true;
        this.setGlobalRunning(true);
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
          this.setGlobalRunning(false);
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
      console.log('Starte All Cron-Job (0,30 Minuten)...');
      
      this.teamSLCronJobs.all = cron.schedule('0,30 7-23 * * *', async () => {
        if (this.isRunning.all) {
          console.log('All Cron-Job läuft bereits, überspringe...');
          return;
        }

        // Prüfe ob ein anderer Cronjob läuft
        if (this.isAnyJobRunning()) {
          console.log('All Cron-Job übersprungen: Ein anderer Cronjob läuft bereits');
          return;
        }

        this.isRunning.all = true;
        this.setGlobalRunning(true);
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
          this.setGlobalRunning(false);
        }
      }, {
        scheduled: true,
        timezone: "Europe/Berlin"
      });
      
      console.log('All Cron-Job erfolgreich gestartet');
    }
  }

  stopTeamSLCronJobs() {
    if (this.teamSLCronJob) {
      this.isRunning = false;
      console.log('TeamSL Cron-Job gestoppt');
    }
  }

  getTeamSLCronJobStatus() {
    return {
      isRunning: this.isRunning,
      globalRunning: this.globalRunning,
      anyJobRunning: this.isAnyJobRunning(),
      isScheduled: {
        w1: this.teamSLCronJobs.w1 !== null,
        w3: this.teamSLCronJobs.w3 !== null,
        all: this.teamSLCronJobs.all !== null
      },
      nextRun: {
        w1: this.teamSLCronJobs.w1 ? this.teamSLCronJobs.w1.nextDate().toISOString() : null,
        w3: this.teamSLCronJobs.w3 ? this.teamSLCronJobs.w3.nextDate().toISOString() : null,
        all: this.teamSLCronJobs.all ? this.teamSLCronJobs.all.nextDate().toISOString() : null
      }
    };
  }
}

module.exports = new CronService();
