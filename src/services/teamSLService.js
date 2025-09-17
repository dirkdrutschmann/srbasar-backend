const axios = require("axios");
const { Spiel, Verein, SrQualifikation } = require("../models");
const { Op } = require("sequelize");
const { fieldFn } = require("../utils/licenseUtils");
const path = require('path');

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
      console.log("Starte neue Abfrage-Strategie mit matchId-basierter Methode...");

      // 1. Alle Ligen abrufen (alte Methode)
      console.log("Lade alle Ligen...");
      const ligen = await this.fetchAllLigen();
      console.log(`${ligen.length} Ligen gefunden`);

      // 2. Alle Matches aus allen Ligen abrufen und nach zeitraum filtern
      console.log(`Lade alle Matches aus allen Ligen und filtere nach zeitraum: ${zeitraum}...`);
      const allMatches = [];
      
      for (const liga of ligen) {
        try {
          console.log(`Lade Matches für Liga ${liga.ligaId}: ${liga.liganame}`);
          const matches = await this.fetchMatchesForLiga(liga);
          
          // Filtere Matches nach zeitraum basierend auf kickoffDate
          const filteredMatches = this.filterMatchesByZeitraum(matches, zeitraum);
          allMatches.push(...filteredMatches);
          
          console.log(`  ${matches.length} Matches gefunden, ${filteredMatches.length} nach Zeitraum-Filter`);
        } catch (error) {
          console.error(`Fehler beim Laden der Matches für Liga ${liga.ligaId}:`, error.message);
        }
      }

      console.log(`Gesamt ${allMatches.length} Matches gefunden`);

      // 3. Mit neuem TeamSL Service einloggen
      console.log("Logge mit neuem TeamSL Service ein...");
      const username = process.env.TEAM_SL_USERNAME;
      const password = process.env.TEAM_SL_PASSWORD;

      if (!username || !password) {
        throw new Error("TEAM_SL_USERNAME und TEAM_SL_PASSWORD müssen in den Umgebungsvariablen gesetzt sein");
      }

      await this.login(username, password);
      console.log("Erfolgreich mit neuem TeamSL Service eingeloggt");

      // 4. Für jede matchId detaillierte Daten abrufen (in Batches)
      const BATCH_SIZE = 100; // Konfigurierbare Batch-Größe
      const PAUSE_PER_REQUEST = 1; // Wartezeit pro Request in ms
      console.log(`Lade detaillierte Daten für ${allMatches.length} Matches in Batches von ${BATCH_SIZE}...`);
      const detailedGames = [];
      const duplicateGames = new Map();

      const batchSize = BATCH_SIZE;
      const totalBatches = Math.ceil(allMatches.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, allMatches.length);
        const batch = allMatches.slice(batchStart, batchEnd);

        console.log(`Verarbeite Batch ${batchIndex + 1}/${totalBatches}: Matches ${batchStart + 1}-${batchEnd}`);

        // Batch parallel verarbeiten
        const batchPromises = batch.map(async (match, index) => {
          const globalIndex = batchStart + index;
          try {
            console.log(`  Lade Details für Match ${globalIndex + 1}/${allMatches.length}: ${match.matchId}`);
            
            const gameDetails = await this.fetchGameDetails(match.matchId);
            if (gameDetails) {
              // Konvertiere zu dem Format, das die alte API erwartet
              const convertedGame = this.convertGameDetailsToApiFormat(gameDetails);
              return { success: true, game: convertedGame, matchId: match.matchId };
            }
            return { success: false, matchId: match.matchId, error: 'Keine Details erhalten' };
          } catch (error) {
            console.error(`  Fehler beim Laden der Details für Match ${match.matchId}:`, error.message);
            return { success: false, matchId: match.matchId, error: error.message };
          }
        });

        try {
          const batchResults = await Promise.all(batchPromises);
          
          let successCount = 0;
          batchResults.forEach(result => {
            if (result.success) {
              detailedGames.push(result.game);
              successCount++;
            }
          });

          console.log(`  Batch ${batchIndex + 1} abgeschlossen: ${successCount}/${batch.length} erfolgreich`);
        } catch (error) {
          console.error(`  Fehler in Batch ${batchIndex + 1}:`, error.message);
        }

        // Pause zwischen Batches (konfigurierbare Wartezeit)
        if (batchIndex < totalBatches - 1) {
          const pauseTime = BATCH_SIZE * PAUSE_PER_REQUEST;
          console.log(`  Warte ${pauseTime}ms vor nächstem Batch...`);
          await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
      }

      console.log(`\n=== Abfrage abgeschlossen ===`);
      console.log(`Geladene Spiele: ${detailedGames.length}/${allMatches.length}`);
      console.log(`Einzigartige IDs: ${detailedGames.length}`);

      return {
        total: detailedGames.length,
        results: detailedGames,
        pages: 1,
        pageSize: detailedGames.length,
        actualCount: detailedGames.length,
        complete: true,
        apiReportedTotal: allMatches.length,
        duplicateGames: duplicateGames
      };
    } catch (error) {
      console.error("Fehler beim Abrufen aller offenen Spiele:", error.message);
      throw error;
    }
  }

  // Neue Methoden basierend auf der alten teamSLService-old.js
  async fetchAllLigen(index = 0) {
    try {
      const { BasketballBundSDK } = await import("basketball-bund-sdk");
      const sdk = new BasketballBundSDK();
      
      const response = await sdk.wam.getLigaList({
        akgGeschlechtIds: [],
        altersklasseIds: [],
        gebietIds: [],
        ligatypIds: [],
        sortBy: 0,
        spielklasseIds: [],
        token: "",
        verbandIds: [3],
        startAtIndex: index,
      });

      if (!response || !response.ligen) {
        console.log("Keine Ligen gefunden");
        return [];
      }

      const ligen = response.ligen.filter(liga => liga.verbandId !== 30);
      console.log(`${ligen.length} Ligen bei Index ${index} gefunden`);

      // Rekursiv weitere Ligen laden wenn hasMoreData = true
      if (response.hasMoreData) {
        console.log("Lade weitere Ligen...");
        const moreLigen = await this.fetchAllLigen(parseInt(index) + parseInt(response.size));
        return [...ligen, ...moreLigen];
      }

      return ligen;
    } catch (error) {
      console.error("Fehler beim Laden der Ligen:", error.message);
      return [];
    }
  }

  async fetchMatchesForLiga(liga) {
    try {
      const { BasketballBundSDK } = await import("basketball-bund-sdk");
      const sdk = new BasketballBundSDK();
      
      const data = await sdk.competition.getSpielplan({
        competitionId: liga.ligaId,
      });

      if (!data || !data.matches) {
        return [];
      }

      return data.matches;
    } catch (error) {
      console.error(`Fehler beim Laden der Matches für Liga ${liga.ligaId}:`, error.message);
      return [];
    }
  }

  async fetchGameDetails(matchId) {
    try {
      if (!this.client) {
        throw new Error("Nicht eingeloggt. Bitte zuerst login() aufrufen.");
      }

      const response = await this.client.get(`/rest/assignschiri/getGame/${matchId}`);
      return response.data;
    } catch (error) {
      console.error(`Fehler beim Laden der Game-Details für Match ${matchId}:`, error.message);
      return null;
    }
  }

  filterMatchesByZeitraum(matches, zeitraum) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Immer nur zukünftige Spiele (ab heute) - nie gestern oder früher
    const startDate = new Date(today);
    
    let endDate;
    
    if (zeitraum === "all") {
      // Bei "all" nur zukünftige Spiele, aber ohne Enddatum
      endDate = null;
    } else {
      switch (zeitraum) {
        case "w1":
          // Nächste 8 Tage
          endDate = new Date(today);
          endDate.setDate(today.getDate() + 8);
          break;
          
        case "w3":
          // 3 Wochen + 1 Tag = 22 Tage
          endDate = new Date(today);
          endDate.setDate(today.getDate() + 22);
          break;
         
        default:
          console.warn(`Unbekannter zeitraum: ${zeitraum}, verwende 'all'`);
          endDate = null;
      }
    }

    if (endDate) {
      console.log(`  Filtere Matches zwischen ${startDate.toISOString().split('T')[0]} und ${endDate.toISOString().split('T')[0]} (nur zukünftige Spiele)`);
    } else {
      console.log(`  Filtere Matches ab ${startDate.toISOString().split('T')[0]} (nur zukünftige Spiele, kein Enddatum)`);
    }

    return matches.filter(match => {
      if (!match.kickoffDate) {
        return false;
      }

      // kickoffDate ist ein Timestamp (Millisekunden)
      const matchDate = new Date(match.kickoffDate);
      const matchDateOnly = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
      
      // Immer nur zukünftige Spiele (ab heute)
      if (matchDateOnly < startDate) {
        return false;
      }
      
      // Wenn Enddatum gesetzt ist, auch das prüfen
      if (endDate && matchDateOnly > endDate) {
        return false;
      }
      
      return true;
    });
  }

  shouldBeOffenAngeboten(srData) {
    if (srData?.lizenzNr) {
      return false;
    }
    
    // Ansonsten den ursprünglichen offenAngeboten Wert verwenden
    return srData?.offenAngeboten || false;
  }

  convertGameDetailsToApiFormat(gameDetails) {
    try {
      const game1 = gameDetails.game1;
      if (!game1) return null;

      // Konvertiere zu dem Format, das die alte API verwendet
      return {
        sp: {
          spielplanId: game1.spielplanId,
          spieldatum: game1.spieldatum,
          heimMannschaftLiga: game1.heimMannschaftLiga ? {
            mannschaftName: game1.heimMannschaftLiga.mannschaftName || 'N/A',
            hideLink: game1.heimMannschaftLiga.hideLink || false
          } : {
            mannschaftName: 'N/A',
            hideLink: false
          },
          gastMannschaftLiga: game1.gastMannschaftLiga ? {
            mannschaftName: game1.gastMannschaftLiga.mannschaftName || 'N/A',
            hideLink: game1.gastMannschaftLiga.hideLink || false
          } : {
            mannschaftName: 'N/A',
            hideLink: false
          },
          liga: {
            liganame: game1.liga?.liganame || 'N/A',
            srQualifikation: game1.liga?.srQualifikation
          },
          spielfeld: {
            bezeichnung: game1.spielfeld?.bezeichnung || 'N/A',
            strasse: game1.spielfeld?.strasse || '',
            plz: game1.spielfeld?.plz || '',
            ort: game1.spielfeld?.ort || ''
          },
          sr1Verein: game1.sr1Verein,
          sr2Verein: game1.sr2Verein,
          sr3Verein: game1.sr3Verein
        },
        sr1OffenAngeboten: this.shouldBeOffenAngeboten(game1, gameDetails.sr1),
        sr2OffenAngeboten: this.shouldBeOffenAngeboten(game1, gameDetails.sr2),
        sr3OffenAngeboten: this.shouldBeOffenAngeboten(game1, gameDetails.sr3),
        sr1: gameDetails.sr1?.spielleitung ? {
          spielleitung: gameDetails.sr1.spielleitung,
          lizenzNr: gameDetails.sr1.lizenzNr,
          srVerein: gameDetails.sr1.srVerein
        } : null,
        sr2: gameDetails.sr2?.spielleitung ? {
          spielleitung: gameDetails.sr2.spielleitung,
          lizenzNr: gameDetails.sr2.lizenzNr,
          srVerein: gameDetails.sr2.srVerein
        } : null,
        sr3: gameDetails.sr3?.spielleitung ? {
          spielleitung: gameDetails.sr3.spielleitung,
          lizenzNr: gameDetails.sr3.lizenzNr,
          srVerein: gameDetails.sr3.srVerein
        } : null
      };
    } catch (error) {
      console.error("Fehler beim Konvertieren der Game-Details:", error.message);
      return null;
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
        offenAngebotenAberVereinNull: 0,
        processingError: 0
      };

      for (const gameData of gamesData) {
        try {
          // Prüfe, ob das Spiel offen angeboten wird
          const isOffered = gameData.sr1OffenAngeboten || gameData.sr2OffenAngeboten || gameData.sr3OffenAngeboten;
          
          if (!isOffered) {
            // Spiel wird nicht offen angeboten - aus DB entfernen
            await Spiel.destroy({
              where: {
                spielplanId: {
                  [Op.eq]: gameData.sp.spielplanId,
                },
              },
              force: true,
            });
            skippedReasons.notOffered++;
            skippedGames++;
            continue;
          }

          // Prüfe, ob offen angeboten aber entsprechender Verein null ist
          if (
            (gameData.sr1OffenAngeboten && !gameData.sp.sr1Verein) ||
            (gameData.sr2OffenAngeboten && !gameData.sp.sr2Verein) ||
            (gameData.sr3OffenAngeboten && !gameData.sp.sr3Verein)
          ) {
            console.log(`Spiel ${gameData.sp.spielplanId} übersprungen: offen angeboten aber Verein null`);
            skippedReasons.offenAngebotenAberVereinNull++;
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
      console.log(`- Offen angeboten aber Verein null: ${skippedReasons.offenAngebotenAberVereinNull}`);
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
