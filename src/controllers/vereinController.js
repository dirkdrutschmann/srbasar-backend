const { Verein } = require('../models');

class VereinController {
  async updateHideLink(req, res) {
    try {
      const { vereinId } = req.params;
      const { hideLink } = req.body;

      // Validierung der Eingabedaten
      if (typeof hideLink !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'hideLink muss ein Boolean-Wert sein'
        });
      }

      // Verein finden
      const verein = await Verein.findByPk(vereinId);
      if (!verein) {
        return res.status(404).json({
          success: false,
          error: 'Verein nicht gefunden'
        });
      }

      // hideLink aktualisieren
      await verein.update({ hideLink });

      res.json({
        success: true,
        message: 'hideLink erfolgreich aktualisiert',
        data: {
          verein: {
            vereinId: verein.vereinId,
            vereinsname: verein.vereinsname,
            hideLink: verein.hideLink
          }
        }
      });

    } catch (error) {
      console.error('Fehler beim Aktualisieren des hideLink:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler beim Aktualisieren des hideLink'
      });
    }
  }

  async getAllVereine(req, res) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = {};
      if (search) {
        whereClause = {
          [require('sequelize').Op.or]: [
            { vereinsname: { [require('sequelize').Op.iLike]: `%${search}%` } },
            { vereinsnummer: { [require('sequelize').Op.eq]: parseInt(search) || 0 } }
          ]
        };
      }

      const { count, rows: vereine } = await Verein.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['vereinsname', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          vereine,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            totalItems: count,
            itemsPerPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Fehler beim Abrufen der Vereine:', error);
      res.status(500).json({
        success: false,
        error: 'Interner Serverfehler beim Abrufen der Vereine'
      });
    }
  }
}

module.exports = new VereinController();
