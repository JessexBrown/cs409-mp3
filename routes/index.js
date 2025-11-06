/*
 * Connect all of your endpoints together here.
 */
// routes/index.js
var express = require('express');

/*
 * Connect all of your endpoints together here.
 */
module.exports = function (app, router) {
    // Home route → GET /api/
    app.use('/api', require('./home.js')(router));

    // Users route → /api/users
    var usersRouter = express.Router();
    app.use('/api/users', require('./users.js')(usersRouter));

    // Tasks route → /api/tasks
    var tasksRouter = express.Router();
    app.use('/api/tasks', require('./tasks.js')(tasksRouter));
};
