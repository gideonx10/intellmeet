import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";
import { useCreateMeeting, useJoinMeeting, useMyMeetings } from "@/hooks/useMeetings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Video, Users, Plus, CalendarClock } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { mutate: logout } = useLogout();
  const { mutate: createMeeting, isPending: creating } = useCreateMeeting();
  const { mutate: joinMeeting, isPending: joining, error: joinError } = useJoinMeeting();
  const { data: meetings, isLoading: loadingMeetings } = useMyMeetings();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤝</span>
          <span className="font-semibold text-slate-800">IntellMeet</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user?.name}</span>
          <Button variant="outline" size="sm" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Good to see you, {user?.name?.split(" ")[0]} 👋</h2>
          <p className="text-slate-500 text-sm mt-1">Start a new meeting or join an existing one</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Create Meeting */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-blue-600" />
                </div>
                New Meeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Meeting title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-slate-200"
              />
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!title.trim() || creating}
                onClick={() => createMeeting({ title })}
              >
                <Video className="w-4 h-4 mr-2" />
                {creating ? "Creating..." : "Start meeting"}
              </Button>
            </CardContent>
          </Card>

          {/* Join Meeting */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-green-600" />
                </div>
                Join Meeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Enter meeting code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="border-slate-200 font-mono tracking-widest"
                maxLength={8}
              />
              {joinError && <p className="text-red-500 text-xs">Invalid meeting code</p>}
              <Button
                variant="outline"
                className="w-full border-green-200 text-green-700 hover:bg-green-50"
                disabled={code.length !== 8 || joining}
                onClick={() => joinMeeting(code)}
              >
                {joining ? "Joining..." : "Join meeting"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Meetings</h3>

          {loadingMeetings ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : meetings && meetings.length > 0 ? (
            <div className="space-y-2">
              {meetings.map((m) => (
                <Card key={m._id} className="border border-slate-200 shadow-sm">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{m.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(m.createdAt).toLocaleDateString()} · {m.status}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-dashed border-slate-300 shadow-none">
              <CardContent className="py-10 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                  <CalendarClock className="w-7 h-7 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">No meetings yet</p>
                  <p className="text-xs text-slate-400 mt-1">Your meeting history will show up here</p>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={creating}
                  onClick={() => createMeeting({ title: "Quick Meeting" })}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {creating ? "Starting..." : "Start your first meeting"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}