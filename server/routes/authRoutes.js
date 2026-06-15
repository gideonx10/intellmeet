import express from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, refreshToken, logout } from '../controllers/authController.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests, try again in 15 minutes' },
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;