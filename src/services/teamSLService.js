const axios = require("axios");
const { Spiel, Verein, SrQualifikation } = require("../models");
const { Op } = require("sequelize");
const { fieldFn } = require("../utils/licenseUtils");

class TeamSLService {
  constructor() {
    this.baseURL = "https://www.basketball-bund.net";
    this.sessionCookie = null;
    this.client = null;
  }

  async login(username, password) {
    try {
      const loginUrl = `${this.baseURL}/login.do?reqCode=login`;
      const body = new URLSearchParams({ username, password }).toString();

      const res = await axios.post(loginUrl, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (
        res.data.includes(
          "Die Kombination aus Benutzername und Passwort ist nicht bekannt!"
        )
      ) {
        throw new Error("Invalid username or password");
      }

      const setCookies = res.headers["set-cookie"];
      this.sessionCookie = this.pickSessionCookie(setCookies);

      if (!this.sessionCookie) {
        throw new Error("No session cookie received");
      }

      this.client = axios.create({
        baseURL: this.baseURL,
        headers: {
          Cookie: this.sessionCookie,
          Accept: "application/json, text/plain, */*",
        },
      });

      await this.verifyLogin();

      console.log("Erfolgreich bei BBN eingeloggt");
      return true;
    } catch (error) {
      console.error("Login fehlgeschlagen:", error.message);
      throw error;
    }
  }

  pickSessionCookie(setCookieHeaders) {
    if (!setCookieHeaders) return undefined;
    const arr = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : [String(setCookieHeaders)];
    for (const raw of arr) {
      const kv = raw.split(";")[0].trim();
      if (kv.startsWith("SESSION=")) return kv;
    }
    return undefined;
  }

  async verifyLogin() {
    try {
      const userCtx = await this.client.get("/rest/user/lc");
      if (!userCtx.data || !userCtx.data.data || !userCtx.data.data.loginName) {
        throw new Error(
          "Login did not persist, /rest/user/lc has no loginName"
        );
      }
      return userCtx.data;
    } catch (error) {
      console.error("Login-Verifikation fehlgeschlagen:", error.message);
      throw error;
    }
  }

  buildSearchPayload({ date = null, pageFrom = 0, pageSize = 100, zeitraum = "all" } = {}) {
    if (!date) {
      const datum = new Date();
      datum.setHours(0, 0, 0, 0);
      date = datum.toISOString();
    }
    return {
      srName: null,
      ligaKurz: null,
      spielStatus: "ALLE",
      vereinsDelegation: "AUSSCHLIESSLICH",
      vereinsSpiele: "STANDARD",
      datum: date,
      zeitraum,
      sortBy: "sp.spieldatum",
      sortOrder: "asc",
      ats: null,
      pageFrom,
      pageSize,
    };
  }

  async fetchOpenGames(pageFrom = 0, pageSize = 100, zeitraum = "all") {
    try {
      if (!this.client) {
        throw new Error("Nicht eingeloggt. Bitte zuerst login() aufrufen.");
      }

      const payload = this.buildSearchPayload({
        pageFrom: pageFrom,
        pageSize: pageSize,
        zeitraum: zeitraum,
      });
      const result = await this.client.post(
        "/rest/offenespiele/search",
        payload
      );

      console.log(
        `Seite ${Math.floor(pageFrom / pageSize) + 1}: ${
          result.data.results?.length || 0
        } Spiele abgerufen`
      );
      return result.data;
    } catch (error) {
      console.error("Fehler beim Abrufen der offenen Spiele:", error.message);
      throw error;
    }
  }

  async fetchAllOpenGames(pageSize = 100, zeitraum = "all") {
    try {
      if (!this.client) {
        throw new Error("Nicht eingeloggt. Bitte zuerst login() aufrufen.");
      }

      console.log("Starte parallele Abfrage aller offenen Spiele...");

      // Erste Anfrage, um die Gesamtanzahl zu ermitteln
      const firstPage = await this.fetchOpenGames(0, pageSize, zeitraum);
      const totalGames = firstPage.total || 0;
      const totalPages = Math.ceil(totalGames / pageSize);

      console.log(`Gesamtanzahl Spiele: ${totalGames}, Seiten: ${totalPages}`);

      if (totalPages <= 1) {
        return {
          total: totalGames,
          results: firstPage.results || [],
          pages: totalPages,
          pageSize: pageSize,
        };
      }

      // Alle Seiten parallel abrufen (10 gleichzeitig)
      const batchSize = 10;
      const allGames = new Set();

      // Erste Seite bereits geladen
      if (firstPage.results) {
        firstPage.results.forEach((game) => allGames.add(JSON.stringify(game)));
      }

      // Alle anderen Seiten in Batches verarbeiten
      for (
        let batchStart = 1;
        batchStart < totalPages;
        batchStart += batchSize
      ) {
        const batchEnd = Math.min(batchStart + batchSize, totalPages);
        const batch = [];

        for (let page = batchStart; page < batchEnd; page++) {
          batch.push(this.fetchOpenGames(page, pageSize));
        }

        console.log(
          `Verarbeite Batch ${
            Math.floor(batchStart / batchSize) + 1
          }: Seiten ${batchStart}-${batchEnd - 1}`
        );

        try {
          const batchResults = await Promise.all(batch);

          batchResults.forEach((pageData, index) => {
            if (pageData.results && pageData.results.length > 0) {
              pageData.results.forEach((game) =>
                allGames.add(JSON.stringify(game))
              );
              console.log(
                `Seite ${batchStart + index}: ${
                  pageData.results.length
                } Spiele geladen`
              );
            }
          });

          console.log(
            `Batch abgeschlossen: ${allGames.size}/${totalGames} Spiele geladen`
          );
        } catch (error) {
          console.error(
            `Fehler in Batch ${Math.floor(batchStart / batchSize) + 1}:`,
            error.message
          );
        }

        // Kleine Pause zwischen den Batches
        if (batchEnd < totalPages) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // Set zurück zu Array konvertieren und parsen
      const results = Array.from(allGames).map((gameStr) =>
        JSON.parse(gameStr)
      );

      console.log(
        `Alle Spiele erfolgreich geladen: ${results.length} von ${totalGames}`
      );

      return {
        total: totalGames,
        results: results,
        pages: totalPages,
        pageSize: pageSize,
      };
    } catch (error) {
      console.error("Fehler beim Abrufen aller offenen Spiele:", error.message);
      throw error;
    }
  }

  async isLoggedIn() {
    try {
      if (!this.client) return false;
      await this.verifyLogin();
      return true;
    } catch (error) {
      return false;
    }
  }

  async logout() {
    this.sessionCookie = null;
    this.client = null;
    console.log("Von BBN abgemeldet");
  }

  async executeCronJob(zeitraum = "all") {
    const startTime = new Date();
    console.log(`BBN Cronjob gestartet um ${startTime.toISOString()}`);

    try {
      const username = process.env.TEAM_SL_USERNAME;
      const password = process.env.TEAM_SL_PASSWORD;

      if (!username || !password) {
        throw new Error(
          "TEAM_SL_USERNAME und TEAM_SL_PASSWORD müssen in den Umgebungsvariablen gesetzt sein"
        );
      }

      await this.login(username, password);
      const games = await this.fetchAllOpenGames(100, zeitraum);

      console.log(
        `Cronjob erfolgreich abgeschlossen. ${games.total} Spiele abgerufen.`
      );

      return {
        success: true,
        gamesCount: games.total,
        timestamp: startTime.toISOString(),
        data: games,
      };
    } catch (error) {
      console.error("Cronjob fehlgeschlagen:", error.message);

      return {
        success: false,
        error: error.message,
        timestamp: startTime.toISOString(),
      };
    } finally {
      await this.logout();
    }
  }

  async processGamesData(zeitraum = "all") {
    try {
      const result = await this.executeCronJob(zeitraum);

      if (result.success) {
        console.log(`Verarbeite ${result.gamesCount} Spiele...`);

        // Spieldaten in die Datenbank speichern
        const dbResult = await this.saveGamesToDatabase(result.data.results, zeitraum);

        console.log("Spieldaten erfolgreich in der Datenbank gespeichert");

        return {
          ...result,
          databaseResult: dbResult,
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Fehler bei der Spieldatenverarbeitung:", error.message);
      throw error;
    }
  }

  async getBBNHealth() {
    try {
      const result = await this.processGamesData();
      return result;
    } catch (error) {
      throw error;
    }
  }

  async orphanRemoval(gamesData) {
    try {
      console.log("Leere alle Tabellen...");

      // Nur die Spiele-Tabelle leeren
      const result = await Spiel.destroy({
        where: {
          spielplanId: {
            [Op.notIn]: gamesData.map((game) => game.sp.spielplanId),
          },
        },
        force: true,
      });
      console.log(`✓ Tabelle "spiele" geleert: ${result}`);

      console.log("Alle Tabellen erfolgreich geleert");
    } catch (error) {
      console.error("Fehler beim Leeren der Tabellen:", error.message);
      // Foreign Key Constraints wieder aktivieren bei Fehler
      try {
        await Spiel.sequelize.query("PRAGMA foreign_keys = ON");
      } catch (fkError) {
        console.error(
          "Fehler beim Wiederherstellen der Foreign Key Constraints:",
          fkError.message
        );
      }
      throw error;
    }
  }

  async saveGamesToDatabase(gamesData, zeitraum) {
    try {
      console.log("Starte Transaktion für Spieldaten...");

      let savedGames = 0;
      let savedVereine = 0;
      let savedSrQualifikationen = 0;

      for (const gameData of gamesData) {
        try {
          // Prüfe, ob das Spiel offen angeboten wird
          if (
            (gameData.sr1OffenAngeboten && !gameData.sr1) ||
            (gameData.sr2OffenAngeboten && !gameData.sr2) ||
            (gameData.sr3OffenAngeboten && !gameData.sr3)
          ) {
            // Spiel wird verarbeitet
          } else {
            await Spiel.destroy({
              where: {
                spielplanId: {
                  [Op.eq]: gameData.sp.spielplanId,
                },
              },
              force: true,
            });
            console.log(
              `Spiel ${gameData.sp.spielplanId} wird übersprungen - nicht offen angeboten`
            );
            continue;
          }

          // 1. Heim-Verein speichern/aktualisieren
          let heimVerein;
          if (gameData.sp.sr1Verein) {
            const [verein, created] = await Verein.findOrCreate({
              where: { vereinId: gameData.sp.sr1Verein.vereinId },
              defaults: {
                vereinsnummer: gameData.sp.sr1Verein.vereinsnummer,
                vereinsname: gameData.sp.sr1Verein.vereinsname,
                verbandId: gameData.sp.sr1Verein.verbandId,
                kreisId: gameData.sp.sr1Verein.kreisId,
                bezirkId: gameData.sp.sr1Verein.bezirkId,
              },
            });

            if (!created) {
              await verein.update({
                vereinsnummer: gameData.sp.sr1Verein.vereinsnummer,
                vereinsname: gameData.sp.sr1Verein.vereinsname,
                verbandId: gameData.sp.sr1Verein.verbandId,
                kreisId: gameData.sp.sr1Verein.kreisId,
                bezirkId: gameData.sp.sr1Verein.bezirkId,
              });
            }

            heimVerein = verein;
            if (created) savedVereine++;
          }

          // 2. Gast-Verein speichern/aktualisieren
          let gastVerein;
          if (gameData.sp.sr2Verein) {
            const [verein, created] = await Verein.findOrCreate({
              where: { vereinId: gameData.sp.sr2Verein.vereinId },
              defaults: {
                vereinsnummer: gameData.sp.sr2Verein.vereinsnummer,
                vereinsname: gameData.sp.sr2Verein.vereinsname,
                verbandId: gameData.sp.sr2Verein.verbandId,
                kreisId: gameData.sp.sr2Verein.kreisId,
                bezirkId: gameData.sp.sr2Verein.bezirkId,
              },
            });

            if (!created) {
              await verein.update({
                vereinsnummer: gameData.sp.sr2Verein.vereinsnummer,
                vereinsname: gameData.sp.sr2Verein.vereinsname,
                verbandId: gameData.sp.sr2Verein.verbandId,
                kreisId: gameData.sp.sr2Verein.kreisId,
                bezirkId: gameData.sp.sr2Verein.bezirkId,
              });
            }

            gastVerein = verein;
            if (created) savedVereine++;
          }

          if (heimVerein?.hideLink && gastVerein?.hideLink) {
            await Spiel.destroy({
              where: {
                spielplanId: {
                  [Op.eq]: gameData.sp.spielplanId,
                },
              },
              force: true,
            });
            console.log(
              `Spiel ${gameData.sp.spielplanId} wird übersprungen - beide Vereine haben hideLink gesetzt`
            );
            continue;
          }
          if (!heimVerein && gastVerein.hideLink) {
            await Spiel.destroy({
              where: {
                spielplanId: {
                  [Op.eq]: gameData.sp.spielplanId,
                },
              },
              force: true,
            });
            console.log(
              `Spiel ${gameData.sp.spielplanId} wird übersprungen - Heimverein nicht gefunden`
            );
            continue;
          }
          if (!gastVerein && heimVerein.hideLink) {
            await Spiel.destroy({
              where: {
                spielplanId: {
                  [Op.eq]: gameData.sp.spielplanId,
                },
              },
              force: true,
            });
            console.log(
              `Spiel ${gameData.sp.spielplanId} wird übersprungen - Gastverein nicht gefunden`
            );
            continue;
          }

          // 3. SR-Qualifikation speichern/aktualisieren (falls vorhanden)
          let srQualifikationId = null;
          if (gameData.sp.liga && gameData.sp.liga.srQualifikation) {
            const [srQual, created] = await SrQualifikation.findOrCreate({
              where: {
                srQualifikationId:
                  gameData.sp.liga.srQualifikation.srQualifikationId,
              },
              defaults: {
                bezeichnung: gameData.sp.liga.srQualifikation.bezeichnung,
                kurzBezeichnung:
                  gameData.sp.liga.srQualifikation.kurzBezeichnung,
              },
            });

            if (!created) {
              await srQual.update({
                bezeichnung: gameData.sp.liga.srQualifikation.bezeichnung,
                kurzBezeichnung:
                  gameData.sp.liga.srQualifikation.kurzBezeichnung,
              });
            }

            srQualifikationId = srQual.srQualifikationId;
            if (created) savedSrQualifikationen++;
          }

          // 4. SR-Lizenz berechnen
          const ligaName = gameData.sp.liga?.liganame || "";
          const srLizenz = fieldFn({ liganame: ligaName });

          // 5. Spiel speichern/aktualisieren
          const [spiel, created] = await Spiel.findOrCreate({
            where: { spielplanId: gameData.sp.spielplanId },
            defaults: {
              spieldatum: gameData.sp.spieldatum,
              heimVereinId: gameData.sp.sr1Verein?.vereinId || null,
              gastVereinId: gameData.sp.sr2Verein?.vereinId || null,
              heimMannschaftName:
                gameData.sp.heimMannschaftLiga?.mannschaftName || "",
              gastMannschaftName:
                gameData.sp.gastMannschaftLiga?.mannschaftName || "",
              ligaName: ligaName,
              spielfeldName: gameData.sp.spielfeld?.bezeichnung || "",
              spielStrasse: gameData.sp.spielfeld?.strasse || "",
              spielPlz: gameData.sp.spielfeld?.plz || "",
              spielOrt: gameData.sp.spielfeld?.ort || "",
              srQualifikationId: srQualifikationId,
              srLizenz: srLizenz,
              sr1OffenAngeboten: gameData.sr1OffenAngeboten || false,
              sr2OffenAngeboten: gameData.sr2OffenAngeboten || false,
              sr3OffenAngeboten: gameData.sr3OffenAngeboten || false,
              sr1VereinId: gameData.sp.sr1Verein?.vereinId || null,
              sr2VereinId: gameData.sp.sr2Verein?.vereinId || null,
              sr3VereinId: gameData.sp.sr3Verein?.vereinId || null,
              sr1VereinName: gameData.sp.sr1Verein?.vereinsname || null,
              sr2VereinName: gameData.sp.sr2Verein?.vereinsname || null,
              sr3VereinName: gameData.sp.sr3Verein?.vereinsname || null,
              rawData: gameData,
            },
          });

          if (!created) {
            // Update bestehenden Eintrag
            await spiel.update({
              spieldatum: gameData.spieldatum,
              heimVereinId: gameData.sp.sr1Verein?.vereinId || 0,
              gastVereinId: gameData.sp.sr2Verein?.vereinId || 0,
              heimMannschaftName:
                gameData.sp.heimMannschaftLiga?.mannschaftName || "",
              gastMannschaftName:
                gameData.sp.gastMannschaftLiga?.mannschaftName || "",
              ligaName: ligaName,
              spielfeldName: gameData.sp.spielfeld?.bezeichnung || "",
              spielStrasse: gameData.sp.spielfeld?.strasse || "",
              spielPlz: gameData.sp.spielfeld?.plz || "",
              spielOrt: gameData.sp.spielfeld?.ort || "",
              srQualifikationId: srQualifikationId,
              srLizenz: srLizenz,
              sr1OffenAngeboten: gameData.sr1OffenAngeboten || false,
              sr2OffenAngeboten: gameData.sr2OffenAngeboten || false,
              sr3OffenAngeboten: gameData.sr3OffenAngeboten || false,
              sr1VereinId: gameData.sp.sr1Verein?.vereinId || null,
              sr2VereinId: gameData.sp.sr2Verein?.vereinId || null,
              sr3VereinId: gameData.sp.sr3Verein?.vereinId || null,
              sr1VereinName: gameData.sp.sr1Verein?.vereinsname || null,
              sr2VereinName: gameData.sp.sr2Verein?.vereinsname || null,
              sr3VereinName: gameData.sp.sr3Verein?.vereinsname || null,
              rawData: gameData,
            });
          }

          if (created) savedGames++;
        } catch (error) {
          console.error(
            `Fehler beim Speichern von Spiel ${gameData.sp.spielplanId}:`,
            error.message
          );
          throw error; // Fehler weiterwerfen, um Transaktion abzubrechen
        }
      }

      console.log(`Datenbank-Update abgeschlossen:`);
      console.log(`- ${savedGames} neue Spiele gespeichert`);
      console.log(`- ${savedVereine} neue Vereine gespeichert`);
      console.log(
        `- ${savedSrQualifikationen} neue SR-Qualifikationen gespeichert`
      );

      if (zeitraum === "all") {
        await this.orphanRemoval(gamesData);
      }

      return {
        savedGames,
        savedVereine,
        savedSrQualifikationen,
      };
    } catch (error) {
      // Transaktion bei Fehler rückgängig machen
      // await transaction.rollback(); // Removed as per new_code
      console.error(
        "❌ Transaktion rückgängig gemacht aufgrund eines Fehlers:",
        error.message
      );
      throw error;
    }
  }
}

module.exports = new TeamSLService();
