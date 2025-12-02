const bcrypt = require('bcrypt');
const fs = require('fs');

async function generateHash() {
    const password = 'password';
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    fs.writeFileSync('hash.txt', hash);
}

generateHash();
