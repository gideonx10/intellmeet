import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected as', socket.id);
  socket.emit('join-room', { roomId: 'TEST123', userId: 'u1', userName: 'Aditya' });

  setTimeout(() => {
    socket.emit('send-message', {
      roomId: 'TEST123',
      meetingId: '6a3154d698402e0f35eef181', // use a real meeting _id from your DB
      senderId: '6a300011518f6819de470f8a',
      senderName: 'Aditya',
      text: 'Hello from test script!',
    });
  }, 1000);
});

socket.on('new-message', (msg) => {
  console.log('New message received:', msg);
});