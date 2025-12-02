/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table('app_user', function (table) {
        table.string('participant_id', 10);
        table.foreign('participant_id').references('participants.participant_id');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table('app_user', function (table) {
        table.dropColumn('participant_id');
    });
};
