import express from 'express';
import {
  createMeeting, getMyMeetings, getMeeting,
  getMeetingByCode, startMeeting, endMeeting, deleteMeeting, toggleActionItem
} from '../controllers/meetingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // all meeting routes are protected

router.post('/', createMeeting);
router.get('/', getMyMeetings);
router.get('/join/:code', getMeetingByCode);
router.get('/:id', getMeeting);
router.patch('/:id/start', startMeeting);
router.patch('/:id/end', endMeeting);
router.patch('/:id/actionItems/:itemId', toggleActionItem);
router.delete('/:id', deleteMeeting);

export default router;