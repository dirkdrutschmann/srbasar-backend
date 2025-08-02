// Importing the necessary modules
const {updateLigen, updateMatches} = require("./_teamsl/update");
const mongoose = require("mongoose");
require('dotenv').config();

/**
 * This script updates the leagues and matches data in the MongoDB database.
 * It first establishes a connection to the MongoDB database using the connection string from the environment variables.
 * Then, it calls the updateLigen function to update the leagues data, and the updateMatches function to update the matches data.
 * Both functions are imported from the _teamsl/update module.
 * After the updates are done, it logs a message and exits the process.
 */
(async () => {
    console.log("start") // Logging the start of the script

    // Options for the MongoDB connection
    const connectionOptions = {
        dbName: process.env.MONGO_DB_NAME,
        family: 4,
        useNewUrlParser: true
    }

    // Disabling the strictQuery option for Mongoose
    mongoose.set("strictQuery", false);

    // Connecting to the MongoDB database and updating the leagues and matches data
    var db = mongoose.connect(process.env.MONGO_URL, connectionOptions).then(async () => {
        console.log("MongoDB-Connection is established.") // Logging the successful connection to the database
        return await updateLigen(0).then(async () => await updateMatches()) // Updating the leagues and matches data
    }).then(() => {
        console.log("DONE " + new Date()) // Logging the completion of the updates
        process.exit(0)
    }) // Exiting the process
})();