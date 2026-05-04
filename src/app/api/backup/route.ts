import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBusinessName } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbPath = path.resolve(process.env.DATABASE_URL || "./varosh.db");

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Database dosyasi bulunamadi" }, { status: 404 });
  }

  const buffer = fs.readFileSync(dbPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${getBusinessName().toLowerCase().replace(/\s+/g, "-")}-backup-${timestamp}.db"`,
    },
  });
}

export async function POST() {
  const dbPath = path.resolve(process.env.DATABASE_URL || "./varosh.db");
  const backupDir = path.resolve("./backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(backupDir, `varosh-${timestamp}.db`);

  fs.copyFileSync(dbPath, backupPath);

  const backups = fs.readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse();

  if (backups.length > 10) {
    for (const old of backups.slice(10)) {
      fs.unlinkSync(path.join(backupDir, old));
    }
  }

  return NextResponse.json({
    ok: true,
    file: backupPath,
    count: Math.min(backups.length, 10),
  });
}
