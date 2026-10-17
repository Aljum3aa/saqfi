import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Briefcase, Landmark, User } from 'lucide-react';
import { useLoginDemo, getGetSessionQueryKey, getGetClubStateQueryKey } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr } from '@/lib/saqfi';
import { Mark, LangToggle } from '@/components/shell';

type Role = 'manager' | 'president' | 'player';

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
    { r: 'manager' as Role, icon: Briefcase, ar: 'المدير المالي', en: 'Finance manager', dar: 'يدير الميزانية والعقود والمصاريف والرواتب.', den: 'Manages the budget, contracts, expenses and payroll.' },
    { r: 'president' as Role, icon: Landmark, ar: 'رئيس النادي', en: 'Club president', dar: 'يشوف كل الأرقام بدون تعديل.', den: 'Sees every figure, without editing.' },
    { r: 'player' as Role, icon: User, ar: 'لاعب', en: 'Player', dar: 'يشوف عقده ورواتبه فقط.', den: 'Sees only his own contract and salary.' },
  ];

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      {/* Brand side: the cap idea, said once and big */}
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12">
        <div className="flex items-center gap-3"><Mark size={44} /><span className="text-[22px] font-bold">{t('سقفي', 'Saqfi')}</span></div>
        <div>
          <div className="h-[5px] w-28 rounded-full bg-cap mb-8" aria-hidden />
          <h1 className="text-[52px] font-bold leading-[1.15] tracking-tight max-w-md">{t('ولا دينار فوق السقف.', 'Not one dinar over the cap.')}</h1>
          <p className="mt-5 text-[17px] text-primary-foreground/75 max-w-md">
            {t('ميزانية النادي ورواتب اللاعبين بمكان واحد. أي صرف يتعدى سقف البند ينرفض قبل لا يصير.',
              'Your club budget and player salaries in one place. Any spend that would break a category cap is stopped before it happens.')}
          </p>
        </div>
        <div className="text-[13px] text-primary-foreground/60">{t('جميع المبالغ بالدينار الكويتي', 'All amounts in Kuwaiti dinar')}</div>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-10 bg-background">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-6"><LangToggle /></div>
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <Mark size={60} />
            <h1 className="text-[30px] font-bold mt-4">{t('سقفي', 'Saqfi')}</h1>
            <p className="text-muted-foreground mt-1">{t('ولا دينار فوق السقف', 'Not one dinar over the cap')}</p>
          </div>
          <h2 className="text-[22px] font-bold mb-1">{t('اختار حسابك', 'Choose your account')}</h2>
          <p className="text-muted-foreground mb-5">{t('هذي نسخة تجريبية، فاختار الدور اللي تبي تجربه.', 'This is a demo, so pick the role you want to try.')}</p>
          <div className="space-y-3">
            {roles.map((x) => {
              const Icon = x.icon;
              return (
                <button key={x.r} data-testid={`button-login-${x.r}`} disabled={!!pending} onClick={() => go(x.r)}
                  className="w-full text-start rounded-xl border border-border bg-card px-4 py-4 min-h-[76px] flex items-center gap-4 shadow-sm hover:border-primary/60 hover:shadow-md active:translate-y-px transition disabled:opacity-60">
                  <span className="h-11 w-11 shrink-0 rounded-lg bg-accent text-primary grid place-items-center"><Icon className="h-5 w-5" /></span>
                  <span className="flex-1">
                    <span className="block font-semibold text-[17px]">{t(x.ar, x.en)}</span>
                    <span className="block text-[15px] text-muted-foreground">{t(x.dar, x.den)}</span>
                  </span>
                  {pending === x.r ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Arrow className="h-5 w-5 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
          {err && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/[.05] p-3 text-destructive" role="alert" data-testid="text-login-error">{err}</div>}
          <p className="mt-6 text-[13px] text-muted-foreground leading-relaxed" data-testid="text-sandbox-notice">
            {t('لا تدخل بيانات حقيقية. ما في أي تحويل بنكي، والرواتب قيود محاسبية فقط.',
              'Do not enter real data. No bank transfers happen; payroll is accounting entries only.')}
          </p>
        </div>
      </div>
    </div>
  );
}
