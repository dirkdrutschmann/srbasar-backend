const authJwt = require("./authJwt"); // Importing the authJwt middleware
const verifySignUp = require("./verifySignUp"); // Importing the verifySignUp middleware

/**
 * This module exports an object containing two middleware functions:
 * - authJwt: This middleware function is used for JWT authentication.
 * - verifySignUp: This middleware function is used to verify the sign up process.
 */
module.exports = {
  authJwt,
  verifySignUp
};