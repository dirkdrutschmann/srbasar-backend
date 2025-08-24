const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SrQualifikation = sequelize.define('SrQualifikation', {
  srQualifikationId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  bezeichnung: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kurzBezeichnung: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'sr_qualifikationen',
  timestamps: true
});

module.exports = SrQualifikation;
