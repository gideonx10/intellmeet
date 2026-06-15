import express from 'express';
import { getMe, updateProfile, deleteAvatar } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

router.get('/me', protect, getMe);

router.put('/profile', protect, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      console.error("UPLOAD ERROR FULL:");
      console.dir(err, { depth: null });

      return res.status(500).json({
        error: err,
        message: err.message,
      });
    }

    next();
  });
}, updateProfile);

router.delete('/avatar', protect, deleteAvatar);

export default router;