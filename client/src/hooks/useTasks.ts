import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Task } from "@/types/task";

export const useMyTasks = () =>
  useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.get("/tasks").then((r) => r.data.tasks as Task[]),
  });

interface CreateTaskInput {
  title: string;
  assignee: string;
  meeting?: string;
  dueDate?: string;
  // When set, and that action item was already converted, the server updates the
  // existing task's assignee/dueDate instead of creating a duplicate.
  actionItemId?: string;
}

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => api.post("/tasks", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};

export const useUpdateTaskStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task["status"] }) =>
      api.patch(`/tasks/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};
