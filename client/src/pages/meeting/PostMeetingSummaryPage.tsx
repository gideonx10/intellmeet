import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Loader2,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Printer,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";
import { useGetMeeting, useToggleActionItem } from "@/hooks/useMeetings";
import { useCreateTask } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/types/meeting";

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return null;

  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)} min ${totalSeconds % 60} sec`;
}

export default function PostMeetingSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: meeting, refetch } = useGetMeeting(id!);
  const { mutate: toggleActionItem } = useToggleActionItem(id!);
  const { mutate: createTask, isPending: creatingTask, error: createTaskError } = useCreateTask();

  const [showTranscript, setShowTranscript] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
  const [formAssignee, setFormAssignee] = useState("");
  const [formDueDate, setFormDueDate] = useState("");

  const {
    mutate: summarize,
    isPending,
    isError,
    error,
    isSuccess,
  } = useMutation({
    mutationFn: () => api.post(`/ai/summarize/${id}`),
    onSuccess: () => refetch(),
  });

  useEffect(() => {
    summarize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const noTranscript = isError && isAxiosError(error) && error.response?.status === 400;
  const duration = formatDuration(meeting?.startedAt, meeting?.endedAt);

  const openConvertForm = (item: ActionItem) => {
    setOpenItemId(item._id ?? null);
    const match = meeting?.participants.find(
      (p) => p.user.name.toLowerCase() === item.assignee.toLowerCase()
    );
    setFormAssignee(match?.user._id ?? "");
    setFormDueDate("");
  };

  const handleConvert = (item: ActionItem) => {
    if (!formAssignee || !item._id) return;
    createTask(
      { title: item.text, assignee: formAssignee, meeting: id, dueDate: formDueDate || undefined },
      {
        onSuccess: () => {
          setConvertedIds((prev) => new Set(prev).add(item._id!));
          setOpenItemId(null);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="no-print bg-white border-b border-slate-200 px-6 py-4">
        <span className="font-semibold text-slate-800">🤝 IntellMeet</span>
      </header>

      <main className="print-summary max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{meeting?.title || "Meeting Summary"}</h1>
            <p className="text-slate-500 text-sm mt-1">AI-generated meeting recap</p>
            {duration && (
              <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {duration}
              </p>
            )}
          </div>
          {isSuccess && (
            <Button variant="outline" size="sm" className="no-print shrink-0" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print / Export
            </Button>
          )}
        </div>

        {isPending && (
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="py-16 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-500">Generating AI summary...</p>
            </CardContent>
          </Card>
        )}

        {noTranscript && (
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="py-10 flex flex-col items-center text-center gap-3">
              <Sparkles className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-600 max-w-sm">
                No transcript recorded for this meeting. Start a meeting and enable transcription to get AI
                summaries.
              </p>
            </CardContent>
          </Card>
        )}

        {isError && !noTranscript && (
          <Card className="border border-red-200 shadow-sm">
            <CardContent className="py-6">
              <p className="text-sm text-red-600">
                {isAxiosError(error) ? error.response?.data?.message || error.message : "Something went wrong generating the summary."}
              </p>
            </CardContent>
          </Card>
        )}

        {isSuccess && meeting && (
          <>
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 leading-relaxed">{meeting.summary}</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Action Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {createTaskError && (
                  <p className="text-xs text-red-500 mb-2">
                    {isAxiosError(createTaskError)
                      ? createTaskError.response?.data?.message || "Failed to create task"
                      : "Failed to create task"}
                  </p>
                )}
                {meeting.actionItems.length === 0 ? (
                  <p className="text-sm text-slate-400">No action items identified.</p>
                ) : (
                  meeting.actionItems.map((item) => (
                    <div key={item._id} className="rounded-lg hover:bg-slate-50">
                      <div className="w-full flex items-start gap-3 px-3 py-2">
                        <button
                          onClick={() => item._id && toggleActionItem(item._id)}
                          className="mt-0.5 shrink-0"
                        >
                          {item.done ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm text-slate-800", item.done && "line-through text-slate-400")}>
                            {item.text}
                          </p>
                          <span className="inline-block mt-1 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                            {item.assignee}
                          </span>
                        </div>

                        {item._id && convertedIds.has(item._id) ? (
                          <span className="no-print text-xs text-green-600 font-medium shrink-0 mt-1">
                            Task created ✓
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="no-print shrink-0"
                            onClick={() => openConvertForm(item)}
                          >
                            Convert to Task
                          </Button>
                        )}
                      </div>

                      {openItemId === item._id && (
                        <div className="no-print px-3 pb-3 pl-11 space-y-2">
                          <select
                            value={formAssignee}
                            onChange={(e) => setFormAssignee(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Assign to...</option>
                            {meeting.participants.map((p) => (
                              <option key={p.user._id} value={p.user._id}>
                                {p.user.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={formDueDate}
                            onChange={(e) => setFormDueDate(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={!formAssignee || creatingTask}
                              onClick={() => handleConvert(item)}
                            >
                              {creatingTask ? "Creating..." : "Create Task"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setOpenItemId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <button
                  onClick={() => setShowTranscript((p) => !p)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <CardTitle className="text-base">Transcript</CardTitle>
                  {showTranscript ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </CardHeader>
              {showTranscript && (
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {meeting.transcript || "No transcript recorded"}
                  </p>
                </CardContent>
              )}
            </Card>
          </>
        )}

        <Button variant="outline" className="no-print w-full" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </main>
    </div>
  );
}
