import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwd, monthLabel, monthsInclusive } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel } from '@/components/shell';
import { CategoryRow, Legend, StackBar } from '@/components/category-bar';
import { cn } from '@/lib/utils';

export default function Dashboard({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const seasonMonths = monthsInclusive(s.seasonStart, s.seasonEnd);
  const elapsed = Math.min(seasonMonths, Math.max(1, monthsInclusive(s.seasonStart, s.today)));
  const overForecast = s.forecast > s.totalBudget;
  const kpis = [
    { k: 'budget', ar: 'سقف الموسم', en: 'Season cap', v: s.totalBudget, tone: '' },
    { k: 'spent', ar: 'مصروف فعلي', en: 'Spent', v: s.spent, tone: '' },
    { k: 'committed', ar: 'محجوز للرواتب', en: 'Reserved salaries', v: s.committed, tone: '' },
    { k: 'remaining', ar: 'متاح فعلاً', en: 'Truly available', v: s.remaining, tone: s.remaining <= 0 ? 'text-destructive' : 'text-primary' },
  ];

  return (
    <div>
      <PageHead
        eyebrow={`${t('موسم', 'Season')} ${monthLabel(s.seasonStart.slice(0, 7), lang)} — ${monthLabel(s.seasonEnd.slice(0, 7), lang)}`}
        title={t(s.club, s.clubEn)}
        sub={t(`الوضع المالي حتى ${s.today}. المتاح = السقف − المصروف − الرواتب المحجوزة للأشهر غير المدفوعة.`, `Financial position as of ${s.today}. Available = cap − spent − salaries reserved for unpaid months.`)}
        action={session.role === 'president' ? <span className="text-[11px] text-muted-foreground border border-border rounded-md px-2.5 py-1.5">{t('عرض الرئيس · قراءة فقط', 'President view · read only')}</span> : undefined}
      />

      <div className="panel p-5 md:p-6 mb-4 rise">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-5">
          {kpis.map((k, i) => (
            <div key={k.k} className={cn('px-1 lg:px-5', i > 0 && 'lg:border-s border-border')} data-testid={`text-kpi-${k.k}`}>
              <div className="eyebrow mb-2">{t(k.ar, k.en)}</div>
              <Money v={k.v} className={cn('text-xl md:text-2xl font-semibold', k.tone)} />
            </div>
          ))}
        </div>
        <StackBar cap={s.totalBudget} spent={s.spent} committed={s.committed} className="h-3 mt-6" />
        <div className="mt-2.5"><Legend /></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="panel p-5 rise" style={{ animationDelay: '.05s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t('الإنفاق الشهري', 'Monthly spend')}</h2>
              <span className="text-[11px] text-muted-foreground">{t('د.ك', 'KWD')}</span>
            </div>
            {s.trend.length === 0 ? (
              <div className="h-56 grid place-items-center text-sm text-muted-foreground">{t('لا يوجد إنفاق مسجل بعد', 'No spend recorded yet')}</div>
            ) : (
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.trend.map((x) => ({ ...x, label: monthLabel(x.month, lang) }))} margin={{ left: 0, right: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(220 30% 18%)" />
                    <XAxis dataKey="label" tick={{ fill: 'hsl(218 18% 62%)', fontSize: 11 }} axisLine={false} tickLine={false} reversed={lang === 'ar'} />
                    <YAxis tick={{ fill: 'hsl(218 18% 62%)', fontSize: 10 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `${Math.round(v / 1000)}k`} orientation={lang === 'ar' ? 'right' : 'left'} />
                    <Tooltip cursor={{ fill: 'hsl(42 72% 56% / .06)' }} contentStyle={{ background: 'hsl(221 44% 12%)', border: '1px solid hsl(220 30% 22%)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${kwd(v)} KWD`, t('الإنفاق', 'Spend')]} />
                    <Bar dataKey="amount" fill="hsl(42 72% 56%)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="panel p-5 rise" style={{ animationDelay: '.1s' }}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className="font-semibold">{t('بنود الميزانية', 'Budget categories')}</h2>
              <Link href="/budget" className="text-xs text-primary hover:underline" data-testid="link-budget">{t('تفاصيل الميزانية', 'Budget detail')}</Link>
            </div>
            <div className="divide-y divide-border">{s.categories.map((c) => <CategoryRow key={c.id} c={c} />)}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5 rise" style={{ animationDelay: '.08s' }}>
            <h2 className="font-semibold mb-3">{t('التنبيهات', 'Alerts')}</h2>
            {s.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('لا توجد تنبيهات. كل البنود ضمن السقف.', 'No alerts. Every category is within its cap.')}</p>
            ) : (
              <ul className="space-y-2">
                {s.alerts.map((a) => (
                  <li key={a.id} data-testid={`alert-${a.id}`} className={cn('flex gap-2.5 rounded-lg border p-3 text-sm', a.type.includes('overdue') ? 'border-destructive/50 bg-destructive/10' : 'border-primary/40 bg-primary/[.06]')}>
                    <AlertTriangle className={cn('h-4 w-4 shrink-0 mt-0.5', a.type.includes('overdue') ? 'text-destructive' : 'text-primary')} />
                    <span>{t(a.message, a.messageEn)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn('panel p-5 rise', overForecast && 'border-destructive/50')} style={{ animationDelay: '.12s' }} data-testid="card-forecast">
            <div className="eyebrow mb-2">{t('توقع نهاية الموسم', 'Season-end forecast')}</div>
            <Money v={s.forecast} className={cn('text-2xl font-semibold', overForecast ? 'text-destructive' : 'text-foreground')} />
            <div className="text-xs mt-1">
              {overForecast
                ? <span className="text-destructive">{t('يتجاوز السقف بـ ', 'Exceeds the cap by ')}<Money v={s.forecast - s.totalBudget} /></span>
                : <span className="text-muted-foreground">{t('ضمن السقف بهامش ', 'Within cap, margin ')}<Money v={s.totalBudget - s.forecast} /></span>}
            </div>
            <div className="gold-rule my-4 opacity-40" />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <div className="font-semibold text-foreground/80 mb-1">{t('الافتراضات', 'Assumptions')}</div>
              {t('المصروف ÷ الأشهر المنقضية بما فيها الشهر الحالي × أشهر الموسم.', 'Spend ÷ elapsed months including the current one × season months.')}
              <div className="num mt-1.5 text-foreground/80">{kwd(s.spent)} ÷ {elapsed} × {seasonMonths}</div>
              {t('لا يشمل العقود المستقبلية غير الموقعة.', 'Excludes contracts not yet signed.')}
            </div>
          </div>

          <div className="panel p-5 rise" style={{ animationDelay: '.16s' }}>
            <div className="eyebrow mb-2">{t('الرواتب القادمة', 'Next payroll')}</div>
            <div className="text-lg font-semibold" data-testid="text-next-payroll">{s.nextPayrollMonth ? monthLabel(s.nextPayrollMonth, lang) : t('اكتمل الموسم', 'Season complete')}</div>
            <div className="text-sm text-muted-foreground mt-1">{t('الكشف الشهري ', 'Monthly run ')}<Money v={s.monthlyPayroll} className="text-foreground" /></div>
            <div className="text-[11px] text-muted-foreground mt-1">{t(`${s.contracts.length} عقد · ${s.payrolls.length} دفعة منفذة`, `${s.contracts.length} contracts · ${s.payrolls.length} runs posted`)}</div>
            <Link href="/payroll" className="inline-block mt-3 text-xs text-primary hover:underline" data-testid="link-payroll">{t('فتح الرواتب', 'Open payroll')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
