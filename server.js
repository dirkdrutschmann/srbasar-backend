// Importing necessary modules
require('rootpath')();
require('dotenv').config();
const express = require('express');
const mongoose = require("mongoose");
const path = require('path');
const {Role} = require('./_models')
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const routes = require("./routes")
const errorHandler = require('_middleware/error-handler');

/**
 * This script starts the server and sets up the necessary middleware and routes.
 * It first establishes a connection to the MongoDB database using the connection string from the environment variables.
 * Then, it initializes the roles in the database if they don't exist.
 * After that, it creates an Express application and sets up the middleware for parsing request bodies, parsing cookies, enabling CORS, and handling errors.
 * It also sets up the routes for the application by calling the function exported by the routes module.
 * Finally, it starts the server on the specified port and logs a message.
 */

// start server
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 3000) : process.env.DEV_PORT;
const connectionOptions = {
    dbName: process.env.MONGO_DB_NAME,
    family: 4,
    useNewUrlParser: true
}

mongoose
    .set('strictQuery', false)
    .connect(process.env.MONGO_URL, connectionOptions)
    .then(() => {
        console.log("MongoDB-Connection is established.")
        init()
        const app = express()
        app.use(bodyParser.urlencoded({ extended: false }));
        app.use(bodyParser.json());
        app.use(cookieParser());

        // allow cors requests from any origin and with credentials
        app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

        // global error handler
        app.use(errorHandler);
        routes(app)
        app.listen(port, () => {
            console.log('Server listening on port ' + port);
        })
    }).catch(err => {
        console.error("Connection error", err);
        process.exit();
    });

/**
 * This function initializes the roles in the database if they don't exist.
 * It first checks the estimated document count of the 'Role' collection.
 * If the count is 0, it creates new documents for the 'user', 'vrsw', and 'admin' roles and saves them to the 'Role' collection.
 */
function init() {
    Role.estimatedDocumentCount((err, count) => {
        if (!err && count === 0) {
            new Role({
                name: "user"
            }).save(err => {
                if (err) {
                    console.log("error", err);
                }

                console.log("added 'user' to roles collection");
            });

            new Role({
                name: "vrsw"
            }).save(err => {
                if (err) {
                    console.log("error", err);
                }

                console.log("added 'vrsw' to roles collection");
            });

            new Role({
                name: "admin"
            }).save(err => {
                if (err) {
                    console.log("error", err);
                }

                console.log("added 'admin' to roles collection");
            });
        }
    });
}