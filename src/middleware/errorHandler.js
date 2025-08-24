const errorHandler = (err, req, res, next) => {
  console.error('Fehler:', err.stack);

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validierungsfehler',
      errors: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'Daten bereits vorhanden'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Interner Server-Fehler'
  });
};

module.exports = errorHandler;
