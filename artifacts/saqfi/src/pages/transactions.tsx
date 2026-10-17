import { useMemo, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useCreateExpense, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, kwd, dateLabel, transactionDescription, validAmount, DEC3, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox, KV } from '@/components/shell';
import { Field } from '@/pages/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Transactions({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const [term, setTerm] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const k = term.trim().toLowerCase();
    return [...(q.data?.transactions ?? [])]
      .filter((x) => (cat === 'all' || x.categoryId === cat) && (!k || transactionDescription(x, lang).toLowerCase().includes(k)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [q.data, term, cat, lang]);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const catName = (id: string) => { const c = s.categories.find((x) => x.id === id); return c ? t(c.name, c.nameEn) : id; };
  const sum = list.reduce((a, x) => a + Math.round(x.amount * 1000), 0) / 1000;
  const typeLabel = (ty: string) => (ty === 'payroll' ? t('رواتب', 'Salaries') : ty === 'expense' ? t('مصروف', 'Expense') : ty);

  return (
    <div>
      <PageHead title={t('المصاريف', 'Expenses')}
        sub={t('كل دينار انصرف. أي مصروف يمس فلوس الرواتب المحجوزة ينرفض.', 'Every dinar spent. Any expense that touches reserved salary money is rejected.')}
        action={isManager ? <Button onClick={() => setOpen(true)} data-testid="button-new-expense"><Plus className="h-4 w-4" />{t('تسجيل مصروف', 'Record expense')}</Button> : <ReadOnlyNote />} />

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <label htmlFor="input-search-ledger" className="sr-only">{t('بحث', 'Search')}</label>
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
          <Input id="input-search-ledger" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('ابحث في الوصف', 'Search descriptions')} className="ps-10" data-testid="input-search-ledger" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-56" data-testid="select-category-filter" aria-label={t('البند', 'Category')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('كل البنود', 'All categories')}</SelectItem>
            {s.categories.map((c) => <SelectItem key={c.id} value={c.id}>{t(c.name, c.nameEn)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4 text-muted-foreground flex justify-between gap-3">
        <span>{list.length} {t('عملية', 'entries')}</span><span>{t('المجموع ', 'Total ')}<Money v={sum} exact className="text-foreground font-semibold" /></span>
      </div>

      {list.length === 0 ? (
        <div className="panel p-10 text-center">
          <div className="font-semibold text-lg">{s.transactions.length === 0 ? t('ما في مصاريف للحين', 'No expenses yet') : t('ما في شي يطابق البحث', 'Nothing matches')}</div>
          <p className="text-muted-foreground mt-1">{s.transactions.length === 0
            ? (isManager ? t('اضغط "تسجيل مصروف" عشان تضيف أول مصروف.', 'Tap "Record expense" to add the first one.') : t('بتظهر هني أول ما يسجّل المدير المالي مصروف.', 'They will appear once the finance manager records one.'))
            : t('جرّب كلمة ثانية أو اختر "كل البنود".', 'Try another word or choose "All categories".')}</p>
        </div>
      ) : (
        <>
          <div className="panel hidden md:block overflow-hidden">
            <table className="w-full">
              <thead className="text-[15px] text-muted-foreground bg-background"><tr className="border-b border-border">
                <th className="text-start font-semibold p-4">{t('التاريخ', 'Date')}</th><th className="text-start font-semibold p-4">{t('الوصف', 'Description')}</th>
                <th className="text-start font-semibold p-4">{t('البند', 'Category')}</th><th className="text-start font-semibold p-4">{t('النوع', 'Type')}</th>
                <th className="text-end font-semibold p-4">{t('المبلغ (د.ك)', 'Amount (KWD)')}</th>
              </tr></thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className="border-b border-border last:border-0" data-testid={`row-tx-${x.id}`}>
                    <td className="p-4 num text-muted-foreground whitespace-nowrap">{dateLabel(x.date, lang)}</td>
                    <td className="p-4">{transactionDescription(x, lang)}</td>
                    <td className="p-4 text-muted-foreground">{catName(x.categoryId)}</td>
                    <td className="p-4 text-muted-foreground">{typeLabel(x.type)}</td>
                    <td className="p-4 text-end num font-semibold">{kwd(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {list.map((x) => (
              <div key={x.id} className="panel p-4" data-testid={`card-tx-${x.id}`}>
                <KV k={t('التاريخ', 'Date')} v={<span className="num">{dateLabel(x.date, lang)}</span>} />
                <div className="my-2 font-semibold break-words">{transactionDescription(x, lang)}</div>
                <KV k={t('البند', 'Category')} v={catName(x.categoryId)} />
                <KV k={t('المبلغ', 'Amount')} v={<Money v={x.amount} exact className="font-semibold" />} />
              </div>
            ))}
          </div>
        </>
      )}
      {isManager && <ExpenseDialog open={open} onOpenChange={setOpen} s={s} />}
    </div>
  );
}

function ExpenseDialog({ open, onOpenChange, s }: { open: boolean; onOpenChange: (o: boolean) => void; s: ClubState }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const blank = { categoryId: s.categories[0]?.id ?? '', amount: '', description: '', date: s.today.slice(0, 10) };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<ApiErr | null>(null);
  const create = useCreateExpense({
    mutation: {
      onSuccess: (m) => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم تسجيل المصروف', 'Expense recorded'), description: lang === 'ar' ? m.message : undefined }); setF(blank); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const c = s.categories.find((x) => x.id === f.categoryId);
  const amt = validAmount(f.amount) ? Number(f.amount) : 0;
  const over = c ? amt > c.remaining : false;
  const fmtBad = f.amount !== '' && !DEC3.test(f.amount.trim());
  const outside = f.date < s.seasonStart || f.date > s.seasonEnd;
  const descShort = f.description !== '' && f.description.trim().length < 2;
  const ok = !!c && amt > 0 && f.description.trim().length >= 2 && !!f.date && !outside;
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={(o) => { setErr(null); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('تسجيل مصروف', 'Record expense')}</DialogTitle>
          <DialogDescription>{t('المبلغ لازم يكون ضمن المتاح في البند بعد المحجوز للرواتب.', 'The amount must fit what is available in the category after reserved salaries.')}</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Field id="select-expense-category" label={t('البند', 'Category')}>
            <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}>
              <SelectTrigger id="select-expense-category" data-testid="select-expense-category"><SelectValue /></SelectTrigger>
              <SelectContent>{s.categories.map((x) => <SelectItem key={x.id} value={x.id}>{t(x.name, x.nameEn)}</SelectItem>)}</SelectContent>
            </Select>
          </Field></div>
          <Field id="input-amount" label={t('المبلغ (د.ك)', 'Amount (KWD)')}><Input id="input-amount" inputMode="decimal" className="num text-end" placeholder="0" value={f.amount} onChange={set('amount')} data-testid="input-amount" aria-invalid={fmtBad} /></Field>
          <Field id="input-date" label={t('التاريخ', 'Date')}><Input id="input-date" type="date" className="num" min={s.seasonStart} max={s.seasonEnd} value={f.date} onChange={set('date')} data-testid="input-date" aria-invalid={outside} /></Field>
          <div className="sm:col-span-2"><Field id="input-description" label={t('الوصف', 'Description')}><Input id="input-description" value={f.description} onChange={set('description')} data-testid="input-description" placeholder={t('مثلاً: إيجار ملعب التدريب', 'e.g. Training pitch rent')} /></Field></div>
        </div>
        {c && (
          <div className={cn('rounded-lg border p-4 space-y-1', over ? 'border-destructive/40 bg-destructive/[.05]' : 'border-border bg-background')} data-testid="card-expense-preview">
            <KV k={t('سقف البند', 'Category cap')} v={<Money v={c.cap} exact />} />
            <KV k={t('مصروف + محجوز', 'Spent + reserved')} v={<Money v={c.spent + c.committed} exact />} />
            <KV k={t('المتاح فعلاً', 'Truly available')} strong v={<Money v={c.remaining} exact />} />
            {over && <div className="text-destructive pt-1">{t('بيتجاوز السقف بـ ', 'Would go over the cap by ')}<Money v={amt - c.remaining} exact /></div>}
          </div>
        )}
        <div role="alert" className="text-destructive text-[15px] space-y-0.5">
          {fmtBad && <p>{t('اكتب المبلغ رقم موجب، وبحد أقصى ثلاث خانات بعد الفاصلة.', 'Enter a positive amount with at most 3 decimals.')}</p>}
          {outside && <p>{t('التاريخ برّا الموسم.', 'The date is outside the season.')}</p>}
          {descShort && <p>{t('الوصف لازم حرفين على الأقل.', 'Description needs at least 2 characters.')}</p>}
        </div>
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('المصروف', 'The expense')} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button disabled={!ok || create.isPending} data-testid="button-submit-expense"
            onClick={() => { setErr(null); create.mutate({ data: { categoryId: f.categoryId, amount: Math.round(amt * 1000) / 1000, description: f.description.trim(), date: f.date } }); }}>
            {create.isPending ? t('جاري التسجيل…', 'Recording…') : t('تسجيل', 'Record')} {amt > 0 && <span className="num">{kwd(amt)} {t('د.ك', 'KWD')}</span>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
