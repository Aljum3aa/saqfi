import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Briefcase, Landmark, User, ShieldCheck } from 'lucide-react';
import { useLoginDemo, getGetSessionQueryKey, getGetClubStateQueryKey } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr } from '@/lib/saqfi';
import { Mark, LangToggle } from '@/components/shell';
import crestUrl from '@assets/crest_1792268676116.webp';

type Role = 'manager' | 'president' | 'player';

const HERO_BG = 'bg-[#0A2B20] bg-[radial-gradient(120%_90%_at_100%_0%,hsl(161_60%_28%/.55),transparent_60%)]';

/** Illustration of the product idea: one season cap, spending can never pass the gold line. */
function CapPreview() {
  const { t } = useLang();
  return (
    <div className="rounded-[20px] border border-white/15 bg-white/[.07] backdrop-blur-sm p-5 md:p-6 max-w-md">
      <div className="flex items-center justify-between text-[13px] text-white/70">
        <span>{t('ميزانية الموسم', 'Season budget')}</span>
        <span className="inline-flex items-center gap-1.5 text-white/85"><ShieldCheck className="h-4 w-4" />{t('السقف محمي', 'Cap protected')}</span>
      </div>
      <div className="relative mt-4 h-3 rounded-full bg-white/15">
        <div className="absolute inset-y-0 start-0 w-[34%] rounded-full bg-white" />
        <div className="absolute inset-y-0 start-[34%] w-[44%] bg-white/45 rounded-e-full" />
        <div className="absolute -top-1.5 -bottom-1.5 start-[90%] w-[3px] rounded-full bg-cap" aria-hidden />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
        <span className="flex items-center gap-2 text-white/80"><i className="h-2 w-2 rounded-full bg-white" />{t('المصروف', 'Spent')}</span>
        <span className="flex items-center gap-2 text-white/80"><i className="h-2 w-2 rounded-full bg-white/45" />{t('المحجوز', 'Reserved')}</span>
        <span className="flex items-center gap-2 text-white/80"><i className="h-2 w-[3px] rounded-full bg-cap" />{t('السقف', 'Cap')}</span>
      </div>
    </div>
  );
}

export default function Login() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [pending, setPending] = useState<Role | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const login = useLoginDemo({
    mutation: {
      onSuccess: (session) => {
        qc.removeQueries({ queryKey: getGetClubStateQueryKey() });
        qc.setQueryData(getGetSessionQueryKey(), session);
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
      },
      onError: (e) => setErr(apiErr(e, lang).msg),
      onSettled: () => setPending(null),
    },
  });
  const go = (role: Role) => { setErr(null); setPending(role); login.mutate({ data: { role } }); };
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;

  const roles = [
    { r: 'manager' as Role, icon: Briefcase, ar: 'المدير المالي', en: 'Finance manager', dar: 'يدير الميزانية والعقود والمصاريف والرواتب.', den: 'Runs the budget, contracts, expenses and payroll.' },
    { r: 'president' as Role, icon: Landmark, ar: 'رئيس النادي', en: 'Club president', dar: 'يشوف كل الأرقام ويعتمد الطلبات الكبيرة.', den: 'Sees every figure and approves large requests.' },
    { r: 'player' as Role, icon: User, ar: 'لاعب', en: 'Player', dar: 'يشوف عقده ورواتبه ومكافآته فقط.', den: 'Sees only his own contract, salary and bonuses.' },
  ];

  const club = (
    <div className="flex items-center gap-3">
      <span className="h-12 w-12 rounded-2xl bg-white/95 grid place-items-center shadow-sm"><img src={crestUrl} alt="" className="h-9 w-9 object-contain" /></span>
      <span className="leading-tight">
        <span className="block font-semibold text-[16px]">{t('نادي الصقور', 'Al-Suqoor FC')}</span>
        <span className="block text-[13px] text-white/65">{t('موسم 2026/27', 'Season 2026/27')}</span>
      </span>
    </div>
  );

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* Brand side (desktop): club identity, the promise, and the cap idea */}
      <aside className={`relative hidden lg:flex flex-col justify-between overflow-hidden text-white p-12 xl:p-16 ${HERO_BG}`}>
        <img src={crestUrl} alt="" aria-hidden className="pointer-events-none absolute -bottom-24 -end-24 w-[520px] opacity-[.06] select-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3"><Mark size={42} onDark /><span className="font-display text-[22px] font-semibold">{t('سقفي', 'Saqfi')}</span></div>
          {club}
        </div>
        <div className="relative">
          <h1 className="font-display text-[48px] xl:text-[56px] font-semibold leading-[1.2] tracking-tight max-w-lg">{t('ولا دينار فوق السقف.', 'Not one dinar over the cap.')}</h1>
          <div className="mt-10"><CapPreview /></div>
        </div>
        <div className="relative text-[13px] text-white/55">{t('جميع المبالغ بالدينار الكويتي', 'All amounts in Kuwaiti dinar')}</div>
      </aside>

      <main className="flex flex-col">
        {/* Brand band (mobile) */}
        <div className={`lg:hidden relative overflow-hidden text-white px-5 pt-5 pb-8 ${HERO_BG}`}>
          <img src={crestUrl} alt="" aria-hidden className="pointer-events-none absolute -bottom-16 -end-14 w-[230px] opacity-[.07] select-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5"><Mark size={36} onDark /><span className="font-display text-[19px] font-semibold">{t('سقفي', 'Saqfi')}</span></div>
            <LangToggle className="text-white/85 hover:bg-white/10" />
          </div>
          <h1 className="relative mt-7 font-display text-[30px] font-semibold leading-[1.3]">{t('ولا دينار فوق السقف.', 'Not one dinar over the cap.')}</h1>
          <div className="relative mt-6">{club}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 lg:py-12">
          <div className="w-full max-w-[440px]">
            <div className="hidden lg:flex justify-end mb-10"><LangToggle /></div>
            <span className="inline-flex items-center rounded-full bg-accent text-primary text-[12px] font-semibold px-3 py-1">{t('نسخة تجريبية', 'Demo')}</span>
            <h2 className="mt-3 font-display text-[26px] font-semibold tracking-tight">{t('تسجيل الدخول', 'Sign in')}</h2>

            <div className="mt-6 rounded-2xl border border-border bg-card shadow-sm divide-y divide-border overflow-hidden">
              {roles.map((x) => {
                const Icon = x.icon;
                return (
                  <button key={x.r} data-testid={`button-login-${x.r}`} disabled={!!pending} onClick={() => go(x.r)}
                    className="group w-full text-start px-4 md:px-5 py-4 min-h-[78px] flex items-center gap-4 hover:bg-accent/60 focus-visible:bg-accent/60 outline-none transition-colors disabled:opacity-60">
                    <span className="h-11 w-11 shrink-0 rounded-xl bg-accent text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors"><Icon className="h-5 w-5" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-[16px]">{t(x.ar, x.en)}</span>
                      <span className="block text-[14px] text-muted-foreground leading-relaxed">{t(x.dar, x.den)}</span>
                    </span>
                    {pending === x.r ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Arrow className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />}
                  </button>
                );
              })}
            </div>

            {err && <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/[.05] p-3 text-destructive" role="alert" data-testid="text-login-error">{err}</div>}
            <p className="mt-6 text-[13px] text-muted-foreground leading-relaxed" data-testid="text-sandbox-notice">
              {t('لا تدخل بيانات حقيقية. ما في أي تحويل بنكي، والرواتب قيود محاسبية فقط.',
                'Do not enter real data. No bank transfers happen; payroll is accounting entries only.')}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
