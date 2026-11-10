import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { db, agreements, agreementSignatures, agreementAuditLogs } from '../../../../../db';
import { getAdminSession } from '../../../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id } = context.params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Agreement ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [agreement] = await db.select().from(agreements).where(eq(agreements.id, id)).limit(1);

    if (!agreement) {
      return new Response(JSON.stringify({ error: 'Agreement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already signed by provider
    const [existingSignature] = await db
      .select()
      .from(agreementSignatures)
      .where(and(eq(agreementSignatures.agreementId, id), eq(agreementSignatures.signerRole, 'provider')))
      .limit(1);

    if (existingSignature) {
      return new Response(
        JSON.stringify({ error: 'Agreement is already signed by the Service Provider.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json().catch(() => ({}));
    const { signerName, signerTitle, signatureType, signatureData } = body;

    if (!signerName || !signatureData) {
      return new Response(
        JSON.stringify({ error: 'Signer name and signature data are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const ipAddress = context.clientAddress || null;
    const userAgent = context.request.headers.get('user-agent') || null;

    // Insert signature
    const [signature] = await db
      .insert(agreementSignatures)
      .values({
        agreementId: id,
        signerRole: 'provider',
        signerName: signerName.trim(),
        signerEmail: session.email,
        signerTitle: signerTitle?.trim() || agreement.providerSignatoryTitle || 'Authorized Signatory',
        signatureType: signatureType === 'drawn' ? 'drawn' : 'typed',
        signatureData: signatureData.trim(),
        ipAddress,
        userAgent,
        consentChecked: true,
        signedAt: now,
      })
      .returning();

    // Check if client has already signed
    const [clientSig] = await db
      .select()
      .from(agreementSignatures)
      .where(and(eq(agreementSignatures.agreementId, id), eq(agreementSignatures.signerRole, 'client')))
      .limit(1);

    const isFullySigned = Boolean(clientSig);
    const newStatus = isFullySigned ? 'signed' : 'partially_signed';

    const [updatedAgreement] = await db
      .update(agreements)
      .set({
        providerSignedAt: now,
        status: newStatus,
        signedAt: isFullySigned ? now : agreement.signedAt,
        isImmutable: isFullySigned,
        updatedAt: now,
      })
      .where(eq(agreements.id, id))
      .returning();

    // Audit log
    await db.insert(agreementAuditLogs).values({
      agreementId: id,
      action: isFullySigned ? 'fully_signed' : 'provider_signed',
      performedBy: session.email,
      role: 'admin',
      description: isFullySigned
        ? `Service Provider signed. Agreement ${agreement.agreementNumber} is now fully signed by both parties and immutable.`
        : `Service Provider signed agreement ${agreement.agreementNumber}. Awaiting client signature.`,
      details: {
        signerName,
        signerEmail: session.email,
        signerRole: 'provider',
        signatureType,
        isFullySigned,
      },
      ipAddress,
    });

    return new Response(
      JSON.stringify({
        success: true,
        agreement: updatedAgreement,
        signature,
        isFullySigned,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin agreement sign error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
