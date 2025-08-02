const mongoose = require("mongoose"); // Importing mongoose for MongoDB database

/**
 * This module exports a Mongoose model for the 'Answer' collection in the MongoDB database.
 * Each document in the 'Answer' collection represents an answer and has the following properties:
 * - link: A reference to a Link document.
 * - name: The name of the person who answered.
 * - email: The email of the person who answered.
 * - telefon: The phone number of the person who answered.
 * - lizenzstufe: The license level of the person who answered.
 * - message: The message of the answer.
 * - games: An array of references to Match documents.
 */
module.exports = mongoose.model(
    "Answer",
    new mongoose.Schema({
        link:    {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Link",
        },
        name: String,
        email: String,
        telefon: String,
        lizenzstufe: String,
        message: String,
        games: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Match",
            }
        ]
    })
)