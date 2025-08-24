const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { User } = require('./models');
require('dotenv').config();

const healthRoutes = require('./routes/healthRoutes');
const spieleRoutes = require('./routes/spieleRoutes');
const userRoutes = require('./routes/userRoutes');
const vereinRoutes = require('./routes/vereinRoutes');
const { sequelize } = require('./config/database');
const cronService = require('./services/cronService');

// Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Modelle importieren für Datenbanksynchronisation
require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/health', healthRoutes);
app.use('/api/spiele', spieleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vereine', vereinRoutes);

// Swagger JSON
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Srbasar API Dokumentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true
  }
}));

app.get('/', (req, res) => {
  res.json({ message: 'Willkommen zur Srbasar Backend API' });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

let server;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Datenbankverbindung erfolgreich hergestellt');
    
    await sequelize.sync({ alter: false, force: false });
    console.log('Datenbank synchronisiert');
    server = app.listen(PORT, () => {
      console.log(`Server läuft auf Port ${PORT}`);
      console.log(`PM2 Instance ID: ${process.env.NODE_APP_INSTANCE || 'N/A'}`);
      
      // Starte alle BBN Cron-Jobs
      cronService.startBBNCronJobs();
    });
  } catch (error) {
    console.error('Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} Signal empfangen. Starte Graceful Shutdown...`);
  
  // Stoppe alle Cron-Jobs
  cronService.stopBBNCronJobs();
  
  if (server) {
    server.close(() => {
      console.log('HTTP Server geschlossen');
    });
  }
  
  try {
    await sequelize.close();
    console.log('Datenbankverbindung geschlossen');
    process.exit(0);
  } catch (error) {
    console.error('Fehler beim Schließen der Datenbankverbindung:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = app;
