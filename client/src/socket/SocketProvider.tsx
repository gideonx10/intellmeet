import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { socket } from "./socket";

interface Props {
  children: React.ReactNode;
}

export function SocketProvider({ children }: Props) {
  const { isAuthenticated, accessToken } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      socket.auth = {
        token: accessToken,
      };

      if (!socket.connected) {
        socket.connect();
      }
    } else {
      socket.disconnect();
    }

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken]);

  return <>{children}</>;
}
