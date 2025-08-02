const mongoose = require('mongoose') // Importing mongoose for MongoDB database

/**
 * This module exports a Mongoose model for the 'Match' collection in the MongoDB database.
 * Each document in the 'Match' collection represents a match and has the following properties:
 * - liganame: The name of the league.
 * - matchId: The unique ID of the match. This is a required field and must be unique.
 * - matchDay: The day of the match.
 * - matchNo: The number of the match.
 * - kickoffDate: The date of the match.
 * - kickoffTime: The time of the match.
 * - homeTeam: The home team of the match.
 * - guestTeam: The guest team of the match.
 * - verzicht: A boolean indicating whether the match was forfeited.
 * - abgesagt: A boolean indicating whether the match was cancelled.
 * - spielfeld: The field of the match.
 * - sr1: The first referee of the match.
 * - sr1Name: The name of the first referee.
 * - sr1Basar: A boolean indicating whether the first referee is from Basar.
 * - sr1Besetzt: A boolean indicating whether the first referee is occupied.
 * - sr1Bonus: The bonus of the first referee.
 * - sr1Mail: The email of the first referee.
 * - sr1Info: Additional information about the first referee.
 * - sr2: The second referee of the match.
 * - sr2Name: The name of the second referee.
 * - sr2Basar: A boolean indicating whether the second referee is from Basar.
 * - sr2Besetzt: A boolean indicating whether the second referee is occupied.
 * - sr2Bonus: The bonus of the second referee.
 * - sr2Info: Additional information about the second referee.
 * - sr2Mail: The email of the second referee.
 */
module.exports = mongoose.model('Match', mongoose.Schema({
    liganame: String,
    matchId: {
      type: Number,
      unique: true,
    },
    matchDay: Number,
    matchNo: Number,
    kickoffDate: String,
    kickoffTime: String,
    homeTeam: String,
    guestTeam: String,
    verzicht: Boolean,
    abgesagt: Boolean,
    spielfeld: String,
    sr1: String,
    sr1Name: String,
    sr1Basar: Boolean,
    sr1Besetzt: Boolean,
    sr1Bonus: Number,
    sr1Mail: String,
    sr1Info: String,
    sr2: String,
    sr2Name: String,
    sr2Basar: Boolean,
    sr2Besetzt: Boolean,
    sr2Bonus: Number,
    sr2Info: String,
    sr2Mail: String,
}))