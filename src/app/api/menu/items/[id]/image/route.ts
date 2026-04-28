import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const db = getDb();

  const item = db.select().from(schema.menuItems).where(eq(schema.menuItems.id, id)).get();
  if (!item) return NextResponse.json({ error: "Urun bulunamadi" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadi" }, { status: 400 });

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    return NextResponse.json({ error: "Gecersiz dosya tipi" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Dosya 5MB'dan buyuk olamaz" }, { status: 400 });
  }

  const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const filename = `${slug}-${id}.webp`;

  const productsDir = path.join(process.cwd(), "public", "images", "products");
  await mkdir(productsDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const optimized = await sharp(Buffer.from(bytes))
    .resize(800, 800, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  const filePath = path.join(productsDir, filename);
  await writeFile(filePath, optimized);

  if (item.imageUrl) {
    const oldPath = path.join(process.cwd(), "public", item.imageUrl);
    if (oldPath !== filePath) {
      try { await unlink(oldPath); } catch {}
    }
  }

  const imageUrl = `/images/products/${filename}`;
  db.update(schema.menuItems)
    .set({ imageUrl })
    .where(eq(schema.menuItems.id, id))
    .run();

  return NextResponse.json({ imageUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const db = getDb();

  const item = db.select().from(schema.menuItems).where(eq(schema.menuItems.id, id)).get();
  if (!item) return NextResponse.json({ error: "Urun bulunamadi" }, { status: 404 });

  if (item.imageUrl) {
    const filePath = path.join(process.cwd(), "public", item.imageUrl);
    try { await unlink(filePath); } catch {}
  }

  db.update(schema.menuItems)
    .set({ imageUrl: null })
    .where(eq(schema.menuItems.id, id))
    .run();

  return NextResponse.json({ ok: true });
}
