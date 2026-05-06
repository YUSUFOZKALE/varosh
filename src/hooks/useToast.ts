"use client";
import { useState, useCallback, useRef } from "react";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const error = useCallback((msg: string) => show(msg, "error"), [show]);
  const success = useCallback((msg: string) => show(msg, "success"), [show]);
  const info = useCallback((msg: string) => show(msg, "info"), [show]);

  return { toasts, error, success, info };
}
