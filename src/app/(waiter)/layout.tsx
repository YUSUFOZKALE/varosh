"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  const ps = usePublicSettings();
  return (
    <div className="h-[100dvh] flex flex-col bg-surface max-w-lg mx-auto">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <img src="/images/varosh-v.png" alt="Varosh" className="h-7 object-contain" />
          <span className="text-white/40 text-sm font-medium">Garson</span>
        </div>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
