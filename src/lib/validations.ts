import { z } from 'zod';

export const profileUpdateSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(255),
});

export const businessSchema = z.object({
  id: z.string().uuid().optional(),
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters').max(255),
  businessType: z.string().trim().max(100).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')).nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).default('India').optional().nullable(),
  gstin: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

export const serviceRequestCreateSchema = z.object({
  serviceId: z.string().min(1, 'Valid service ID or code required'),
  businessId: z.string().uuid('Valid business ID required').optional(),
  requirements: z.string().trim().max(2000).optional().default(''),
});

export const serviceRequestUpdateSchema = z.object({
  requestId: z.string().uuid('Valid request ID required'),
  requirements: z.string().trim().min(1, 'Requirements cannot be empty').max(2000),
});

export const serviceRequestCancelSchema = z.object({
  requestId: z.string().uuid('Valid request ID required'),
  reason: z.string().trim().max(500).optional(),
});

// Agreement Validation Schemas
export const agreementClauseSchema = z.object({
  id: z.string(),
  sectionNumber: z.number().int().min(1).max(100),
  title: z.string().trim().min(1, 'Clause title is required').max(255),
  category: z.string().optional(),
  content: z.string().trim().min(1, 'Clause content cannot be empty'),
  customNotes: z.string().optional().nullable(),
  isMandatory: z.boolean().default(false),
  isCustomizable: z.boolean().default(true),
});

const optionalUuidOrNull = z
  .union([z.string().uuid(), z.string().length(0), z.null(), z.undefined()])
  .transform((val) => (val === '' || !val ? null : val));

const optionalDateOrNull = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((val) => {
    if (!val || val === '') return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  });

const numberCoerce = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}, z.number().nonnegative().default(0));

export const agreementCreateSchema = z.object({
  title: z.string().trim().min(2, 'Title required').max(255).default('PROFESSIONAL SERVICE AGREEMENT'),
  templateId: optionalUuidOrNull,
  userId: optionalUuidOrNull,
  businessId: optionalUuidOrNull,
  quotationId: optionalUuidOrNull,

  // Client Details
  clientName: z.string().trim().min(2, 'Client name is required').max(255),
  clientEmail: z.string().trim().email('Valid client email required').max(255),
  clientCompany: z.string().trim().max(255).optional().nullable(),
  clientAddress: z.string().trim().optional().nullable(),
  clientCity: z.string().trim().max(100).optional().nullable(),
  clientState: z.string().trim().max(100).optional().nullable(),
  clientCountry: z.string().trim().max(100).default('India').optional().nullable(),
  clientPhone: z.string().trim().max(50).optional().nullable(),
  clientGstin: z.string().trim().max(50).optional().nullable(),

  // Project Details
  projectName: z.string().trim().min(2, 'Project name is required').max(255),
  projectDescription: z.string().trim().optional().nullable(),
  scopeOfWork: z.string().trim().optional().nullable(),
  deliverables: z.array(z.any()).optional().nullable(),
  timeline: z.string().trim().optional().nullable(),
  milestones: z.array(z.any()).optional().nullable(),

  // Commercials
  currency: z.string().trim().max(10).default('INR'),
  totalAmount: numberCoerce,
  advanceAmount: numberCoerce,
  advancePercentage: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return 50;
    const num = parseInt(String(val), 10);
    return isNaN(num) ? 50 : Math.min(100, Math.max(0, num));
  }, z.number().int().min(0).max(100).default(50)),
  paymentSchedule: z.string().trim().optional().nullable(),
  taxPercentage: numberCoerce,
  taxAmount: numberCoerce,

  // Clauses
  clauses: z.array(agreementClauseSchema).min(1, 'At least one agreement clause is required'),

  // Status & Provider Override
  status: z.enum([
    'draft',
    'pending_review',
    'sent',
    'viewed',
    'pending_signature',
    'partially_signed',
    'signed',
    'rejected',
    'expired',
    'cancelled',
  ]).default('draft'),
  validUntil: optionalDateOrNull,
  providerGstinEnabled: z.boolean().default(false),
  providerGstin: z.string().trim().max(50).optional().nullable(),
});

export const agreementUpdateSchema = agreementCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const agreementSignSchema = z.object({
  signerName: z.string().trim().min(2, 'Full legal name required').max(255),
  signerEmail: z.string().trim().email('Valid email required').max(255),
  signerTitle: z.string().trim().max(255).optional().nullable(),
  signatureType: z.enum(['typed', 'drawn']).default('typed'),
  signatureData: z.string().trim().min(5, 'Valid signature data required'),
  consentChecked: z.literal(true, {
    errorMap: () => ({ message: 'You must explicitly accept and agree to the agreement terms' }),
  }),
});

export const companySettingsSchema = z.object({
  companyLegalName: z.string().trim().min(2).max(255),
  companyBrandName: z.string().trim().min(2).max(255),
  registeredAddress: z.string().trim().min(5),
  legalEmail: z.string().trim().email(),
  supportEmail: z.string().trim().email(),
  contactPhone: z.string().trim().max(100),
  gstin: z.string().trim().max(50).optional().nullable(),
  gstinEnabled: z.boolean().default(false),
  logoUrl: z.string().trim().min(1),
  signatoryName: z.string().trim().min(2).max(255),
  signatoryTitle: z.string().trim().min(2).max(255),
  defaultCurrency: z.string().trim().max(10).default('INR'),
});
