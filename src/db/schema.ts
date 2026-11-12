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

// 3b. Service Pricing Table (Real-time dynamic pricing & coming-soon controls)
export const servicePricing = pgTable(
  'service_pricing',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceCode: varchar('service_code', { length: 50 }).notNull().unique(),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).default('open').notNull(), // 'open' | 'soon'
    type: varchar('type', { length: 50 }).default('starting').notNull(), // 'package' | 'fixed' | 'starting'
    smallPrice: numeric('small_price', { precision: 12, scale: 2 }),
    smallText: varchar('small_text', { length: 255 }).default(''),
    smallUnit: varchar('small_unit', { length: 255 }).default(''),
    smallDetail: text('small_detail').default(''),
    midPrice: numeric('mid_price', { precision: 12, scale: 2 }),
    midText: varchar('mid_text', { length: 255 }).default(''),
    midUnit: varchar('mid_unit', { length: 255 }).default(''),
    midDetail: text('mid_detail').default(''),
    billing: varchar('billing', { length: 255 }).default(''),
    market: varchar('market', { length: 500 }).default(''),
    notes: text('notes').default(''),
    packages: jsonb('packages').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('service_pricing_code_uidx').on(table.serviceCode),
    index('service_pricing_status_idx').on(table.status),
    index('service_pricing_type_idx').on(table.type),
    index('service_pricing_service_id_idx').on(table.serviceId),
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

// 9. Agreement Templates Table
export const agreementTemplates = pgTable(
  'agreement_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(), // e.g. AGT-WEB-DEV
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    description: text('description'),
    clauses: jsonb('clauses').notNull(), // array of AgreementClause
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('agreement_templates_code_uidx').on(table.code),
    index('agreement_templates_category_idx').on(table.category),
  ]
);

// 10. Company Settings Table (Document branding & GSTIN settings)
export const companySettings = pgTable(
  'company_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyLegalName: varchar('company_legal_name', { length: 255 }).default('Ascelstack Technologies Private Limited').notNull(),
    companyBrandName: varchar('company_brand_name', { length: 255 }).default('Ascelstack').notNull(),
    registeredAddress: text('registered_address').default('Sector V, Bidhannagar, Salt Lake, Kolkata, West Bengal 700091, India').notNull(),
    legalEmail: varchar('legal_email', { length: 255 }).default('legal@ascelstack.com').notNull(),
    supportEmail: varchar('support_email', { length: 255 }).default('support@ascelstack.com').notNull(),
    contactPhone: varchar('contact_phone', { length: 100 }).default('+91 89428 41651').notNull(),
    gstin: varchar('gstin', { length: 50 }),
    gstinEnabled: boolean('gstin_enabled').default(false).notNull(),
    logoUrl: text('logo_url').default('/brand/mark.svg').notNull(),
    signatoryName: varchar('signatory_name', { length: 255 }).default('Authorized Signatory').notNull(),
    signatoryTitle: varchar('signatory_title', { length: 255 }).default('Director / Legal Counsel').notNull(),
    defaultCurrency: varchar('default_currency', { length: 10 }).default('INR').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }
);

// 11. Agreements Table
export const agreements = pgTable(
  'agreements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agreementNumber: varchar('agreement_number', { length: 100 }).notNull().unique(), // e.g. PSA-2026-0001
    secureToken: varchar('secure_token', { length: 255 }).notNull().unique(), // Cryptographic token for secure signing link
    title: varchar('title', { length: 255 }).default('PROFESSIONAL SERVICE AGREEMENT').notNull(),
    status: varchar('status', { length: 50 }).default('draft').notNull(),
    // draft | pending_review | sent | viewed | pending_signature | partially_signed | signed | rejected | expired | cancelled

    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'set null' }),
    quotationId: uuid('quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
    templateId: uuid('template_id').references(() => agreementTemplates.id, { onDelete: 'set null' }),

    version: integer('version').default(1).notNull(),
    isImmutable: boolean('is_immutable').default(false).notNull(),

    // Service Provider Information Snapshot
    providerName: varchar('provider_name', { length: 255 }).notNull(),
    providerLogo: text('provider_logo').default('/brand/mark.svg').notNull(),
    providerAddress: text('provider_address').notNull(),
    providerEmail: varchar('provider_email', { length: 255 }).notNull(),
    providerPhone: varchar('provider_phone', { length: 100 }).notNull(),
    providerGstin: varchar('provider_gstin', { length: 50 }),
    providerGstinEnabled: boolean('provider_gstin_enabled').default(false).notNull(),
    providerSignatoryName: varchar('provider_signatory_name', { length: 255 }).default('Authorized Signatory').notNull(),
    providerSignatoryTitle: varchar('provider_signatory_title', { length: 255 }).default('Director / Legal Counsel').notNull(),

    // Client Information
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientEmail: varchar('client_email', { length: 255 }).notNull(),
    clientCompany: varchar('client_company', { length: 255 }),
    clientAddress: text('client_address'),
    clientCity: varchar('client_city', { length: 100 }),
    clientState: varchar('client_state', { length: 100 }),
    clientCountry: varchar('client_country', { length: 100 }).default('India'),
    clientPhone: varchar('client_phone', { length: 50 }),
    clientGstin: varchar('client_gstin', { length: 50 }),

    // Project Details & Scope
    projectName: varchar('project_name', { length: 255 }).notNull(),
    projectDescription: text('project_description'),
    scopeOfWork: text('scope_of_work'),
    deliverables: jsonb('deliverables'), // array of { title, description }
    timeline: text('timeline'),
    milestones: jsonb('milestones'), // array of { title, duration, amount, description }

    // Commercials
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    advanceAmount: numeric('advance_amount', { precision: 12, scale: 2 }).default('0.00'),
    advancePercentage: integer('advance_percentage').default(50),
    paymentSchedule: text('payment_schedule'),
    taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0.00'),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00'),

    // All 25 customizable clauses stored as snapshot
    clauses: jsonb('clauses').notNull(),

    // Timestamps
    validUntil: timestamp('valid_until', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    clientSignedAt: timestamp('client_signed_at', { withTimezone: true }),
    providerSignedAt: timestamp('provider_signed_at', { withTimezone: true }),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('agreements_number_uidx').on(table.agreementNumber),
    uniqueIndex('agreements_token_uidx').on(table.secureToken),
    index('agreements_status_idx').on(table.status),
    index('agreements_user_id_idx').on(table.userId),
    index('agreements_business_id_idx').on(table.businessId),
    index('agreements_quotation_id_idx').on(table.quotationId),
    index('agreements_created_at_idx').on(table.createdAt),
  ]
);

