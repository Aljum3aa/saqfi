import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (ar: string, en: string) => string };
const LangCtx = createContext<Ctx>({ lang: 'ar', setLang: () => {}, t: (a) => a });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('saqfi-lang') === 'en' ? 'en' : 'ar'));
  useEffect(() => {
    localStorage.setItem('saqfi-lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'سقفي: ولا دينار فوق السقف' : 'Saqfi: Not one dinar over the cap';
  }, [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t: (ar, en) => (lang === 'ar' ? ar : en) }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
