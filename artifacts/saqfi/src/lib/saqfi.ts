import type { Lang } from './i18n';

/** True when the amount carries fils (non-zero thousandths). */
export const isFractional = (n: number) => Number.isFinite(n) && Math.round(Math.abs(n) * 1000) % 1000 !== 0;
/** Format KWD. exact=true: 3 decimals only if the value has fils, else whole. exact=false: whole dinars (summaries). */
export const kwd = (n: number, exact = true) => {
  const v = Number.isFinite(n) ? n : 0;
  const d = exact && isFractional(v) ? 3 : 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
/** Amount with localized suffix, for plain strings (toasts, dialogs). */
export const kwdText = (n: number, lang: Lang, exact = true) => `${kwd(n, exact)} ${lang === 'ar' ? 'د.ك' : 'KWD'}`;
/** Value for editable inputs: no commas, 3 decimals only if fractional. */
export const kwdInput = (n: number) => (isFractional(n) ? n.toFixed(3) : String(Math.round(n)));

export const DEC3 = /^\d+(\.\d{1,3})?$/;
export const validAmount = (s: string) => DEC3.test(s.trim()) && Number(s) > 0;

export function monthLabel(ym: string, lang: Lang) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
export function dateLabel(d: string, lang: Lang) {
  if (!d) return '';
  const dt = new Date(d.length === 10 ? d + 'T00:00:00Z' : d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Presentation only: keep stored descriptions and ISO date values unchanged. */
export function displayText(value: string, lang: Lang) {
  return value
    .replace(/\b\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?\b/g,
      date => date.length === 7 ? monthLabel(date, lang) : dateLabel(date, lang))
    .replace(/(\d)\s*[—–]\s*(?=\d)/g, `$1 ${lang === 'ar' ? 'إلى' : 'to'} `)
    .replace(/\s*[—–]\s*/g, lang === 'ar' ? '، ' : ', ');
}

export function transactionDescription(
  entry: { description: string; date: string; type: string; categoryId: string },
  lang: Lang,
) {
  if (entry.type === 'payroll') {
    const month = entry.description.match(/\b\d{4}-(?:0[1-9]|1[0-2])\b/)?.[0] ?? entry.date.slice(0, 7);
    return `${lang === 'ar' ? 'رواتب اللاعبين،' : 'Player salaries,'} ${monthLabel(month, lang)}`;
  }
  if (entry.categoryId === 'staff' && entry.description.startsWith('رواتب الجهاز الفني')) {
    return `${lang === 'ar' ? 'رواتب الجهاز الفني،' : 'Technical staff salaries,'} ${monthLabel(entry.date.slice(0, 7), lang)}`;
  }
  return displayText(entry.description, lang);
}

/** Inclusive month count; partial months count as full. */
export function monthsInclusive(start: string, end: string) {
  if (!start || !end) return 0;
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const n = (ey - sy) * 12 + (em - sm) + 1;
  return n > 0 ? n : 0;
}
export const ym = (d: string) => d.slice(0, 7);

export type ApiErr = { msg: string; exceeded?: number; status?: number };
export function apiErr(e: unknown, lang: Lang): ApiErr {
  const err = e as { status?: number; message?: string; data?: { error?: string; errorEn?: string; exceeded?: number } | null };
  const d = err?.data ?? undefined;
  const msg = (lang === 'ar' ? d?.error : d?.errorEn ?? d?.error) ?? (lang === 'ar' ? 'تعذر الاتصال بالخادم. حاول مرة ثانية.' : 'Could not reach the server. Please try again.');
  return { msg: displayText(msg, lang), exceeded: typeof d?.exceeded === 'number' ? d.exceeded : undefined, status: err?.status };
}

export const POSITIONS: { v: string; ar: string; en: string }[] = [
  { v: 'GK', ar: 'حارس مرمى', en: 'Goalkeeper' },
  { v: 'DF', ar: 'مدافع', en: 'Defender' },
  { v: 'MF', ar: 'وسط', en: 'Midfielder' },
  { v: 'FW', ar: 'مهاجم', en: 'Forward' },
];
export const posLabel = (p: string, lang: Lang) => {
  const f = POSITIONS.find((x) => x.v === p || x.en === p || x.ar === p);
  return f ? (lang === 'ar' ? f.ar : f.en) : p;
};
