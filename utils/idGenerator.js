const crypto = require('crypto');

function generateId() {
    return crypto.randomBytes(5).toString('hex'); // Generates 10 characters
}

module.exports = { generateId };
