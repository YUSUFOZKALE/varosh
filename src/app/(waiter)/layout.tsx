"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
  const ps = usePublicSettings();
  return (
    <div className="min-h-screen bg-surface max-w-lg mx-auto">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <img src="/images/varosh-v.png" alt="Varosh" className="h-7 object-contain" />
          <span className="text-white/40 text-sm font-medium">Garson</span>
        </div>
      </header>
      {children}
    </div>
  );
}
