import { getDb, schema } from "./db";
import { eq, sql } from "drizzle-orm";

export function updateCustomerStats(phone: string, orderTotal: number) {
  const db = getDb();
  const user = db.select().from(schema.users)
    .where(eq(schema.users.phone, phone))
    .get();

  if (!user) return;

  const newOrderCount = user.orderCount + 1;
  const newTotalSpent = user.totalSpent + orderTotal;
  const newAvg = newTotalSpent / newOrderCount;

  let segment: "new" | "loyal" | "lost" | "vip" | "complainer" = "new";
  if (newOrderCount >= 20 || newTotalSpent >= 5000) segment = "vip";
  else if (newOrderCount >= 5) segment = "loyal";

  let loyaltyTier: "bronze" | "silver" | "gold" | "vip" = "bronze";
  if (newTotalSpent >= 5000) loyaltyTier = "vip";
  else if (newTotalSpent >= 2000) loyaltyTier = "gold";
  else if (newTotalSpent >= 500) loyaltyTier = "silver";

  const pointsEarned = Math.floor(orderTotal * 0.1);

  db.update(schema.users)
    .set({
      orderCount: newOrderCount,
      totalSpent: newTotalSpent,
      avgOrderAmount: newAvg,
      lastOrderAt: new Date().toISOString(),
      segment,
      loyaltyTier,
      loyaltyPoints: user.loyaltyPoints + pointsEarned,
      updatedAt: sql`(datetime('now','localtime'))`,
    })
    .where(eq(schema.users.id, user.id))
    .run();
}

export function findOrCreateCustomer(phone: string, name?: string | null, address?: string | null) {
  const db = getDb();
  let user = db.select().from(schema.users)
    .where(eq(schema.users.phone, phone))
    .get();

  if (!user) {
    user = db.insert(schema.users)
      .values({
        phone,
        name: name || null,
        address: address || null,
      })
      .returning()
      .get();
  }

  return user;
}
