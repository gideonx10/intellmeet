import OpenAI, { toFile } from 'openai';
import Meeting from '../models/Meeting.js';
import { deleteCache } from '../utils/cache.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/ai/transcribe/:meetingId
export const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const meetingExists = await Meeting.exists({ _id: req.params.meetingId });
    if (!meetingExists) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const audioFile = await toFile(req.file.buffer, 'chunk.webm', { type: req.file.mimetype });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      // Without a pinned language, Whisper free-guesses per chunk — on short or
      // low-signal audio it can misdetect and "translate" into a random language
      // entirely (classic symptom: stray Arabic/Ukrainian text that was never spoken).
      // Meetings here are assumed English; pinning it eliminates that failure mode.
      language: 'en',
    });

    const text = transcription.text?.trim();

    if (text) {
      // Concurrent 30s chunk uploads can overlap in flight — a plain read-modify-write
      // (findById -> save) loses whichever chunk saves first. This pipeline update appends
      // atomically inside MongoDB instead.
      await Meeting.findByIdAndUpdate(
        req.params.meetingId,
        [
          {
            $set: {
              transcript: {
                $concat: [
                  { $ifNull: ['$transcript', ''] },
                  { $cond: [{ $eq: [{ $ifNull: ['$transcript', ''] }, ''] }, '', ' '] },
                  text,
                ],
              },
            },
          },
        ],
        { updatePipeline: true }
      );
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

    // Idempotent: a summary already exists (e.g. this meeting's summary page was visited
    // before) — re-running would overwrite meeting.actionItems wholesale, discarding any
    // taskId links and done-state already recorded against the current items.
    if (meeting.summary) {
      return res.status(200).json({ summary: meeting.summary, actionItems: meeting.actionItems });
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

    // When a host ends a meeting for everyone, every participant's browser lands on the
    // summary page at once and each independently calls this endpoint. A plain
    // findById -> mutate -> save() races here: the second save hits a Mongoose version
    // conflict (VersionError) against the first, surfacing as a 500 for that participant.
    // This atomic, conditional update only lets the first arrival actually persist —
    // a concurrent loser matches zero documents and both callers converge on the same result.
    const updated = await Meeting.findOneAndUpdate(
      { _id: req.params.meetingId, summary: { $in: [null, ''] } },
      { $set: { summary: parsed.summary, actionItems: parsed.actionItems || [] } },
      { new: true }
    );

    const result = updated || (await Meeting.findById(req.params.meetingId));
    await deleteCache(`meeting:${req.params.meetingId}`);

    res.status(200).json({ summary: result.summary, actionItems: result.actionItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
