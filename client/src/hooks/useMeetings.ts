import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import type { Meeting } from "@/types/meeting";

export const useCreateMeeting = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: { title: string }) => api.post("/meetings", data),
    onSuccess: ({ data }) => {
      navigate(`/lobby/${data.meeting._id}?code=${data.meeting.meetingCode}`);
    },
  });
};

export const useJoinMeeting = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (code: string) => api.get(`/meetings/join/${code}`),
    onSuccess: ({ data }) => {
      navigate(`/lobby/${data.meeting._id}?code=${data.meeting.meetingCode}`);
    },
  });
};

export const useGetMeeting = (id: string) =>
  useQuery({
    queryKey: ["meeting", id],
    queryFn: () => api.get(`/meetings/${id}`).then((r) => r.data.meeting),
    enabled: !!id,
  });

export const useMyMeetings = () =>
  useQuery({
    queryKey: ["meetings"],
    queryFn: () => api.get("/meetings").then((r) => r.data.meetings as Meeting[]),
  });

export const useStartMeeting = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`/meetings/${id}/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", id] }),
  });
};

export const useEndMeeting = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/meetings/${id}/end`),
    onSuccess: () => navigate("/dashboard"),
  });
};