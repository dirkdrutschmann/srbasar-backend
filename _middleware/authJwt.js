const jwt = require("jsonwebtoken"); // Importing jsonwebtoken for token verification
const {User, Role} = require('../_models/index') // Importing User and Role models

/**
 * Middleware function to verify the token in the request.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
verifyToken = (req, res, next) => {
  let token = req.headers["authorization"] || req.headers["Authorization"];
  if (!token) {
    return res.status(403).send({ message: "No token provided!" });
  }

  // Remove "Bearer " prefix if present
  if (token.startsWith('Bearer ')) {
    token = token.slice(7);
  }

  jwt.verify(token, process.env.SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized!" });
    }
    req.userId = decoded.id;
    next();
  });
};

/**
 * Middleware function to check if the user is an admin.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
isAdmin = (req, res, next) => {
  User.findById(req.userId).exec((err, user) => {
    if (err) {
      res.status(500).send({ message: err });
      return;
    }

    Role.find(
      {
        _id: { $in: user.roles }
      },
      (err, roles) => {
        if (err) {
          res.status(500).send({ message: err });
          return;
        }

        for (let i = 0; i < roles.length; i++) {
          if (roles[i].name === "admin") {
            next();
            return;
          }
        }

        res.status(403).send({ message: "Require Admin Role!" });
        return;
      }
    );
  });
};

/**
 * Middleware function to check if the user is a VRSW.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
isVRSW = (req, res, next) => {
  User.findById(req.userId).exec((err, user) => {
    if (err) {
      res.status(500).send({ message: err });
      return;
    }

    Role.find(
      {
        _id: { $in: user.roles }
      },
      (err, roles) => {
        if (err) {
          res.status(500).send({ message: err });
          return;
        }

        for (let i = 0; i < roles.length; i++) {
          if (roles[i].name === "vrsw") {
            next();
            return;
          }
        }

        res.status(403).send({ message: "Require VRSW Role!" });
        return;
      }
    );
  });
};

/**
 * Middleware function to get the club of the user.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
getClub = (req, res, next) => {
  User.findById(req.userId).exec((err, user) => {
    if (err) {
      res.status(500).send({ message: err });
      return;
    }
    req.club = user.club;
    next()
    return
  });
}

const authJwt = {
  verifyToken,
  isAdmin,
  isVRSW,
  getClub
};
module.exports = authJwt;