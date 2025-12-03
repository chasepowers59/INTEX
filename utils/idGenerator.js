const crypto = require('crypto');

function generateId() {
    // Generate a random integer between 1 and 2147483647 (Postgres INTEGER max)
    return Math.floor(Math.random() * 2147483647) + 1;
}

module.exports = { generateId };
