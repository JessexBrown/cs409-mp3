// models/task.js

var mongoose = require('mongoose');

var TaskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    // _id of the assigned user, or "" if unassigned
    assignedUser: {
      type: String,
      default: '',
    },
    // name of assigned user, or "unassigned"
    assignedUserName: {
      type: String,
      default: 'unassigned',
      trim: true,
    },
    dateCreated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', TaskSchema);
