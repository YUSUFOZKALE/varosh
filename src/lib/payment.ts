import { getDb, getSqliteDb, schema } from "./db";
import { eq, and, sql } from "drizzle-orm";

interface PaymentOptions {
  orderId: number;
  method: "cash" | "card";
  amount?: number;
  receivedAmount?: number;
  staffId?: number;
  isCourierDelivery?: boolean;
}

interface PaymentResult {
  ok: boolean;
  error?: string;
  status?: number;
}

export function recordPayment(opts: PaymentOptions): PaymentResult {
  const db = getDb();
  const sqlite = getSqliteDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, opts.orderId)).get();
  if (!order) return { ok: false, error: "Siparis bulunamadi", status: 404 };

  if (order.paymentConfirmedAt) {
    return { ok: false, error: "Bu siparis zaten odenmis", status: 409 };
  }

  if (opts.method !== "cash" && opts.method !== "card") {
    return { ok: false, error: "Gecersiz odeme yontemi", status: 400 };
  }

  const amount = opts.amount ?? order.total;
  if (amount <= 0) return { ok: false, error: "Gecersiz tutar", status: 400 };

  const receivedAmount = opts.receivedAmount ?? amount;
  const changeGiven = opts.method === "cash" ? Math.max(0, receivedAmount - amount) : 0;

  const txn = sqlite.transaction(() => {
    db.insert(schema.payments)
      .values({
        orderId: opts.orderId,
        amount,
        method: opts.method,
        receivedAmount,
        changeGiven,
        staffId: opts.staffId || null,
      })
      .run();

    if (!opts.isCourierDelivery) {
      db.insert(schema.cashRegister)
        .values({
          type: "sale",
          amount,
          orderId: opts.orderId,
          staffId: opts.staffId || null,
          description: `Siparis #${opts.orderId} - ${opts.method}`,
        })
        .run();
    }

    if (amount < order.total) {
      db.update(schema.orders)
        .set({ discountAmount: order.total - amount })
        .where(eq(schema.orders.id, opts.orderId))
        .run();
    }

    db.update(schema.orders)
      .set({
        paymentMethod: opts.method,
        paymentConfirmedAt: sql`(datetime('now','localtime'))`,
      })
      .where(eq(schema.orders.id, opts.orderId))
      .run();

    if (order.tableNumber) {
      closeTableSessionIfAllPaid(order.tableNumber, opts.orderId);
    }
  });

  txn();
  return { ok: true };
}

function closeTableSessionIfAllPaid(tableNumber: number, justPaidOrderId: number) {
  const db = getDb();

  const session = db.select().from(schema.tableSessions)
    .where(and(
      eq(schema.tableSessions.tableNumber, tableNumber),
      eq(schema.tableSessions.status, "open")
    ))
    .get();

  if (!session) return;

  const unpaid = db.select({ id: schema.orders.id }).from(schema.orders)
    .where(sql`${schema.orders.tableNumber} = ${tableNumber}
      AND ${schema.orders.createdAt} >= ${session.openedAt}
      AND ${schema.orders.status} != 'cancelled'
      AND ${schema.orders.paymentMethod} IS NULL
      AND ${schema.orders.id} != ${justPaidOrderId}`)
    .all();

  if (unpaid.length === 0) {
    const allOrders = db.select().from(schema.orders)
      .where(sql`${schema.orders.tableNumber} = ${tableNumber}
        AND ${schema.orders.createdAt} >= ${session.openedAt}
        AND ${schema.orders.status} != 'cancelled'`)
      .all();
    const sessionTotal = allOrders.reduce((s, o) => s + o.total, 0);

    db.update(schema.tableSessions)
      .set({
        status: "closed" as const,
        total: sessionTotal,
        closedAt: sql`(datetime('now','localtime'))`,
      })
      .where(eq(schema.tableSessions.id, session.id))
      .run();
  }
}

export function refundPayment(orderId: number, staffId?: number): PaymentResult {
  const db = getDb();
  const sqlite = getSqliteDb();

  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order) return { ok: false, error: "Siparis bulunamadi", status: 404 };

  if (!order.paymentConfirmedAt) {
    return { ok: false, error: "Bu siparis henuz odenmemis", status: 400 };
  }

  const payment = db.select().from(schema.payments)
    .where(eq(schema.payments.orderId, orderId))
    .get();

  if (!payment) return { ok: false, error: "Odeme kaydi bulunamadi", status: 404 };

  const txn = sqlite.transaction(() => {
    db.insert(schema.cashRegister)
      .values({
        type: "refund",
        amount: payment.amount,
        orderId,
        staffId: staffId || null,
        description: `Iade: Siparis #${orderId}`,
      })
      .run();

    db.update(schema.orders)
      .set({
        status: "cancelled" as const,
        cancelledAt: sql`(datetime('now','localtime'))`,
        cancelReason: "Iade yapildi",
      })
      .where(eq(schema.orders.id, orderId))
      .run();

    if (order.customerPhone) {
      reverseCustomerStats(order.customerPhone, order.total);
    }
  });

  txn();
  return { ok: true };
}

function reverseCustomerStats(phone: string, orderTotal: number) {
  const db = getDb();
  const user = db.select().from(schema.users)
    .where(eq(schema.users.phone, phone))
    .get();

  if (!user || user.orderCount <= 0) return;

  const newOrderCount = Math.max(0, user.orderCount - 1);
  const newTotalSpent = Math.max(0, user.totalSpent - orderTotal);
  const newAvg = newOrderCount > 0 ? newTotalSpent / newOrderCount : 0;
  const pointsToRemove = Math.floor(orderTotal * 0.1);

  let segment: "new" | "loyal" | "lost" | "vip" | "complainer" = "new";
  if (newOrderCount >= 20 || newTotalSpent >= 5000) segment = "vip";
  else if (newOrderCount >= 5) segment = "loyal";

  let loyaltyTier: "bronze" | "silver" | "gold" | "vip" = "bronze";
  if (newTotalSpent >= 5000) loyaltyTier = "vip";
  else if (newTotalSpent >= 2000) loyaltyTier = "gold";
  else if (newTotalSpent >= 500) loyaltyTier = "silver";

  db.update(schema.users)
    .set({
      orderCount: newOrderCount,
      totalSpent: newTotalSpent,
      avgOrderAmount: newAvg,
      segment,
      loyaltyTier,
      loyaltyPoints: Math.max(0, user.loyaltyPoints - pointsToRemove),
      updatedAt: sql`(datetime('now','localtime'))`,
    })
    .where(eq(schema.users.id, user.id))
    .run();
}
