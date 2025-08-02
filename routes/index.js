/**
 * Importing required routes
 */
const auth = require("./auth.routes"); // Authentication routes
const ref = require("./ref.routes"); // Reference routes
const update = require("./update.routes"); // Update routes
const user = require("./user.routes"); // User routes
const link = require("./link.routes"); // Link routes

/**
 * This function initializes all the routes for the application.
 * @param {object} app - The express application.
 */
module.exports = function (app) {
  // Global CORS headers configuration
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Authorization, Origin, Content-Type, Accept"
    );
    next();
  });

  auth(app), // Initialize authentication routes
    ref(app), // Initialize reference routes
    update(app), // Initialize update routes
    user(app), // Initialize user routes
    link(app); // Initialize link routes
};
