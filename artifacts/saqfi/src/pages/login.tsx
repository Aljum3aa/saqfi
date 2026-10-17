import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
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
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const roles: { r: Role; ar: string; en: string; dar: string; den: string }[] = [
    { r: 'manager', ar: 'المدير المالي', en: 'Finance manager', dar: 'صلاحية كاملة: الميزانية، العقود، المصروفات، وتشغيل الرواتب.', den: 'Full write access: budget, contracts, expenses and payroll runs.' },
    { r: 'president', ar: 'رئيس النادي', en: 'Club president', dar: 'قراءة فقط لكل الأرقام والتنبيهات والسجل.', den: 'Read-only view of every figure, alert and ledger line.' },
    { r: 'player', ar: 'لاعب', en: 'Player', dar: 'عقده الشخصي وسجل رواتبه فقط.', den: 'Only his own contract and salary history.' },
  ];

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.15fr_1fr]">
      <section className="relative overflow-hidden border-b lg:border-b-0 lg:border-e border-border p-6 md:p-12 flex flex-col">
        <div className="absolute inset-0 pointer-events-none opacity-[.07]" style={{ backgroundImage: 'linear-gradient(hsl(42 72% 56%) 1px,transparent 1px),linear-gradient(90deg,hsl(42 72% 56%) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3"><Mark size={40} /><span className="font-bold text-lg">{t('سقفي', 'Saqfi')}</span></div>
          <LangToggle className="lg:hidden" />
        </div>
        <div className="relative my-auto py-12">
          <div className="eyebrow text-primary mb-5">{t('غرفة التحكم المالي · الدوري الكويتي', 'Financial control room · Kuwaiti league')}</div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight rise">
            {t('ولا دينار', 'Not one dinar')}<br /><span className="text-primary">{t('فوق السقف.', 'over the cap.')}</span>
          </h1>
          <p className="mt-6 max-w-md text-muted-foreground rise" style={{ animationDelay: '.1s' }}>
            {t('كل عقد يُحجز من الميزانية قبل توقيعه، وكل مصروف يُفحص مقابل ما تبقى فعلاً، وكل راتب يُسجّل بدقة ثلاث خانات عشرية.',
              'Every contract is reserved against the budget before signing, every expense is checked against what is truly left, every salary booked to three decimals.')}
          </p>
          <div className="mt-10 max-w-md rise" style={{ animationDelay: '.2s' }}>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-2">
              <span>{t('سقف الموسم', 'Season cap')}</span><span className="num text-foreground">400,000.000 KWD</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-primary" style={{ width: '31%' }} />
              <div className="h-full stripes" style={{ width: '44%' }} />
            </div>
            <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-primary" />{t('مصروف', 'Spent')}</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm stripes" />{t('محجوز للرواتب', 'Reserved for salaries')}</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-muted border border-border" />{t('متاح فعلاً', 'Truly available')}</span>
            </div>
          </div>
        </div>
        <div className="relative text-[11px] text-muted-foreground">{t('نادي الساحل الجديد · موسم 2026/2027', 'New Sahel FC · Season 2026/2027')}</div>
      </section>

      <section className="p-6 md:p-12 flex flex-col">
        <div className="hidden lg:flex justify-end"><LangToggle /></div>
        <div className="my-auto w-full max-w-md mx-auto py-8">
          <h2 className="text-2xl font-bold">{t('دخول تجريبي', 'Demo sign-in')}</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">{t('اختر الدور الذي تريد تجربته. الجلسة تُحفظ عبر الخادم.', 'Pick the role you want to try. The session is kept by the server.')}</p>
          <div className="space-y-3">
            {roles.map((x, i) => (
              <button key={x.r} data-testid={`button-login-${x.r}`} disabled={!!pending} onClick={() => go(x.r)}
                className="group w-full text-start panel p-4 flex items-center gap-4 hover:border-primary/70 transition-all disabled:opacity-60 rise"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
                <span className="num text-xs text-primary/70 w-6">0{i + 1}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{t('الدخول كـ', 'Enter as ')}{t(x.ar, x.en)}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{t(x.dar, x.den)}</span>
                </span>
                {pending === x.r ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Arrow className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />}
              </button>
            ))}
          </div>
          {err && <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm" data-testid="text-login-error">{err}</div>}
          <div className="mt-8 rounded-lg border border-primary/30 bg-primary/[.05] p-4 text-xs leading-relaxed" data-testid="text-sandbox-notice">
            <div className="font-semibold text-primary mb-1">{t('بيئة تجريبية عامة', 'Public sandbox')}</div>
            {t('هذه الأدوار متاحة للجميع لأغراض العرض وليست حسابات إنتاج آمنة. لا تُدخل بيانات حقيقية. لا تُنفّذ أي تحويلات بنكية — الرواتب قيود محاسبية فقط.',
              'These roles are open to anyone for demonstration and are not secure production accounts. Do not enter real data. No bank transfers happen — payroll is accounting entries only.')}
          </div>
        </div>
      </section>
    </div>
  );
}
