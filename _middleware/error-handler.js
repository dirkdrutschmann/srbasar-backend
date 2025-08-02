/**
 * This module exports a single function, errorHandler, which is a middleware function for handling errors in Express.
 * @module errorHandler
 */

/**
 * Middleware function for handling errors in Express.
 * @param {Error} err - The error object.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
function errorHandler(err, req, res, next) {
    switch (true) {
        case typeof err === 'string':
            // Custom application error
            // If the error message ends with 'not found', it's a 404 error, otherwise it's a 400 error
            const is404 = err.toLowerCase().endsWith('not found');
            const statusCode = is404 ? 404 : 400;
            return res.status(statusCode).json({ message: err });
        case err.name === 'ValidationError':
            // Mongoose validation error
            return res.status(400).json({ message: err.message });
        case err.name === 'UnauthorizedError':
            // JWT authentication error
            return res.status(401).json({ message: 'Unauthorized' });
        default:
            // Unknown error, return a 500 status code
            return res.status(500).json({ message: err.message });
    }
}

module.exports = errorHandler;