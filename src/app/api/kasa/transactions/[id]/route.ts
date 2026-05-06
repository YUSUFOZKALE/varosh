import { NextRequest, NextResponse } from "next/server";
import { getDb, getSqliteDb, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Gecersiz ID" }, { status: 400 });

  const body = await req.json();
  const db = getDb();
  const sqlite = getSqliteDb();

  const tx = db.select().from(schema.kasaTransactions).where(eq(schema.kasaTransactions.id, id)).get();
  if (!tx) return NextResponse.json({ error: "Islem bulunamadi" }, { status: 404 });

  const updates: Record<string, any> = {};

  if (body.isReturned === true && tx.type === "trust") {
    updates.isReturned = true;
    updates.returnedAt = sql`(datetime('now','localtime'))`;
  }

  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Guncellenecek alan yok" }, { status: 400 });
  }

  const updated = sqlite.transaction(() => {
    if (body.isReturned === true && tx.type === "trust" && tx.paymentMethod === "cash") {
      db.insert(schema.cashRegister)
        .values({
          type: "deposit",
          amount: tx.amount,
          staffId: session.staffId,
          description: `Emanet iade: ${tx.person}`,
        })
        .run();
    }

    return db.update(schema.kasaTransactions)
      .set(updates)
      .where(eq(schema.kasaTransactions.id, id))
      .returning()
      .get();
  })();

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Yetki yok" }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "Gecersiz ID" }, { status: 400 });

  const db = getDb();
  const sqlite = getSqliteDb();

  const tx = db.select().from(schema.kasaTransactions).where(eq(schema.kasaTransactions.id, id)).get();
  if (!tx) return NextResponse.json({ error: "Islem bulunamadi" }, { status: 404 });

  sqlite.transaction(() => {
    if (tx.paymentMethod === "cash") {
      const crType = tx.type === "income" ? "deposit" : "withdrawal";
      const crDesc = tx.type === "income"
        ? `Nakit gelir: ${tx.description || tx.category || ""}`
        : tx.type === "expense"
        ? `Gider: ${tx.description || tx.category || ""}`
        : tx.type === "trust"
        ? `Emanet: ${tx.person}`
        : `Personel odeme: ${tx.person}`;

      db.run(sql`DELETE FROM cash_register
        WHERE type = ${crType}
        AND amount = ${tx.amount}
        AND description = ${crDesc}
        AND staff_id = ${tx.createdBy}
        LIMIT 1`);
    }

    db.delete(schema.kasaTransactions).where(eq(schema.kasaTransactions.id, id)).run();
  })();

  return NextResponse.json({ ok: true });
}
