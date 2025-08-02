const { verifySignUp, authJwt } = require("../_middleware"); // Importing the necessary middleware
const controller = require("../_controller/auth.controller"); // Importing the controller

/**
 * This module exports a function that sets up the routes for authentication.
 * @param {object} app - The express application.
 */
module.exports = function(app) {
  // The prefix for the routes
  const PREFIX = "/api/auth"

 

  /**
   * Route for resetting a user's password.
   * It does not require any middleware.
   */
  app.post(PREFIX + "/reset", [], controller.reset)

  /**
   * Route for resetting a user's password with token.
   * It does not require any middleware.
   */
  app.post(PREFIX + "/validate-reset-token", [], controller.validateResetToken)

  app.post(PREFIX + "/reset-password", [], controller.resetPassword)

  /**
   * Route for signing up a user.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isAdmin: To check if the user is an admin.
   * - verifySignUp.checkDuplicateUsernameOrEmail: To check if the email is already in use.
   * - verifySignUp.checkRolesExisted: To check if the roles exist.
   */
  app.post(
    PREFIX +  "/signup",
    [
      authJwt.verifyToken,
      authJwt.isAdmin,
      verifySignUp.checkDuplicateUsernameOrEmail,
      verifySignUp.checkRolesExisted
    ],
    controller.signup
  );

  /**
   * Route for deleting a user.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isAdmin: To check if the user is an admin.
   */
  app.post(PREFIX +  "/user",
  [
    authJwt.verifyToken,
    authJwt.isAdmin
  ],
  controller.delete)

  /**
   * Route for signing in a user.
   * It does not require any middleware.
   */
  app.post(PREFIX + "/signin", controller.signin);
};