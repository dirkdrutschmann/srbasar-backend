// Importing the Mongoose models for the different collections in the MongoDB database
const Liga = require('./liga.model');
const Match = require('./match.model');
const Role = require('./role.model');
const User = require('./user.model');
const Link = require('./link.model');
const Answer = require('./answer.model');

/**
 * This module exports an object containing the Mongoose models for the different collections in the MongoDB database.
 * Each property of the object is a Mongoose model:
 * - Liga: The model for the 'Liga' collection.
 * - Match: The model for the 'Match' collection.
 * - Role: The model for the 'Role' collection.
 * - User: The model for the 'User' collection.
 * - Link: The model for the 'Link' collection.
 * - Answer: The model for the 'Answer' collection.
 */
module.exports = {
  Liga,
  Match,
  Role,
  Link,
  Answer,
  User
};