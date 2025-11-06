// routes/tasks.js

var Task = require('../models/task');
var User = require('../models/user');

module.exports = function (router) {
  // /api/tasks
  var tasksRoute = router.route('/');

  // GET /api/tasks
  tasksRoute.get(async function (req, res) {
    try {
        let where = {};
        let sort = null;
        let select = null;
        let skip = 0;
        let limit = 100; // default limit for tasks
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

        // limit (default 100, but can override)
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

        if (count) {
        const docCount = await Task.countDocuments(where);
        return res.status(200).json({
            message: 'Tasks count retrieved successfully',
            data: docCount,
        });
        }

        let query = Task.find(where);

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

        const tasks = await query.exec();

        // If where includes _id and none found, 404 (per FAQ-style behavior)
        const isIdWhere =
        where &&
        Object.prototype.hasOwnProperty.call(where, '_id');

        if (isIdWhere && tasks.length === 0) {
        return res.status(404).json({
            message: 'Task Not Found',
            data: 'Task not found',
        });
        }

        return res.status(200).json({
        message: 'Tasks retrieved successfully',
        data: tasks,
        });
    } catch (err) {
        return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Failed to retrieve tasks',
        });
    }
    });

  // POST /api/tasks
  tasksRoute.post(async function (req, res) {
    try {
      const {
        name,
        description,
        deadline,
        completed,
        assignedUser,
        assignedUserName,
      } = req.body;

      // name + deadline required
      if (!name || !deadline) {
        return res.status(400).json({
          message: 'Bad Request',
          data: 'Task name and deadline are required',
        });
      }

      // Normalize completed: support boolean and string ("true"/"false")
        let completedValue = false;
        if (typeof completed === 'boolean') {
        completedValue = completed;
        } else if (typeof completed === 'string') {
        completedValue = completed.toLowerCase() === 'true';
        }

      // build base task
      const task = new Task({
        name,
        description: description || '',
        deadline,
        completed: completedValue, // default false otherwise
        assignedUser: assignedUser || '',
        assignedUserName: assignedUserName || 'unassigned',
      });

      const savedTask = await task.save();

      // If task is assigned and NOT completed, add to user.pendingTasks
      if (savedTask.assignedUser && savedTask.completed === false) {
        const user = await User.findById(savedTask.assignedUser);
        if (!user) {
          // clean up: delete task if assignedUser is invalid
          await Task.findByIdAndDelete(savedTask._id);
          return res.status(400).json({
            message: 'Bad Request',
            data: 'Assigned user not found',
          });
        }

        if (!user.pendingTasks.includes(String(savedTask._id))) {
          user.pendingTasks.push(String(savedTask._id));
          await user.save();
        }
      }

      return res.status(201).json({
        message: 'Task created successfully',
        data: savedTask,
      });
    } catch (err) {
      return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Could not create task',
      });
    }
  });

  // /api/tasks/:id
  var taskRoute = router.route('/:id');

  // GET /api/tasks/:id
  taskRoute.get(async function (req, res) {
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

        let query = Task.findById(req.params.id);
        if (select) {
        query = query.select(select);
        }

        const task = await query.exec();

        if (!task) {
        return res.status(404).json({
            message: 'Task Not Found',
            data: 'Task not found',
        });
        }
        return res.status(200).json({
        message: 'Task retrieved successfully',
        data: task,
        });
    } catch (err) {
        return res.status(404).json({
        message: 'Task Not Found',
        data: 'Task not found',
        });
    }
    });

  // TODO: PUT /api/tasks/:id
  taskRoute.put(async function (req, res) {
    try {
        const taskId = req.params.id;

        // Find existing task first
        let task = await Task.findById(taskId);
        if (!task) {
        return res.status(404).json({
            message: 'Task Not Found',
            data: 'Task not found',
        });
        }

        const {
        name,
        description,
        deadline,
        completed,
        assignedUser,
        assignedUserName,
        } = req.body;

        // name + deadline required for PUT as well
        if (!name || !deadline) {
        return res.status(400).json({
            message: 'Bad Request',
            data: 'Task name and deadline are required',
        });
        }

        // Determine new completed value (support boolean and "true"/"false")
        let newCompleted = false;
        if (typeof completed === 'boolean') {
        newCompleted = completed;
        } else if (typeof completed === 'string') {
        newCompleted = completed.toLowerCase() === 'true';
        }

        // Handle assignedUser logic
        let newAssignedUserId = assignedUser || '';
        let assignedUserDoc = null;
        let newAssignedUserName = assignedUserName;

        if (newAssignedUserId) {
        assignedUserDoc = await User.findById(newAssignedUserId);
        if (!assignedUserDoc) {
            return res.status(400).json({
            message: 'Bad Request',
            data: 'Assigned user not found',
            });
        }

        // If assignedUserName is missing or wrong, sync to the real user name
        newAssignedUserName = assignedUserName || assignedUserDoc.name;
        } else {
        newAssignedUserName = 'unassigned';
        }

        // Update the task document fields
        task.name = name;
        task.description = description || '';
        task.deadline = deadline;
        task.completed = newCompleted;
        task.assignedUser = newAssignedUserId;
        task.assignedUserName = newAssignedUserName;

        const updatedTask = await task.save();

        // --- Two-way reference maintenance ---

        // Remove this task from all users' pendingTasks first
        await User.updateMany(
        { pendingTasks: String(taskId) },
        { $pull: { pendingTasks: String(taskId) } }
        );

        // If the task is assigned to a user AND is not completed,
        // add it to that user's pendingTasks
        if (newAssignedUserId && newCompleted === false && assignedUserDoc) {
        if (!assignedUserDoc.pendingTasks.includes(String(taskId))) {
            assignedUserDoc.pendingTasks.push(String(taskId));
            await assignedUserDoc.save();
        }
        }

        return res.status(200).json({
        message: 'Task updated successfully',
        data: updatedTask,
        });
    } catch (err) {
        return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Could not update task',
        });
    }
    });

  // TODO: DELETE /api/tasks/:id
  taskRoute.delete(async function (req, res) {
    try {
        const taskId = req.params.id;

        const task = await Task.findById(taskId);
        if (!task) {
        return res.status(404).json({
            message: 'Task Not Found',
            data: 'Task not found',
        });
        }

        const assignedUserId = task.assignedUser;

        // If currently assigned, remove this task from that user's pendingTasks
        if (assignedUserId) {
        await User.updateOne(
            { _id: assignedUserId },
            { $pull: { pendingTasks: String(taskId) } }
        );
        }

        // Delete the task itself
        await Task.findByIdAndDelete(taskId);

        return res.status(200).json({
        message: 'Task deleted successfully',
        data: 'Task was deleted and unassigned from any user',
        });
    } catch (err) {
        return res.status(500).json({
        message: 'Internal Server Error',
        data: 'Could not delete task',
        });
    }
    });

  return router;
};
