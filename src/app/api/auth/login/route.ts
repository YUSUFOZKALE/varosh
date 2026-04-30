import { NextRequest, NextResponse } from "next/server";
import { loginWithPin, AUTH_COOKIE_NAME } from "@/lib/auth";

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Cok fazla deneme. 15 dakika bekleyin." }, { status: 429 });
  }

  const { pin } = await req.json();

  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN gerekli" }, { status: 400 });
  }

  const result = loginWithPin(pin);
  if (!result) {
    return NextResponse.json({ error: "Gecersiz PIN" }, { status: 401 });
  }

  const response = NextResponse.json({
    name: result.staff.name,
    role: result.staff.role,
  });

  response.cookies.set(AUTH_COOKIE_NAME, result.token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });

  return response;
}
