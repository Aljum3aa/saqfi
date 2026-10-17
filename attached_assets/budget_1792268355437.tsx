import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSaveBudget, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, DEC3, kwd, kwdInput, monthLabel, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox } from '@/components/shell';
import { SpendBar, toneOf } from '@/components/category-bar';
import { StatStrip, Stat, Chip, SectionTitle } from '@/components/kit';
import { Field } from '@/pages/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const fils = (s: string) => Math.round(Number(s) * 1000);

export default function Budget({ session }: { session: Session }) {
  const { t } = useLang();
  const q = useClub();
  const [editing, setEditing] = useState(false);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  return (
    <div>
      <PageHead
        title={t('الميزانية', 'Budget')}
        sub={t('سقف كل بند، وكم انصرف منه، وكم محجوز للرواتب.', 'Each category\'s cap, what was spent, and what is reserved for salaries.')}
        action={isManager ? (!editing ? <Button className="rounded-full h-12 px-6" data-testid="button-edit-budget" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />{t('تعديل الميزانية', 'Edit budget')}</Button> : undefined) : <ReadOnlyNote />}
      />
      {editing && isManager ? <BudgetEditor s={s} onDone={() => setEditing(false)} /> : <BudgetCards s={s} />}
      <MonthlyChart s={s} />
    </div>
  );
}

