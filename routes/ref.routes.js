const { authJwt } = require("../_middleware"); // Importing the necessary middleware
const controller = require("../_controller/ref.controller"); // Importing the controller

/**
 * This module exports a function that sets up the routes for referees.
 * @param {object} app - The express application.
 */
module.exports = function(app) {
  // The prefix for the routes
  const PREFIX = '/api/ref/'


  /**
   * Route for listing referees.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   * - authJwt.getClub: To get the club of the user.
   */
  app.get(PREFIX + '', [authJwt.verifyToken, authJwt.isVRSW, authJwt.getClub], controller.list)

  /**
   * Route for listing all referees.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   */
  app.get(PREFIX + 'all', [authJwt.verifyToken, authJwt.isVRSW], controller.all)

  /**
   * Route for listing referees for a basar.
   * It does not require any middleware.
   */
  app.get(PREFIX + 'basar', [], controller.basar)

  /**
   * Route for taking over a game.
   * It does not require any middleware.
   */
  app.post(PREFIX + ':game', [], controller.uebernehmen)

  /**
   * Route for listing clubs.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isAdmin: To check if the user is an admin.
   */
  app.get(PREFIX + 'vereine' , [authJwt.verifyToken, authJwt.isAdmin], controller.vereine)
}