// 12. Agreement Signatures Table
export const agreementSignatures = pgTable(
  'agreement_signatures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agreementId: uuid('agreement_id')
      .notNull()
      .references(() => agreements.id, { onDelete: 'cascade' }),
    signerRole: varchar('signer_role', { length: 50 }).notNull(), // client | provider
    signerName: varchar('signer_name', { length: 255 }).notNull(),
    signerEmail: varchar('signer_email', { length: 255 }).notNull(),
    signerTitle: varchar('signer_title', { length: 255 }),
    signatureType: varchar('signature_type', { length: 50 }).default('typed').notNull(), // typed | drawn
    signatureData: text('signature_data').notNull(), // SVG / Base64 / Font representation
    ipAddress: varchar('ip_address', { length: 100 }),
    userAgent: text('user_agent'),
    consentChecked: boolean('consent_checked').default(true).notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agreement_signatures_agreement_id_idx').on(table.agreementId),
    index('agreement_signatures_signer_role_idx').on(table.signerRole),
  ]
);

// 13. Agreement Audit Logs Table
export const agreementAuditLogs = pgTable(
  'agreement_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agreementId: uuid('agreement_id')
      .notNull()
      .references(() => agreements.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 100 }).notNull(),
    // created | updated | sent | viewed | client_signed | provider_signed | fully_signed | rejected | pdf_downloaded | cancelled
    performedBy: varchar('performed_by', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(), // admin | client | system
    description: text('description').notNull(),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agreement_audit_logs_agreement_id_idx').on(table.agreementId),
    index('agreement_audit_logs_action_idx').on(table.action),
    index('agreement_audit_logs_created_at_idx').on(table.createdAt),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  quotations: many(quotations),
  serviceRequests: many(serviceRequests),
  activityLogs: many(activityLogs),
  agreements: many(agreements),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerUserId],
    references: [users.id],
  }),
  quotations: many(quotations),
  serviceRequests: many(serviceRequests),
  activityLogs: many(activityLogs),
  agreements: many(agreements),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  serviceRequests: many(serviceRequests),
  pricing: one(servicePricing, {
    fields: [services.id],
    references: [servicePricing.serviceId],
  }),
}));

export const servicePricingRelations = relations(servicePricing, ({ one }) => ({
  service: one(services, {
    fields: [servicePricing.serviceId],
    references: [services.id],
  }),
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
  agreements: many(agreements),
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

export const agreementsRelations = relations(agreements, ({ one, many }) => ({
  user: one(users, {
    fields: [agreements.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [agreements.businessId],
    references: [businesses.id],
  }),
  quotation: one(quotations, {
    fields: [agreements.quotationId],
    references: [quotations.id],
  }),
  template: one(agreementTemplates, {
    fields: [agreements.templateId],
    references: [agreementTemplates.id],
  }),
  signatures: many(agreementSignatures),
  auditLogs: many(agreementAuditLogs),
}));

export const agreementTemplatesRelations = relations(agreementTemplates, ({ many }) => ({
  agreements: many(agreements),
}));

export const agreementSignaturesRelations = relations(agreementSignatures, ({ one }) => ({
  agreement: one(agreements, {
    fields: [agreementSignatures.agreementId],
    references: [agreements.id],
  }),
}));

export const agreementAuditLogsRelations = relations(agreementAuditLogs, ({ one }) => ({
  agreement: one(agreements, {
    fields: [agreementAuditLogs.agreementId],
    references: [agreements.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServicePricing = typeof servicePricing.$inferSelect;
export type NewServicePricing = typeof servicePricing.$inferInsert;
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
export type AgreementTemplateModel = typeof agreementTemplates.$inferSelect;
export type NewAgreementTemplateModel = typeof agreementTemplates.$inferInsert;
export type CompanySettingsModel = typeof companySettings.$inferSelect;
export type NewCompanySettingsModel = typeof companySettings.$inferInsert;
export type Agreement = typeof agreements.$inferSelect;
export type NewAgreement = typeof agreements.$inferInsert;
export type AgreementSignature = typeof agreementSignatures.$inferSelect;
export type NewAgreementSignature = typeof agreementSignatures.$inferInsert;
export type AgreementAuditLog = typeof agreementAuditLogs.$inferSelect;
export type NewAgreementAuditLog = typeof agreementAuditLogs.$inferInsert;
