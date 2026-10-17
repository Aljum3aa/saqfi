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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4"><LangToggle /></div>
        <div className="panel p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <Mark size={56} />
            <h1 className="text-[28px] font-semibold mt-4">{t('سقفي', 'Saqfi')}</h1>
            <p className="text-muted-foreground mt-1">{t('ولا دينار فوق السقف', 'Not one dinar over the cap')}</p>
          </div>
          <p className="font-semibold mb-3">{t('ادخل كـ', 'Sign in as')}</p>
          <div className="space-y-3">
            {roles.map((x) => {
              const Icon = x.icon;
              return (
                <button key={x.r} data-testid={`button-login-${x.r}`} disabled={!!pending} onClick={() => go(x.r)}
                  className="w-full text-start rounded-lg border border-border bg-card px-4 py-4 min-h-[72px] flex items-center gap-4 hover:border-primary hover:bg-accent transition-colors disabled:opacity-60">
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
          {err && <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/[.05] p-3 text-destructive" role="alert" data-testid="text-login-error">{err}</div>}
        </div>
        <p className="mt-5 text-center text-[13px] text-muted-foreground leading-relaxed" data-testid="text-sandbox-notice">
          {t('نسخة تجريبية مفتوحة للجميع. لا تدخل بيانات حقيقية، وما في أي تحويل بنكي؛ الرواتب قيود محاسبية فقط.',
            'Open demo for anyone. Do not enter real data. No bank transfers happen; payroll is accounting entries only.')}
        </p>
      </div>
    </div>
  );
}
