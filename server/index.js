import dotenv from 'dotenv';
import redisClient from './config/redis.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import meetingRoutes from './routes/meetingRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import ChatMessage from './models/ChatMessage.js';
import { setIO } from './socket/io.js';

dotenv.config();
connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
});
setIO(io);

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'IntellMeet API running' });
});

// Track who is in which room: roomId -> Set of socketIds
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // User joins a meeting room
  socket.on('join-room', ({ roomId, userId, userName, micOn, camOn }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId).set(socket.id, { userId, userName, micOn, camOn });

    // Tell everyone else in the room that a new peer joined
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      userName,
      micOn,
      camOn,
    });

    // Send current participants list to the new joiner
    const participants = [...rooms.get(roomId).entries()]
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ socketId: id, ...data }));
    socket.emit('room-participants', participants);
  });

  // Broadcast mic/camera toggle to the room
  socket.on('media-state-changed', ({ roomId, micOn, camOn }) => {
    const room = rooms.get(roomId);
    if (room?.has(socket.id)) {
      const participant = room.get(socket.id);
      participant.micOn = micOn;
      participant.camOn = camOn;
    }

    socket.to(roomId).emit('media-state-changed', { socketId: socket.id, micOn, camOn });
  });

  // WebRTC: forward SDP offer to a specific peer
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  // WebRTC: forward SDP answer to a specific peer
  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  // WebRTC: forward ICE candidate to a specific peer
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // =========================
  // CHAT EVENTS
  // =========================

  // Send a chat message
  socket.on('send-message', async ({ roomId, meetingId, senderId, senderName, text }) => {
    try {
      const message = await ChatMessage.create({
        meeting: meetingId,
        sender: senderId,
        text,
      });

      io.to(roomId).emit('new-message', {
        _id: message._id,
        text: message.text,
        sender: {
          _id: senderId,
          name: senderName,
        },
        createdAt: message.createdAt,
      });
    } catch (err) {
      console.error('Send message error:', err);
      socket.emit('message-error', {
        message: 'Failed to send message',
      });
    }
  });

  // Typing indicator
  socket.on('typing', ({ roomId, userName }) => {
    socket.to(roomId).emit('user-typing', {
      userName,
    });
  });

  socket.on('stop-typing', ({ roomId }) => {
    socket.to(roomId).emit('user-stop-typing');
  });

  // Notifications
  socket.on('send-notification', ({ toUserId, type, message, meetingId }) => {
    io.emit('notification', {
      toUserId,
      type,
      message,
      meetingId,
      createdAt: new Date(),
    });
  });

  // =========================
  // ROOM LEAVE EVENTS
  // =========================

  // User leaves room manually
  socket.on('leave-room', ({ roomId }) => {
    handleLeave(socket, roomId);
  });

  // User disconnects (tab close, network drop)
  socket.on('disconnect', () => {
    rooms.forEach((_, roomId) => {
      if (rooms.get(roomId)?.has(socket.id)) {
        handleLeave(socket, roomId);
      }
    });
    console.log('Socket disconnected:', socket.id);
  });
});

function handleLeave(socket, roomId) {
  socket.to(roomId).emit('user-left', { socketId: socket.id });
  socket.leave(roomId);
  if (rooms.has(roomId)) {
    rooms.get(roomId).delete(socket.id);
    if (rooms.get(roomId).size === 0) rooms.delete(roomId);
  }
}

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});