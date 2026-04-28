export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface px-4 py-3 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src="/logo-header.png" alt="VAROSH" className="h-6" />
          <span className="text-white/40 text-sm font-medium">Kurye</span>
        </div>
      </header>
      {children}
    </div>
  );
}
