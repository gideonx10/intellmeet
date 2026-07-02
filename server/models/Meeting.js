import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const participantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  role: { type: String, enum: ['host', 'participant'], default: 'participant' },
});

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
  },
  meetingCode: {
    type: String,
    unique: true,
    default: () => uuidv4().slice(0, 8).toUpperCase(),
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participants: [participantSchema],
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended'],
    default: 'scheduled',
  },
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  endedAt: { type: Date },
  recording: { type: String, default: '' },
  transcript: { type: String, default: '' },
  summary: { type: String, default: '' },
  actionItems: [{
    text: String,
    assignee: String,
    done: { type: Boolean, default: false },
    // Set once an action item is converted to a Task, so the summary page can show the
    // task's live assignee/status instead of the stale AI-suggested `assignee` string.
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  }],
}, { timestamps: true });

const Meeting = mongoose.model('Meeting', meetingSchema);
export default Meeting;