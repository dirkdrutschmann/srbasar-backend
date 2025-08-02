const mongoose = require("mongoose"); // Importing mongoose for MongoDB database

/**
 * This module exports a Mongoose model for the 'User' collection in the MongoDB database.
 * Each document in the 'User' collection represents a user and has the following properties:
 * - email: The email of the user.
 * - password: The hashed password of the user.
 * - firstName: The first name of the user.
 * - lastName: The last name of the user.
 * - club: An array of strings representing the clubs the user belongs to.
 * - roles: An array of references to Role documents. Each Role document represents a role the user has.
 * - showContact: A boolean indicating whether to show the user's contact information.
 * - contactInfo: The contact information of the user.
 * - showMail: A boolean indicating whether to show the user's email.
 * - showInfo: A boolean indicating whether to show the user's information.
 * - phone: The phone number of the user.
 * - whatsapp: A boolean indicating whether the user has WhatsApp.
 * - getEmails: A boolean indicating whether the user wants to receive emails.
 * - name: The name of the user.
 */
module.exports = mongoose.model(
    "User",
    new mongoose.Schema({
        email: String,
        password: String,
        firstName: String,
        lastName: String,
        club: [
            {type: String}
        ],
        roles: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Role"
            }
        ],
        showContact: Boolean,
        contactInfo: String,
        showMail: Boolean,
        showInfo: Boolean,
        phone: String,
        whatsapp: Boolean,
        getEmails: Boolean,
        name: String,
        resetToken: String,
        resetTokenExpires: Date
    })
)