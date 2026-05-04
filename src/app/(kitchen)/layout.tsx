export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <img src="/images/varosh-v.png" alt="Varosh" className="h-7 object-contain" />
          <span className="text-white/40 text-sm font-medium">Mutfak</span>
        </div>
      </header>
      {children}
    </div>
  );
}
