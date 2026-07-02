import { useCallback, useRef, useState } from "react";
import api from "@/lib/api";

// Reverted to the 30s chunks verified working in QA. A shorter (12s) window was tried for
// latency but shorter chunks give Whisper less linguistic context per call, which measurably
// increased hallucination (stray text in random languages, phantom phrases) on real testing.
// Correctness matters more here than latency — the transcript quality gates whether the AI
// summary/action-item extraction can work at all.
const CHUNK_DURATION_MS = 30000;

// Below this RMS, a chunk is treated as silence/near-silence and skipped rather than sent to
// Whisper — very short/quiet audio is exactly the case where Whisper tends to hallucinate text
// that was never actually said (classic case: invented "thanks for watching"-style phrases).
const SILENCE_RMS_THRESHOLD = 0.015;

// Below this duration, a chunk can't contain a complete meaningful utterance regardless of its
// energy — skip it rather than risk Whisper hallucinating on a fragment.
const MIN_CHUNK_DURATION_SEC = 1.5;

async function isSilent(blob: Blob): Promise<boolean> {
  let audioCtx: AudioContext | undefined;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    if (audioBuffer.duration < MIN_CHUNK_DURATION_SEC) return true;

    const channelData = audioBuffer.getChannelData(0);
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) sumSquares += channelData[i] * channelData[i];
    const rms = Math.sqrt(sumSquares / channelData.length);

    return rms < SILENCE_RMS_THRESHOLD;
  } catch {
    // If we can't decode/analyze it, don't block sending — err on the side of transcribing.
    return false;
  } finally {
    audioCtx?.close();
  }
}

export const useTranscription = (
  meetingId: string,
  myStreamRef: React.MutableRefObject<MediaStream | null>
) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");

  const activeRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendChunk = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) return;
      if (await isSilent(blob)) return;

      const formData = new FormData();
      formData.append("audio", blob, "chunk.webm");

      try {
        const { data } = await api.post(`/ai/transcribe/${meetingId}`, formData, {
          headers: { "Content-Type": undefined },
        });
        if (data.transcript) {
          setTranscript((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
        }
      } catch (err) {
        console.error("Transcription chunk failed:", err);
      }
    },
    [meetingId]
  );

  // Each chunk is its own start/stop cycle so every blob is a self-contained,
  // independently decodable webm file — a single MediaRecorder timeslice
  // only puts container headers on the first chunk.
  const recordChunk = useCallback(
    (audioStream: MediaStream) => {
      const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
      const parts: Blob[] = [];
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) parts.push(e.data);
      };

      recorder.onstop = () => {
        sendChunk(new Blob(parts, { type: "audio/webm" }));
        if (activeRef.current) recordChunk(audioStream);
      };

      recorder.start();
      timerRef.current = setTimeout(() => recorder.stop(), CHUNK_DURATION_MS);
    },
    [sendChunk]
  );

  const toggleTranscription = () => {
    if (activeRef.current) {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      recorderRef.current?.stop();
      setIsTranscribing(false);
      return;
    }

    const audioTracks = myStreamRef.current?.getAudioTracks() ?? [];
    if (audioTracks.length === 0) return;

    activeRef.current = true;
    setIsTranscribing(true);
    recordChunk(new MediaStream(audioTracks));
  };

  return { isTranscribing, transcript, toggleTranscription };
};
