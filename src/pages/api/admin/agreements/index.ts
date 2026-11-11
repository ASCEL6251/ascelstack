import type { APIRoute } from 'astro';
import { eq, desc, asc, ilike, or, and, sql } from 'drizzle-orm';
import { db, agreements, users, businesses, companySettings, agreementAuditLogs } from '../../../../db';
import { getAdminSession } from '../../../../lib/admin-auth';
import { agreementCreateSchema } from '../../../../lib/validations';
import { DEFAULT_COMPANY_INFO } from '../../../../lib/agreement-clauses';

function generateSecureHex(byteLength = 24): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = context.url;
    const search = url.searchParams.get('q')?.trim() || '';
    const statusFilter = url.searchParams.get('status')?.trim() || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(agreements.agreementNumber, `%${search}%`),
          ilike(agreements.title, `%${search}%`),
          ilike(agreements.projectName, `%${search}%`),
          ilike(agreements.clientName, `%${search}%`),
          ilike(agreements.clientEmail, `%${search}%`),
          ilike(agreements.clientCompany, `%${search}%`)
        )
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      conditions.push(eq(agreements.status, statusFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)::int` })
      .from(agreements)
      .where(whereClause);

    const items = await db
      .select({
        id: agreements.id,
        agreementNumber: agreements.agreementNumber,
        secureToken: agreements.secureToken,
        title: agreements.title,
        status: agreements.status,
        version: agreements.version,
        isImmutable: agreements.isImmutable,
        clientName: agreements.clientName,
        clientEmail: agreements.clientEmail,
        clientCompany: agreements.clientCompany,
        projectName: agreements.projectName,
        currency: agreements.currency,
        totalAmount: agreements.totalAmount,
        advanceAmount: agreements.advanceAmount,
        advancePercentage: agreements.advancePercentage,
        clientSignedAt: agreements.clientSignedAt,
        providerSignedAt: agreements.providerSignedAt,
        signedAt: agreements.signedAt,
        createdAt: agreements.createdAt,
        updatedAt: agreements.updatedAt,
      })
      .from(agreements)
      .where(whereClause)
      .orderBy(desc(agreements.createdAt))
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({
        agreements: items,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin agreements GET error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = agreementCreateSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = parsed.data;

    // Fetch active company settings or fallback to standard company info
    const [settings] = await db.select().from(companySettings).limit(1);
    const providerName = settings?.companyLegalName || DEFAULT_COMPANY_INFO.legalName;
    const providerAddress = settings?.registeredAddress || DEFAULT_COMPANY_INFO.address;
    const providerEmail = settings?.legalEmail || DEFAULT_COMPANY_INFO.email;
    const providerPhone = settings?.contactPhone || DEFAULT_COMPANY_INFO.phone;
    const providerLogo = settings?.logoUrl || DEFAULT_COMPANY_INFO.logoUrl;
    const providerGstinEnabled = data.providerGstinEnabled ?? settings?.gstinEnabled ?? false;
    const providerGstin = providerGstinEnabled ? (data.providerGstin || settings?.gstin || null) : null;
    const providerSignatoryName = settings?.signatoryName || DEFAULT_COMPANY_INFO.signatoryName;
    const providerSignatoryTitle = settings?.signatoryTitle || DEFAULT_COMPANY_INFO.signatoryTitle;

    // Generate unique Agreement Number: PSA-YYYY-XXXX (collision-proof)
    const currentYear = new Date().getFullYear();
    const existingForYear = await db
      .select({ agreementNumber: agreements.agreementNumber })
      .from(agreements)
      .where(ilike(agreements.agreementNumber, `PSA-${currentYear}-%`));

    let maxSeq = 0;
    for (const item of existingForYear) {
      const parts = item.agreementNumber.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    const agreementNumber = `PSA-${currentYear}-${nextSeq}`;

    // Cryptographically secure token for public signing link (Web Crypto standard)
    const secureToken = generateSecureHex(24);

    // Auto-link registered user in Neon if clientEmail matches existing user account
    let linkedUserId = data.userId || null;
    let linkedBusinessId = data.businessId || null;

    if (!linkedUserId && data.clientEmail) {
      const [matchedUser] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${data.clientEmail.trim()})`)
        .limit(1);

      if (matchedUser) {
        linkedUserId = matchedUser.id;
        if (!linkedBusinessId) {
          const [matchedBiz] = await db
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.ownerUserId, matchedUser.id))
            .limit(1);
          if (matchedBiz) linkedBusinessId = matchedBiz.id;
        }
      }
    }

    // Calculate advance amount if not explicitly provided
    const advanceAmount =
      data.advanceAmount > 0
        ? data.advanceAmount
        : Number(((data.totalAmount * data.advancePercentage) / 100).toFixed(2));

    const [newAgreement] = await db
      .insert(agreements)
      .values({
        agreementNumber,
        secureToken,
        title: data.title,
        status: data.status || 'draft',
        userId: linkedUserId,
        businessId: linkedBusinessId,
        quotationId: data.quotationId || null,
        templateId: data.templateId || null,
        version: 1,
        isImmutable: false,

        // Provider Snapshot
        providerName,
        providerLogo,
        providerAddress,
        providerEmail,
        providerPhone,
        providerGstin,
        providerGstinEnabled,
        providerSignatoryName,
        providerSignatoryTitle,

        // Client
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientCompany: data.clientCompany || null,
        clientAddress: data.clientAddress || null,
        clientCity: data.clientCity || null,
        clientState: data.clientState || null,
        clientCountry: data.clientCountry || 'India',
        clientPhone: data.clientPhone || null,
        clientGstin: data.clientGstin || null,

        // Project
        projectName: data.projectName,
        projectDescription: data.projectDescription || null,
        scopeOfWork: data.scopeOfWork || null,
        deliverables: data.deliverables || null,
        timeline: data.timeline || null,
        milestones: data.milestones || null,

        // Commercials
        currency: data.currency || 'INR',
        totalAmount: String(data.totalAmount),
        advanceAmount: String(advanceAmount),
        advancePercentage: data.advancePercentage,
        paymentSchedule: data.paymentSchedule || null,
        taxPercentage: String(data.taxPercentage || 0),
        taxAmount: String(data.taxAmount || 0),

        // Clauses
        clauses: data.clauses,

        // Timestamps
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        sentAt: data.status === 'sent' ? new Date() : null,
      })
      .returning();

    // Audit log
    await db.insert(agreementAuditLogs).values({
      agreementId: newAgreement.id,
      action: 'created',
      performedBy: session.email,
      role: 'admin',
      description: `Created agreement ${newAgreement.agreementNumber} (${newAgreement.title}) for ${newAgreement.clientName}`,
      details: {
        agreementNumber: newAgreement.agreementNumber,
        clientEmail: newAgreement.clientEmail,
        totalAmount: newAgreement.totalAmount,
        currency: newAgreement.currency,
        status: newAgreement.status,
      },
      ipAddress: context.clientAddress || null,
    });

    const origin = context.url.origin;
    return new Response(
      JSON.stringify({
        success: true,
        agreement: newAgreement,
        accessCode: newAgreement.agreementNumber,
        signingUrl: `${origin}/agreements/${newAgreement.secureToken}`,
        printPdfUrl: `${origin}/agreements/${newAgreement.secureToken}/print`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin agreements POST error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
