const express = require('express');
const vereinController = require('../controllers/vereinController');
const { verifyToken, isAdmin } = require('../middleware/authJwt');

const router = express.Router();

/**
 * @swagger
 * /api/vereine:
 *   get:
 *     summary: Alle Vereine abrufen
 *     description: Ruft alle Vereine mit Paginierung und Suchfunktion ab
 *     tags: [Vereine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Seitennummer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Anzahl der Einträge pro Seite (max. 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Suche nach Vereinsname oder Vereinsnummer
 *     responses:
 *       200:
 *         description: Vereine erfolgreich abgerufen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     vereine:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Verein'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       500:
 *         description: Serverfehler
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', [verifyToken, isAdmin], vereinController.getAllVereine);


/**
 * @swagger
 * /api/vereine/{vereinId}/hideLink:
 *   patch:
 *     summary: hideLink für einen Verein aktualisieren
 *     description: Ändert den hideLink-Status eines Vereins (nur für Administratoren)
 *     tags: [Vereine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vereinId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID des Vereins
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hideLink
 *             properties:
 *               hideLink:
 *                 type: boolean
 *                 description: Neuer Wert für hideLink
 *                 example: true
 *     responses:
 *       200:
 *         description: hideLink erfolgreich aktualisiert
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: hideLink erfolgreich aktualisiert
 *                 data:
 *                   type: object
 *                   properties:
 *                     verein:
 *                       type: object
 *                       properties:
 *                         vereinId:
 *                           type: integer
 *                           example: 1
 *                         vereinsname:
 *                           type: string
 *                           example: "Beispielverein"
 *                         hideLink:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Ungültige Eingabedaten
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Nicht authentifiziert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Keine Admin-Berechtigung
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Verein nicht gefunden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Serverfehler
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:vereinId/hideLink', [verifyToken, isAdmin], vereinController.updateHideLink);

module.exports = router;
