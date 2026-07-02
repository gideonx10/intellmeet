import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface Props {
  meetingId: string;
  roomId: string;
}

export default function ChatPanel({ meetingId, roomId }: Props) {
  const { user } = useAuthStore();
  const { messages, typingUser, sendMessage, emitTyping } = useChat(meetingId, roomId);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-l-2xl shadow-xl border border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Meeting Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-slate-400 text-xs text-center mt-8">No messages yet. Say hi! 👋</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender._id === user?.id;
          return (
            <div key={msg._id} className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
              {!isMe && <span className="text-xs text-slate-500 ml-1">{msg.sender.name}</span>}
              <div className={cn("px-3 py-2 rounded-2xl text-sm max-w-[80%] wrap-break-word", isMe ? "bg-blue-600 text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm")}>
                {msg.text}
              </div>
              <span className="text-xs text-slate-400 mx-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        {typingUser && (
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 rounded-2xl px-3 py-2 text-xs text-slate-500 flex items-center gap-1">
              <span>{typingUser} is typing</span>
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); emitTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button onClick={handleSend} disabled={!text.trim()} className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}