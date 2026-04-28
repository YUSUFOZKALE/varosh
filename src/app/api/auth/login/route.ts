import { NextRequest, NextResponse } from "next/server";
import { loginWithPin, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
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
