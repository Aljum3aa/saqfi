import type { Lang } from './i18n';

export const kwd = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

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
  const msg = (lang === 'ar' ? d?.error : d?.errorEn ?? d?.error) ?? err?.message ?? (lang === 'ar' ? 'تعذر الاتصال بالخادم' : 'Could not reach the server');
  return { msg, exceeded: typeof d?.exceeded === 'number' ? d.exceeded : undefined, status: err?.status };
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
