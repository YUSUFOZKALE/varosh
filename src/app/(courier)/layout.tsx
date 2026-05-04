"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { usePublicSettings } from "@/hooks/use-public-settings";

const NAV_ITEMS = [
  { href: "/courier", label: "Teslimatlar", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
  { href: "/courier/packages", label: "Paketlerim", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/courier/wallet", label: "Kasa", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
];

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  const ps = usePublicSettings();
  const pathname = usePathname();

  const isBatchPage = pathname.startsWith("/courier/batch/");

  return (
    <div className="min-h-screen bg-surface flex flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/images/varosh-v.png" alt="Varosh" className="h-7 object-contain" />
          <span className="text-white/40 text-sm font-medium">Kurye</span>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      {!isBatchPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-sm border-t border-border max-w-md mx-auto">
          <div className="flex">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/courier" ? pathname === "/courier" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${active ? "text-amber-400" : "text-white/30"}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
