import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Peer from "simple-peer";
import { useSocket } from "@/socket/useSocket";
import { useAuthStore } from "@/store/authStore";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Monitor, Circle, Users, Captions, Copy } from "lucide-react";
import ChatPanel from "@/components/meeting/ChatPanel";
import ParticipantsList from "@/components/meeting/ParticipantsList";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useRecording } from "@/hooks/useRecording";
import { useTranscription } from "@/hooks/useTranscription";
import { useEndMeeting, useGetMeeting, useStartMeeting } from "@/hooks/useMeetings";
import { useToast } from "@/hooks/useToast";
import { ToastStack } from "@/components/ui/toast";

interface PeerData {
  peer: Peer.Instance;
  socketId: string;
  userName: string;
  stream?: MediaStream;
  screenStream?: MediaStream;
  micOn: boolean;
  camOn: boolean;
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
  const { isSharing, screenStream, toggleScreenShare } = useScreenShare(peersRef);
  const { isRecording, recordingTime, toggleRecording } = useRecording(myStreamRef);
  const { isTranscribing, transcript, toggleTranscription } = useTranscription(id!, myStreamRef);
  const { data: meeting } = useGetMeeting(id!);
  const { mutate: endMeeting } = useEndMeeting();
  const { mutate: startMeeting } = useStartMeeting(id!);
  const isHost = meeting?.host?._id === user?.id;
  const { toasts, showToast } = useToast();

