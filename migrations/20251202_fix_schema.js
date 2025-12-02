/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Use raw SQL to make participant_id nullable - safer for existing FKs
    await knex.raw('ALTER TABLE donations ALTER COLUMN participant_id DROP NOT NULL');

    const hasTable = await knex.schema.hasTable('milestone_templates');
    if (!hasTable) {
        await knex.schema.createTable('milestone_templates', function (table) {
            table.increments('id').primary();
            table.string('title', 255).notNullable();
            table.text('description');
            table.integer('days_from_start').defaultTo(0);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('milestone_templates');
    // Revert participant_id to NOT NULL (might fail if nulls exist, but standard for down)
    await knex.raw('ALTER TABLE donations ALTER COLUMN participant_id SET NOT NULL');
};
