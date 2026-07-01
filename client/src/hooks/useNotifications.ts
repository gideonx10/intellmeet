import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/socket/useSocket";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { Notification } from "@/types/notification";

export const useNotifications = () => {
  const socket = useSocket();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications/me").then((r) => r.data.notifications as Notification[]),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!socket || !user) return;

    const handleNotification = (payload: Notification & { toUserId: string }) => {
      if (payload.toUserId !== user.id) return;
      qc.setQueryData<Notification[]>(["notifications"], (prev) => [payload, ...(prev ?? [])]);
    };

    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, [socket, user, qc]);

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = () => {
    (query.data ?? []).filter((n) => !n.read).forEach((n) => markRead(n._id));
  };

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    markRead,
    markAllRead,
  };
};
