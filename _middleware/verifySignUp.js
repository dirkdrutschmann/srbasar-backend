const {User, Role} = require('../_models/index') // Importing User and Role models
const {ROLES} = require ('../_init/roles') // Importing ROLES from roles module

/**
 * Middleware function to check if the email is already in use.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
checkDuplicateUsernameOrEmail = (req, res, next) => {
    User.findOne({
      email: req.body.email
    }).exec((err, user) => {
      if (err) {
        res.status(500).send({ message: err });
        return;
      }

      if (user) {
        res.status(400).send({ message: "Failed! Email is already in use!" });
        return;
      }

      next();
    });
}

/**
 * Middleware function to check if the roles exist.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
checkRolesExisted = (req, res, next) => {
  if (req.body.roles) {
    for (let i = 0; i < req.body.roles.length; i++) {
      if (!ROLES.includes(req.body.roles[i])) {
        res.status(400).send({
          message: `Failed! Role ${req.body.roles[i]} does not exist!`
        });
        return;
      }
    }
  }

  next();
};

/**
 * This module exports an object containing two middleware functions:
 * - checkDuplicateUsernameOrEmail: This middleware function is used to check if the email is already in use.
 * - checkRolesExisted: This middleware function is used to check if the roles exist.
 */
const verifySignUp = {
  checkDuplicateUsernameOrEmail,
  checkRolesExisted
};

module.exports = verifySignUp;