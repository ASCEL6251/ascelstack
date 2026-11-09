import { pgTable, uuid, varchar, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users Table (identity mapping from Clerk)
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_clerk_id_idx').on(table.clerkUserId),
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

// 4. Service Requests Table
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
    requirements: text('requirements'),
    status: varchar('status', { length: 50 }).default('pending').notNull(), // pending | reviewing | approved | active | completed | rejected | cancelled
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('service_requests_business_id_idx').on(table.businessId),
    index('service_requests_user_id_idx').on(table.userId),
    index('service_requests_service_id_idx').on(table.serviceId),
    index('service_requests_status_idx').on(table.status),
  ]
);

// 5. Activity Logs Table
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  serviceRequests: many(serviceRequests),
  activityLogs: many(activityLogs),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerUserId],
    references: [users.id],
  }),
  serviceRequests: many(serviceRequests),
  activityLogs: many(activityLogs),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  serviceRequests: many(serviceRequests),
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
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type NewServiceRequest = typeof serviceRequests.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
