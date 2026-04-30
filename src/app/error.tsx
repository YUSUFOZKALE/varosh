"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Bir hata olustu</h2>
        <p className="text-gray-600 mb-4">{error.message || "Beklenmeyen bir hata meydana geldi."}</p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
