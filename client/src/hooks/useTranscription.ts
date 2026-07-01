import { useCallback, useRef, useState } from "react";
import api from "@/lib/api";

const CHUNK_DURATION_MS = 30000;

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
