"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicSettings } from "@/hooks/use-public-settings";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const ps = usePublicSettings();

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];

  async function handleSubmit() {
    if (pin.length < 4) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.role === "courier") router.push("/courier");
      else if (data.role === "cook") router.push("/kitchen");
      else if (data.role === "waiter") router.push("/waiter");
      else router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Giris basarisiz");
      setPin("");
    }
    setLoading(false);
  }

  function handleDigit(d: string) {
    if (d === "C") { setPin(""); setError(""); return; }
    if (d === "OK") { handleSubmit(); return; }
    if (pin.length < 6) setPin(pin + d);
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <img src="/images/varosh-full.png" alt="Varosh" className="h-14 mx-auto object-contain" />
          <p className="text-white/40 text-sm mt-2">PIN ile giris yapin</p>
        </div>

        <div className="bg-surface-1 rounded-2xl border border-border p-6">
          <div className="flex justify-center gap-2 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  i < pin.length ? "bg-accent border-accent" : "border-white/20"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center mb-4">{error}</p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {digits.map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                disabled={loading}
                className={`py-4 rounded-xl text-lg font-semibold transition-all ${
                  d === "OK"
                    ? "btn-primary"
                    : d === "C"
                    ? "bg-surface-3 text-red-400 hover:bg-red-600/20"
                    : "bg-surface-2 hover:bg-surface-3 text-white"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
