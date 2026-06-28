import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { mutate: logout } = useLogout();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤝</span>
          <span className="font-semibold text-slate-800">IntellMeet</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Hey, {user?.name} 👋</span>
          <Button variant="outline" size="sm" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Body placeholder — we'll build this properly on Days 10–14 */}
      <main className="max-w-4xl mx-auto px-6 py-12 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Dashboard coming on Day 10</h2>
          <p className="text-slate-500 text-sm">Auth is working — you're logged in as <strong>{user?.email}</strong></p>
        </div>
      </main>
    </div>
  );
}