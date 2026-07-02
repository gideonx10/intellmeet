import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import Meeting from '../models/Meeting.js';
import { deleteCache } from '../utils/cache.js';
import { getIO } from '../socket/io.js';

// POST /api/tasks
// When called with an actionItemId whose action item has already been converted to a task
// (actionItem.taskId set), this updates that existing task's assignee/dueDate instead of
// creating a duplicate — covers both "Convert to Task" and "Reassign" from the summary page.
export const createTask = async (req, res) => {
  try {
    const { title, description, assignee, meeting: meetingId, dueDate, actionItemId } = req.body;

    let meetingDoc = null;
    let actionItem = null;
    if (meetingId && actionItemId) {
      meetingDoc = await Meeting.findById(meetingId);
      if (!meetingDoc) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      actionItem = meetingDoc.actionItems.id(actionItemId);
      if (!actionItem) {
        return res.status(404).json({ message: 'Action item not found' });
      }
    }

    let task = actionItem?.taskId ? await Task.findById(actionItem.taskId) : null;
    const isReassignment = !!task;

    if (task) {
      task.assignee = assignee;
      task.dueDate = dueDate;
      await task.save();
    } else {
      task = await Task.create({
        title,
        description,
        assignee,
        meeting: meetingId,
        dueDate,
        createdBy: req.user._id,
      });
    }

    await task.populate('assignee', 'name avatar');
    await task.populate('meeting', 'title');
    await task.populate('createdBy', 'name');

    if (actionItem && !isReassignment) {
      actionItem.taskId = task._id;
      await meetingDoc.save();
    }
    if (meetingId) {
      await deleteCache(`meeting:${meetingId}`);
    }

    if (assignee && assignee.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: assignee,
        type: 'task_assigned',
        message: isReassignment ? `You've been reassigned: ${task.title}` : `You've been assigned: ${task.title}`,
        meetingId: meetingId || undefined,
      });

      const io = getIO();
      if (io) {
        io.emit('notification', {
          ...notification.toObject(),
          toUserId: notification.recipient.toString(),
        });
      }
    }

    res.status(isReassignment ? 200 : 201).json({ message: isReassignment ? 'Task reassigned' : 'Task created', task });
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
