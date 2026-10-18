import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useGetRates, getGetRatesQueryKey } from '@workspace/api-client-react';
import { kwd } from '@/lib/saqfi';
import type { Lang } from '@/lib/i18n';

/**
 * Display currency. The ledger is always kept in KWD; this only changes how amounts are shown,
 * using the live rates the server already serves (/rates, base KWD). Forms keep entering KWD.
 */
export const DISPLAY_CURRENCIES = [
  { code: 'KWD', ar: 'د.ك', en: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti dinar' },
  { code: 'USD', ar: '$', en: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US dollar' },
  { code: 'EUR', ar: '€', en: 'EUR', nameAr: 'يورو', nameEn: 'Euro' },
  { code: 'GBP', ar: '£', en: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'Pound sterling' },
  { code: 'SAR', ar: 'ر.س', en: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi riyal' },
  { code: 'AED', ar: 'د.إ', en: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE dirham' },
  { code: 'QAR', ar: 'ر.ق', en: 'QAR', nameAr: 'ريال قطري', nameEn: 'Qatari riyal' },
  { code: 'BHD', ar: 'د.ب', en: 'BHD', nameAr: 'دينار بحريني', nameEn: 'Bahraini dinar' },
  { code: 'OMR', ar: 'ر.ع', en: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani rial' },
  { code: 'EGP', ar: 'ج.م', en: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian pound' },
  { code: 'TRY', ar: '₺', en: 'TRY', nameAr: 'ليرة تركية', nameEn: 'Turkish lira' },
] as const;
export type DisplayCode = (typeof DISPLAY_CURRENCIES)[number]['code'];

type Ctx = {
  code: DisplayCode;              // what the user picked
  shown: DisplayCode;             // what is actually shown (falls back to KWD until a rate exists)
  setCode: (c: DisplayCode) => void;
  conv: (kwdAmount: number) => number;
  unit: (lang: Lang) => string;
  text: (kwdAmount: number, lang: Lang, exact?: boolean) => string;
  loading: boolean;
  failed: boolean;
};
const CurCtx = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState<DisplayCode>(() => {
    try { const c = localStorage.getItem('saqfi-cur'); return (DISPLAY_CURRENCIES.some((x) => x.code === c) ? c : 'KWD') as DisplayCode; } catch { return 'KWD'; }
  });
  const setCode = (c: DisplayCode) => { setCodeState(c); try { localStorage.setItem('saqfi-cur', c); } catch { /* private mode */ } };
  const rates = useGetRates({ query: { queryKey: getGetRatesQueryKey(), enabled: code !== 'KWD', staleTime: 30 * 60 * 1000, retry: 1 } });
  const rate = code === 'KWD' ? 1 : rates.data?.rates?.[code];
  const shown: DisplayCode = rate ? code : 'KWD';
  const r = rate ?? 1;
  const meta = DISPLAY_CURRENCIES.find((x) => x.code === shown)!;
  const conv = (v: number) => v * r;
  const unit = (lang: Lang) => (lang === 'ar' ? meta.ar : meta.en);
  // Converted amounts are estimates: show whole units (KWD keeps its fils when exact).
  const text = (v: number, lang: Lang, exact = false) => `${kwd(conv(v), shown === 'KWD' ? exact : false)} ${unit(lang)}`;
  useEffect(() => { if (rates.isError && code !== 'KWD') console.warn('rates unavailable; showing KWD'); }, [rates.isError, code]);
  return (
    <CurCtx.Provider value={{ code, shown, setCode, conv, unit, text, loading: code !== 'KWD' && rates.isLoading, failed: code !== 'KWD' && rates.isError }}>
      {children}
    </CurCtx.Provider>
  );
}

export function useCurrency(): Ctx {
  const c = useContext(CurCtx);
  if (c) return c;
  /* Outside the provider (e.g. tests): plain KWD */
  return { code: 'KWD', shown: 'KWD', setCode: () => {}, conv: (v) => v, unit: (l) => (l === 'ar' ? 'د.ك' : 'KWD'),
    text: (v, l, e = false) => `${kwd(v, e)} ${l === 'ar' ? 'د.ك' : 'KWD'}`, loading: false, failed: false };
}

/** Inside forms and dialogs amounts are entered and booked in KWD, so every amount there stays KWD. */
export const KwdOnly = createContext(false);
