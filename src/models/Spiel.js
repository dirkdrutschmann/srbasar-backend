const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Spiel = sequelize.define('Spiel', {
  spielplanId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  spieldatum: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  heimVereinId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  gastVereinId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  heimMannschaftName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  gastMannschaftName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ligaName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  spielfeldName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  spielStrasse: {
    type: DataTypes.STRING,
    allowNull: false
  },
  spielPlz: {
    type: DataTypes.STRING,
    allowNull: false
  },
  spielOrt: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sr1OffenAngeboten: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sr2OffenAngeboten: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sr3OffenAngeboten: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sr1VereinName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sr2VereinName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sr3VereinName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rawData: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Vollständige API-Response als JSON'
  }
}, {
  tableName: 'spiele',
  timestamps: true
});

module.exports = Spiel;
