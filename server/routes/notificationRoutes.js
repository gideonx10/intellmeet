import express from 'express';
import { createNotification, getMyNotifications, markRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', createNotification);
router.get('/me', getMyNotifications);
router.patch('/:id/read', markRead);

export default router;
