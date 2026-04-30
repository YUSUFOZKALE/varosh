import { cookies } from "next/headers";
import { getDb, schema } from "./db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const AUTH_COOKIE = "varosh_session";
const SECRET = process.env.AUTH_SECRET!;
if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET ortam degiskeni tanimlanmali (.env dosyasina ekleyin)");

interface SessionPayload {
  staffId: number;
  name: string;
  role: string;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(b64).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function loginWithPin(pin: string) {
  const db = getDb();
  const staffMember = db.select()
    .from(schema.staff)
    .where(and(eq(schema.staff.pin, pin), eq(schema.staff.isActive, true)))
    .get();

  if (!staffMember) return null;

  const payload: SessionPayload = {
    staffId: staffMember.id,
    name: staffMember.name,
    role: staffMember.role,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };

  return { token: sign(payload), staff: payload };
}

export function getSession(): SessionPayload | null {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

export function getSessionFromToken(token: string): SessionPayload | null {
  return verify(token);
}

export const AUTH_COOKIE_NAME = AUTH_COOKIE;
