import { Link } from 'wouter';
import { AlertTriangle, CheckCircle2, Banknote } from 'lucide-react';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwdText, displayText } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote } from '@/components/shell';
import { CategoryRow, SpendBar } from '@/components/category-bar';
import { cn } from '@/lib/utils';

export default function Dashboard({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const left = Math.round((s.totalBudget - s.spent) * 1000) / 1000;
  const pct = s.totalBudget > 0 ? (s.spent / s.totalBudget) * 100 : 0;
  const over = s.forecast > s.totalBudget;
  const gap = Math.abs(s.totalBudget - s.forecast);
  const f = kwdText(s.forecast, lang, false);
  const g = kwdText(gap, lang, false);

  return (
    <div>
      <PageHead
        title={t('الرئيسية', 'Home')}
        sub={t(`وضع ميزانية ${s.club} اليوم.`, `Where ${s.clubEn}'s budget stands today.`)}
        action={session.role === 'manager'
          ? <Link href="/payroll" data-testid="link-payroll" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:opacity-90"><Banknote className="h-4 w-4" />{t('صرف رواتب الشهر', 'Pay this month\'s salaries')}</Link>
          : <ReadOnlyNote />}
      />

      <div className="space-y-6">
        <section className="panel p-5 md:p-8" data-testid="card-summary">
          <div className="grid gap-6 sm:grid-cols-3">
            <div data-testid="text-kpi-budget"><div className="text-muted-foreground mb-1">{t('الميزانية', 'Budget')}</div><Money v={s.totalBudget} className="text-[28px] md:text-[34px] font-semibold" /></div>
            <div data-testid="text-kpi-spent"><div className="text-muted-foreground mb-1">{t('المصروف', 'Spent')}</div><Money v={s.spent} className="text-[28px] md:text-[34px] font-semibold" /></div>
            <div data-testid="text-kpi-left"><div className="text-muted-foreground mb-1">{t('الباقي', 'Left')}</div><Money v={left} className={cn('text-[28px] md:text-[34px] font-semibold', left < 0 && 'text-destructive')} /></div>
          </div>
          <SpendBar cap={s.totalBudget} spent={s.spent} className="h-3 mt-7" />
          <div className="mt-2 text-[15px] text-muted-foreground"><span className="num">{pct.toFixed(0)}%</span> {t('من الميزانية انصرف', 'of the budget spent')}</div>
          <div className="mt-5 pt-4 border-t border-border text-[15px] space-y-1">
            <div data-testid="text-kpi-committed">{t('محجوز للرواتب الجاية: ', 'Reserved for upcoming salaries: ')}<Money v={s.committed} className="font-semibold" /></div>
            <div className="text-muted-foreground" data-testid="text-kpi-remaining">{t('يعني اللي تقدر تصرفه فعلاً (الباقي ناقص المحجوز): ', 'So what you can actually spend (left minus reserved): ')}<Money v={s.remaining} className={cn('font-semibold', s.remaining <= 0 ? 'text-destructive' : 'text-foreground')} /></div>
          </div>
        </section>

        <section className="panel p-5 md:p-8">
          <h2 className="text-xl font-semibold mb-4">{t('يحتاج انتباهك', 'Needs your attention')}</h2>
          {s.alerts.length === 0 ? (
            <div className="flex items-center gap-3 text-success" data-testid="text-no-alerts"><CheckCircle2 className="h-5 w-5" />{t('كل شي تمام. ما في شي يحتاج تدخل.', 'All good. Nothing needs action.')}</div>
          ) : (
            <ul className="divide-y divide-border">
              {s.alerts.map((a) => {
                const pay = /payroll|overdue|salar/i.test(a.type);
                const bad = /overdue|over/i.test(a.type);
                return (
                  <li key={a.id} data-testid={`alert-${a.id}`} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex gap-3 flex-1">
                      <AlertTriangle className={cn('h-5 w-5 shrink-0 mt-0.5', bad ? 'text-destructive' : 'text-warning')} />
                      <span>{displayText(t(a.message, a.messageEn), lang)}</span>
                    </div>
                    <Link href={pay ? '/payroll' : '/budget'} data-testid={`link-fix-${a.id}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-[15px] hover:bg-muted shrink-0">
                      {pay ? t('افتح الرواتب', 'Open payroll') : t('افتح الميزانية', 'Open budget')}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel p-5 md:p-8">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-xl font-semibold">{t('البنود', 'Categories')}</h2>
            <Link href="/budget" className="min-h-11 inline-flex items-center text-primary text-[15px] hover:underline" data-testid="link-budget">{t('التفاصيل', 'Details')}</Link>
          </div>
          <div className="divide-y divide-border">{s.categories.map((c) => <CategoryRow key={c.id} c={c} />)}</div>
        </section>

        <section className="panel p-5 md:p-8" data-testid="card-forecast">
          <h2 className="text-xl font-semibold mb-2">{t('توقع نهاية الموسم', 'Season-end forecast')}</h2>
          <p className={cn('text-[17px]', over && 'text-destructive')}>
            {over
              ? t(`بهالمعدل بتخلص الموسم بـ ${f}، يعني أكثر من السقف بـ ${g}.`, `At this pace the season ends at ${f}, which is ${g} over the cap.`)
              : t(`بهالمعدل بتخلص الموسم بـ ${f}، يعني أقل من السقف بـ ${g}.`, `At this pace the season ends at ${f}, which is ${g} under the cap.`)}
          </p>
        </section>
      </div>
    </div>
  );
}
