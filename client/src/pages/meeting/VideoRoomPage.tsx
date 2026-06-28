import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Peer from "simple-peer";
import { useSocket } from "@/socket/useSocket";
import { useAuthStore } from "@/store/authStore";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Monitor, Circle} from "lucide-react";
import ChatPanel from "@/components/meeting/ChatPanel";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useRecording } from "@/hooks/useRecording";

interface PeerData {
  peer: Peer.Instance;
  socketId: string;
  userName: string;
  stream?: MediaStream;
}

export default function VideoRoomPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const socket = useSocket();
  const { user } = useAuthStore();
  
  const navigate = useNavigate();

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const myStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerData>>(new Map());
  const { isSharing, toggleScreenShare } = useScreenShare(myStreamRef, peersRef);
  const { isRecording, recordingTime, toggleRecording } = useRecording(myStreamRef);

  const [peers, setPeers] = useState<PeerData[]>([]);
  const [micOn, setMicOn] = useState(searchParams.get("mic") !== "false");
  const [camOn, setCamOn] = useState(searchParams.get("cam") !== "false");
  const [chatOpen, setChatOpen] = useState(false);
  
  const roomId = id!;

  // Add remote stream to state when peer connects
  const handleStream = useCallback((socketId: string, stream: MediaStream) => {
    setPeers((prev) =>
      prev.map((p) => (p.socketId === socketId ? { ...p, stream } : p))
    );
  }, []);

  useEffect(() => {
    if (!socket) return;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn });
        myStreamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      } catch {
        console.warn("No media access");
      }

      // Join the socket room
      socket.emit("join-room", { roomId, userId: user?.id, userName: user?.name });
    };

    initMedia();

    // Someone already in room — we initiate the call to them
    socket.on("room-participants", (participants: { socketId: string; userName: string }[]) => {
      participants.forEach(({ socketId, userName }) => {
        const peer = new Peer({ initiator: true, trickle: true, stream: myStreamRef.current || undefined });

        peer.on("signal", (signal) => socket.emit("offer", { to: socketId, offer: signal }));
        peer.on("stream", (stream) => handleStream(socketId, stream));
        peer.on("error", (e) => console.error("Peer error", e));

        peersRef.current.set(socketId, { peer, socketId, userName });
        setPeers((prev) => [...prev, { peer, socketId, userName }]);
      });
    });

    // New peer joined — they initiate; we answer
    socket.on("user-joined", ({ socketId, userName }: { socketId: string; userName: string }) => {
      const peer = new Peer({ initiator: false, trickle: true, stream: myStreamRef.current || undefined });

      peer.on("signal", (signal) => socket.emit("answer", { to: socketId, answer: signal }));
      peer.on("stream", (stream) => handleStream(socketId, stream));
      peer.on("error", (e) => console.error("Peer error", e));

      peersRef.current.set(socketId, { peer, socketId, userName });
      setPeers((prev) => [...prev, { peer, socketId, userName }]);
    });

    // Receive offer — signal to existing peer
    socket.on("offer", ({ from, offer }: { from: string; offer: Peer.SignalData }) => {
      peersRef.current.get(from)?.peer.signal(offer);
    });

    // Receive answer
    socket.on("answer", ({ from, answer }: { from: string; answer: Peer.SignalData }) => {
      peersRef.current.get(from)?.peer.signal(answer);
    });

    // Receive ICE candidate
    socket.on("ice-candidate", ({ from, candidate }: { from: string; candidate: Peer.SignalData }) => {
      peersRef.current.get(from)?.peer.signal(candidate);
    });

    // Peer left
    socket.on("user-left", ({ socketId }: { socketId: string }) => {
      peersRef.current.get(socketId)?.peer.destroy();
      peersRef.current.delete(socketId);
      setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    return () => {
      socket.emit("leave-room", { roomId });
      myStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach(({ peer }) => peer.destroy());
      peersRef.current.clear();
      socket.off("room-participants");
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
    };
  }, [socket]);

  const toggleMic = () => {
    myStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((p) => !p);
  };

  const toggleCam = () => {
    myStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((p) => !p);
  };

  const handleLeave = () => {
    socket?.emit("leave-room", { roomId });
    myStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigate("/dashboard");
  };


  const allVideos = [
    { socketId: "me", userName: user?.name || "You", stream: null, isMe: true },
    ...peers.map((p) => ({ ...p, isMe: false })),
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-1 p-4 grid gap-3 content-start"
          style={{ gridTemplateColumns: `repeat(${Math.min(allVideos.length, 3)}, 1fr)` }}
        >
          {allVideos.map(({ socketId, userName, stream, isMe }) => (
            <div key={socketId} className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
              {isMe ? (
                <video ref={myVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                <RemoteVideo stream={stream} />
              )}
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {userName} {isMe ? "(You)" : ""}
              </div>
            </div>
          ))}
        </div>

        {chatOpen && (
          <div className="w-80 flex-shrink-0 h-full">
            <ChatPanel meetingId={id!} roomId={roomId} />
          </div>
        )}
      </div>

      <div className="bg-slate-800 border-t border-slate-700 px-6 py-4 flex items-center justify-center gap-4">
        <ControlBtn onClick={toggleMic} active={micOn} icon={micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />} />
        <ControlBtn onClick={toggleCam} active={camOn} icon={camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />} />
        <button
          onClick={toggleScreenShare}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isSharing ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`}
          title={isSharing ? "Stop sharing" : "Share screen"}
        >
          <Monitor className="w-5 h-5" />
        </button>
        <button
          onClick={toggleRecording}
          className={`flex items-center gap-2 px-4 h-12 rounded-full transition-colors ${isRecording ? "bg-red-500 hover:bg-red-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`}
          title={isRecording ? "Stop recording" : "Start recording"}
        >
          <Circle className={`w-3 h-3 ${isRecording ? "fill-white animate-pulse" : "fill-slate-400"}`} />
          <span className="text-sm font-mono">{isRecording ? recordingTime : "REC"}</span>
        </button>
        <ControlBtn onClick={() => setChatOpen((p) => !p)} active={!chatOpen} icon={<MessageSquare className="w-5 h-5" />} />
        <button onClick={handleLeave} className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center">
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function RemoteVideo({ stream }: { stream: MediaStream | null | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />;
}

function ControlBtn({ onClick, active, icon }: { onClick: () => void; active: boolean; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${active ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}>
      {icon}
    </button>
  );
}