"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePublicSettings } from "@/hooks/use-public-settings";

interface NavItem { href: string; label: string; icon: string; roles?: string[] }

const NAV: NavItem[] = [
  { href: "/", label: "Panel", icon: "\u{1F4CA}", roles: ["owner", "cashier"] },
  { href: "/orders", label: "Siparisler", icon: "\u{1F4E6}", roles: ["owner", "cashier"] },
  { href: "/pos", label: "Yeni Siparis", icon: "+", roles: ["owner", "cashier"] },
  { href: "/kitchen", label: "Mutfak", icon: "\u{1F468}\u{200D}\u{1F373}", roles: ["owner", "cook"] },
  { href: "/menu", label: "Menu", icon: "\u{1F37D}️", roles: ["owner"] },
  { href: "/cashier", label: "Kasa", icon: "\u{1F4B0}", roles: ["owner", "cashier"] },
  { href: "/stock", label: "Stok", icon: "\u{1F4E6}", roles: ["owner"] },
  { href: "/customers", label: "Musteriler", icon: "\u{1F465}", roles: ["owner"] },
  { href: "/delivery", label: "Teslimat", icon: "\u{1F6F5}", roles: ["owner", "courier"] },
  { href: "/staff", label: "Personel", icon: "\u{1F464}", roles: ["owner"] },
  { href: "/checklist", label: "Kontrol", icon: "✅", roles: ["owner", "cashier"] },
  { href: "/reports", label: "Raporlar", icon: "\u{1F4C8}", roles: ["owner"] },
  { href: "/settings", label: "Ayarlar", icon: "⚙️", roles: ["owner"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const ps = usePublicSettings();
  const [role, setRole] = useState<string>("owner");
  const [staffName, setStaffName] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.staffId) {
        setRole(d.role);
        setStaffName(d.name);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border flex items-center justify-between px-4 h-14">
        <button onClick={() => setOpen(!open)} className="text-white/60 text-2xl">☰</button>
        <img src="/images/varosh-full.png" alt="Varosh" className="h-7 object-contain" />
        <div className="w-8" />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-56 bg-surface border-r border-border flex flex-col h-screen transition-transform md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="p-5 border-b border-border">
          <img src="/images/varosh-full.png" alt="Varosh" className="h-8 object-contain" />
          <p className="text-[10px] text-white/30 mt-1">POS Sistemi</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                  active
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/60">{staffName}</p>
              <p className="text-[10px] text-white/20 capitalize">{role}</p>
            </div>
            <button
              onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}
              className="text-white/20 hover:text-red-400 text-xs px-2 py-1 rounded"
            >
              Cikis
            </button>
          </div>
        </div>
      </aside>

      {/* Spacer for mobile top bar */}
      <div className="md:hidden h-14 shrink-0" />
    </>
  );
}
