const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database.sqlite'),
  logging: false,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
});

module.exports = { sequelize };
