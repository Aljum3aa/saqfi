import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSaveBudget, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, DEC3, kwd, kwdInput, monthLabel, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox, KV } from '@/components/shell';
import { SpendBar } from '@/components/category-bar';
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
        action={isManager ? (!editing ? <Button data-testid="button-edit-budget" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />{t('تعديل الميزانية', 'Edit budget')}</Button> : undefined) : <ReadOnlyNote />}
      />
      {editing && isManager ? <BudgetEditor s={s} onDone={() => setEditing(false)} /> : <BudgetTable s={s} />}
      <MonthlyChart s={s} />
    </div>
  );
}

function BudgetTable({ s }: { s: ClubState }) {
  const { t } = useLang();
  return (
    <>
      <div className="panel hidden md:block overflow-hidden">
        <table className="w-full">
          <thead className="text-[15px] text-muted-foreground bg-background">
            <tr className="border-b border-border">
              <th className="text-start font-semibold p-4">{t('البند', 'Category')}</th>
              <th className="text-end font-semibold p-4">{t('السقف', 'Cap')}</th>
              <th className="text-end font-semibold p-4">{t('المصروف', 'Spent')}</th>
              <th className="text-end font-semibold p-4">{t('محجوز', 'Reserved')}</th>
              <th className="text-end font-semibold p-4">{t('المتاح فعلاً', 'Available')}</th>
              <th className="p-4 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {s.categories.map((c) => (
              <tr key={c.id} className="border-b border-border" data-testid={`row-budget-${c.id}`}>
                <td className="p-4 font-semibold">{t(c.name, c.nameEn)}</td>
                <td className="p-4 text-end num">{kwd(c.cap)}</td>
                <td className="p-4 text-end num">{kwd(c.spent)}</td>
                <td className="p-4 text-end num">{kwd(c.committed)}</td>
                <td className={cn('p-4 text-end num font-semibold', c.remaining <= 0 && 'text-destructive')}>{kwd(c.remaining)}</td>
                <td className="p-4"><SpendBar cap={c.cap} spent={c.spent} /></td>
              </tr>
            ))}
            <tr className="font-semibold bg-background">
              <td className="p-4">{t('المجموع', 'Total')}</td>
              <td className="p-4 text-end num">{kwd(s.totalBudget)}</td>
              <td className="p-4 text-end num">{kwd(s.spent)}</td>
              <td className="p-4 text-end num">{kwd(s.committed)}</td>
              <td className="p-4 text-end num">{kwd(s.remaining)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <p className="p-4 text-[15px] text-muted-foreground">{t('كل المبالغ بالدينار الكويتي. المتاح فعلاً = السقف ناقص المصروف والمحجوز.', 'All amounts in KWD. Available = cap minus spent and reserved.')}</p>
      </div>
      <div className="md:hidden space-y-3">
        {s.categories.map((c) => (
          <div key={c.id} className="panel p-4" data-testid={`card-budget-${c.id}`}>
            <div className="font-semibold mb-2">{t(c.name, c.nameEn)}</div>
            <SpendBar cap={c.cap} spent={c.spent} className="mb-3" />
            <KV k={t('السقف', 'Cap')} v={<Money v={c.cap} exact />} />
            <KV k={t('المصروف', 'Spent')} v={<Money v={c.spent} exact />} />
            <KV k={t('محجوز', 'Reserved')} v={<Money v={c.committed} exact />} />
            <KV k={t('المتاح فعلاً', 'Available')} strong v={<Money v={c.remaining} exact className={c.remaining <= 0 ? 'text-destructive' : ''} />} />
          </div>
        ))}
        <div className="panel p-4">
          <div className="font-semibold mb-2">{t('المجموع', 'Total')}</div>
          <KV k={t('الميزانية', 'Budget')} v={<Money v={s.totalBudget} exact />} />
          <KV k={t('المصروف', 'Spent')} v={<Money v={s.spent} exact />} />
          <KV k={t('محجوز', 'Reserved')} v={<Money v={s.committed} exact />} />
          <KV k={t('المتاح فعلاً', 'Available')} strong v={<Money v={s.remaining} exact />} />
        </div>
      </div>
    </>
  );
}

