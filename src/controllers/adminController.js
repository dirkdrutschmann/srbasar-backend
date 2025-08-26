const { User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mailerService = require('../services/mailerService');

class AdminController {
  
  async getAllUsers(req, res) {
    try {
      const users = await User.findAll({
        attributes: ['id', 'username', 'email', 'name', 'role', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Fehler beim Abrufen der Benutzer:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Abrufen der Benutzer'
      });
    }
  }

  async createUser(req, res) {
    try {
      const { username, email, name, role = 'user' } = req.body;

      // Validierung
      if (!username || !email || !name) {
        return res.status(400).json({
          success: false,
          message: 'Username, E-Mail und Name sind erforderlich'
        });
      }

      // Prüfen ob Benutzer bereits existiert
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { username: username },
            { email: email }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Benutzer mit diesem Username oder E-Mail existiert bereits'
        });
      }

      // Dummy-Passwort generieren (wird nicht verwendet, da Benutzer Passwort über Reset-Link setzt)
      const dummyPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(dummyPassword, 10);

      // Reset-Token generieren
      const resetToken = crypto.randomBytes(20).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

      // Benutzer erstellen
      const newUser = await User.create({
        username,
        email,
        name,
        password: hashedPassword,
        role,
        resetToken: resetToken,
        resetTokenExpiry: resetTokenExpiry,
        mustChangePassword: true
      });

      // E-Mail senden
      try {
        await mailerService.sendWelcomeEmail({
          email: email,
          username: username,
          resetToken: resetToken
        });
      } catch (emailError) {
        console.error('Fehler beim Senden der Willkommens-E-Mail:', emailError);
        // Benutzer wurde erstellt, aber E-Mail konnte nicht gesendet werden
      }

      res.status(201).json({
        success: true,
        message: 'Benutzer erfolgreich erstellt und Willkommens-E-Mail gesendet',
        data: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        }
      });
    } catch (error) {
      console.error('Fehler beim Erstellen des Benutzers:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Erstellen des Benutzers'
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const currentUserId = req.userId;

      // Prüfen ob Benutzer versucht sich selbst zu löschen
      if (parseInt(id) === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Sie können sich nicht selbst löschen'
        });
      }

      // Benutzer finden
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Benutzer nicht gefunden'
        });
      }

      // Benutzer löschen
      await user.destroy();

      res.status(200).json({
        success: true,
        message: 'Benutzer erfolgreich gelöscht'
      });
    } catch (error) {
      console.error('Fehler beim Löschen des Benutzers:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Löschen des Benutzers'
      });
    }
  }

  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const currentUserId = req.userId;

      // Validierung
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Ungültige Rolle. Erlaubt sind: user, admin'
        });
      }

      // Prüfen ob Benutzer versucht seine eigene Rolle zu ändern
      if (parseInt(id) === currentUserId) {
        return res.status(400).json({
          success: false,
          message: 'Sie können Ihre eigene Rolle nicht ändern'
        });
      }

      // Benutzer finden und aktualisieren
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Benutzer nicht gefunden'
        });
      }

      await user.update({ role });

      res.status(200).json({
        success: true,
        message: 'Benutzerrolle erfolgreich aktualisiert',
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Benutzerrolle:', error);
      res.status(500).json({
        success: false,
        message: 'Fehler beim Aktualisieren der Benutzerrolle'
      });
    }
  }
}

module.exports = new AdminController();
