import OpenAI, { toFile } from 'openai';
import Meeting from '../models/Meeting.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/ai/transcribe/:meetingId
export const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const audioFile = await toFile(req.file.buffer, 'chunk.webm', { type: req.file.mimetype });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    const text = transcription.text?.trim();

    if (text) {
      meeting.transcript = meeting.transcript ? `${meeting.transcript} ${text}` : text;
      await meeting.save();
    }

    res.status(200).json({ transcript: text || '' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ai/summarize/:meetingId
export const summarizeMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (!meeting.transcript) {
      return res.status(400).json({ message: 'No transcript available for this meeting' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            "You are a meeting intelligence assistant. Given a meeting transcript, produce: 1) A concise summary (3-5 sentences), 2) A JSON array of action items with shape [{text: string, assignee: string}] where assignee is a name mentioned near the action or 'Unassigned'. Respond ONLY with valid JSON: {summary: string, actionItems: [{text, assignee}]}",
        },
        { role: 'user', content: meeting.transcript },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);

    meeting.summary = parsed.summary;
    meeting.actionItems = parsed.actionItems || [];
    await meeting.save();

    res.status(200).json({ summary: meeting.summary, actionItems: meeting.actionItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
