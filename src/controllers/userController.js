const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const crypto = require('crypto');
const mailerService = require('../services/mailerService');

class UserController {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Benutzername und Passwort sind erforderlich'
        });
      }

      // Benutzer finden
      const user = await User.findOne({
        where: {
          [require('sequelize').Op.or]: [
            { username: username },
            { email: username }
          ],
          isActive: true
        }
      });
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Ungültige Anmeldedaten'
        });
      }

      // Passwort überprüfen
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Ungültige Anmeldedaten'
        });
      }

      // JWT Token erstellen
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Last login aktualisieren
      await user.update({ lastLogin: new Date() });

      res.json({
        success: true,
        message: 'Login erfolgreich',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role
          },
          token: token
        }
      });

    } catch (error) {
      console.error('Login-Fehler:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler beim Login'
      });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'E-Mail-Adresse ist erforderlich'
        });
      }

      // Benutzer finden
      const user = await User.findOne({
        where: { email: email, isActive: true }
      });

      if (!user) {
        // Aus Sicherheitsgründen geben wir keine Information darüber, ob der Benutzer existiert
        return res.json({
          success: true,
          message: 'Wenn die E-Mail-Adresse existiert, wurde eine E-Mail mit Anweisungen gesendet'
        });
      }

      // Reset-Token erstellen
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 Stunde gültig

      // Token in der Datenbank speichern (hier würdest du normalerweise eine separate Tabelle verwenden)
      // Für dieses Beispiel speichern wir es temporär im User-Modell
      await user.update({
        resetToken: resetToken,
        resetTokenExpiry: resetTokenExpiry
      });

      // E-Mail mit Passwort-Reset-Link senden
      try {
        await mailerService.sendPasswordResetEmail(email, user.name, resetToken);
        
        res.json({
          success: true,
          message: 'Passwort-Reset-E-Mail wurde erfolgreich gesendet'
        });
      } catch (emailError) {
        console.error('Fehler beim Senden der E-Mail:', emailError);
        
        // Token aus der Datenbank entfernen, da E-Mail fehlgeschlagen ist
        await user.update({
          resetToken: null,
          resetTokenExpiry: null
        });
        
        res.status(500).json({
          success: false,
          error: 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.'
        });
      }

    } catch (error) {
      console.error('Passwort vergessen Fehler:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler beim Passwort-Reset'
      });
    }
  }

  async validateResetToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token ist erforderlich'
        });
      }

      // Benutzer mit gültigem Reset-Token finden
      const user = await User.findOne({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            [require('sequelize').Op.gt]: new Date()
          },
          isActive: true
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Ungültiger oder abgelaufener Reset-Token'
        });
      }

      res.json({
        success: true,
        message: 'Token ist gültig',
        data: {
          isValid: true,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Token-Validierung Fehler:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler bei der Token-Validierung'
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Reset-Token und neues Passwort sind erforderlich'
        });
      }

      // Benutzer mit gültigem Reset-Token finden
      const user = await User.findOne({
        where: {
          resetToken: resetToken,
          resetTokenExpiry: {
            [require('sequelize').Op.gt]: new Date()
          },
          isActive: true
        }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Ungültiger oder abgelaufener Reset-Token'
        });
      }

      // Reset-Token löschen
      await user.update({
        password: newPassword,
        resetToken: null,
        resetTokenExpiry: null
      });

      // Bestätigungs-E-Mail senden
      try {
        await mailerService.sendPasswordChangedEmail(user.email, user.name);
      } catch (emailError) {
        console.error('Fehler beim Senden der Bestätigungs-E-Mail:', emailError);
          // E-Mail-Fehler soll den Erfolg nicht beeinträchtigen
      }

      res.json({
        success: true,
        message: 'Passwort wurde erfolgreich zurückgesetzt'
      });

    } catch (error) {
      console.error('Passwort-Reset Fehler:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler beim Passwort-Reset'
      });
    }
  }

  async updateUser(req, res) {
    try {
      const userId = req.user.id; // Aus JWT Token
      const { name, email, currentPassword, newPassword } = req.body;

      // Benutzer finden
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Benutzer nicht gefunden'
        });
      }

      // Update-Objekt erstellen
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;

      // Passwort-Änderung
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            error: 'Aktuelles Passwort ist erforderlich für Passwort-Änderung'
          });
        }

        // Aktuelles Passwort überprüfen
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            error: 'Aktuelles Passwort ist falsch'
          });
        }

        updateData.password = newPassword;
      }

      // Benutzer aktualisieren
      await user.update(updateData);

      res.json({
        success: true,
        message: 'Benutzer erfolgreich aktualisiert',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }
      });

    } catch (error) {
      console.error('User-Update Fehler:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler beim Benutzer-Update'
      });
    }
  }

  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'email', 'name', 'role', 'lastLogin', 'createdAt']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Benutzer nicht gefunden'
        });
      }

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      console.error('Profil-Abruf Fehler:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler beim Abrufen des Profils'
      });
    }
  }
}

module.exports = new UserController();
