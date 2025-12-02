exports.up = function (knex) {
    return knex('app_user')
        .where('username', 'admin')
        .update({
            password_hash: '$2b$10$m6Y5DDasY7gPwwxivAakpOLkt3BR9FgTo9t17L4vW0T8E4SNL4adi'
        });
};

exports.down = function (knex) {
    // No rollback needed for password update in this context
    return Promise.resolve();
};
