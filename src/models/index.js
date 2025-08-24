const Spiel = require('./Spiel');
const Verein = require('./Verein');
const SrQualifikation = require('./SrQualifikation');
const User = require('./User');

// Beziehungen definieren
Spiel.belongsTo(Verein, { foreignKey: 'heimVereinId', as: 'heimVerein' });
Spiel.belongsTo(Verein, { foreignKey: 'gastVereinId', as: 'gastVerein' });
Spiel.belongsTo(Verein, { foreignKey: 'sr1VereinId', as: 'sr1Verein' });
Spiel.belongsTo(Verein, { foreignKey: 'sr2VereinId', as: 'sr2Verein' });
Spiel.belongsTo(Verein, { foreignKey: 'sr3VereinId', as: 'sr3Verein' });

Spiel.belongsTo(SrQualifikation, { foreignKey: 'srQualifikationId', as: 'srQualifikation' });

Verein.hasMany(Spiel, { foreignKey: 'heimVereinId', as: 'heimSpiele' });
Verein.hasMany(Spiel, { foreignKey: 'gastVereinId', as: 'gastSpiele' });
Verein.hasMany(Spiel, { foreignKey: 'sr1VereinId', as: 'sr1Verein' });
Verein.hasMany(Spiel, { foreignKey: 'sr2VereinId', as: 'sr2Verein' });
Verein.hasMany(Spiel, { foreignKey: 'sr3VereinId', as: 'sr3Verein' });

SrQualifikation.hasMany(Spiel, { foreignKey: 'srQualifikationId', as: 'spiele' });

module.exports = {
  Spiel,
  Verein,
  SrQualifikation,
  User
};
