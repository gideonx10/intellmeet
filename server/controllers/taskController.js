import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import { getIO } from '../socket/io.js';

// POST /api/tasks
export const createTask = async (req, res) => {
  try {
    const { title, description, assignee, meeting, dueDate } = req.body;

    const task = await Task.create({
      title,
      description,
      assignee,
      meeting,
      dueDate,
      createdBy: req.user._id,
    });

    await task.populate('assignee', 'name avatar');
    await task.populate('meeting', 'title');
    await task.populate('createdBy', 'name');

    if (assignee && assignee.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: assignee,
        type: 'task_assigned',
        message: `You've been assigned: ${title}`,
        meetingId: meeting || undefined,
      });

      const io = getIO();
      if (io) {
        io.emit('notification', {
          ...notification.toObject(),
          toUserId: notification.recipient.toString(),
        });
      }
    }

    res.status(201).json({ message: 'Task created', task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tasks
export const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [{ assignee: req.user._id }, { createdBy: req.user._id }],
    })
      .populate('assignee', 'name avatar')
      .populate('createdBy', 'name')
      .populate('meeting', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({ tasks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/tasks/:id/status
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isAssignee = task.assignee.toString() === req.user._id.toString();
    const isCreator = task.createdBy.toString() === req.user._id.toString();

    if (!isAssignee && !isCreator) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    task.status = status;
    await task.save();
    await task.populate('assignee', 'name avatar');
    await task.populate('meeting', 'title');

    res.status(200).json({ task });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/tasks/:id
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the creator can delete this task' });
    }

    await task.deleteOne();

    res.status(200).json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