function MonthlyChart({ s }: { s: ClubState }) {
  const { t, lang } = useLang();
  return (
    <section className="panel p-5 md:p-8 mt-6">
      <h2 className="text-xl font-semibold mb-1">{t('المصروف كل شهر', 'Spending per month')}</h2>
      <p className="text-muted-foreground mb-5">{t('بالدينار الكويتي', 'In Kuwaiti dinar')}</p>
      {s.trend.length === 0 ? (
        <div className="h-48 grid place-items-center text-muted-foreground text-center">{t('ما في مصروف مسجّل للحين. سجّل أول مصروف من صفحة المصاريف.', 'No spending yet. Record the first expense on the Expenses page.')}</div>
      ) : (
        <div className="h-64" dir="ltr" data-testid="chart-monthly">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.trend.map((x) => ({ ...x, label: monthLabel(x.month, lang) }))} margin={{ left: 0, right: 0, top: 4 }}>
              <CartesianGrid vertical={false} stroke="hsl(220 14% 90%)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(220 9% 40%)', fontSize: 12 }} axisLine={false} tickLine={false} reversed={lang === 'ar'} />
              <YAxis tick={{ fill: 'hsl(220 9% 40%)', fontSize: 12 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => kwd(v, false)} orientation={lang === 'ar' ? 'right' : 'left'} />
              <Tooltip cursor={{ fill: 'hsl(214 30% 95%)' }} contentStyle={{ background: 'hsl(0 0% 99.5%)', border: '1px solid hsl(220 14% 88%)', borderRadius: 12, fontSize: 14, fontFamily: 'IBM Plex Sans Arabic' }}
                formatter={(v: number) => [`${kwd(v)} ${t('د.ك', 'KWD')}`, t('المصروف', 'Spent')]} />
              <Bar dataKey="amount" fill="hsl(214 60% 22%)" radius={[6, 6, 0, 0]} maxBarSize={44} />
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
          <Input id="input-total" data-testid="input-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="num text-end" />
        </Field>
      </div>
      <div className={cn('mt-4 rounded-lg border px-4 py-3', diff === 0 ? 'border-border text-success' : 'border-warning/50 text-warning')} data-testid="text-budget-diff">
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
                className={cn('num text-end', invalid && 'border-destructive focus-visible:ring-destructive')} />
            </div>
          );
        })}
      </div>
      {badFmt && <p className="text-destructive mt-3" role="alert">{t('اكتب المبالغ أرقام موجبة، وبحد أقصى ثلاث خانات بعد الفاصلة.', 'Enter positive numbers with at most 3 decimals.')}</p>}
      {below.length > 0 && <p className="text-destructive mt-2" role="alert">{t('هالبنود أقل من الحد الأدنى: ', 'Below the minimum: ')}{below.map((c) => t(c.name, c.nameEn)).join(t('، ', ', '))}</p>}
      {err && <div className="mt-4"><ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('تعديل الميزانية', 'Budget change')} /></div>}
      <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6 sm:justify-end">
        <Button variant="outline" onClick={onDone} data-testid="button-cancel-budget">{t('إلغاء', 'Cancel')}</Button>
        <Button disabled={!ok || save.isPending} data-testid="button-save-budget"
          onClick={() => { setErr(null); save.mutate({ data: { total: fils(total) / 1000, categories: s.categories.map((c) => ({ id: c.id, cap: fils(caps[c.id]) / 1000 })) } }); }}>
          {save.isPending ? t('جاري الحفظ…', 'Saving…') : t('حفظ الميزانية', 'Save budget')}
        </Button>
      </div>
    </div>
  );
}
