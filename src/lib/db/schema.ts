import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================================
// TEMEL TABLOLAR
// ============================================================

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  address: text("address"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  notes: text("notes"),
  totalSpent: real("total_spent").default(0).notNull(),
  orderCount: integer("order_count").default(0).notNull(),
  loyaltyPoints: integer("loyalty_points").default(0).notNull(),
  loyaltyTier: text("loyalty_tier", {
    enum: ["bronze", "silver", "gold", "vip"],
  })
    .default("bronze")
    .notNull(),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  birthday: text("birthday"),
  segment: text("segment", {
    enum: ["new", "loyal", "lost", "vip", "complainer"],
  })
    .default("new")
    .notNull(),
  avgOrderAmount: real("avg_order_amount").default(0).notNull(),
  favoriteItemId: integer("favorite_item_id"),
  peakHour: integer("peak_hour"),
  lastOrderAt: text("last_order_at"),
  autoNotes: text("auto_notes"),
  familyGroupId: integer("family_group_id"),
  displayNameSource: text("display_name_source", {
    enum: ["profile", "self", "manual"],
  }),
  firstContactAt: text("first_contact_at"),
  kvkkAcceptedAt: text("kvkk_accepted_at"),
  isBlacklisted: integer("is_blacklisted", { mode: "boolean" })
    .default(false)
    .notNull(),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const userAddresses = sqliteTable("user_addresses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  label: text("label").default("Ev").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false).notNull(),
  shortDescription: text("short_description"),
  isVerifiedByCourier: integer("is_verified_by_courier", { mode: "boolean" }).default(false).notNull(),
  courierNote: text("courier_note"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "cashier", "cook", "courier", "waiter"] }).notNull(),
  pin: text("pin"),
  permissions: text("permissions"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  avgDeliveryMinutes: real("avg_delivery_minutes"),
  totalDeliveries: integer("total_deliveries").default(0).notNull(),
  avgRating: real("avg_rating"),
  salary: real("salary"),
  advanceBalance: real("advance_balance").default(0),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// MENU
// ============================================================

export const menuCategories = sqliteTable("menu_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
});

