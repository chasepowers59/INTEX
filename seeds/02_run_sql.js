const fs = require('fs');
const path = require('path');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
    const sqlPath = path.join(__dirname, 'import_all_data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolon to run statements individually if needed, 
    // but knex.raw usually handles multiple statements if the DB driver supports it.
    // PostgreSQL driver supports multiple statements in one query.
    await knex.raw(sql);
};
