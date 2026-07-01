import express from 'express';
import multer from 'multer';
import { transcribeAudio, summarizeMeeting } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(protect);

router.post('/transcribe/:meetingId', upload.single('audio'), transcribeAudio);
router.post('/summarize/:meetingId', summarizeMeeting);

export default router;
