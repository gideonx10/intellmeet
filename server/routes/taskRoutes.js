import express from 'express';
import { createTask, getMyTasks, updateTaskStatus, deleteTask } from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', createTask);
router.get('/', getMyTasks);
router.patch('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

export default router;
