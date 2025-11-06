// routes/users.js

var User = require('../models/user');
var Task = require('../models/task');


module.exports = function (router) {
  // /api/users
  var usersRoute = router.route('/');

  // GET /api/users
  usersRoute.get(async function (req, res) {
    try {
        let where = {};
        let sort = null;
        let select = null;
        let skip = 0;
        let limit = null; // no default limit for users
        let count = false;

        // where
        if (req.query.where) {
        try {
            where = JSON.parse(req.query.where);
        } catch (e) {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'Invalid JSON in where parameter',
            });
        }
        }

        // sort
        if (req.query.sort) {
        try {
            sort = JSON.parse(req.query.sort);
        } catch (e) {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'Invalid JSON in sort parameter',
            });
        }
        }

        // select
        if (req.query.select) {
        try {
            select = JSON.parse(req.query.select);
        } catch (e) {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'Invalid JSON in select parameter',
            });
        }
        }

        // skip
        if (req.query.skip) {
        const parsedSkip = parseInt(req.query.skip, 10);
        if (!Number.isNaN(parsedSkip) && parsedSkip >= 0) {
            skip = parsedSkip;
        } else {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'Invalid skip parameter',
            });
        }
        }

        // limit (no default limit for users)
        if (req.query.limit) {
        const parsedLimit = parseInt(req.query.limit, 10);
        if (!Number.isNaN(parsedLimit) && parsedLimit >= 0) {
            limit = parsedLimit;
        } else {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'Invalid limit parameter',
            });
        }
        }

        // count
        if (req.query.count === 'true' || req.query.count === '1') {
        count = true;
        }

        // If count=true, return just the count
        if (count) {
        const docCount = await User.countDocuments(where);
        return res.status(200).json({
            message: 'Users count retrieved successfully',
            data: docCount,
        });
        }

        // Build query
        let query = User.find(where);

        if (sort) {
        query = query.sort(sort);
        }
        if (select) {
        query = query.select(select);
        }
        if (skip) {
        query = query.skip(skip);
        }
        if (limit !== null) {
        query = query.limit(limit);
        }

        const users = await query.exec();

        // Special case: if where targets _id and nothing found, return 404 (per FAQ)
        const isIdWhere =
        where &&
        Object.prototype.hasOwnProperty.call(where, '_id');

        if (isIdWhere && users.length === 0) {
        return res.status(404).json({
            message: 'User Not Found',
            data: 'User not found',
        });
        }

        return res.status(200).json({
        message: 'Users retrieved successfully',
        data: users,
        });
    } catch (err) {
        return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Failed to retrieve users',
        });
    }
    });

  // POST /api/users
  usersRoute.post(async function (req, res) {
    try {
      const { name, email, pendingTasks } = req.body;

      if (!name || !email) {
        return res.status(400).json({
          message: 'Bad Request',
          data: 'Name and email are required',
        });
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({
          message: 'Bad Request',
          data: 'A user with this email already exists',
        });
      }

      const user = new User({
        name,
        email,
        pendingTasks: Array.isArray(pendingTasks) ? pendingTasks : [],
      });

      const saved = await user.save();
      return res.status(201).json({
        message: 'User created successfully',
        data: saved,
      });
    } catch (err) {
      return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Could not create user',
      });
    }
  });

  // /api/users/:id
  var userRoute = router.route('/:id');

  userRoute.get(async function (req, res) {
    try {
        let select = null;

        if (req.query.select) {
        try {
            select = JSON.parse(req.query.select);
        } catch (e) {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'Invalid JSON in select parameter',
            });
        }
        }

        let query = User.findById(req.params.id);
        if (select) {
        query = query.select(select);
        }

        const user = await query.exec();

        if (!user) {
        return res.status(404).json({
            message: 'User Not Found',
            data: 'User not found',
        });
        }
        return res.status(200).json({
        message: 'User retrieved successfully',
        data: user,
        });
    } catch (err) {
        // invalid ObjectId → 404
        return res.status(404).json({
        message: 'User Not Found',
        data: 'User not found',
        });
    }
    });

  // TODO: PUT /api/users/:id
  userRoute.put(async function (req, res) {
    try {
        const userId = req.params.id;

        // Find existing user first
        const existingUser = await User.findById(userId);
        if (!existingUser) {
        return res.status(404).json({
            message: 'User Not Found',
            data: 'User not found',
        });
        }

        const { name, email, pendingTasks } = req.body;

        // Validation: require name + email for update too
        if (!name || !email) {
        return res.status(400).json({
            message: 'Bad Request',
            data: 'Name and email are required',
        });
        }

        // Enforce unique email (excluding this user)
        const emailLower = email.toLowerCase();
        const emailOwner = await User.findOne({ email: emailLower });
        if (emailOwner && String(emailOwner._id) !== String(userId)) {
        return res.status(400).json({
            message: 'Bad Request',
            data: 'A user with this email already exists',
        });
        }

        // Normalize pendingTasks to an array of strings
        let newPendingTasks = Array.isArray(pendingTasks)
        ? pendingTasks.map(String)
        : [];

        // Deduplicate task IDs so the same task doesn't appear multiple times
        newPendingTasks = [...new Set(newPendingTasks)];

        // First, clear this user from all tasks that currently reference them
        await Task.updateMany(
        { assignedUser: String(userId) },
        {
            $set: {
            assignedUser: '',
            assignedUserName: 'unassigned',
            },
        }
        );

        // Now, assign this user to all tasks in newPendingTasks
        // while checking that no other user already has them
        for (const taskId of newPendingTasks) {
        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(400).json({
            message: 'Bad Request',
            data: `Task with id ${taskId} not found`,
            });
        }

        // If this task is assigned to another user, reject (conflict)
        if (task.assignedUser && String(task.assignedUser) !== String(userId)) {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'The task is already assigned to another user',
            });
        }

        // Only pending (not completed) tasks go into pendingTasks
        if (task.completed === false) {
            task.assignedUser = String(userId);
            task.assignedUserName = name;
            await task.save();
        }
        }

        // Update the user document itself (RESTful "replace"-style)
        existingUser.name = name;
        existingUser.email = emailLower;
        existingUser.pendingTasks = newPendingTasks;
        const updatedUser = await existingUser.save();

        return res.status(200).json({
        message: 'User updated successfully',
        data: updatedUser,
        });
    } catch (err) {
        return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Could not update user',
        });
    }
    });
  // TODO: DELETE /api/users/:id
  userRoute.delete(async function (req, res) {
    try {
        const userId = req.params.id;

        const user = await User.findById(userId);
        if (!user) {
        return res.status(404).json({
            message: 'User Not Found',
            data: 'User not found',
        });
        }

        // Unassign this user's pending tasks
        await Task.updateMany(
        { assignedUser: String(userId) },
        {
            $set: {
            assignedUser: '',
            assignedUserName: 'unassigned',
            },
        }
        );

        // Delete the user
        await User.findByIdAndDelete(userId);

        return res.status(200).json({
        message: 'User deleted successfully',
        data: 'User and their pending tasks were unassigned',
        });
    } catch (err) {
        return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Could not delete user',
        });
    }
    });

  return router;
};
