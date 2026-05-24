import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "PNG, JPEG veya WEBP olmali" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Dosya 5MB dan buyuk" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const publicDir = path.join(process.cwd(), "public");

  const icon512 = await sharp(buffer).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ quality: 90 }).toBuffer();
  const icon192 = await sharp(buffer).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ quality: 90 }).toBuffer();
  const favicon = await sharp(buffer).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ quality: 90 }).toBuffer();

  fs.writeFileSync(path.join(publicDir, "icon-512.png"), icon512);
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), icon192);
  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), icon192);
  fs.writeFileSync(path.join(publicDir, "favicon.png"), favicon);

  return NextResponse.json({ ok: true });
}
