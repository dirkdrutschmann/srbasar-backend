const mongoose = require("mongoose"); // Importing mongoose for MongoDB database

/**
 * This module exports a Mongoose model for the 'Role' collection in the MongoDB database.
 * Each document in the 'Role' collection represents a role and has the following property:
 * - name: The name of the role.
 */
const Role = mongoose.model(
    "Role",
    new mongoose.Schema({
        name: String
    })
);

module.exports = Role;