import Notification from '../models/Notification.js';
import { getIO } from '../socket/io.js';

// POST /api/notifications
export const createNotification = async (req, res) => {
  try {
    const { recipient, type, message, meetingId } = req.body;

    const notification = await Notification.create({ recipient, type, message, meetingId });

    const io = getIO();
    if (io) {
      io.emit('notification', {
        ...notification.toObject(),
        toUserId: notification.recipient.toString(),
      });
    }

    res.status(201).json({ notification });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/notifications/me
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ notifications });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(200).json({ notification });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
