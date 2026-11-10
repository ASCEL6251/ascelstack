import { pgTable, uuid, varchar, text, timestamp, jsonb, index, uniqueIndex, numeric, integer, boolean } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// 1. Users Table (identity mapping from Clerk)
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    role: varchar('role', { length: 50 }).default('customer'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_clerk_id_idx').on(table.clerkUserId),
    uniqueIndex('users_email_lower_uidx').on(sql`lower(${table.email})`),
    index('users_email_idx').on(table.email),
  ]
);

// 2. Businesses Table
export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    businessType: varchar('business_type', { length: 100 }),
    industry: varchar('industry', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    website: varchar('website', { length: 255 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }).default('India'),
    gstin: varchar('gstin', { length: 50 }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('businesses_owner_user_id_idx').on(table.ownerUserId),
  ]
);

// 3. Services Table (populated from Ascelstack catalogue)
export const services = pgTable(
  'services',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).unique(), // e.g. ASC-0001
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description').notNull(),
    layer: varchar('layer', { length: 50 }).notNull(), // build | grow | run
    discipline: varchar('discipline', { length: 100 }).notNull(),
    availabilityStatus: varchar('availability_status', { length: 50 }).default('live').notNull(), // live | coming_soon
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('services_slug_idx').on(table.slug),
    index('services_layer_idx').on(table.layer),
    index('services_discipline_idx').on(table.discipline),
  ]
);

// 4. Quotations Table (Core Enterprise Quotations & Inquiries)
export const quotations = pgTable(
  'quotations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quotationNumber: varchar('quotation_number', { length: 50 }).notNull().unique(), // e.g. QUO-2026-0001
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    projectTitle: varchar('project_title', { length: 255 }).notNull(),
    projectDescription: text('project_description'),
    requirements: text('requirements'),
    attachments: jsonb('attachments').default([]),
    quotationStatus: varchar('quotation_status', { length: 50 }).default('New Inquiry').notNull(),
    paymentStatus: varchar('payment_status', { length: 50 }).default('Not Required').notNull(),
    paymentVerified: boolean('payment_verified').default(false).notNull(),
    paymentReference: varchar('payment_reference', { length: 255 }),
    projectProgress: integer('project_progress').default(0).notNull(), // 0 to 100
    currency: varchar('currency', { length: 10 }).default('INR').notNull(), // INR | USD
    initialEstimatedCost: numeric('initial_estimated_cost', { precision: 12, scale: 2 }).default('0'),
    finalQuotationAmount: numeric('final_quotation_amount', { precision: 12, scale: 2 }).default('0'),
    additionalCharges: numeric('additional_charges', { precision: 12, scale: 2 }).default('0'),
    discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0'),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0'),
    pricingBreakdown: jsonb('pricing_breakdown').default([]),
    internalNotes: text('internal_notes'), // strictly hidden from customer
    customerNotes: text('customer_notes'), // customer-visible update notes
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('quotations_number_idx').on(table.quotationNumber),
    index('quotations_user_id_idx').on(table.userId),
    index('quotations_business_id_idx').on(table.businessId),
    index('quotations_status_idx').on(table.quotationStatus),
    index('quotations_payment_status_idx').on(table.paymentStatus),
    index('quotations_created_at_idx').on(table.createdAt),
  ]
);

// 5. Service Requests Table (Individual items / pipelines requested)
export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    quotationId: uuid('quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
    requirements: text('requirements'),
    status: varchar('status', { length: 50 }).default('pending').notNull(), // pending | reviewing | approved | active | completed | rejected | cancelled
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('service_requests_business_id_idx').on(table.businessId),
    index('service_requests_user_id_idx').on(table.userId),
    index('service_requests_service_id_idx').on(table.serviceId),
    index('service_requests_quotation_id_idx').on(table.quotationId),
    index('service_requests_status_idx').on(table.status),
  ]
);

// 6. Quotation History Table (Audit of every change to quotations)
export const quotationHistory = pgTable(
  'quotation_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quotationId: uuid('quotation_id')
      .notNull()
      .references(() => quotations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    adminEmail: varchar('admin_email', { length: 255 }).notNull(),
    fieldChanged: varchar('field_changed', { length: 100 }).notNull(),
    previousValue: text('previous_value'),
    newValue: text('new_value'),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('quotation_history_quotation_id_idx').on(table.quotationId),
    index('quotation_history_created_at_idx').on(table.createdAt),
  ]
);

// 7. Activity Logs Table (User activity)
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    activityType: varchar('activity_type', { length: 100 }).notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activity_logs_user_id_idx').on(table.userId),
    index('activity_logs_business_id_idx').on(table.businessId),
    index('activity_logs_created_at_idx').on(table.createdAt),
  ]
);

// 8. Admin Activity Logs Table (Administrative audit trail)
export const adminActivityLogs = pgTable(
  'admin_activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminEmail: varchar('admin_email', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(), // user | quotation | pricing | payment | system
    targetId: varchar('target_id', { length: 255 }),
    description: text('description').notNull(),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('admin_activity_logs_admin_email_idx').on(table.adminEmail),
    index('admin_activity_logs_created_at_idx').on(table.createdAt),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  quotations: many(quotations),
  serviceRequests: many(serviceRequests),
  activityLogs: many(activityLogs),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerUserId],
    references: [users.id],
  }),
  quotations: many(quotations),
  serviceRequests: many(serviceRequests),
  activityLogs: many(activityLogs),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  serviceRequests: many(serviceRequests),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  user: one(users, {
    fields: [quotations.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [quotations.businessId],
    references: [businesses.id],
  }),
  serviceRequests: many(serviceRequests),
  history: many(quotationHistory),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one }) => ({
  business: one(businesses, {
    fields: [serviceRequests.businessId],
    references: [businesses.id],
  }),
  user: one(users, {
    fields: [serviceRequests.userId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [serviceRequests.serviceId],
    references: [services.id],
  }),
  quotation: one(quotations, {
    fields: [serviceRequests.quotationId],
    references: [quotations.id],
  }),
}));

export const quotationHistoryRelations = relations(quotationHistory, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationHistory.quotationId],
    references: [quotations.id],
  }),
  user: one(users, {
    fields: [quotationHistory.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [activityLogs.businessId],
    references: [businesses.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type Quotation = typeof quotations.$inferSelect;
export type NewQuotation = typeof quotations.$inferInsert;
export type QuotationHistory = typeof quotationHistory.$inferSelect;
export type NewQuotationHistory = typeof quotationHistory.$inferInsert;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type NewServiceRequest = typeof serviceRequests.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;
export type NewAdminActivityLog = typeof adminActivityLogs.$inferInsert;
