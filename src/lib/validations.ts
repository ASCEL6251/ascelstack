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
  serviceId: z.string().uuid('Valid service ID required'),
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
