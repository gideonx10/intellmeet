import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useGetMeeting } from "@/hooks/useMeetings";

export default function LobbyPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: meeting } = useGetMeeting(id!);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      } catch {
        setReady(true); // allow joining even without camera
      }
    };
    getMedia();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((p) => !p);
  };

  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((p) => !p);
  };

  const handleJoin = () => {
    // Stop lobby stream — VideoRoom will get its own stream
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate(`/meeting/${id}?code=${searchParams.get("code")}&mic=${micOn}&cam=${camOn}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-white text-xl font-semibold">{meeting?.title || "Meeting Lobby"}</h1>
          <p className="text-slate-400 text-sm mt-1">Code: <span className="font-mono text-slate-300">{searchParams.get("code")}</span></p>
        </div>

        {/* Camera preview */}
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-video">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-2xl text-white font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}>
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button onClick={toggleCam} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${camOn ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}>
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
        </div>

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base"
          disabled={!ready}
          onClick={handleJoin}
        >
          Join now <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}