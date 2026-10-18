import { Link } from 'wouter';
import { AlertTriangle, CheckCircle2, Banknote, Receipt, Trophy, ShieldCheck, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwd, kwdText, displayText } from '@/lib/saqfi';
import { useClub, Money, PageSkeleton, ErrorPanel, ReadOnlyNote } from '@/components/shell';
import { toneOf } from '@/components/category-bar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const shortMonth = (ym: string, lang: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { month: 'short', timeZone: 'UTC' });
};
const greeting = (t: (a: string, e: string) => string) => (new Date().getHours() < 12 ? t('صباح الخير', 'Good morning') : t('مساء الخير', 'Good evening'));
const todayLabel = (d: string, lang: string) =>
  new Date((d || new Date().toISOString()).slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const pctOf = (v: number, cap: number) => (cap > 0 ? (v / cap) * 100 : 0);

/** The season cap split into what is spent, what salaries already hold, and what is still free. */
function CapLedger({ cap, spent, reserved, free }: { cap: number; spent: number; reserved: number; free: number }) {
  const { t } = useLang();
  const over = spent + reserved > cap;
  const ps = Math.min(100, pctOf(spent, cap));
  const pr = Math.max(0, Math.min(100 - ps, pctOf(reserved, cap)));
  const rows = [
    { k: 'spent', label: t('انصرف', 'Spent'), v: spent, dot: 'bg-white' },
    { k: 'reserved', label: t('محجوز للرواتب', 'Held for salaries'), v: reserved, dot: 'bg-[#7FC8A9]' },
    { k: 'free', label: t('متاح', 'Free'), v: Math.max(0, free), dot: 'bg-white/20 ring-1 ring-white/40' },
  ];
  return (
    <div>
      <div className="relative h-3 rounded-full bg-white/10" role="img"
        aria-label={t(`انصرف ${Math.round(ps)}٪ ومحجوز ${Math.round(pr)}٪ من السقف`, `${Math.round(ps)}% spent and ${Math.round(pr)}% held of the cap`)}>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <div className={cn('h-full transition-[width] duration-700 ease-out', over ? 'bg-red-300' : 'bg-white')} style={{ width: `${ps}%` }} />
          <div className="h-full bg-[#7FC8A9] transition-[width] duration-700 ease-out" style={{ width: `${pr}%` }} />
        </div>
        <span aria-hidden className="absolute -top-1.5 -bottom-1.5 end-0 w-[3px] rounded-full bg-cap" />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 md:gap-6">
        {rows.map((r) => (
          <div key={r.k} className="min-w-0" data-testid={`ledger-${r.k}`}>
            <dt className="flex items-center gap-2 text-[13px] text-white/60"><i className={cn('h-2 w-2 rounded-full shrink-0', r.dot)} /><span className="truncate">{r.label}</span></dt>
            <dd className="mt-1 font-display text-[17px] md:text-[20px] font-semibold tracking-tight"><Money v={r.v} unit={false} /></dd>
            <dd className="text-[12.5px] text-white/50 num">{Math.round(pctOf(r.v, cap))}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Panel({ title, action, children, className, testid }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; testid?: string }) {
  return (
    <section className={cn('panel p-5 md:p-6', className)} data-testid={testid}>
      <div className="flex items-center justify-between gap-3 mb-4 min-h-8">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const isPresident = session.role === 'president';
  const over = s.forecast > s.totalBudget;
  const gap = Math.abs(s.totalBudget - s.forecast);
  const waiting = s.requests.filter((r) => r.status === 'pending').length;
  const Arrow = lang === 'ar' ? ChevronLeft : ChevronRight;

  const trend0 = (s.trend ?? []).map((p) => ({ m: shortMonth(p.month, lang), v: p.amount }));
  const trend = lang === 'ar' ? [...trend0].reverse() : trend0;   /* RTL: months read right to left */
  const trendAvg = trend0.length ? trend0.reduce((a, p) => a + p.v, 0) / trend0.length : 0;

  const cats = [...s.categories].sort((a, b) => pctOf(b.spent + b.committed, b.cap) - pctOf(a.spent + a.committed, a.cap));
  const kpis = [
    { k: 'payroll', label: t('الرواتب الشهرية', 'Monthly payroll'), v: <Money v={s.monthlyPayroll} />, href: '/payroll' },
    { k: 'players', label: t('اللاعبين بعقود', 'Players under contract'), v: <span className="num font-display">{s.contracts.length}</span>, href: '/contracts' },
    { k: 'bonuses', label: t('مكافآت تنتظر الصرف', 'Bonuses to pay'), v: <Money v={s.pendingBonuses} />, href: '/bonuses' },
    { k: 'approvals', label: t('طلبات تنتظر القرار', 'Awaiting decision'), v: <span className={cn('num font-display', waiting > 0 && 'text-warning')}>{waiting}</span>, href: '/approvals' },
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[26px] md:text-[32px] font-semibold leading-tight tracking-tight">{greeting(t)}</h1>
          <div className="mt-1 text-[14px] text-muted-foreground" data-testid="text-today">{todayLabel(s.today, lang)}</div>
        </div>
        {isManager && (
          <div className="grid grid-cols-3 md:flex gap-2" aria-label={t('إجراءات سريعة', 'Quick actions')}>
            <Button asChild className="rounded-xl h-11 px-4"><Link href="/transactions?new=1" data-testid="link-quick-expense"><Receipt className="h-4 w-4" />{t('مصروف', 'Expense')}</Link></Button>
            <Button asChild variant="outline" className="rounded-xl h-11 px-4 bg-card"><Link href="/bonuses" data-testid="link-quick-match"><Trophy className="h-4 w-4" />{t('نتيجة', 'Result')}</Link></Button>
            <Button asChild variant="outline" className="rounded-xl h-11 px-4 bg-card"><Link href="/payroll" data-testid="link-quick-payroll"><Banknote className="h-4 w-4" />{t('الرواتب', 'Payroll')}</Link></Button>
          </div>
        )}
        {isPresident && (
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-xl h-11 px-4"><Link href="/approvals" data-testid="link-quick-approvals"><ShieldCheck className="h-4 w-4" />{waiting > 0 ? t(`${waiting} تنتظر قرارك`, `${waiting} awaiting you`) : t('الموافقات', 'Approvals')}</Link></Button>
            <ReadOnlyNote />
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* Overview: the one dark surface. Free money first, then how the cap is used, then the forecast. */}
        <section className="hero p-6 md:p-8" data-testid="card-summary">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-end">
            <div>
              <div className="text-[14px] text-white/65">{t('تقدر تصرف بعد', 'Still free to spend')}</div>
              <span data-testid="text-kpi-remaining">
                <Money v={s.remaining} className={cn('block mt-2 font-display text-[44px] sm:text-[56px] md:text-[64px] font-semibold leading-none tracking-tight', s.remaining <= 0 && 'text-red-300')} />
              </span>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[.08] px-3 h-8">
                  {t('سقف الموسم', 'Season cap')} <Money v={s.totalBudget} className="font-semibold text-white" />
                </span>
                <span data-testid="card-forecast"
                  className={cn('inline-flex items-center gap-2 rounded-full px-3 h-8', over ? 'bg-red-400/15 text-red-200' : 'bg-[#7FC8A9]/15 text-[#BFE6D4]')}>
                  {over ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {t('توقع نهاية الموسم', 'Season-end forecast')} <Money v={s.forecast} className="font-semibold" unit={false} />
                  <span className="text-white/55">({over ? t(`فوق بـ ${kwd(gap, false)}`, `${kwd(gap, false)} over`) : t(`تحت بـ ${kwd(gap, false)}`, `${kwd(gap, false)} under`)})</span>
                </span>
              </div>
            </div>
            <CapLedger cap={s.totalBudget} spent={s.spent} reserved={s.committed} free={s.remaining} />
          </div>
        </section>

        {/* Supporting figures, each one opens where it is managed */}
        <div className="panel grid grid-cols-2 lg:grid-cols-4 overflow-hidden [&>*]:border-border max-lg:[&>*:nth-child(odd)]:border-e max-lg:[&>*:nth-child(-n+2)]:border-b lg:[&>*:not(:last-child)]:border-e">
          {kpis.map((k) => (
            <Link key={k.k} href={k.href} data-testid={`kpi-${k.k}`}
              className="group p-4 md:p-5 min-w-0 hover:bg-muted/50 focus-visible:bg-muted/50 outline-none transition-colors">
              <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground"><span className="truncate">{k.label}</span><Arrow className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" /></div>
              <div className="mt-1.5 text-[20px] md:text-[22px] font-semibold tracking-tight">{k.v}</div>
            </Link>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start">
          <Panel title={t('الصرف الشهري', 'Monthly spending')} testid="card-trend"
            action={trend0.length > 0 && <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"><i className="w-4 border-t-2 border-dashed border-cap" />{t('المتوسط', 'Average')} <Money v={trendAvg} className="font-semibold text-foreground" /></span>}>
            {trend.length === 0 ? (
              <div className="h-56 grid place-items-center text-center text-muted-foreground">
                <div><Receipt className="h-5 w-5 mx-auto mb-2" />{t('ما في صرف مسجل للحين. أول مصروف بيظهر هني.', 'No spending yet. Your first expense will show here.')}</div>
              </div>
            ) : (
              <div className="h-60" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="hsl(100 10% 91%)" />
                    <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(150 6% 37%)' }} />
                    <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 12, fill: 'hsl(150 6% 37%)' }} orientation={lang === 'ar' ? 'right' : 'left'}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <ReferenceLine y={trendAvg} stroke="#B8933F" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Tooltip cursor={{ fill: 'hsl(150 30% 94% / .6)' }} formatter={(v: number) => [kwdText(v, lang, false), t('الصرف', 'Spent')]}
                      contentStyle={{ borderRadius: 12, border: '1px solid hsl(100 8% 89%)', boxShadow: '0 8px 24px hsl(160 40% 12% / .08)', fontFamily: 'inherit', direction: lang === 'ar' ? 'rtl' : 'ltr' }} />
                    <Bar dataKey="v" fill="#0B6B4C" radius={[6, 6, 2, 2]} maxBarSize={36} animationDuration={500} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title={t('يحتاج انتباهك', 'Needs your attention')} testid="card-attention"
            action={s.alerts.length > 0 && <span className="min-w-6 h-6 px-2 rounded-full bg-warning/12 text-warning text-[12px] font-bold grid place-items-center num">{s.alerts.length}</span>}>
            {s.alerts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-accent/60 p-4 text-[15px]" data-testid="text-no-alerts">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />{t('كل شي تمام، ما في شي يحتاج تدخل.', 'All clear. Nothing needs action.')}
              </div>
            ) : (
              <ul className="divide-y divide-border -my-1">
                {s.alerts.map((a) => {
                  const pay = /payroll|overdue|salar|late/i.test(a.type);
                  const appr = a.type === 'approval';
                  const bad = /overdue|over/i.test(a.type);
                  return (
                    <li key={a.id} data-testid={`alert-${a.id}`}>
                      <Link href={appr ? '/approvals' : pay ? '/payroll' : '/budget'} data-testid={`link-fix-${a.id}`}
                        className="group flex items-start gap-3 py-3.5 rounded-lg outline-none focus-visible:bg-muted/60">
                        <span className={cn('mt-0.5 h-8 w-8 rounded-full grid place-items-center shrink-0', bad ? 'bg-destructive/10 text-destructive' : 'bg-warning/12 text-warning')}><AlertTriangle className="h-4 w-4" /></span>
                        <span className="flex-1 text-[14.5px] leading-relaxed">{displayText(t(a.message, a.messageEn), lang)}</span>
                        <Arrow className="mt-1.5 h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {s.insights.length > 0 && (
              <div className="mt-5 pt-5 border-t border-border" data-testid="card-insights">
                <div className="text-[13px] font-semibold text-muted-foreground mb-3">{t('قراءة المستشار', 'Advisor notes')}</div>
                <ul className="space-y-2.5">
                  {s.insights.map((i) => (
                    <li key={i.id} className="flex gap-2.5 text-[14px] leading-relaxed">
                      <Info className={cn('h-4 w-4 mt-1 shrink-0', i.tone === 'bad' ? 'text-destructive' : i.tone === 'warn' ? 'text-warning' : 'text-primary')} />
                      <span>{t(i.message, i.messageEn)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        <Panel title={t('البنود', 'Categories')} testid="card-categories"
          action={<Link href="/budget" className="h-9 inline-flex items-center gap-1 rounded-lg px-3 text-primary text-[14px] font-semibold hover:bg-accent" data-testid="link-budget">{t('إدارة البنود', 'Manage')}<Arrow className="h-4 w-4" /></Link>}>
          <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_7rem_6rem] gap-x-6 pb-2 text-[12.5px] text-muted-foreground border-b border-border">
            <span>{t('البند', 'Category')}</span><span>{t('المستخدم من السقف', 'Cap used')}</span><span className="text-end">{t('انصرف / السقف', 'Spent / cap')}</span><span className="text-end">{t('متاح', 'Free')}</span>
          </div>
          <ul className="divide-y divide-border">
            {cats.map((c) => {
              const used = pctOf(c.spent + c.committed, c.cap);
              const tone = toneOf(used);
              const ps = Math.min(100, pctOf(c.spent, c.cap));
              const pr = Math.max(0, Math.min(100 - ps, pctOf(c.committed, c.cap)));
              return (
                <li key={c.id} data-testid={`row-category-${c.id}`} className="py-3.5 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_7rem_6rem] gap-x-6 gap-y-2 items-center">
                  <span className="font-semibold text-[15px] truncate">{t(c.name, c.nameEn)}</span>
                  <span className="text-end md:order-last"><Money v={c.remaining} className={cn('text-[14px] font-semibold', c.remaining < 0 && 'text-destructive')} /></span>
                  <div className="col-span-2 md:col-span-1 flex items-center gap-3">
                    <div className="relative h-2 flex-1 rounded-full bg-[hsl(var(--track))]">
                      <div className="absolute inset-0 flex overflow-hidden rounded-full">
                        <div className={cn('h-full', tone === 'bad' ? 'bg-destructive' : tone === 'warn' ? 'bg-warning' : 'bg-primary')} style={{ width: `${ps}%` }} />
                        <div className="h-full bg-primary/25" style={{ width: `${pr}%` }} />
                      </div>
                      <span aria-hidden className={cn('absolute -top-1 -bottom-1 end-0 w-[2px] rounded-full', tone === 'bad' ? 'bg-destructive' : 'bg-cap')} />
                    </div>
                    <span className="text-[13px] text-muted-foreground num w-10 text-end">{Math.round(used)}%</span>
                  </div>
                  <span className="hidden md:block text-[13.5px] text-muted-foreground text-end whitespace-nowrap">
                    <Money v={c.spent} unit={false} className={cn('font-semibold', tone === 'bad' ? 'text-destructive' : 'text-foreground')} /> / <Money v={c.cap} unit={false} />
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
