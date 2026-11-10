import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { db, agreements, agreementSignatures, agreementAuditLogs } from '../../../db';
import { agreementSignSchema } from '../../../lib/validations';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const { token } = context.params;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Agreement access token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [agreement] = await db
      .select()
      .from(agreements)
      .where(eq(agreements.secureToken, token))
      .limit(1);

    if (!agreement) {
      return new Response(JSON.stringify({ error: 'Agreement not found or invalid link' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Auto-mark as viewed on first opening by client
    if (agreement.status === 'sent') {
      const now = new Date();
      await db
        .update(agreements)
        .set({
          status: 'viewed',
          viewedAt: now,
          updatedAt: now,
        })
        .where(eq(agreements.id, agreement.id));

      agreement.status = 'viewed';
      agreement.viewedAt = now;

      await db.insert(agreementAuditLogs).values({
        agreementId: agreement.id,
        action: 'viewed',
        performedBy: agreement.clientEmail,
        role: 'client',
        description: `Agreement ${agreement.agreementNumber} was opened and viewed by client (${agreement.clientEmail})`,
        ipAddress: context.clientAddress || null,
      });
    }

    // Fetch any existing signatures
    const signatures = await db
      .select({
        id: agreementSignatures.id,
        signerRole: agreementSignatures.signerRole,
        signerName: agreementSignatures.signerName,
        signerTitle: agreementSignatures.signerTitle,
        signatureType: agreementSignatures.signatureType,
        signatureData: agreementSignatures.signatureData,
        signedAt: agreementSignatures.signedAt,
      })
      .from(agreementSignatures)
      .where(eq(agreementSignatures.agreementId, agreement.id));

    return new Response(
      JSON.stringify({
        agreement,
        signatures,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API agreement token GET error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const { token } = context.params;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Agreement token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [agreement] = await db
      .select()
      .from(agreements)
      .where(eq(agreements.secureToken, token))
      .limit(1);

    if (!agreement) {
      return new Response(JSON.stringify({ error: 'Agreement not found or invalid link' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validation: cannot sign cancelled, rejected, or expired agreement
    if (['cancelled', 'rejected', 'expired'].includes(agreement.status)) {
      return new Response(
        JSON.stringify({ error: `This agreement is ${agreement.status} and cannot be signed.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if client has already signed
    const [existingClientSig] = await db
      .select()
      .from(agreementSignatures)
      .where(and(eq(agreementSignatures.agreementId, agreement.id), eq(agreementSignatures.signerRole, 'client')))
      .limit(1);

    if (existingClientSig) {
      return new Response(
        JSON.stringify({ error: 'This agreement has already been signed by the client.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = agreementSignSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = parsed.data;
    const now = new Date();
    const ipAddress = context.clientAddress || null;
    const userAgent = context.request.headers.get('user-agent') || null;

    // 1. Record electronic signature
    const [clientSignature] = await db
      .insert(agreementSignatures)
      .values({
        agreementId: agreement.id,
        signerRole: 'client',
        signerName: data.signerName.trim(),
        signerEmail: data.signerEmail.trim().toLowerCase(),
        signerTitle: data.signerTitle?.trim() || 'Client Representative',
        signatureType: data.signatureType,
        signatureData: data.signatureData.trim(),
        ipAddress,
        userAgent,
        consentChecked: true,
        signedAt: now,
      })
      .returning();

    // 2. Check if provider has already signed
    const [providerSig] = await db
      .select()
      .from(agreementSignatures)
      .where(and(eq(agreementSignatures.agreementId, agreement.id), eq(agreementSignatures.signerRole, 'provider')))
      .limit(1);

    const isFullySigned = Boolean(providerSig);
    const newStatus = isFullySigned ? 'signed' : 'partially_signed';

    // 3. Update agreement state (locked & immutable once fully signed)
    const [updatedAgreement] = await db
      .update(agreements)
      .set({
        clientSignedAt: now,
        status: newStatus,
        signedAt: isFullySigned ? now : agreement.signedAt,
        isImmutable: isFullySigned,
        updatedAt: now,
      })
      .where(eq(agreements.id, agreement.id))
      .returning();

    // 4. Audit log
    await db.insert(agreementAuditLogs).values({
      agreementId: agreement.id,
      action: isFullySigned ? 'fully_signed' : 'client_signed',
      performedBy: data.signerEmail,
      role: 'client',
      description: isFullySigned
        ? `Client (${data.signerName}) signed. Agreement ${agreement.agreementNumber} is now fully executed and locked.`
        : `Client (${data.signerName}) signed agreement ${agreement.agreementNumber}. Awaiting Service Provider countersignature.`,
      details: {
        signerName: data.signerName,
        signerEmail: data.signerEmail,
        signerTitle: data.signerTitle,
        signatureType: data.signatureType,
        isFullySigned,
      },
      ipAddress,
    });

    return new Response(
      JSON.stringify({
        success: true,
        agreement: updatedAgreement,
        signature: clientSignature,
        isFullySigned,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API agreement token sign POST error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
