const mongoose = require("mongoose"); // Importing mongoose for MongoDB database

/**
 * This module exports a Mongoose model for the 'Link' collection in the MongoDB database.
 * Each document in the 'Link' collection represents a link and has the following properties:
 * - user: A reference to a User document.
 * - verein: The name of the club.
 * - lizenzstufe: The license level.
 * - link: The link itself.
 * - start: The start date/time of the link's validity.
 * - end: The end date/time of the link's validity.
 * - onlyShow: A boolean indicating whether to only show the link.
 */
module.exports = mongoose.model(
    "Link",
    new mongoose.Schema({
        user:    {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        verein: String,
        lizenzstufe: String,
        link: {
            type: String,
        },
        start: String,
        end: String,
        onlyShow: Boolean
    })
)