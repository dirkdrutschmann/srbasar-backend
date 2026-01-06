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
const adminRoutes = require('./routes/adminRoutes');
const { sequelize } = require('./config/database');
const cronService = require('./services/cronService');

// Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Modelle importieren für Datenbanksynchronisation
require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Konfiguration VOR Helmet
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:5173', 'http://localhost:5174', 'https://srbasar.de', 'https://www.srbasar.de'];

app.use(cors({
  origin: function (origin, callback) {
    // Erlaube Requests ohne Origin (z.B. mobile Apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin ${origin} nicht erlaubt`);
      callback(new Error('CORS Policy: Origin nicht erlaubt'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'sentry-trace', 'baggage'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Helmet NACH CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Deaktiviere CSP für API
}));

app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/v1/health', healthRoutes);
app.use('/v1/spiele', spieleRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/vereine', vereinRoutes);
app.use('/v1/admin', adminRoutes);

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
      console.log(`Erlaubte Origins: ${allowedOrigins.join(', ')}`);
      
      // Starte alle TeamSL Cron-Jobs
      cronService.startTeamSLCronJobs();
    });
  } catch (error) {
    console.error('Fehler beim Starten des Servers:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} Signal empfangen. Starte Graceful Shutdown...`);
  
  // Stoppe alle Cron-Jobs
  cronService.stopTeamSLCronJobs();
  
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

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

if (require.main === module) {
  startServer();
}

module.exports = app;
