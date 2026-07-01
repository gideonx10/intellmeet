import { getCache, setCache, deleteCache } from "../utils/cache.js";
import Meeting from '../models/Meeting.js';

// POST /api/meetings — create meeting
export const createMeeting = async (req, res) => {
  try {
    const { title, scheduledAt } = req.body;

    const meeting = await Meeting.create({
      title,
      host: req.user._id,
      scheduledAt: scheduledAt || Date.now(),
      participants: [{ user: req.user._id, role: 'host' }],
    });

    await meeting.populate('host', 'name email avatar');

    res.status(201).json({
      message: 'Meeting created',
      meeting,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/meetings — get all meetings for logged-in user
export const getMyMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [
        { host: req.user._id },
        { 'participants.user': req.user._id },
      ],
    })
      .populate('host', 'name avatar')
      .populate('participants.user', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({ meetings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/meetings/:id — get single meeting
export const getMeeting = async (req, res) => {
  try {
    const cacheKey = `meeting:${req.params.id}`;

    // Check Redis first
    const cached = await getCache(cacheKey);

    if (cached) {
      return res.status(200).json({
        meeting: cached,
        source: 'cache',
      });
    }

    // Fetch from MongoDB
    const meeting = await Meeting.findById(req.params.id)
      .populate('host', 'name email avatar')
      .populate('participants.user', 'name avatar');

    if (!meeting) {
      return res.status(404).json({
        message: 'Meeting not found',
      });
    }

    // Store in Redis for 2 minutes
    await setCache(cacheKey, meeting, 120);

    return res.status(200).json({
      meeting,
      source: 'db',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/meetings/join/:code — join by meeting code
export const getMeetingByCode = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingCode: req.params.code.toUpperCase(),
    }).populate('host', 'name avatar');

    if (!meeting) {
      return res.status(404).json({
        message: 'Invalid meeting code',
      });
    }

    if (meeting.status === 'ended') {
      return res.status(400).json({
        message: 'Meeting has ended',
      });
    }

    res.status(200).json({ meeting });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/meetings/:id/start
export const startMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: 'Meeting not found',
      });
    }

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Only the host can start the meeting',
      });
    }

    meeting.status = 'active';
    meeting.startedAt = Date.now();

    await meeting.save();

    // Clear cached version
    await deleteCache(`meeting:${meeting._id}`);

    res.status(200).json({
      message: 'Meeting started',
      meeting,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/meetings/:id/end
export const endMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: 'Meeting not found',
      });
    }

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Only the host can end the meeting',
      });
    }

    meeting.status = 'ended';
    meeting.endedAt = Date.now();

    await meeting.save();

    // Clear cached version
    await deleteCache(`meeting:${meeting._id}`);

    res.status(200).json({
      message: 'Meeting ended',
      meeting,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/meetings/:id/actionItems/:itemId
export const toggleActionItem = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const item = meeting.actionItems.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Action item not found' });
    }

    item.done = !item.done;
    await meeting.save();
    await deleteCache(`meeting:${meeting._id}`);

    res.status(200).json({ actionItems: meeting.actionItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/meetings/:id
export const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: 'Meeting not found',
      });
    }

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Only the host can delete the meeting',
      });
    }

    // Remove cache before deleting
    await deleteCache(`meeting:${meeting._id}`);

    await meeting.deleteOne();

    res.status(200).json({
      message: 'Meeting deleted',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};