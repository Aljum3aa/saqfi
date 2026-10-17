import { Link } from 'wouter';
import { AlertTriangle, CheckCircle2, Banknote, ArrowDownLeft, CalendarClock, TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwd, kwdText, displayText } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, clubCrest } from '@/components/shell';
import { CategoryRow, SpendBar } from '@/components/category-bar';
import { cn } from '@/lib/utils';

const shortMonth = (ym: string, lang: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { month: 'short', timeZone: 'UTC' });
};

function Tile({ icon: Icon, label, children, note, tone = 'navy' }:
  { icon: typeof Banknote; label: string; children: React.ReactNode; note?: React.ReactNode; tone?: 'navy' | 'gold' | 'bad' | 'good' }) {
  const chip = tone === 'gold' ? 'bg-cap/15 text-[hsl(42_60%_32%)]' : tone === 'bad' ? 'bg-destructive/10 text-destructive' : tone === 'good' ? 'bg-success/10 text-success' : 'bg-accent text-primary';
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-3">
        <span className={cn('h-10 w-10 rounded-full grid place-items-center shrink-0', chip)}><Icon className="h-[18px] w-[18px]" /></span>
        <span className="text-[15px] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-4 font-display text-[26px] font-semibold tracking-tight">{children}</div>
      {note && <div className="mt-1 text-[13px] text-muted-foreground">{note}</div>}
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
  const free = s.remaining;
  const trend = (s.trend ?? []).map((p) => ({ m: shortMonth(p.month, lang), v: p.amount }));

  return (
    <div>
      <PageHead
        title={t('الرئيسية', 'Home')}
        sub={t(`وضع ميزانية ${s.club} اليوم.`, `Where ${s.clubEn}'s budget stands today.`)}
        action={session.role === 'manager'
          ? <Link href="/payroll" data-testid="link-payroll" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[.98] transition"><Banknote className="h-4 w-4" />{t('صرف رواتب الشهر', 'Pay this month\'s salaries')}</Link>
          : <ReadOnlyNote />}
      />

      <div className="space-y-5 md:space-y-6">
        {/* Balance card: the one bold moment, like a bank card */}
        <section data-testid="card-summary"
          className="relative overflow-hidden rounded-[24px] p-6 md:p-9 text-white shadow-xl shadow-primary/20 bg-[radial-gradient(130%_140%_at_100%_0%,#24467d_0%,#14284B_48%,#0c1a33_100%)]">
          <img aria-hidden src={clubCrest()} alt="" className="pointer-events-none absolute -bottom-16 -start-10 h-72 w-72 object-contain opacity-[.08] grayscale brightness-[3]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white/70">{t('تقدر تصرف بعد', 'You can still spend')}</div>
                <Money v={free} className={cn('block mt-2 font-display text-[44px] md:text-[64px] font-semibold leading-none tracking-tight', free <= 0 && 'text-red-300', '[&_.text-muted-foreground]:text-white/60')} />
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[13px] text-white/85 backdrop-blur"><span className="num">{pct.toFixed(0)}%</span> {t('من السقف', 'of the cap')}</span>
            </div>
            <p className="mt-3 text-[15px] text-white/65" data-testid="text-kpi-remaining">
              {t('من سقف الموسم، بعد ما حجزنا رواتب الأشهر الجاية.', 'Under the season cap, after reserving the coming months\' salaries.')}
            </p>
            <SpendBar cap={s.totalBudget} spent={s.spent} reserved={s.committed} onDark className="mt-8" />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-white/75">
              <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-white" />{t('انصرف', 'Spent')}</span>
              <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-white/40" />{t('محجوز للرواتب', 'Reserved')}</span>
              <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cap" />{t('السقف', 'Cap')} <Money v={s.totalBudget} className="font-semibold text-white [&_.text-muted-foreground]:text-white/60" /></span>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          <div data-testid="text-kpi-spent"><Tile icon={ArrowDownLeft} label={t('انصرف لين الحين', 'Spent so far')}><Money v={s.spent} /></Tile></div>
          <div data-testid="text-kpi-committed"><Tile icon={CalendarClock} label={t('محجوز للرواتب', 'Reserved for salaries')} tone="gold"><Money v={s.committed} /></Tile></div>
          <div data-testid="card-forecast">
            <Tile icon={TrendingUp} label={t('توقع نهاية الموسم', 'Season-end forecast')} tone={over ? 'bad' : 'good'}
              note={over ? t(`أكثر من السقف بـ ${kwdText(gap, lang, false)}`, `${kwdText(gap, lang, false)} over the cap`) : t(`أقل من السقف بـ ${kwdText(gap, lang, false)}`, `${kwdText(gap, lang, false)} under the cap`)}>
              <Money v={s.forecast} className={over ? 'text-destructive' : ''} />
            </Tile>
          </div>
        </div>

        <div className="grid gap-5 md:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start">
          <section className="panel p-5 md:p-7">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h2 className="text-[19px] font-semibold">{t('الصرف الشهري', 'Monthly spending')}</h2>
              <span className="text-[13px] text-muted-foreground">{t('بالدينار الكويتي', 'In KWD')}</span>
            </div>
            {trend.length === 0 ? (
              <p className="text-muted-foreground">{t('ما في صرف مسجل للحين.', 'No spending recorded yet.')}</p>
            ) : (
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sq-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14284B" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#14284B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="hsl(220 20% 92%)" />
                    <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(218 12% 42%)' }} reversed={lang === 'ar'} />
                    <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 12, fill: 'hsl(218 12% 42%)' }} orientation={lang === 'ar' ? 'right' : 'left'}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip cursor={{ stroke: 'hsl(220 16% 85%)' }} formatter={(v: number) => [`${kwd(v, false)} ${lang === 'ar' ? 'د.ك' : 'KWD'}`, t('الصرف', 'Spent')]}
                      contentStyle={{ borderRadius: 12, border: '1px solid hsl(220 16% 90%)', boxShadow: '0 8px 24px hsl(218 40% 20% / .08)', fontFamily: 'inherit' }} />
                    <Area type="monotone" dataKey="v" stroke="#14284B" strokeWidth={2.5} fill="url(#sq-area)" dot={{ r: 3, fill: '#14284B' }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="panel p-5 md:p-7">
            <h2 className="text-[19px] font-semibold mb-4">{t('يحتاج انتباهك', 'Needs your attention')}</h2>
            {s.alerts.length === 0 ? (
              <div className="flex items-center gap-3 text-success" data-testid="text-no-alerts"><CheckCircle2 className="h-5 w-5" />{t('كل شي تمام. ما في شي يحتاج تدخل.', 'All good. Nothing needs action.')}</div>
            ) : (
              <ul className="space-y-3">
                {s.alerts.map((a) => {
                  const pay = /payroll|overdue|salar/i.test(a.type);
                  const bad = /overdue|over/i.test(a.type);
                  return (
                    <li key={a.id} data-testid={`alert-${a.id}`} className={cn('rounded-2xl p-4', bad ? 'bg-destructive/[.06]' : 'bg-warning/[.08]')}>
                      <div className="flex gap-3">
                        <span className={cn('h-9 w-9 rounded-full grid place-items-center shrink-0', bad ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning')}><AlertTriangle className="h-[18px] w-[18px]" /></span>
                        <span className="pt-1.5">{displayText(t(a.message, a.messageEn), lang)}</span>
                      </div>
                      <Link href={pay ? '/payroll' : '/budget'} data-testid={`link-fix-${a.id}`}
                        className="mt-3 ms-12 inline-flex min-h-10 items-center rounded-full bg-card px-4 text-[14px] font-semibold shadow-sm hover:shadow-md transition">
                        {pay ? t('افتح الرواتب', 'Open payroll') : t('افتح الميزانية', 'Open budget')}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="panel p-5 md:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[19px] font-semibold">{t('البنود', 'Categories')}</h2>
            <Link href="/budget" className="min-h-11 inline-flex items-center rounded-full px-4 text-primary text-[14px] font-semibold hover:bg-accent" data-testid="link-budget">{t('كل التفاصيل', 'All details')}</Link>
          </div>
          <div className="grid md:grid-cols-2 md:gap-x-10 divide-y divide-border md:divide-y-0">
            {s.categories.map((c) => <CategoryRow key={c.id} c={c} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
