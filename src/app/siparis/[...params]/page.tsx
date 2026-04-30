"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SiparisRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const segments = (params.params as string[]) || [];
    const phone = segments[0] || "";
    const name = segments[1] ? decodeURIComponent(segments[1]) : "";

    const query = new URLSearchParams();
    if (phone) query.set("p", phone);
    if (name) query.set("ad", name);

    router.replace(`/siparis?${query.toString()}`);
  }, [params, router]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-sm">Yukleniyor...</p>
      </div>
    </div>
  );
}
