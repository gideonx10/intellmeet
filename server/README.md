# IntellMeet — AI-Powered Enterprise Meeting & Collaboration Platform

Production-grade MERN application with real-time video meetings, AI-powered meeting intelligence, and team collaboration. Built during Zidio Development's Web Development (MERN) internship program.

## Tech Stack
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express
- Database: MongoDB (Atlas)
- Cache: Redis (Redis Cloud)
- Real-time: Socket.io, WebRTC
- AI: OpenAI / Whisper (coming Week 3)
- Media storage: Cloudinary

## Backend Setup (current progress — Week 1 complete)

\`\`\`
cd server
npm install
\`\`\`

Create a \`.env\` file with:
\`\`\`
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password
\`\`\`

Run the server:
\`\`\`
npm run dev
\`\`\`

## API Endpoints (Week 1)

### Auth — /api/auth
- POST /signup
- POST /login
- POST /refresh
- POST /logout

### Users — /api/users
- GET /me (protected)
- PUT /profile (protected, multipart form-data: name, avatar)
- DELETE /avatar (protected)

### Meetings — /api/meetings (all protected)
- POST /
- GET /
- GET /join/:code
- GET /:id
- PATCH /:id/start
- PATCH /:id/end
- DELETE /:id

### Chat — /api/chat
- GET /:meetingId (protected)

## Socket.io Events
- join-room, room-participants, user-joined, user-left
- offer, answer, ice-candidate (WebRTC signaling)
- send-message, new-message, typing, user-typing
- send-notification, notification

## Project Status
Week 1 (Days 1–7): Backend foundation, auth, profile, meeting CRUD, Redis caching, real-time chat — Complete

Week 2 (Days 8–14): Frontend & real-time meeting UI — In progress

## Team
- Backend & Architecture
- Frontend & UI
- AI & Integration
2