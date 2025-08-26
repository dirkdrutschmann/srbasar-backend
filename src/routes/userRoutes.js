const express = require('express');
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authJwt');

const router = express.Router();

/**
 * @swagger
 * /v1/users/login:
 *   post:
 *     summary: Benutzer anmelden
 *     description: Authentifiziert einen Benutzer und gibt einen JWT-Token zurück
 *     tags: [Benutzer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Benutzername oder E-Mail-Adresse
 *               password:
 *                 type: string
 *                 description: Passwort
 *     responses:
 *       200:
 *         description: Login erfolgreich
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
 *                   example: "Login erfolgreich"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *                           enum: [user, moderator, admin]
 *                     token:
 *                       type: string
 *                       description: JWT-Token für Authentifizierung
 *       400:
 *         description: Fehlende Parameter
 *       401:
 *         description: Ungültige Anmeldedaten
 *       500:
 *         description: Serverfehler
 */
router.post('/login', userController.login);

/**
 * @swagger
 * /v1/users/forgot-password:
 *   post:
 *     summary: Passwort vergessen
 *     description: Sendet einen Passwort-Reset-Token an die E-Mail-Adresse
 *     tags: [Benutzer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: E-Mail-Adresse des Benutzers
 *     responses:
 *       200:
 *         description: Reset-Token gesendet
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
 *                   example: "Passwort-Reset-E-Mail wurde gesendet"
 *       400:
 *         description: Fehlende E-Mail-Adresse
 *       500:
 *         description: Serverfehler
 */
router.post('/forgot-password', userController.forgotPassword);

/**
 * @swagger
 * /v1/users/validate-reset-token:
 *   post:
 *     summary: Reset-Token validieren
 *     description: Überprüft, ob ein Reset-Token gültig und nicht abgelaufen ist
 *     tags: [Benutzer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Zu validierender Reset-Token
 *     responses:
 *       200:
 *         description: Token ist gültig
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
 *                   example: "Token ist gültig"
 *                 data:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                       example: true
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *       400:
 *         description: Fehlender Token
 *       401:
 *         description: Ungültiger oder abgelaufener Token
 *       500:
 *         description: Serverfehler
 */
router.post('/validate-reset-token', userController.validateResetToken);

/**
 * @swagger
 * /v1/users/reset-password:
 *   post:
 *     summary: Passwort zurücksetzen
 *     description: Setzt das Passwort mit einem gültigen Reset-Token zurück
 *     tags: [Benutzer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *                 description: Gültiger Reset-Token
 *               newPassword:
 *                 type: string
 *                 description: Neues Passwort
 *     responses:
 *       200:
 *         description: Passwort erfolgreich zurückgesetzt
 *       400:
 *         description: Ungültiger oder abgelaufener Token
 *       500:
 *         description: Serverfehler
 */
router.post('/reset-password', userController.resetPassword);

/**
 * @swagger
 * /v1/users/profile:
 *   get:
 *     summary: Benutzerprofil abrufen
 *     description: Ruft das Profil des authentifizierten Benutzers ab
 *     tags: [Benutzer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil erfolgreich abgerufen
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *                         lastLogin:
 *                           type: string
 *                           format: date-time
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Nicht authentifiziert
 *       404:
 *         description: Benutzer nicht gefunden
 *       500:
 *         description: Serverfehler
 */
router.get('/profile', verifyToken, userController.getProfile);

/**
 * @swagger
 * /v1/users/profile:
 *   put:
 *     summary: Benutzerprofil aktualisieren
 *     description: Aktualisiert das Profil des authentifizierten Benutzers
 *     tags: [Benutzer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Neuer Name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Neue E-Mail-Adresse
 *               currentPassword:
 *                 type: string
 *                 description: Aktuelles Passwort (nur bei Passwort-Änderung erforderlich)
 *               newPassword:
 *                 type: string
 *                 description: Neues Passwort
 *     responses:
 *       200:
 *         description: Profil erfolgreich aktualisiert
 *       400:
 *         description: Fehlende Parameter oder falsches aktuelles Passwort
 *       401:
 *         description: Nicht authentifiziert
 *       404:
 *         description: Benutzer nicht gefunden
 *       500:
 *         description: Serverfehler
 */
router.put('/profile', verifyToken, userController.updateUser);

module.exports = router;
