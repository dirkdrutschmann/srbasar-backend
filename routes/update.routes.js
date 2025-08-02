const { authJwt } = require("../_middleware"); // Importing the necessary middleware
const controller = require('../_controller/update.controller'); // Importing the controller

/**
 * This module exports a function that sets up the routes for updates.
 * @param {object} app - The express application.
 */
module.exports = function(app) {
  // The prefix for the routes
  const PREFIX = '/api/update'



  /**
   * Route for updating leagues.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isAdmin: To check if the user is an admin.
   */
  app.get(PREFIX + '/ligen',[authJwt.verifyToken, authJwt.isAdmin],controller.ligen )

  /**
   * Route for updating matches.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isAdmin: To check if the user is an admin.
   */
  app.get(PREFIX + '/matches',[authJwt.verifyToken, authJwt.isAdmin], controller.matches)

  /**
   * Route for updating a referee game.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   * - authJwt.getClub: To get the club of the user.
   */
  app.post(PREFIX + '/ref/:game',[authJwt.verifyToken, authJwt.isVRSW, authJwt.getClub], controller.refgame)

  /**
   * Route for updating all leagues and matches.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isAdmin: To check if the user is an admin.
   */
  app.get(PREFIX + '/all', [authJwt.verifyToken, authJwt.isAdmin ], controller.all)
}