import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/socket/useSocket";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

interface Message {
  _id: string;
  text: string;
  sender: { _id: string; name: string };
  createdAt: string;
}

export const useChat = (meetingId: string, roomId: string) => {
  const socket = useSocket();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load existing chat history
    api.get(`/chat/${meetingId}`).then(({ data }) => setMessages(data.messages));
  }, [meetingId]);

  useEffect(() => {
    if (!socket) return;

    socket.on("new-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("user-typing", ({ userName }: { userName: string }) => {
      setTypingUser(userName);
    });

    socket.on("user-stop-typing", () => setTypingUser(null));

    return () => {
      socket.off("new-message");
      socket.off("user-typing");
      socket.off("user-stop-typing");
    };
  }, [socket]);

  const sendMessage = (text: string) => {
    if (!text.trim() || !socket) return;
    socket.emit("send-message", {
      roomId,
      meetingId,
      senderId: user?.id,
      senderName: user?.name,
      text,
    });
  };

  const emitTyping = () => {
    socket?.emit("typing", { roomId, userName: user?.name });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket?.emit("stop-typing", { roomId });
    }, 1500);
  };

  return { messages, typingUser, sendMessage, emitTyping };
};