export const menuItems = sqliteTable("menu_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .references(() => menuCategories.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  deliveryPrice: real("delivery_price"),
  imageUrl: text("image_url"),
  isAvailable: integer("is_available", { mode: "boolean" })
    .default(true)
    .notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  stockEnabled: integer("stock_enabled", { mode: "boolean" })
    .default(false)
    .notNull(),
  stockQuantity: integer("stock_quantity"),
  costPrice: real("cost_price"),
  profitMargin: real("profit_margin"),
  upsellItemId: integer("upsell_item_id"),
  upsellMessage: text("upsell_message"),
  prepTimeMinutes: integer("prep_time_minutes").default(10).notNull(),
  kitchenStationId: integer("kitchen_station_id"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const menuItemOptions = sqliteTable("menu_item_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  menuItemId: integer("menu_item_id")
    .references(() => menuItems.id)
    .notNull(),
  groupName: text("group_name").notNull(),
  optionName: text("option_name").notNull(),
  priceModifier: real("price_modifier").default(0).notNull(),
  isDefault: integer("is_default", { mode: "boolean" })
    .default(false)
    .notNull(),
});

// ============================================================
// SIPARISLER
// ============================================================

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  staffCourierId: integer("staff_courier_id").references(() => staff.id),
  source: text("source", { enum: ["whatsapp", "qr", "manual", "phone", "walk_in", "yemeksepeti", "getir"] }).notNull(),
  status: text("status", {
    enum: ["pending_approval", "new", "preparing", "ready", "on_the_way", "delivered", "cancelled"],
  })
    .default("new")
    .notNull(),
  tableNumber: integer("table_number"),
  customerPhone: text("customer_phone"),
  customerName: text("customer_name"),
  deliveryAddress: text("delivery_address"),
  deliveryLatitude: real("delivery_latitude"),
  deliveryLongitude: real("delivery_longitude"),
  paymentMethod: text("payment_method", { enum: ["cash", "card"] }),
  subtotal: real("subtotal").default(0).notNull(),
  deliveryFee: real("delivery_fee").default(0).notNull(),
  discountAmount: real("discount_amount").default(0).notNull(),
  taxAmount: real("tax_amount").default(0).notNull(),
  total: real("total").default(0).notNull(),
  costTotal: real("cost_total").default(0).notNull(),
  profitAmount: real("profit_amount").default(0).notNull(),
  notes: text("notes"),
  couponId: integer("coupon_id"),
  couponCode: text("coupon_code"),
  loyaltyPointsEarned: integer("loyalty_points_earned").default(0).notNull(),
  loyaltyPointsUsed: integer("loyalty_points_used").default(0).notNull(),
  trackingToken: text("tracking_token").unique(),
  qrToken: text("qr_token").unique(),
  estimatedDeliveryMinutes: integer("estimated_delivery_minutes"),
  queuePriority: integer("queue_priority").default(0).notNull(),
  mergedWithOrderId: integer("merged_with_order_id"),
  splitFromOrderId: integer("split_from_order_id"),
  mergedIntoOrderId: integer("merged_into_order_id"),
  batchId: integer("batch_id"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
  preparedAt: text("prepared_at"),
  pickedUpAt: text("picked_up_at"),
  deliveredAt: text("delivered_at"),
  cancelledAt: text("cancelled_at"),
  cancelReason: text("cancel_reason"),
  paymentConfirmedAt: text("payment_confirmed_at"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  menuItemId: integer("menu_item_id").references(() => menuItems.id),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: real("unit_price").notNull(),
  unitCost: real("unit_cost").default(0).notNull(),
  totalPrice: real("total_price").notNull(),
  selectedOptions: text("selected_options"),
  notes: text("notes"),
  removedIngredients: text("removed_ingredients"),
});

// ============================================================
// TESLIMAT
// ============================================================

export const deliveryZones = sqliteTable("delivery_zones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  polygon: text("polygon").notNull(),
  deliveryFee: real("delivery_fee").default(0).notNull(),
  minOrderAmount: real("min_order_amount").default(0).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
});

export const deliveryRoutes = sqliteTable("delivery_routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courierId: integer("courier_id")
    .references(() => staff.id)
    .notNull(),
  status: text("status", { enum: ["active", "completed", "cancelled"] })
    .default("active")
    .notNull(),
  totalDistanceKm: real("total_distance_km"),
  startedAt: text("started_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
  completedAt: text("completed_at"),
});

export const routeStops = sqliteTable("route_stops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  routeId: integer("route_id")
    .references(() => deliveryRoutes.id)
    .notNull(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  stopOrder: integer("stop_order").notNull(),
  status: text("status", { enum: ["pending", "arrived", "delivered", "failed"] })
    .default("pending")
    .notNull(),
  arrivedAt: text("arrived_at"),
  deliveredAt: text("delivered_at"),
  failReason: text("fail_reason"),
});

// ============================================================
// SADAKAT SISTEMI
// ============================================================

export const loyaltyTiers = sqliteTable("loyalty_tiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  minPoints: integer("min_points").notNull(),
  pointMultiplier: real("point_multiplier").default(1).notNull(),
  perks: text("perks"),
  color: text("color"),
});

