const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class MailerService {
  constructor() {
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    // Konfiguriere den Transporter basierend auf Umgebungsvariablen
    if (!process.env.UNIX_SENDMAIL) {
      // SMTP-Konfiguration
      return nodemailer.createTransport({
        host: process.env.MAILER_HOST,
        port: process.env.MAILER_PORT,
        secure: process.env.MAILER_SECURE === 'true',
        auth: {
          user: process.env.MAILER_USER,
          pass: process.env.MAILER_PASS
        }
      });
    } else {
      // Fallback auf sendmail (wie in mailer-old.js)
      return nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail'
      });
    }
  }

  async sendMail(to, subject, html, replyTo = null) {
    try {
      const mailOptions = {
        from: process.env.MAILER_USER || 'noreply@srbasar.de',
        to: to,
        subject: subject,
        html: html,
        replyTo: replyTo || process.env.MAILER_REPLY_TO || 'noreply@srbasar.de'
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ E-Mail erfolgreich gesendet:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Fehler beim Senden der E-Mail:', error);
      throw error;
    }
  }

  async generateEmailHTML(name = null, beforeButton = null, button = false, afterButton = null, buttonLink = null, buttonText = null) {
    try {
      // Lade das base.hbs Template
      const templatePath = path.join(__dirname, '../templates/email/base.hbs');
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      // Kompiliere das Template
      const template = handlebars.compile(templateContent);
      
      // Erstelle die Template-Daten
      const templateData = {
        name: name,
        beforeButton: beforeButton,
        button: button,
        afterButton: afterButton,
        buttonLink: buttonLink,
        buttonText: buttonText,
        frontendUrl: process.env.FRONTEND_URL || 'https://srbasar.de'
      };
      
      // Rendere das Template
      return template(templateData);
    } catch (error) {
      console.error('❌ Fehler beim Laden des E-Mail-Templates:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(to, name, resetToken) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Passwort zurücksetzen - srBasar';
    const html = await this.generateEmailHTML(
      name,
      'Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.',
      true,
      'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Der Link ist 1 Stunde gültig.',
      resetLink,
      'Passwort zurücksetzen'
    );
    return this.sendMail(to, subject, html);
  }

  async sendPasswordChangedEmail(to, name) {
    const subject = 'Passwort geändert - srBasar';
    const html = await this.generateEmailHTML(
      name,
      'Ihr Passwort wurde erfolgreich geändert.',
      false,
      'Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie uns bitte umgehend.',
      null,
      null
    );
    return this.sendMail(to, subject, html);
  }

  async sendWelcomeEmail({ email, username, resetToken, tempPassword }) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Willkommen bei srBasar - Passwort setzen';
    
    const beforeButton = `
      <p>Hallo ${username},</p>
      <p>Ihr Account für srBasar wurde erfolgreich erstellt!</p>
      <p><strong>Ihre Zugangsdaten:</strong></p>
      <ul>
        <li>Benutzername: <strong>${username}</strong></li>
        <li>E-Mail: <strong>${email}</strong></li>
        <li>Temporäres Passwort: <strong>${tempPassword}</strong></li>
      </ul>
      <p>Aus Sicherheitsgründen müssen Sie Ihr Passwort beim ersten Login ändern. Klicken Sie auf den Button unten, um ein neues Passwort zu setzen:</p>
    `;
    
    const afterButton = `
      <p>Alternativ können Sie sich mit Ihrem temporären Passwort anmelden und werden automatisch zur Passwort-Änderung weitergeleitet.</p>
      <p>Der Reset-Link ist 24 Stunden gültig.</p>
      <p>Bei Fragen wenden Sie sich gerne an das Support-Team.</p>
    `;
    
    const html = await this.generateEmailHTML(
      username,
      beforeButton,
      true,
      afterButton,
      resetLink,
      'Passwort setzen'
    );
    
    return this.sendMail(email, subject, html);
  }

}

module.exports = new MailerService();