import ChatMessage from '../models/ChatMessage.js';

// GET /api/chat/:meetingId
export const getChatHistory = async (req, res) => {
  try {
    const messages = await ChatMessage.find({ meeting: req.params.meetingId })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });
    res.status(200).json({ messages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};