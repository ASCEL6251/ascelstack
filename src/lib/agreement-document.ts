/**
 * Helpers that turn a stored agreement row into the final document text:
 * money formatting, amount in words (Indian system), clause placeholder merge
 * and a content fingerprint printed on the execution certificate.
 */

type Row = Record<string, any>;

export interface Deliverable { title: string }
export interface Milestone { title: string; duration?: string; amount?: string }
export interface Clause { id?: string; sectionNumber: number; title: string; content: string; category?: string }

const CURRENCY_LOCALE: Record<string, string> = { INR: 'en-IN', USD: 'en-US', EUR: 'en-IE', GBP: 'en-GB', AED: 'en-AE' };

export function money(amount: string | number | null | undefined, currency = 'INR', withDecimals = false) {
  const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: withDecimals ? 2 : 0,
      maximumFractionDigits: withDecimals ? 2 : 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN')}`;
  }
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ' ' + ONES[r % 10] : ''}`);
  return parts.join(' ');
}

/** 150000 → "One Lakh Fifty Thousand" (Indian grouping). */
function indianWords(n: number): string {
  if (n === 0) return 'Zero';
  const units: [number, string][] = [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']];
  const out: string[] = [];
  let rest = n;
  for (const [size, name] of units) {
    const q = Math.floor(rest / size);
    if (q) {
      out.push(`${q >= 1000 ? indianWords(q) : below1000(q)} ${name}`);
      rest %= size;
    }
  }
  if (rest) out.push(below1000(rest));
  return out.join(' ');
}

/** 1500000 → "One Million Five Hundred Thousand" (international grouping). */
function intlWords(n: number): string {
  if (n === 0) return 'Zero';
  const units: [number, string][] = [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
  const out: string[] = [];
  let rest = n;
  for (const [size, name] of units) {
    const q = Math.floor(rest / size);
    if (q) {
      out.push(`${below1000(q)} ${name}`);
      rest %= size;
    }
  }
  if (rest) out.push(below1000(rest));
  return out.join(' ');
}

const CURRENCY_WORDS: Record<string, [string, string]> = {
  INR: ['Rupees', 'Paise'],
  USD: ['US Dollars', 'Cents'],
  EUR: ['Euros', 'Cents'],
  GBP: ['Pounds Sterling', 'Pence'],
  AED: ['UAE Dirhams', 'Fils'],
};

export function amountInWords(amount: string | number | null | undefined, currency = 'INR') {
  const n = Math.abs(typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0)) || 0;
  const whole = Math.floor(n);
  const fraction = Math.round((n - whole) * 100);
  const [major, minor] = CURRENCY_WORDS[currency] ?? [currency, 'Cents'];
  const words = currency === 'INR' ? indianWords(whole) : intlWords(whole);
  const tail = fraction ? ` and ${below1000(fraction)} ${minor}` : '';
  return `${major} ${words}${tail} Only`;
}

export function longDate(d: Date | string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function stamp(d: Date | string | null | undefined) {
  if (!d) return '';
  return (
    new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'Asia/Kolkata',
    }) + ' IST'
  );
}

export function clientAddressLine(a: Row) {
  return [a.clientAddress, a.clientCity, a.clientState, a.clientCountry].filter((v) => v && String(v).trim()).join(', ');
}

/** Replace every {{token}} in the stored clause text with the agreement's real values. */
export function mergeClauses(a: Row): Clause[] {
  const currency = a.currency || 'INR';
  const deliverables = ((a.deliverables as Deliverable[]) || []).filter((d) => d?.title);
  const milestones = ((a.milestones as Milestone[]) || []).filter((m) => m?.title);
  const address = clientAddressLine(a);
  const num = (v: any) => (parseFloat(v) || 0).toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US');

  const values: Record<string, string> = {
    client_name: a.clientName || 'the Client',
    client_company: a.clientCompany || a.clientName || 'the Client',
    client_email: a.clientEmail || 'as on record',
    client_phone: a.clientPhone || 'as on record',
    client_country: a.clientCountry || 'India',
    project_name: a.projectName || 'the Project',
    project_description: a.projectDescription || 'As set out in Schedule A of this Agreement.',
    scope_of_work: a.scopeOfWork || 'The deliverables and milestones set out in Schedule A of this Agreement.',
    project_timeline: a.timeline || 'As set out in Schedule A',
    deliverables_list: deliverables.length
      ? deliverables.map((d, i) => `${i + 1}. ${d.title}`).join('\n')
      : 'As set out in Schedule A.',
    milestones_schedule: milestones.length
      ? milestones.map((m, i) => `${i + 1}. ${m.title}${m.duration ? ` (${m.duration})` : ''}${m.amount ? ` — ${m.amount}` : ''}`).join('\n')
      : 'As set out in Schedule A.',
    payment_schedule: a.paymentSchedule || 'As set out in Schedule A.',
    currency,
    total_amount: num(a.totalAmount),
    total_amount_words: amountInWords(a.totalAmount, currency),
    advance_amount: num(a.advanceAmount),
    advance_percentage: String(a.advancePercentage ?? 0),
  };

  return ((a.clauses as Clause[]) || [])
    .slice()
    .sort((x, y) => x.sectionNumber - y.sectionNumber)
    .map((c) => {
      let text = String(c.content || '');
      // The address tokens sit together; collapse them so missing parts leave no ", , ,".
      text = text.replace(
        /\{\{client_address\}\},\s*\{\{client_city\}\},\s*\{\{client_state\}\},\s*\{\{client_country\}\}/g,
        address || 'the address on record',
      );
      text = text
        .replace(/\{\{client_address\}\}/g, a.clientAddress || 'the address on record')
        .replace(/\{\{client_city\}\}/g, a.clientCity || '')
        .replace(/\{\{client_state\}\}/g, a.clientState || '')
        .replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m));
      return { ...c, content: text };
    });
}

/** SHA-256 over the parts of the agreement that make up its legal content. */
export async function fingerprint(a: Row, clauses: Clause[]) {
  const payload = JSON.stringify({
    n: a.agreementNumber,
    v: a.version,
    p: [a.providerName, a.providerAddress],
    c: [a.clientName, a.clientCompany, a.clientEmail],
    pr: [a.projectName, a.deliverables, a.milestones, a.timeline],
    $: [a.currency, a.totalAmount, a.advanceAmount, a.advancePercentage, a.paymentSchedule],
    cl: clauses.map((c) => [c.sectionNumber, c.title, c.content]),
  });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  sent: 'Awaiting signature',
  viewed: 'Awaiting signature',
  pending_signature: 'Awaiting signature',
  partially_signed: 'Awaiting countersignature',
  signed: 'Fully executed',
  rejected: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};
