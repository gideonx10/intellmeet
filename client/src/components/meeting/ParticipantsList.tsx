import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Participant {
  socketId: string;
  userName: string;
  micOn: boolean;
  camOn: boolean;
  isMe: boolean;
}

interface Props {
  participants: Participant[];
}

export default function ParticipantsList({ participants }: Props) {
  return (
    <div className="flex flex-col h-full bg-white rounded-l-2xl shadow-xl border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">
          Participants ({participants.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {participants.map((p) => (
          <div
            key={p.socketId}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50"
          >
            <div className="relative w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {p.userName?.charAt(0).toUpperCase() || "?"}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
            </div>

            <span className="flex-1 text-sm text-slate-800 truncate">
              {p.userName} {p.isMe ? "(You)" : ""}
            </span>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  p.micOn ? "text-slate-500" : "bg-red-50 text-red-500"
                )}
              >
                {p.micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </span>
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  p.camOn ? "text-slate-500" : "bg-red-50 text-red-500"
                )}
              >
                {p.camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