  // hasStartedRef guards against StrictMode's dev-mode double-invoke: both invocations would
  // otherwise see status "scheduled" (before the first mutation's refetch lands) and both fire
  // startMeeting, racing two concurrent saves on the same document version.
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (isHost && meeting?.status === "scheduled") {
      hasStartedRef.current = true;
      startMeeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, meeting?.status]);

  const [peers, setPeers] = useState<PeerData[]>([]);
  const [micOn, setMicOn] = useState(searchParams.get("mic") !== "false");
  const [camOn, setCamOn] = useState(searchParams.get("cam") !== "false");
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  
  const roomId = id!;

  // A peer emits one 'stream' event per distinct MediaStream it sends — the first is always
  // their camera+mic (added at connection time), and simple-peer's addStream/removeStream for
  // screen sharing renegotiates and delivers a second, separate stream later. Route by arrival
  // order rather than merging into a single `stream` field, so a screen share never overwrites
  // the camera feed already being rendered for that peer.
  const handleStream = useCallback((socketId: string, stream: MediaStream) => {
    setPeers((prev) =>
      prev.map((p) => {
        if (p.socketId !== socketId) return p;
        if (!p.stream) return { ...p, stream };
        return { ...p, screenStream: stream };
      })
    );
  }, []);

  useEffect(() => {
    if (!socket) return;

    // getUserMedia is async and outlives React StrictMode's mount/cleanup/remount cycle in dev.
    // Without this guard, a stale run finishes after cleanup and still emits join-room, producing
    // a second, orphaned peer connection for the same socket.
    let cancelled = false;

    const initMedia = async () => {
      // Always request both tracks — the lobby's mic/cam choice should only control the
      // initial *enabled* state, not whether the track exists at all. If a disabled track
      // is never acquired here, there's nothing for toggleMic/toggleCam to flip later, and
      // no video track was ever added to the peer connection for the camera to turn back on.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          console.warn("No media access");
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        stream.getVideoTracks().forEach((t) => (t.enabled = camOn));
        stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
        myStreamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      }

      if (cancelled) return;

      // Join the socket room
      socket.emit("join-room", { roomId, userId: user?.id, userName: user?.name, micOn, camOn });
    };

    initMedia();

    // Someone already in room — we initiate the call to them
    socket.on(
      "room-participants",
      (participants: { socketId: string; userName: string; micOn?: boolean; camOn?: boolean }[]) => {
        participants.forEach(({ socketId, userName, micOn: peerMicOn, camOn: peerCamOn }) => {
          if (peersRef.current.has(socketId)) return;
          const peer = new Peer({ initiator: true, trickle: true, stream: myStreamRef.current || undefined });

          peer.on("signal", (signal) => socket.emit("offer", { to: socketId, offer: signal }));
          peer.on("stream", (stream) => handleStream(socketId, stream));
          peer.on("error", (e) => console.error("Peer error", e));

          const peerData = { peer, socketId, userName, micOn: peerMicOn ?? true, camOn: peerCamOn ?? true };
          peersRef.current.set(socketId, peerData);
          setPeers((prev) => [...prev, peerData]);
        });
      }
    );

    // New peer joined — they initiate; we answer
    socket.on(
      "user-joined",
      ({
        socketId,
        userName,
        micOn: peerMicOn,
        camOn: peerCamOn,
      }: {
        socketId: string;
        userName: string;
        micOn?: boolean;
        camOn?: boolean;
      }) => {
        if (peersRef.current.has(socketId)) return;
        const peer = new Peer({ initiator: false, trickle: true, stream: myStreamRef.current || undefined });

        peer.on("signal", (signal) => socket.emit("answer", { to: socketId, answer: signal }));
        peer.on("stream", (stream) => handleStream(socketId, stream));
        peer.on("error", (e) => console.error("Peer error", e));

        const peerData = { peer, socketId, userName, micOn: peerMicOn ?? true, camOn: peerCamOn ?? true };
        peersRef.current.set(socketId, peerData);
        setPeers((prev) => [...prev, peerData]);
      }
    );

    // Remote peer toggled mic/camera
    socket.on(
      "media-state-changed",
      ({ socketId, micOn: peerMicOn, camOn: peerCamOn }: { socketId: string; micOn: boolean; camOn: boolean }) => {
        const entry = peersRef.current.get(socketId);
        if (entry) peersRef.current.set(socketId, { ...entry, micOn: peerMicOn, camOn: peerCamOn });
        setPeers((prev) =>
          prev.map((p) => (p.socketId === socketId ? { ...p, micOn: peerMicOn, camOn: peerCamOn } : p))
        );
      }
    );

    // Remote peer started/stopped screen sharing — explicit signal rather than inferring from
    // track-ended, since that's flakier to react to across browsers. The actual screen video
    // arrives separately as its own 'stream' event (see handleStream); this just controls
    // whether that peer's screen tile is shown, and clears it immediately on stop.
    socket.on(
      "screen-share-changed",
      ({ socketId, isSharing: peerIsSharing }: { socketId: string; isSharing: boolean }) => {
        if (peerIsSharing) return;
        const entry = peersRef.current.get(socketId);
        if (entry) peersRef.current.set(socketId, { ...entry, screenStream: undefined });
        setPeers((prev) =>
          prev.map((p) => (p.socketId === socketId ? { ...p, screenStream: undefined } : p))
        );
      }
    );

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

    // Host ended the meeting — everyone still in the room gets sent to the summary
    socket.on("meeting-ended", () => {
      navigate(`/meeting/${roomId}/summary`);
    });

    return () => {
      cancelled = true;
      socket.emit("leave-room", { roomId });
      myStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach(({ peer }) => peer.destroy());
      peersRef.current.clear();
      socket.off("room-participants");
      socket.off("user-joined");
      socket.off("media-state-changed");
      socket.off("screen-share-changed");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
      socket.off("meeting-ended");
    };
  }, [socket]);

  const toggleMic = () => {
    const next = !micOn;
    myStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    socket?.emit("media-state-changed", { roomId, micOn: next, camOn });
    showToast(next ? "Microphone unmuted" : "Microphone muted");
  };

  const toggleCam = () => {
    const next = !camOn;
    myStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
    socket?.emit("media-state-changed", { roomId, micOn, camOn: next });
    showToast(next ? "Camera turned on" : "Camera turned off");
  };

  // Screen share, recording, and captions each have a silent-failure path (permission denied,
  // no camera, no mic track) — toasting off the *resulting* state transition rather than the
  // click itself avoids announcing an action that didn't actually happen.
  const mountedTogglesRef = useRef({ share: false, rec: false, cc: false });

  useEffect(() => {
    if (!mountedTogglesRef.current.share) {
      mountedTogglesRef.current.share = true;
      return;
    }
    socket?.emit("screen-share-changed", { roomId, isSharing });
    showToast(isSharing ? "You're sharing your screen" : "Screen sharing stopped");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharing, showToast]);

  useEffect(() => {
    if (!mountedTogglesRef.current.rec) {
      mountedTogglesRef.current.rec = true;
      return;
    }
    showToast(isRecording ? "Recording started" : "Recording stopped — check your downloads");
  }, [isRecording, showToast]);

  useEffect(() => {
    if (!mountedTogglesRef.current.cc) {
      mountedTogglesRef.current.cc = true;
      return;
    }
    showToast(isTranscribing ? "Live captions started" : "Live captions stopped");
  }, [isTranscribing, showToast]);

  const copyMeetingCode = () => {
    if (!meeting?.meetingCode) return;
    navigator.clipboard.writeText(meeting.meetingCode);
    showToast("Meeting code copied to clipboard");
  };

  const handleLeave = () => {
    socket?.emit("leave-room", { roomId });
    myStreamRef.current?.getTracks().forEach((t) => t.stop());

    if (isHost) {
      endMeeting(id!);
    } else {
      navigate("/dashboard");
    }
  };


  // Real participants (for the participant list/count) — deliberately separate from `tiles`
  // below, which also includes synthetic screen-share entries that aren't people.
  const allPeople = [
    { socketId: "me", userName: user?.name || "You", isMe: true, micOn, camOn },
    ...peers.map((p) => ({ socketId: p.socketId, userName: p.userName, isMe: false, micOn: p.micOn, camOn: p.camOn })),
  ];

  type Tile = {
    key: string;
    kind: "camera" | "screen";
    userName: string;
    isMe: boolean;
    stream?: MediaStream | null;
    micOn?: boolean;
    camOn?: boolean;
  };

  // Screen share is always its own tile, never a substitute for someone's camera tile — a
  // presenter's camera (on or off) and their screen share render side by side, same as
  // everyone else's, exactly like independent participants would.
  const tiles: Tile[] = [
    { key: "me", kind: "camera", userName: user?.name || "You", isMe: true, stream: null, micOn, camOn },
    ...(isSharing && screenStream ? [{ key: "me-screen", kind: "screen" as const, userName: user?.name || "You", isMe: true, stream: screenStream }] : []),
    ...peers.flatMap((p) => [
      { key: p.socketId, kind: "camera" as const, userName: p.userName, isMe: false, stream: p.stream, micOn: p.micOn, camOn: p.camOn },
      ...(p.screenStream ? [{ key: `${p.socketId}-screen`, kind: "screen" as const, userName: p.userName, isMe: false, stream: p.screenStream }] : []),
    ]),
  ];

  return (
    <div className="h-screen bg-slate-900 flex flex-col relative">
      <ToastStack toasts={toasts} />

      {isHost && meeting?.meetingCode && (
        <button
          onClick={copyMeetingCode}
          title="Copy meeting code"
          className="absolute top-4 left-4 z-40 flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-full border border-slate-700 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          <span className="font-mono tracking-widest">{meeting.meetingCode}</span>
        </button>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div
          className="flex-1 min-h-0 p-4 grid gap-3 content-start overflow-y-auto"
          style={{ gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)}, 1fr)` }}
        >
          {tiles.map((tile) => (
            <div key={tile.key} className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
              {tile.kind === "screen" ? (
                tile.isMe ? <ScreenPreview stream={tile.stream!} /> : <RemoteVideo stream={tile.stream} />
              ) : tile.isMe ? (
                <video ref={myVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                <RemoteVideo stream={tile.stream} />
              )}

              {tile.kind === "camera" && !tile.camOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold">
                    {tile.userName?.charAt(0).toUpperCase() || "?"}
                  </div>
                </div>
              )}

              {tile.kind === "screen" && (
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Monitor className="w-3 h-3" /> Presenting
                </div>
              )}

              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {tile.userName} {tile.isMe ? "(You)" : ""} {tile.kind === "screen" ? "— screen" : ""}
              </div>

              {tile.kind === "camera" && !tile.micOn && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <MicOff className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          className={`shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out ${
            participantsOpen ? "w-80 opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="w-80 h-full">
            <ParticipantsList
              participants={allPeople.map(({ socketId, userName, isMe, micOn: pMicOn, camOn: pCamOn }) => ({
                socketId,
                userName,
                isMe,
                micOn: pMicOn,
                camOn: pCamOn,
              }))}
            />
          </div>
        </div>

        <div
          className={`shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out ${
            chatOpen ? "w-80 opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="w-80 h-full">
            <ChatPanel meetingId={id!} roomId={roomId} />
          </div>
        </div>
      </div>

      {transcript && (
        <div className="bg-black/70 text-white text-sm px-6 py-2 max-h-24 overflow-y-auto">
          {transcript}
        </div>
      )}

      <div className="bg-slate-800 border-t border-slate-700 px-6 py-4 flex items-center justify-center gap-4">
        <ControlBtn onClick={toggleMic} active={micOn} icon={micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />} />
        <ControlBtn onClick={toggleCam} active={camOn} icon={camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />} />
        <button
          onClick={toggleTranscription}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isTranscribing ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`}
          title={isTranscribing ? "Stop live captions" : "Start live captions"}
        >
          <Captions className="w-5 h-5" />
        </button>
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
        <ControlBtn
          onClick={() => setParticipantsOpen((p) => !p)}
          active={!participantsOpen}
          icon={<Users className="w-5 h-5" />}
          badge={allPeople.length}
        />
        <ControlBtn onClick={() => setChatOpen((p) => !p)} active={!chatOpen} icon={<MessageSquare className="w-5 h-5" />} />
        <button
          onClick={handleLeave}
          title={isHost ? "End meeting for all" : "Leave meeting"}
          className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
        >
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

function ScreenPreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className="w-full h-full object-contain" />;
}

function ControlBtn({
  onClick,
  active,
  icon,
  badge,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors ${active ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
    >
      {icon}
      {!!badge && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}