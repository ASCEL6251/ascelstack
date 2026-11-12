import { eq } from 'drizzle-orm';
import { db, agreements, agreementSignatures } from '../db';
import { mergeClauses, fingerprint } from './agreement-document';

/** Everything the client page and the PDF page need to render one agreement. */
export async function loadAgreementByToken(token: string) {
  const [agreement] = await db.select().from(agreements).where(eq(agreements.secureToken, token)).limit(1);
  if (!agreement) return null;

  const signatures = await db
    .select()
    .from(agreementSignatures)
    .where(eq(agreementSignatures.agreementId, agreement.id));

  const clauses = mergeClauses(agreement);
  const hash = await fingerprint(agreement, clauses);

  return {
    agreement,
    clauses,
    hash,
    clientSig: signatures.find((s) => s.signerRole === 'client') ?? null,
    providerSig: signatures.find((s) => s.signerRole === 'provider') ?? null,
  };
}

export type LoadedAgreement = NonNullable<Awaited<ReturnType<typeof loadAgreementByToken>>>;
