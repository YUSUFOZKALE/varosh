"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  const ps = usePublicSettings();
  return (
    <div className="min-h-screen bg-surface px-4 py-3 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {ps.headerLogoUrl ? <img src={ps.headerLogoUrl} alt={ps.businessName} className="h-6 object-contain" /> : <span className="font-bold text-amber-400 text-sm">{ps.businessName}</span>}
          <span className="text-white/40 text-sm font-medium">Kurye</span>
        </div>
      </header>
      {children}
    </div>
  );
}
