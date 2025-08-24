const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SR-Basar Backend API',
      version: '1.0.0',
      description: 'Backend-API für das Srbasar-System zur Verwaltung von Basketball-Spielen und Schiedsrichtern',
      contact: {
        name: 'Srbasar Team',
        email: 'info@srbasar.de'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Entwicklungsserver'
      },
      {
        url: 'https://api.srbasar.de',
        description: 'Produktionsserver'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT-Token für Authentifizierung'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Eindeutige ID des Benutzers'
            },
            username: {
              type: 'string',
              description: 'Benutzername'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'E-Mail-Adresse'
            },
            name: {
              type: 'string',
              description: 'Vollständiger Name'
            },
            role: {
              type: 'string',
              enum: ['user', 'moderator', 'admin'],
              description: 'Benutzerrolle'
            },
            isActive: {
              type: 'boolean',
              description: 'Benutzer ist aktiv'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Letzter Login'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Erstellungsdatum'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Letztes Update'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Benutzername oder E-Mail-Adresse'
            },
            password: {
              type: 'string',
              description: 'Passwort'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Login erfolgreich'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                token: {
                  type: 'string',
                  description: 'JWT-Token für Authentifizierung'
                }
              }
            }
          }
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'E-Mail-Adresse des Benutzers'
            }
          }
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['resetToken', 'newPassword'],
          properties: {
            resetToken: {
              type: 'string',
              description: 'Gültiger Reset-Token'
            },
            newPassword: {
              type: 'string',
              description: 'Neues Passwort'
            }
          }
        },
        ProfileUpdateRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Neuer Name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Neue E-Mail-Adresse'
            },
            currentPassword: {
              type: 'string',
              description: 'Aktuelles Passwort (nur bei Passwort-Änderung erforderlich)'
            },
            newPassword: {
              type: 'string',
              description: 'Neues Passwort'
            }
          }
        },
        Spiel: {
          type: 'object',
          properties: {
            spielplanId: {
              type: 'integer',
              description: 'Eindeutige ID des Spiels'
            },
            spieldatum: {
              type: 'integer',
              description: 'Spieldatum als Unix-Timestamp'
            },
            spieldatumFormatiert: {
              type: 'string',
              description: 'Formatiertes Spieldatum in deutscher Lokalisierung'
            },
            heimVereinId: {
              type: 'integer',
              description: 'ID des Heimvereins'
            },
            gastVereinId: {
              type: 'integer',
              description: 'ID des Gastvereins'
            },
            heimMannschaftName: {
              type: 'string',
              description: 'Name der Heimmannschaft'
            },
            gastMannschaftName: {
              type: 'string',
              description: 'Name der Gastmannschaft'
            },
            ligaName: {
              type: 'string',
              description: 'Name der Liga'
            },
            spielfeldName: {
              type: 'string',
              description: 'Name des Spielfelds'
            },
            spielStrasse: {
              type: 'string',
              description: 'Straße des Spielorts'
            },
            spielPlz: {
              type: 'string',
              description: 'PLZ des Spielorts'
            },
            spielOrt: {
              type: 'string',
              description: 'Ort des Spiels'
            },
            sr1OffenAngeboten: {
              type: 'boolean',
              description: 'SR1-Position offen angeboten'
            },
            sr2OffenAngeboten: {
              type: 'boolean',
              description: 'SR2-Position offen angeboten'
            },
            sr3OffenAngeboten: {
              type: 'boolean',
              description: 'SR3-Position offen angeboten'
            },
            heimVerein: {
              $ref: '#/components/schemas/Verein'
            },
            gastVerein: {
              $ref: '#/components/schemas/Verein'
            },
            srQualifikation: {
              $ref: '#/components/schemas/SrQualifikation'
            }
          }
        },
        Verein: {
          type: 'object',
          properties: {
            vereinId: {
              type: 'integer',
              description: 'Eindeutige ID des Vereins'
            },
            vereinsnummer: {
              type: 'integer',
              description: 'Vereinsnummer'
            },
            vereinsname: {
              type: 'string',
              description: 'Name des Vereins'
            },
            inaktiv: {
              type: 'boolean',
              description: 'Verein ist inaktiv'
            },
            hideLink: {
              type: 'boolean',
              description: 'Verein soll nicht angezeigt werden'
            }
          }
        },
        SrQualifikation: {
          type: 'object',
          properties: {
            srQualifikationId: {
              type: 'integer',
              description: 'Eindeutige ID der SR-Qualifikation'
            },
            bezeichnung: {
              type: 'string',
              description: 'Vollständige Bezeichnung der Qualifikation'
            },
            kurzBezeichnung: {
              type: 'string',
              description: 'Kurze Bezeichnung der Qualifikation'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              description: 'Aktuelle Seitennummer'
            },
            pageSize: {
              type: 'integer',
              description: 'Anzahl der Einträge pro Seite'
            },
            itemsPerPage: {
              type: 'integer',
              description: 'Anzahl der Einträge pro Seite'
            },
            totalItems: {
              type: 'integer',
              description: 'Gesamtanzahl der Einträge'
            },
            totalPages: {
              type: 'integer',
              description: 'Gesamtanzahl der Seiten'
            },
            hasNextPage: {
              type: 'boolean',
              description: 'Gibt es eine nächste Seite?'
            },
            hasPrevPage: {
              type: 'boolean',
              description: 'Gibt es eine vorherige Seite?'
            },
            nextPage: {
              type: 'integer',
              nullable: true,
              description: 'Nächste Seitennummer (null wenn keine)'
            },
            prevPage: {
              type: 'integer',
              nullable: true,
              description: 'Vorherige Seitennummer (null wenn keine)'
            }
          }
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              description: 'Gesundheitsstatus'
            },
            message: {
              type: 'string',
              description: 'Statusmeldung'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Zeitstempel der Überprüfung'
            }
          }
        },
        SystemInfo: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success'
            },
            data: {
              type: 'object',
              description: 'Systeminformationen'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Fehlermeldung'
            },
            details: {
              type: 'string',
              description: 'Detaillierte Fehlerinformationen'
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
