export function Loading({ text = "Yukleniyor..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-white/40">
      <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin mb-3" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-red-400 text-sm mb-3">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-xs">
          Tekrar Dene
        </button>
      )}
    </div>
  );
}
