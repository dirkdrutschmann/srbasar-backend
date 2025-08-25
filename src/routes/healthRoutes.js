const express = require('express');
const healthController = require('../controllers/healthController');

const router = express.Router();

/**
 * @swagger
 * /v1/health:
 *   get:
 *     summary: System-Gesundheitsstatus abrufen
 *     description: Überprüft den allgemeinen Gesundheitsstatus des Systems
 *     tags: [Gesundheit]
 *     responses:
 *       200:
 *         description: System ist gesund
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 message:
 *                   type: string
 *                   description: Statusmeldung
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Zeitstempel der Überprüfung
 *       503:
 *         description: System ist nicht gesund
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 message:
 *                   type: string
 *                   description: Fehlermeldung
 *       500:
 *         description: Systemfehler
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', healthController.getHealth);

/**
 * @swagger
 * /v1/health/system:
 *   get:
 *     summary: Systeminformationen abrufen
 *     description: Ruft detaillierte Systeminformationen ab
 *     tags: [Gesundheit]
 *     responses:
 *       200:
 *         description: Systeminformationen erfolgreich abgerufen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   description: Systeminformationen
 *       500:
 *         description: Systemfehler
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/system', healthController.getSystemInfo);

/**
 * @swagger
 * /v1/health/database:
 *   get:
 *     summary: Datenbank-Gesundheit prüfen
 *     description: Überprüft den Verbindungsstatus zur Datenbank
 *     tags: [Gesundheit]
 *     responses:
 *       200:
 *         description: Datenbank ist gesund
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 message:
 *                   type: string
 *                   description: Statusmeldung
 *       503:
 *         description: Datenbank ist nicht gesund
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 message:
 *                   type: string
 *                   description: Fehlermeldung
 *       500:
 *         description: Systemfehler
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/database', healthController.getDatabaseHealth);

module.exports = router;
