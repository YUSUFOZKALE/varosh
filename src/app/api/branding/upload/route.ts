import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { sql } from "drizzle-orm";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  const type = formData.get("type") as string | null;

  if (!file) return NextResponse.json({ error: "Dosya bulunamadi" }, { status: 400 });
  if (!type || !["logo", "header-logo"].includes(type)) {
    return NextResponse.json({ error: "Gecersiz tip: logo veya header-logo" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Gecersiz dosya tipi" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya 5MB'dan buyuk olamaz" }, { status: 400 });
  }

  const brandingDir = path.join(process.cwd(), "public", "images", "branding");
  await mkdir(brandingDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let filename: string;
  if (file.type === "image/svg+xml") {
    filename = `${type}.svg`;
    await writeFile(path.join(brandingDir, filename), buffer);
  } else {
    filename = `${type}.png`;
    const optimized = await sharp(buffer)
      .resize(type === "logo" ? 512 : 800, type === "logo" ? 512 : 200, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ quality: 90 })
      .toBuffer();
    await writeFile(path.join(brandingDir, filename), optimized);
  }

  const imageUrl = `/images/branding/${filename}`;
  const settingKey = type === "logo" ? "business_logo_url" : "business_header_logo_url";

  const db = getDb();
  db.insert(schema.settings)
    .values({ key: settingKey, value: imageUrl, updatedAt: sql`(datetime('now','localtime'))` })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: imageUrl, updatedAt: sql`(datetime('now','localtime'))` },
    })
    .run();

  return NextResponse.json({ imageUrl });
}
