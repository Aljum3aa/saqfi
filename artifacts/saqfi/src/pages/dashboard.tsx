import { Link } from 'wouter';
import { AlertTriangle, CheckCircle2, Banknote } from 'lucide-react';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwdText, displayText } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote } from '@/components/shell';
import { CategoryRow, SpendBar } from '@/components/category-bar';
import { cn } from '@/lib/utils';

function Legend({ swatch, label, children }: { swatch: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full shrink-0', swatch)} />
      <span className="text-muted-foreground text-[15px]">{label}</span>
      <span className="font-semibold ms-auto sm:ms-0">{children}</span>
    </div>
  );
}

export default function Dashboard({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const pct = s.totalBudget > 0 ? (s.spent / s.totalBudget) * 100 : 0;
  const over = s.forecast > s.totalBudget;
  const gap = Math.abs(s.totalBudget - s.forecast);
  const f = kwdText(s.forecast, lang, false);
  const g = kwdText(gap, lang, false);
  const free = s.remaining;

  return (
    <div>
      <PageHead
        title={t('الرئيسية', 'Home')}
        sub={t(`وضع ميزانية ${s.club} اليوم.`, `Where ${s.clubEn}'s budget stands today.`)}
        action={session.role === 'manager'
          ? <Link href="/payroll" data-testid="link-payroll" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 active:translate-y-px transition"><Banknote className="h-4 w-4" />{t('صرف رواتب الشهر', 'Pay this month\'s salaries')}</Link>
          : <ReadOnlyNote />}
      />

      <div className="space-y-6">
        {/* The one big moment: how much is still free under the cap */}
        <section className="panel p-5 md:p-8" data-testid="card-summary">
          <div className="text-muted-foreground">{t('تقدر تصرف بعد', 'You can still spend')}</div>
          <Money v={free} className={cn('block mt-1 text-[40px] md:text-[56px] font-bold leading-none tracking-tight', free <= 0 ? 'text-destructive' : 'text-foreground')} />
          <p className="mt-3 text-[15px] text-muted-foreground" data-testid="text-kpi-remaining">
            {t('من سقف الموسم، بعد ما حجزنا رواتب الأشهر الجاية.', 'Under the season cap, after reserving the coming months\' salaries.')}
          </p>

          <SpendBar cap={s.totalBudget} spent={s.spent} reserved={s.committed} className="mt-7" />

          <div className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-6">
            <div data-testid="text-kpi-spent"><Legend swatch="bg-primary" label={t('انصرف', 'Spent')}><Money v={s.spent} /></Legend></div>
            <div data-testid="text-kpi-committed"><Legend swatch="bg-primary/25" label={t('محجوز للرواتب', 'Reserved for salaries')}><Money v={s.committed} /></Legend></div>
            <div data-testid="text-kpi-budget"><Legend swatch="bg-cap" label={t('سقف الموسم', 'Season cap')}><Money v={s.totalBudget} /></Legend></div>
          </div>

          <p className={cn('mt-6 pt-5 border-t border-border text-[15px]', over ? 'text-destructive font-semibold' : 'text-foreground/80')} data-testid="card-forecast">
            <span className="num">{pct.toFixed(0)}%</span> {t('من الميزانية انصرف. ', 'of the budget is spent. ')}
            {over
              ? t(`بهالمعدل بتخلص الموسم بـ ${f}، أكثر من السقف بـ ${g}.`, `At this pace the season ends at ${f}, ${g} over the cap.`)
              : t(`بهالمعدل بتخلص الموسم بـ ${f}، أقل من السقف بـ ${g}.`, `At this pace the season ends at ${f}, ${g} under the cap.`)}
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
          <section className="panel p-5 md:p-7">
            <h2 className="text-[19px] font-semibold mb-3">{t('يحتاج انتباهك', 'Needs your attention')}</h2>
            {s.alerts.length === 0 ? (
              <div className="flex items-center gap-3 text-success" data-testid="text-no-alerts"><CheckCircle2 className="h-5 w-5" />{t('كل شي تمام. ما في شي يحتاج تدخل.', 'All good. Nothing needs action.')}</div>
            ) : (
              <ul className="space-y-3">
                {s.alerts.map((a) => {
                  const pay = /payroll|overdue|salar/i.test(a.type);
                  const bad = /overdue|over/i.test(a.type);
                  return (
                    <li key={a.id} data-testid={`alert-${a.id}`}
                      className={cn('rounded-lg p-4 border', bad ? 'border-destructive/25 bg-destructive/[.04]' : 'border-warning/25 bg-warning/[.06]')}>
                      <div className="flex gap-3">
                        <AlertTriangle className={cn('h-5 w-5 shrink-0 mt-0.5', bad ? 'text-destructive' : 'text-warning')} />
                        <span>{displayText(t(a.message, a.messageEn), lang)}</span>
                      </div>
                      <Link href={pay ? '/payroll' : '/budget'} data-testid={`link-fix-${a.id}`}
                        className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-card border border-border px-4 text-[15px] font-semibold hover:bg-muted">
                        {pay ? t('افتح الرواتب', 'Open payroll') : t('افتح الميزانية', 'Open budget')}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel p-5 md:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[19px] font-semibold">{t('البنود', 'Categories')}</h2>
              <Link href="/budget" className="min-h-11 inline-flex items-center text-primary text-[15px] font-semibold hover:underline" data-testid="link-budget">{t('كل التفاصيل', 'All details')}</Link>
            </div>
            <div className="divide-y divide-border">{s.categories.map((c) => <CategoryRow key={c.id} c={c} />)}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
