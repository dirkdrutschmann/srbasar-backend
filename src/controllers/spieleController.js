const { Op } = require("sequelize");
const { Spiel, Verein, SrQualifikation } = require("../models");

class SpieleController {
  async getAllSpiele(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        spieldatum,
        ligaName,
        spielfeldName,
        search,
        sortBy = "spieldatum",
        sortOrder = "ASC",
      } = req.query;

      const pageNumber = parseInt(page);
      const pageSize = Math.min(parseInt(limit), 100);
      const offset = (pageNumber - 1) * pageSize;

      // Alle Spiele ohne Filter laden (für available filters)
      const allSpiele = await Spiel.findAll({
        include: [
          {
            model: Verein,
            as: "heimVerein",
            foreignKey: "heimVereinId",
            attributes: [
              "vereinId",
              "vereinsname",
              "vereinsnummer"
            ],
          },
          {
            model: Verein,
            as: "gastVerein",
            foreignKey: "gastVereinId",
            attributes: [
              "vereinId",
              "vereinsname",
              "vereinsnummer"
            ],
          },
          {
            model: SrQualifikation,
            as: "srQualifikation",
            foreignKey: "srQualifikationId",
            attributes: ["srQualifikationId", "bezeichnung", "kurzBezeichnung"],
          },
        ],
      });

      // Available filters aus allen Spielen extrahieren
      const availableFilters = {
        spielfeldName: [
          ...new Set(allSpiele.map((s) => s.spielfeldName).filter(Boolean)),
        ].sort(),
        ligaName: [
          ...new Set(allSpiele.map((s) => s.ligaName).filter(Boolean)),
        ].sort(),
        spieldatum: [
          ...new Set(allSpiele.map((s) => s.spieldatum).filter(Boolean)),
        ].sort((a, b) => a - b),
      };

      // Filter-Objekt aufbauen
      const whereClause = {};

      if (spieldatum) {
        whereClause.spieldatum = parseInt(spieldatum);
      }

      if (ligaName) {
        whereClause.ligaName = {
          [Op.like]: `%${ligaName}%`,
        };
      }

      if (spielfeldName) {
        whereClause.spielfeldName = {
          [Op.like]: `%${spielfeldName}%`,
        };
      }

      // Globale Suche über alle Textfelder
      if (search) {
        // Erstelle ein separates OR-Objekt für die globale Suche
        const searchConditions = [
          { heimMannschaftName: { [Op.like]: `%${search}%` } },
          { gastMannschaftName: { [Op.like]: `%${search}%` } },
          { sr1VereinName: { [Op.like]: `%${search}%` } },
          { sr2VereinName: { [Op.like]: `%${search}%` } },
          { sr3VereinName: { [Op.like]: `%${search}%` } },
          { ligaName: { [Op.like]: `%${search}%` } },
          { spielfeldName: { [Op.like]: `%${search}%` } },
          { spielStrasse: { [Op.like]: `%${search}%` } },
          { spielPlz: { [Op.like]: `%${search}%` } },
          { spielOrt: { [Op.like]: `%${search}%` } },
        ];

        // Wenn globale Suche aktiv ist, überschreiben wir die spezifischen Filter
        // da die globale Suche bereits alle Felder durchsucht
        delete whereClause.ligaName;
        delete whereClause.spielfeldName;

        // Füge die globale Suche als AND-Bedingung hinzu
        whereClause[Op.and] = [{ [Op.or]: searchConditions }];
      }

      // Sortierung validieren
      const allowedSortFields = ["spieldatum", "ligaName", "spielfeldName"];
      const allowedSortOrders = ["ASC", "DESC"];

      const finalSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "spieldatum";
      const finalSortOrder = allowedSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "ASC";

      // Gefilterte Spiele abrufen
      const { count, rows: spiele } = await Spiel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Verein,
            as: "heimVerein",
            foreignKey: "heimVereinId",
            attributes: [
              "vereinId",
              "vereinsname",
              "vereinsnummer"
            ],
          },
          {
            model: Verein,
            as: "gastVerein",
            foreignKey: "gastVereinId",
            attributes: [
              "vereinId",
              "vereinsname",
              "vereinsnummer"
            ],
          },
          {
            model: Verein,
            as: "sr1Verein",
            foreignKey: "sr1VereinId",
            attributes: [
              "vereinId",
              "vereinsname",
              "vereinsnummer"
            ],
          },
          {
            model: Verein,
            as: "sr2Verein",
            foreignKey: "sr2VereinId",
            attributes: [
              "vereinId",
              "vereinsname",
              "vereinsnummer"
            ],
          },
          {
            model: Verein,
            as: "sr3Verein",
            foreignKey: "sr3VereinId",
            attributes: [
              "vereinId",
              "vereinsname",
              "vereinsnummer"
            ],
          },
          {
            model: SrQualifikation,
            as: "srQualifikation",
            foreignKey: "srQualifikationId",
            attributes: ["srQualifikationId", "bezeichnung", "kurzBezeichnung"],
          },
        ],
        order: [[finalSortBy, finalSortOrder]],
        limit: pageSize,
        offset: offset,
      });

      // Paginierungs-Metadaten
      const totalPages = Math.ceil(count / pageSize);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      // Spieldatum in lesbares Format konvertieren
      const spieleMitFormatiertemDatum = spiele.map((spiel) => {
        const spielData = spiel.toJSON();
        if (spielData.spieldatum) {
          const datum = new Date(parseInt(spielData.spieldatum));
          spielData.datum = datum.toLocaleString("de-DE", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          spielData.zeit = datum.toLocaleString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
          });
        }
        delete spielData.rawData;
        delete spielData.sr1VereinId;
        delete spielData.sr2VereinId;
        delete spielData.sr3VereinId;
        delete spielData.srQualifikationId;
        delete spielData.createdAt;
        delete spielData.updatedAt;
        delete spielData.heimVereinId;
        delete spielData.gastVereinId;
        return spielData;
      });

      res.json({
        success: true,
        data: {
          spiele: spieleMitFormatiertemDatum,
          pagination: {
            currentPage: pageNumber,
            pageSize: pageSize,
            totalItems: count,
            totalPages: totalPages,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? pageNumber + 1 : null,
            prevPage: hasPrevPage ? pageNumber - 1 : null,
          },
          availableFilters: availableFilters,
        },
      });
    } catch (error) {
      console.error("Fehler beim Abrufen der Spiele:", error);
      res.status(500).json({
        success: false,
        error: "Fehler beim Abrufen der Spiele",
        details: error.message,
      });
    }
  }
}

module.exports = new SpieleController();
