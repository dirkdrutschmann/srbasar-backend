const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DATABASE_SERVER || 'localhost',
  port: process.env.DATABASE_PORT || 3306,
  username: process.env.DATABASE_USER || 'db',
  password: process.env.DATABASE_PASSWORD || 'pass',
  database: process.env.DATABASE || 'db',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  }
});

module.exports = { sequelize };
