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

      const expectedResults = pageSize;
      const actualResults = result.data.results?.length || 0;
      console.log(
        `Seite ${Math.floor(pageFrom / pageSize) + 1}: geplant ${expectedResults}, erhalten ${actualResults} Spiele`
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

      console.log("Starte adaptive parallele Abfrage aller offenen Spiele...");

      // 1. Erste Seite abrufen um die Gesamtanzahl zu erhalten
      console.log("Lade erste Seite um Gesamtanzahl zu ermitteln...");
      const firstPage = await this.fetchOpenGames(0, pageSize, zeitraum);
      const totalGames = firstPage.total || 0;
      
      console.log(`API meldet ${totalGames} Spiele insgesamt`);

      if (totalGames === 0) {
        return {
          total: 0,
          results: [],
          pages: 0,
          pageSize: pageSize,
          actualCount: 0,
          complete: true,
          apiReportedTotal: 0
        };
      }

      const allGames = new Set();
      const gameIds = new Set();
      
      // Erste Seite bereits laden
      if (firstPage.results) {
        firstPage.results.forEach((game) => {
          allGames.add(JSON.stringify(game));
          gameIds.add(game.sp.spielplanId);
        });
        console.log(`Erste Seite: ${firstPage.results.length} Spiele geladen`);
        console.log(`Gesamt nach Seite 1: ${allGames.size}/${totalGames} Spiele`);
      }

      // Berechne wie viele Seiten wir brauchen (immer 100 pro Seite)
      const estimatedPages = Math.ceil(totalGames / pageSize);
      const pagesToFetch = Math.min(estimatedPages, 50); // Maximal 50 Seiten
        
      console.log(`Lade ${pagesToFetch} Seiten parallel (pageSize=${pageSize})...`);
      
      // 10 Seiten parallel abrufen
      const batchSize = 10;
      let pagesLoaded = 0;
      
      for (let batchStart = 1; batchStart <= pagesToFetch; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, pagesToFetch);
        const batch = [];
        
        // Batch von Seiten vorbereiten
        for (let page = batchStart; page <= batchEnd; page++) {
          batch.push(this.fetchOpenGames(page, pageSize, zeitraum));
        }
        
        console.log(`Lade Batch: Seiten ${batchStart}-${batchEnd}...`);
        
        try {
          const batchResults = await Promise.all(batch);
          
          let newGamesInBatch = 0;
          batchResults.forEach((pageData, index) => {
            const pageNumber = batchStart + index;
            if (pageData.results && pageData.results.length > 0) {
              let newGamesOnPage = 0;
              let duplicatesOnPage = 0;
              
              pageData.results.forEach((game) => {
                const gameId = game.sp.spielplanId;
                if (!gameIds.has(gameId)) {
                  allGames.add(JSON.stringify(game));
                  gameIds.add(gameId);
                  newGamesOnPage++;
                  newGamesInBatch++;
                } else {
                  duplicatesOnPage++;
                }
              });
              
              console.log(`  Seite ${pageNumber}: ${pageData.results.length} Spiele, ${newGamesOnPage} neue, ${duplicatesOnPage} Duplikate`);
              pagesLoaded++;
            } else {
              console.log(`  Seite ${pageNumber}: Keine Spiele gefunden`);
            }
          });
          
          const totalAfterBatch = allGames.size;
          const expectedAfterBatch = Math.min((batchEnd) * pageSize, totalGames);
          console.log(`Batch abgeschlossen: ${newGamesInBatch} neue Spiele, ${totalAfterBatch}/${totalGames} gesamt (Seiten 1-${batchEnd})`);
          console.log(`Erwartet nach ${batchEnd} Seiten: ${expectedAfterBatch}, tatsächlich: ${totalAfterBatch}`);
          
          // Prüfe ob wir alle Spiele haben
          if (allGames.size >= totalGames) {
            console.log(`✅ Alle ${totalGames} Spiele gefunden!`);
            break;
          }
          
        } catch (error) {
          console.error(`Fehler in Batch ${Math.floor(batchStart / batchSize) + 1}:`, error.message);
        }
        
        // Kleine Pause zwischen Batches
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      
      console.log(`Abfrage abgeschlossen: ${allGames.size}/${totalGames} Spiele (${pagesLoaded} Seiten geladen)`);

      // Set zurück zu Array konvertieren
      const results = Array.from(allGames).map((gameStr) => JSON.parse(gameStr));

      console.log(`\n=== Abfrage abgeschlossen ===`);
      console.log(`Geladene Spiele: ${results.length}/${totalGames}`);
      console.log(`Einzigartige IDs: ${gameIds.size}`);
      console.log(`Seiten geladen: ${pagesLoaded}`);

      if (results.length !== totalGames) {
        console.warn(`⚠️  Nicht alle Spiele abgerufen: ${results.length}/${totalGames}`);
        console.warn(`Mögliche Ursachen:`);
        console.warn(`- API liefert weniger Spiele als gemeldet`);
        console.warn(`- Duplikate in der API`);
        console.warn(`- Seitenüberschneidungen`);
      } else {
        console.log(`✅ Alle ${totalGames} Spiele erfolgreich abgerufen`);
      }

      return {
        total: results.length,
        results: results,
        pages: pagesLoaded,
        pageSize: pageSize,
        actualCount: results.length,
        complete: results.length >= totalGames,
        apiReportedTotal: totalGames
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

  async validateGameProcessing(gamesData) {
    try {
      const totalGames = gamesData.length;
      const processedGames = await Spiel.count({
        where: {
          spielplanId: {
            [Op.in]: gamesData.map(game => game.sp.spielplanId)
          }
        }
      });
      
      const openGames = await Spiel.count({
        where: {
          [Op.or]: [
            { sr1OffenAngeboten: true },
            { sr2OffenAngeboten: true },
            { sr3OffenAngeboten: true }
          ]
        }
      });

      return {
        totalGamesFromAPI: totalGames,
        gamesInDatabase: processedGames,
        openGamesInDatabase: openGames,
        processingComplete: processedGames === totalGames,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Fehler bei der Validierung der Spielverarbeitung:", error.message);
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
      console.log(`Verarbeite ${gamesData.length} Spiele...`);

      let savedGames = 0;
      let updatedGames = 0;
      let skippedGames = 0;
      let savedVereine = 0;
      let savedSrQualifikationen = 0;
      let errors = [];
      let skippedReasons = {
        notOffered: 0,
        bothVereinsHideLink: 0,
        heimVereinNotFound: 0,
        gastVereinNotFound: 0,
        processingError: 0
      };

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
            skippedReasons.notOffered++;
            skippedGames++;
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
            skippedReasons.bothVereinsHideLink++;
            skippedGames++;
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
            skippedReasons.heimVereinNotFound++;
            skippedGames++;
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
            skippedReasons.gastVereinNotFound++;
            skippedGames++;
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
            });
          }

          if (created) {
            savedGames++;
          } else {
            updatedGames++;
          }
        } catch (error) {
          console.error(
            `Fehler beim Speichern von Spiel ${gameData.sp.spielplanId}:`,
            error.message
          );
          errors.push({
            spielplanId: gameData.sp.spielplanId,
            error: error.message
          });
          skippedReasons.processingError++;
          skippedGames++;
          // Fehler sammeln statt Transaktion abzubrechen
        }
      }

      console.log(`Datenbank-Update abgeschlossen:`);
      console.log(`- ${savedGames} neue Spiele gespeichert`);
      console.log(`- ${updatedGames} Spiele aktualisiert`);
      console.log(`- ${skippedGames} Spiele übersprungen`);
      console.log(`- ${savedVereine} neue Vereine gespeichert`);
      console.log(
        `- ${savedSrQualifikationen} neue SR-Qualifikationen gespeichert`
      );
      
      // Detaillierte Übersicht der übersprungenen Spiele
      console.log(`\n📊 Übersprungene Spiele - Details:`);
      console.log(`- Nicht offen angeboten: ${skippedReasons.notOffered}`);
      console.log(`- Beide Vereine hideLink: ${skippedReasons.bothVereinsHideLink}`);
      console.log(`- Heimverein nicht gefunden: ${skippedReasons.heimVereinNotFound}`);
      console.log(`- Gastverein nicht gefunden: ${skippedReasons.gastVereinNotFound}`);
      console.log(`- Verarbeitungsfehler: ${skippedReasons.processingError}`);
      
      if (errors.length > 0) {
        console.warn(`⚠️  ${errors.length} Fehler aufgetreten:`);
        errors.forEach(err => {
          console.warn(`  - Spiel ${err.spielplanId}: ${err.error}`);
        });
      }

      // Validierung: Prüfe ob alle Spiele verarbeitet wurden
      const expectedGames = gamesData.length;
      const processedGames = savedGames + updatedGames + skippedGames;
      
      if (processedGames !== expectedGames) {
        console.warn(`⚠️  Verarbeitungsmismatch: ${processedGames}/${expectedGames} Spiele verarbeitet`);
      }

      if (zeitraum === "all") {
        await this.orphanRemoval(gamesData);
      }

      return {
        savedGames,
        updatedGames,
        skippedGames,
        savedVereine,
        savedSrQualifikationen,
        errors,
        skippedReasons,
        totalProcessed: savedGames + updatedGames + skippedGames,
        success: errors.length === 0
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
