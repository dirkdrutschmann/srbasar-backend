const mongoose = require("mongoose") // Importing mongoose for MongoDB database

/**
 * This module exports a Mongoose model for the 'Liga' collection in the MongoDB database.
 * Each document in the 'Liga' collection represents a league and has the following properties:
 * - ligaId: The unique ID of the league. This is a required field.
 * - liganame: The name of the league.
 * - liganr: The number of the league.
 * - akName: The name of the age group for the league.
 * - geschlechtId: The ID of the gender for the league.
 * - geschlecht: The gender for the league.
 * - verbandId: The ID of the association for the league.
 * - verbandName: The name of the association for the league.
 * - matches: An array of references to Match documents. Each Match document represents a match in the league.
 */
module.exports = mongoose.model('Liga', mongoose.Schema({
    ligaId: {
        type: Number,
        required: true,
        unique: true,
    },
    liganame: String,
    liganr: Number,
    akName: String,
    geschlechtId: Number,
    geschlecht: String,
    verbandId: Number,
    verbandName: String,
    matches: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match",
        },
    ],
}))

/**
 *     possible API properties
 *     seasonId: Number,
 *     seasonName: String,
 *     actualMatchDay: Number,
 *     skName: String,
 *     skNameSmall: String,
 *     skEbeneId: Number,
 *     skEbeneName: String,
 *     bezirknr: Number,
 *     bezirkName: String,
 *     kreisnr: Number,
 *     kreisname: String,
 *     statisticType: String,
 *     vorabliga: Boolean,
 *     tableExists: Boolean,
 *     crossTableExists: Boolean,
 */