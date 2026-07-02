import type { ToastItem } from "@/hooks/useToast";

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-slate-900/90 text-white text-sm px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