export const customerPoints = sqliteTable("customer_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  orderId: integer("order_id").references(() => orders.id),
  points: integer("points").notNull(),
  type: text("type", {
    enum: ["earned", "spent", "bonus", "referral", "birthday", "surprise"],
  }).notNull(),
  description: text("description"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const referralCodes = sqliteTable("referral_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  code: text("code").notNull().unique(),
  usageCount: integer("usage_count").default(0).notNull(),
  totalPointsEarned: integer("total_points_earned").default(0).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// KUPON VE KAMPANYA
// ============================================================

export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["percentage", "fixed", "free_item"] }).notNull(),
  value: real("value").notNull(),
  freeItemId: integer("free_item_id").references(() => menuItems.id),
  minOrderAmount: real("min_order_amount").default(0).notNull(),
  maxUsageTotal: integer("max_usage_total"),
  maxUsagePerUser: integer("max_usage_per_user").default(1).notNull(),
  currentUsage: integer("current_usage").default(0).notNull(),
  validFrom: text("valid_from").notNull(),
  validUntil: text("valid_until").notNull(),
  targetSegment: text("target_segment"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const couponUsage = sqliteTable("coupon_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  couponId: integer("coupon_id")
    .references(() => coupons.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  discountAmount: real("discount_amount").notNull(),
  usedAt: text("used_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", {
    enum: [
      "happy_hour",
      "weather",
      "bundle",
      "dormant",
      "birthday",
      "broadcast",
      "ab_test",
    ],
  }).notNull(),
  config: text("config").notNull(),
  targetSegment: text("target_segment"),
  status: text("status", { enum: ["draft", "active", "paused", "ended"] })
    .default("draft")
    .notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  sentCount: integer("sent_count").default(0).notNull(),
  openCount: integer("open_count").default(0).notNull(),
  conversionCount: integer("conversion_count").default(0).notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const abTests = sqliteTable("ab_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id")
    .references(() => campaigns.id)
    .notNull(),
  variantName: text("variant_name").notNull(),
  messageTemplate: text("message_template").notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  conversionCount: integer("conversion_count").default(0).notNull(),
  conversionRate: real("conversion_rate").default(0).notNull(),
});

export const broadcasts = sqliteTable("broadcasts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  message: text("message").notNull(),
  targetSegment: text("target_segment"),
  status: text("status", { enum: ["pending", "sending", "sent", "failed"] })
    .default("pending")
    .notNull(),
  totalRecipients: integer("total_recipients").default(0).notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  scheduledAt: text("scheduled_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// RECETE VE MALIYET
// ============================================================

export const ingredients = sqliteTable("ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  unitCost: real("unit_cost").notNull(),
  currentStock: real("current_stock").default(0).notNull(),
  minStockAlert: real("min_stock_alert"),
  supplier: text("supplier"),
  supplierId: integer("supplier_id"),
  updatedAt: text("updated_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  menuItemId: integer("menu_item_id")
    .references(() => menuItems.id)
    .notNull()
    .unique(),
  totalCost: real("total_cost").default(0).notNull(),
  lastCalculatedAt: text("last_calculated_at"),
});

export const recipeItems = sqliteTable("recipe_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id")
    .references(() => recipes.id)
    .notNull(),
  ingredientId: integer("ingredient_id")
    .references(() => ingredients.id)
    .notNull(),
  quantity: real("quantity").notNull(),
  costAtTime: real("cost_at_time").notNull(),
});

// ============================================================
// GUVENLIK VE DENETIM
// ============================================================

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").references(() => staff.id),
  action: text("action").notNull(),
  tableName: text("table_name"),
  recordId: integer("record_id"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).default(false).notNull(),
});

export const rolePermissions = sqliteTable("role_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roleId: integer("role_id")
    .references(() => userRoles.id)
    .notNull(),
  resource: text("resource").notNull(),
  action: text("action", { enum: ["read", "create", "update", "delete"] }).notNull(),
});

// ============================================================
// DEGERLENDIRME VE SIKAYET
// ============================================================

export const ratings = sqliteTable("ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull()
    .unique(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  score: integer("score").notNull(),
  comment: text("comment"),
  sentGoogleReview: integer("sent_google_review", { mode: "boolean" })
    .default(false)
    .notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const complaints = sqliteTable("complaints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").references(() => orders.id),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  category: text("category", {
    enum: ["quality", "delivery", "wrong_order", "missing_item", "other"],
  }).notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["open", "in_progress", "resolved", "closed"] })
    .default("open")
    .notNull(),
  resolution: text("resolution"),
  assignedTo: integer("assigned_to").references(() => staff.id),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
  resolvedAt: text("resolved_at"),
});

