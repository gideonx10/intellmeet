import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyTasks, useCreateTask, useUpdateTaskStatus } from "@/hooks/useTasks";
import { useMyMeetings } from "@/hooks/useMeetings";
import type { Task } from "@/types/task";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { data: tasks, isLoading: loadingTasks, error: tasksError } = useMyTasks();
  const { data: meetings } = useMyMeetings();
  const { mutate: createTask, isPending: creating, error: createError } = useCreateTask();
  const { mutate: updateStatus } = useUpdateTaskStatus();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const participants = useMemo(() => {
    const map = new Map<string, { _id: string; name: string }>();
    meetings?.forEach((m) => {
      map.set(m.host._id, { _id: m.host._id, name: m.host.name });
      m.participants?.forEach((p) => {
        if (p.user) map.set(p.user._id, { _id: p.user._id, name: p.user.name });
      });
    });
    return [...map.values()];
  }, [meetings]);

  const handleCreate = () => {
    if (!title.trim() || !assignee) return;
    createTask(
      { title, assignee, dueDate: dueDate || undefined },
      {
        onSuccess: () => {
          setTitle("");
          setAssignee("");
          setDueDate("");
          setShowForm(false);
        },
      }
    );
  };

  const handleDrop = (status: Task["status"]) => {
    if (draggedId) updateStatus({ id: draggedId, status });
    setDraggedId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-slate-800">Workspace</span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tasksError && (
          <p className="text-sm text-red-500 mb-4">
            {isAxiosError(tasksError) ? tasksError.response?.data?.message || "Failed to load tasks" : "Failed to load tasks"}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
              className="bg-slate-100 rounded-xl p-3 min-h-[420px]"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                {col.key === "todo" && (
                  <Button size="icon-sm" variant="ghost" onClick={() => setShowForm((p) => !p)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {col.key === "todo" && showForm && (
                <div className="bg-white rounded-lg p-3 mb-3 space-y-2 shadow-sm">
                  {createError && (
                    <p className="text-xs text-red-500">
                      {isAxiosError(createError) ? createError.response?.data?.message || "Failed to create task" : "Failed to create task"}
                    </p>
                  )}
                  <Input
                    placeholder="Task title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-sm"
                  />
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Assign to...</option>
                    {participants.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!title.trim() || !assignee || creating}
                    onClick={handleCreate}
                  >
                    {creating ? "Adding..." : "Add task"}
                  </Button>
                </div>
              )}

              {loadingTasks ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks
                    ?.filter((t) => t.status === col.key)
                    .map((task) => (
                      <div
                        key={task._id}
                        draggable
                        onDragStart={() => setDraggedId(task._id)}
                        className="bg-white rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing"
                      >
                        <p className="text-sm font-medium text-slate-800">{task.title}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center shrink-0">
                              {task.assignee?.name?.[0]?.toUpperCase()}
                            </div>
                            {task.meeting && (
                              <span className="text-xs text-slate-400 truncate">{task.meeting.title}</span>
                            )}
                          </div>
                          {task.dueDate && (
                            <span className="text-xs text-slate-400 shrink-0">
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
