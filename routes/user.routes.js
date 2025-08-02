const { authJwt } = require("../_middleware"); // Importing the necessary middleware
const controller = require("../_controller/user.controller"); // Importing the controller

/**
 * This module exports a function that sets up the routes for users.
 * @param {object} app - The express application.
 */
module.exports = function(app) {
  // The prefix for the routes
  const PREFIX = '/api/user/'



  /**
   * Route for listing users.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isAdmin: To check if the user is an admin.
   */
  app.get(PREFIX + 'list' , [authJwt.verifyToken, authJwt.isAdmin], controller.list);

  /**
   * Route for updating a user.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   */
  app.post(PREFIX + 'update' , [authJwt.verifyToken], controller.update);
}