// ============================================================
// MUTFAK ISTASYONLARI
// ============================================================

export const kitchenStations = sqliteTable("kitchen_stations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["doner", "beverage", "dessert", "side", "general"],
  }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
});

export const stationAssignments = sqliteTable("station_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stationId: integer("station_id")
    .references(() => kitchenStations.id)
    .notNull(),
  menuItemId: integer("menu_item_id")
    .references(() => menuItems.id)
    .notNull(),
});

// ============================================================
// BILDIRIM KUYRUGU
// ============================================================

export const notificationsOutbox = sqliteTable("notifications_outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channel: text("channel", { enum: ["whatsapp", "push", "internal"] }).notNull(),
  recipientPhone: text("recipient_phone"),
  recipientStaffId: integer("recipient_staff_id").references(() => staff.id),
  templateType: text("template_type"),
  message: text("message").notNull(),
  metadata: text("metadata"),
  status: text("status", { enum: ["pending", "sent", "failed", "cancelled"] })
    .default("pending")
    .notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  scheduledAt: text("scheduled_at"),
  sentAt: text("sent_at"),
  failReason: text("fail_reason"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// YEDEKLEME VE SNAPSHOT
// ============================================================

export const snapshots = sqliteTable("snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  type: text("type", { enum: ["scheduled", "manual", "pre_update"] }).notNull(),
  integrityCheck: text("integrity_check", { enum: ["ok", "failed", "pending"] })
    .default("pending")
    .notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// ON MUHASEBE
// ============================================================

export const financeEntries = sqliteTable("finance_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  taxAmount: real("tax_amount").default(0).notNull(),
  description: text("description"),
  orderId: integer("order_id").references(() => orders.id),
  receiptImageUrl: text("receipt_image_url"),
  isAutomatic: integer("is_automatic", { mode: "boolean" })
    .default(false)
    .notNull(),
  date: text("date")
    .default(sql`(date('now','localtime'))`)
    .notNull(),
  createdBy: integer("created_by").references(() => staff.id),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// BUNDLE / COMBO
// ============================================================

export const bundles = sqliteTable("bundles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  discountType: text("discount_type", { enum: ["percentage", "fixed"] }).notNull(),
  discountValue: real("discount_value").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  validFrom: text("valid_from"),
  validUntil: text("valid_until"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const bundleItems = sqliteTable("bundle_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bundleId: integer("bundle_id")
    .references(() => bundles.id)
    .notNull(),
  menuItemId: integer("menu_item_id")
    .references(() => menuItems.id)
    .notNull(),
  quantity: integer("quantity").default(1).notNull(),
});

// ============================================================
// AYARLAR
// ============================================================

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// WHATSAPP MENU LINKLERI
// ============================================================

export const menuLinks = sqliteTable("menu_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  phone: text("phone").notNull(),
  name: text("name"),
  address: text("address"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  addressId: integer("address_id"),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  orderId: integer("order_id").references(() => orders.id),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// MASALAR (QR menu)
// ============================================================

export const tables = sqliteTable("tables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: integer("number").notNull().unique(),
  label: text("label"),
  token: text("token").notNull().unique(),
  capacity: integer("capacity").default(4).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

// ============================================================
// MASA HESAPLARI (Table Sessions)
// ============================================================

export const tableSessions = sqliteTable("table_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableNumber: integer("table_number").notNull(),
  status: text("status", { enum: ["open", "closed"] })
    .default("open")
    .notNull(),
  total: real("total").default(0).notNull(),
  openedAt: text("opened_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
  closedAt: text("closed_at"),
});

// ============================================================
// ILETISIM ORKESTRASYON
// ============================================================

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  channel: text("channel", { enum: ["whatsapp", "qr", "internal"] })
    .default("whatsapp")
    .notNull(),
  status: text("status", {
    enum: ["bot_active", "human_active", "waiting_human", "closed"],
  })
    .default("bot_active")
    .notNull(),
  assignedStaffId: integer("assigned_staff_id").references(() => staff.id),
  lastIntent: text("last_intent"),
  botFailCount: integer("bot_fail_count").default(0).notNull(),
  isTyping: integer("is_typing", { mode: "boolean" }).default(false).notNull(),
  typingBy: text("typing_by"),
  satisfactionScore: integer("satisfaction_score"),
  closedReason: text("closed_reason"),
  firstResponseAt: text("first_response_at"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .references(() => conversations.id)
    .notNull(),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
  senderType: text("sender_type", { enum: ["customer", "bot", "staff"] }).notNull(),
  senderStaffId: integer("sender_staff_id").references(() => staff.id),
  messageType: text("message_type", {
    enum: ["text", "voice", "image", "location", "call_missed"],
  })
    .default("text")
    .notNull(),
  content: text("content").notNull(),
  whatsappMessageId: text("whatsapp_message_id"),
  metadata: text("metadata"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const intents = sqliteTable("intents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .references(() => conversations.id)
    .notNull(),
  messageId: integer("message_id")
    .references(() => messages.id)
    .notNull(),
  intent: text("intent", {
    enum: [
      "order_new",
      "order_status",
      "order_modify",
      "menu_inquiry",
      "complaint",
      "compliment",
      "address_change",
      "hours_inquiry",
      "human_needed",
      "small_talk",
      "spam",
      "unknown",
    ],
  }).notNull(),
  confidence: real("confidence").notNull(),
  method: text("method", { enum: ["ollama", "regex", "keyword"] }).notNull(),
  rawOutput: text("raw_output"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const callbackQueue = sqliteTable("callback_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  conversationId: integer("conversation_id")
    .references(() => conversations.id)
    .notNull(),
  reason: text("reason"),
  topicSummary: text("topic_summary"),
  priority: integer("priority").default(0).notNull(),
  status: text("status", {
    enum: ["pending", "called", "no_answer", "resolved", "expired"],
  })
    .default("pending")
    .notNull(),
  callbackBy: text("callback_by"),
  reminderSentAt: text("reminder_sent_at"),
  calledAt: text("called_at"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const humanQueue = sqliteTable("human_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  conversationId: integer("conversation_id")
    .references(() => conversations.id)
    .notNull(),
  priority: integer("priority").default(0).notNull(),
  reason: text("reason"),
  position: integer("position").notNull(),
  estimatedWaitMinutes: integer("estimated_wait_minutes"),
  status: text("status", {
    enum: ["waiting", "connected", "cancelled", "timeout"],
  })
    .default("waiting")
    .notNull(),
  lastUpdateSentAt: text("last_update_sent_at"),
  connectedAt: text("connected_at"),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const businessStatus = sqliteTable("business_status", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", {
    enum: ["available", "busy", "break", "closed"],
  }).notNull(),
  changedBy: text("changed_by"),
  reason: text("reason"),
  autoDetected: integer("auto_detected", { mode: "boolean" })
    .default(false)
    .notNull(),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const conversationTags = sqliteTable("conversation_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .references(() => conversations.id)
    .notNull(),
  tag: text("tag").notNull(),
  addedBy: integer("added_by").references(() => staff.id),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const quickReplies = sqliteTable("quick_replies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shortcut: text("shortcut").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  usageCount: integer("usage_count").default(0).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const spamBlacklist = sqliteTable("spam_blacklist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  reason: text("reason"),
  addedBy: integer("added_by").references(() => staff.id),
  createdAt: text("created_at")
    .default(sql`(datetime('now','localtime'))`)
    .notNull(),
});

export const slaMetrics = sqliteTable("sla_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .references(() => conversations.id)
    .notNull(),
  firstResponseSeconds: integer("first_response_seconds"),
  resolutionSeconds: integer("resolution_seconds"),
  botHandled: integer("bot_handled", { mode: "boolean" })
    .default(false)
    .notNull(),
  escalated: integer("escalated", { mode: "boolean" })
    .default(false)
    .notNull(),
  satisfactionScore: integer("satisfaction_score"),
  date: text("date")
    .default(sql`(date('now','localtime'))`)
    .notNull(),
});

// ============================================================
// YENI TABLOLAR (Briefing gereklilikleri)
// ============================================================

export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  staffId: integer("staff_id").references(() => staff.id).notNull(),
  startTime: text("start_time").default(sql`(datetime('now','localtime'))`).notNull(),
  endTime: text("end_time"),
  startCash: real("start_cash").default(0).notNull(),
  endCash: real("end_cash"),
  notes: text("notes"),
});

export const dailyReports = sqliteTable("daily_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  totalRevenue: real("total_revenue").default(0).notNull(),
  orderCount: integer("order_count").default(0).notNull(),
  cashTotal: real("cash_total").default(0).notNull(),
  cardTotal: real("card_total").default(0).notNull(),
  onlineTotal: real("online_total").default(0).notNull(),
  deliveryCount: integer("delivery_count").default(0).notNull(),
  takeawayCount: integer("takeaway_count").default(0).notNull(),
  dineInCount: integer("dine_in_count").default(0).notNull(),
  cancelCount: integer("cancel_count").default(0).notNull(),
  cancelAmount: real("cancel_amount").default(0).notNull(),
  discountTotal: real("discount_total").default(0).notNull(),
  deliveryFeeTotal: real("delivery_fee_total").default(0).notNull(),
  avgOrderAmount: real("avg_order_amount").default(0).notNull(),
  topSellingItem: text("top_selling_item"),
  staffId: integer("staff_id").references(() => staff.id),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});

export const checklists = sqliteTable("checklists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["opening", "closing"] }).notNull(),
  date: text("date").notNull(),
  staffId: integer("staff_id").references(() => staff.id).notNull(),
  items: text("items").notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});

export const stockCounts = sqliteTable("stock_counts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ingredientId: integer("ingredient_id").references(() => ingredients.id).notNull(),
  countedQuantity: real("counted_quantity").notNull(),
  systemQuantity: real("system_quantity").notNull(),
  difference: real("difference").notNull(),
  staffId: integer("staff_id").references(() => staff.id).notNull(),
  date: text("date").default(sql`(date('now','localtime'))`).notNull(),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});

export const wastage = sqliteTable("wastage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ingredientId: integer("ingredient_id").references(() => ingredients.id).notNull(),
  quantity: real("quantity").notNull(),
  reason: text("reason", { enum: ["expired", "damaged", "spilled", "overcooked", "other"] }).notNull(),
  staffId: integer("staff_id").references(() => staff.id).notNull(),
  notes: text("notes"),
  date: text("date").default(sql`(date('now','localtime'))`).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});

export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  totalAmount: real("total_amount").notNull(),
  staffId: integer("staff_id").references(() => staff.id),
  notes: text("notes"),
  receiptImageUrl: text("receipt_image_url"),
  date: text("date").default(sql`(date('now','localtime'))`).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});

export const purchaseItems = sqliteTable("purchase_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").references(() => purchases.id).notNull(),
  ingredientId: integer("ingredient_id").references(() => ingredients.id).notNull(),
  quantity: real("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  totalCost: real("total_cost").notNull(),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  amount: real("amount").notNull(),
  method: text("method", { enum: ["cash", "card", "online"] }).notNull(),
  changeGiven: real("change_given").default(0).notNull(),
  receivedAmount: real("received_amount"),
  staffId: integer("staff_id").references(() => staff.id),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});

export const cashRegister = sqliteTable("cash_register", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["sale", "refund", "deposit", "withdrawal", "opening", "closing"] }).notNull(),
  amount: real("amount").notNull(),
  orderId: integer("order_id").references(() => orders.id),
  staffId: integer("staff_id").references(() => staff.id),
  description: text("description"),
  createdAt: text("created_at").default(sql`(datetime('now','localtime'))`).notNull(),
});