function BudgetCards({ s }: { s: ClubState }) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <StatStrip>
        <Stat label={t('ميزانية الموسم', 'Season budget')}><Money v={s.totalBudget} /></Stat>
        <Stat label={t('انصرف', 'Spent')}><Money v={s.spent} /></Stat>
        <Stat label={t('محجوز للرواتب', 'Reserved')}><Money v={s.committed} /></Stat>
        <Stat label={t('المتاح فعلاً', 'Truly available')} tone={s.remaining <= 0 ? 'bad' : 'good'}><Money v={s.remaining} /></Stat>
      </StatStrip>

      <div className="grid gap-4 md:grid-cols-2">
        {s.categories.map((c) => {
          const pct = c.cap > 0 ? ((c.spent + c.committed) / c.cap) * 100 : 0;
          const tone = toneOf(c.cap > 0 ? (c.spent / c.cap) * 100 : 0);
          return (
            <div key={c.id} className="panel p-5" data-testid={`card-budget-${c.id}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[16px]">{t(c.name, c.nameEn)}</span>
                <Chip tone={tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'navy'}><span className="num">{Math.round(pct)}%</span>&nbsp;{t('مستخدم', 'used')}</Chip>
              </div>
              <div className="mt-4 text-[13px] text-muted-foreground">{t('المتاح فعلاً', 'Truly available')}</div>
              <Money v={c.remaining} className={cn('block font-display text-[28px] font-semibold tracking-tight', c.remaining <= 0 && 'text-destructive')} />
              <SpendBar cap={c.cap} spent={c.spent} reserved={c.committed} className="mt-4" />
              <div className="mt-4 grid grid-cols-3 gap-2 text-[13px]">
                <div><div className="text-muted-foreground">{t('السقف', 'Cap')}</div><Money v={c.cap} className="font-semibold" /></div>
                <div><div className="text-muted-foreground">{t('انصرف', 'Spent')}</div><Money v={c.spent} className="font-semibold" /></div>
                <div><div className="text-muted-foreground">{t('محجوز', 'Reserved')}</div><Money v={c.committed} className="font-semibold" /></div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-muted-foreground">{t('المتاح فعلاً = السقف ناقص اللي انصرف والمحجوز للرواتب.', 'Truly available = cap minus spent and reserved salaries.')}</p>
    </div>
  );
}

function MonthlyChart({ s }: { s: ClubState }) {
  const { t, lang } = useLang();
  return (
    <section className="panel p-5 md:p-7 mt-6">
      <SectionTitle aside={t('بالدينار الكويتي', 'In Kuwaiti dinar')}>{t('المصروف كل شهر', 'Spending per month')}</SectionTitle>
      {s.trend.length === 0 ? (
        <div className="h-48 grid place-items-center text-muted-foreground text-center">{t('ما في مصروف مسجّل للحين. سجّل أول مصروف من صفحة المصاريف.', 'No spending yet. Record the first expense on the Expenses page.')}</div>
      ) : (
        <div className="h-64" dir="ltr" data-testid="chart-monthly">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.trend.map((x) => ({ ...x, label: monthLabel(x.month, lang) }))} margin={{ left: 0, right: 0, top: 4 }}>
              <CartesianGrid vertical={false} stroke="hsl(220 20% 92%)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(218 12% 42%)', fontSize: 12 }} axisLine={false} tickLine={false} reversed={lang === 'ar'} />
              <YAxis tick={{ fill: 'hsl(218 12% 42%)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} orientation={lang === 'ar' ? 'right' : 'left'}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip cursor={{ fill: 'hsl(218 40% 95%)', radius: 8 }} contentStyle={{ background: '#fff', border: '1px solid hsl(220 16% 90%)', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 8px 24px hsl(218 40% 20% / .08)' }}
                formatter={(v: number) => [`${kwd(v)} ${t('د.ك', 'KWD')}`, t('المصروف', 'Spent')]} />
              <Bar dataKey="amount" fill="#14284B" radius={[10, 10, 4, 4]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function BudgetEditor({ s, onDone }: { s: ClubState; onDone: () => void }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [total, setTotal] = useState(kwdInput(s.totalBudget));
  const [caps, setCaps] = useState<Record<string, string>>(() => Object.fromEntries(s.categories.map((c) => [c.id, kwdInput(c.cap)])));
  const [err, setErr] = useState<ApiErr | null>(null);
  const save = useSaveBudget({
    mutation: {
      onSuccess: (m) => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم حفظ الميزانية', 'Budget saved'), description: lang === 'ar' ? m.message : undefined }); onDone(); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const badFmt = !DEC3.test(total) || Object.values(caps).some((v) => !DEC3.test(v));
  const sum = Object.values(caps).reduce((a, v) => a + (DEC3.test(v) ? fils(v) : 0), 0);
  const diff = fils(total) - sum;
  const below = s.categories.filter((c) => DEC3.test(caps[c.id]) && fils(caps[c.id]) < Math.round((c.spent + c.committed) * 1000));
  const ok = !badFmt && diff === 0 && below.length === 0 && Number(total) >= 1;

  return (
    <div className="panel p-5 md:p-8">
      <h2 className="text-xl font-semibold mb-1">{t('تعديل الميزانية', 'Edit budget')}</h2>
      <p className="text-muted-foreground mb-6">{t('مجموع البنود لازم يساوي الميزانية، وما تقدر تنزّل بند تحت اللي انصرف وانحجز منه.', 'Categories must add up to the budget, and none can go below what is spent plus reserved.')}</p>
      <div className="max-w-xs">
        <Field id="input-total" label={t('ميزانية الموسم (د.ك)', 'Season budget (KWD)')}>
          <Input id="input-total" data-testid="input-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="num text-end h-11" />
        </Field>
      </div>
      <div className={cn('mt-4 rounded-xl px-4 py-3', diff === 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')} data-testid="text-budget-diff">
        {diff === 0 ? t('المجموع مطابق للميزانية', 'Categories match the budget') : <>{t('مبلغ غير موزّع: ', 'Not yet allocated: ')}<span className="num">{kwd(diff / 1000)}</span> {t('د.ك', 'KWD')}</>}
      </div>
      <div className="divide-y divide-border mt-4">
        {s.categories.map((c) => {
          const floor = c.spent + c.committed;
          const v = caps[c.id];
          const invalid = !DEC3.test(v) || fils(v) < Math.round(floor * 1000);
          const id = `input-cap-${c.id}`;
          return (
            <div key={c.id} className="py-4 grid sm:grid-cols-[1fr_240px] gap-3 sm:items-end">
              <div>
                <label htmlFor={id} className="font-semibold block">{t(c.name, c.nameEn)}</label>
                <div className="text-[15px] text-muted-foreground">{t('أقل شي: ', 'Minimum: ')}<Money v={floor} exact /></div>
              </div>
              <Input id={id} data-testid={id} inputMode="decimal" value={v} onChange={(e) => setCaps({ ...caps, [c.id]: e.target.value })} aria-invalid={invalid}
                className={cn('num text-end h-11', invalid && 'border-destructive focus-visible:ring-destructive')} />
            </div>
          );
        })}
      </div>
      {badFmt && <p className="text-destructive mt-3" role="alert">{t('اكتب المبالغ أرقام موجبة، وبحد أقصى ثلاث خانات بعد الفاصلة.', 'Enter positive numbers with at most 3 decimals.')}</p>}
      {below.length > 0 && <p className="text-destructive mt-2" role="alert">{t('هالبنود أقل من الحد الأدنى: ', 'Below the minimum: ')}{below.map((c) => t(c.name, c.nameEn)).join(t('، ', ', '))}</p>}
      {err && <div className="mt-4"><ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('تعديل الميزانية', 'Budget change')} /></div>}
      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6 sm:justify-end">
        <Button variant="outline" className="rounded-full h-11 px-6" onClick={onDone} data-testid="button-cancel-budget">{t('إلغاء', 'Cancel')}</Button>
        <Button className="rounded-full h-11 px-6" disabled={!ok || save.isPending} data-testid="button-save-budget"
          onClick={() => { setErr(null); save.mutate({ data: { total: fils(total) / 1000, categories: s.categories.map((c) => ({ id: c.id, cap: fils(caps[c.id]) / 1000 })) } }); }}>
          {save.isPending ? t('جاري الحفظ…', 'Saving…') : t('حفظ الميزانية', 'Save budget')}
        </Button>
      </div>
    </div>
  );
}
