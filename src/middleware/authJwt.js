const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1] || req.headers['x-access-token'];

  if (!token) {
    return res.status(403).json({
      success: false,
      error: 'Kein Token bereitgestellt'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Ungültiger Token'
    });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin-Berechtigung erforderlich'
    });
  }
  next();
};

const isModerator = (req, res, next) => {
  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Moderator- oder Admin-Berechtigung erforderlich'
    });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isModerator
};
