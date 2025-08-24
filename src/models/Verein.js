const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Verein = sequelize.define('Verein', {
  vereinId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  vereinsnummer: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  vereinsname: {
    type: DataTypes.STRING,
    allowNull: false
  },
  verbandId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  kreisId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  bezirkId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  hideLink: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'vereine',
  timestamps: true
});

module.exports = Verein;
