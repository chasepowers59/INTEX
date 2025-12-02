exports.up = function (knex) {
    return knex('app_user')
        .where('username', 'admin')
        .update({
            password_hash: 'password'
        });
};

exports.down = function (knex) {
    // No rollback needed
    return Promise.resolve();
};
