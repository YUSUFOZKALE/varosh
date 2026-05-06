"use client";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 ${
            t.type === "error"
              ? "bg-red-600/95 text-white"
              : t.type === "success"
              ? "bg-green-600/95 text-white"
              : "bg-neutral-800/95 text-white"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
