import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Loader2, CheckCircle2, Circle, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";
import { useGetMeeting, useToggleActionItem } from "@/hooks/useMeetings";
import { cn } from "@/lib/utils";

export default function PostMeetingSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: meeting, refetch } = useGetMeeting(id!);
  const { mutate: toggleActionItem } = useToggleActionItem(id!);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <span className="font-semibold text-slate-800">🤝 IntellMeet</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{meeting?.title || "Meeting Summary"}</h1>
          <p className="text-slate-500 text-sm mt-1">AI-generated meeting recap</p>
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
                {meeting.actionItems.length === 0 ? (
                  <p className="text-sm text-slate-400">No action items identified.</p>
                ) : (
                  meeting.actionItems.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => item._id && toggleActionItem(item._id)}
                      className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left"
                    >
                      {item.done ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={cn("text-sm text-slate-800", item.done && "line-through text-slate-400")}>
                          {item.text}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.assignee}</p>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </main>
    </div>
  );
}
