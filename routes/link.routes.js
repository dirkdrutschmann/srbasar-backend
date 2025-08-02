const { authJwt } = require("../_middleware"); // Importing the necessary middleware
const controller = require("../_controller/link.controller"); // Importing the controller

/**
 * This module exports a function that sets up the routes for links.
 * @param {object} app - The express application.
 */
module.exports = function(app) {
  // The prefix for the routes
  const PREFIX = '/api/link/'


  /**
   * Route for listing links.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   */
  app.post(PREFIX + '', [authJwt.verifyToken, authJwt.isVRSW], controller.list)

  /**
   * Route for adding a link.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   */
  app.post(PREFIX + 'add',[authJwt.verifyToken, authJwt.isVRSW], controller.add )

  /**
   * Route for removing a link.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   */
  app.delete(PREFIX + 'remove/:link',[authJwt.verifyToken, authJwt.isVRSW], controller.remove )

  /**
   * Route for removing an answer.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   */
  app.delete(PREFIX + 'removeAnswer/:answer',[authJwt.verifyToken, authJwt.isVRSW], controller.removeAnswer )

  /**
   * Route for getting an answer.
   * It requires the following middleware:
   * - authJwt.verifyToken: To verify the token in the request.
   * - authJwt.isVRSW: To check if the user is a VRSW.
   */
  app.get(PREFIX + 'getAnswer/:answer',[authJwt.verifyToken, authJwt.isVRSW], controller.getAnswer )

  /**
   * Route for answering a link.
   * It does not require any middleware.
   */
  app.post(PREFIX + 'answer', controller.answer)

  /**
   * Route for getting a link.
   * It does not require any middleware.
   */
  app.post(PREFIX + 'get/:link',controller.get)
}