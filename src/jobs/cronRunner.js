#!/usr/bin/env node

/**
 * Cron Job Runner - Führt alle Cron-Jobs manuell aus
 * Verwendung: npm run cron [w1|w3|all]
 */

const TeamSLService = require('../services/teamSLService');

async function runCronJob(jobType = 'all') {
  console.log(`\n🚀 Starte ${jobType.toUpperCase()} Cron-Job manuell...`);
  console.log(`⏰ Gestartet um: ${new Date().toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const startTime = new Date();

  try {
    const result = await TeamSLService.processGamesData(jobType);
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ ${jobType.toUpperCase()} Cron-Job erfolgreich abgeschlossen!`);
    console.log(`⏱️  Dauer: ${Math.round(duration / 1000 * 100) / 100}s`);
    console.log(`📊 Ergebnis: ${result.gamesCount} Spiele verarbeitet`);
    console.log(`🕐 Beendet um: ${endTime.toISOString()}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`⚠️  Fehler: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ ${jobType.toUpperCase()} Cron-Job fehlgeschlagen!`);
    console.error(`⏱️  Dauer: ${Math.round(duration / 1000 * 100) / 100}s`);
    console.error(`🕐 Beendet um: ${endTime.toISOString()}`);
    console.error(`🚨 Fehler: ${error.message}`);
    
    if (error.stack) {
      console.error('📋 Stack Trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Command Line Interface
const args = process.argv.slice(2);
const jobType = args[0] || 'all';

const validJobTypes = ['w1', 'w3', 'all'];

if (!validJobTypes.includes(jobType)) {
  console.error(`❌ Ungültiger Job-Typ: ${jobType}`);
  console.error(`✅ Verfügbare Job-Typen: ${validJobTypes.join(', ')}`);
  console.error('');
  console.error('Verwendung:');
  console.error('  npm run cron        # Führt "all" Job aus');
  console.error('  npm run cron w1     # Führt "w1" Job aus');
  console.error('  npm run cron w3     # Führt "w3" Job aus');
  console.error('  npm run cron all    # Führt "all" Job aus');
  process.exit(1);
}

runCronJob(jobType);
