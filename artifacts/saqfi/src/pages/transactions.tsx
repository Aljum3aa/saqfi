import { useMemo, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Banknote, Receipt } from 'lucide-react';
import { useCreateExpense, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, kwd, dateLabel, transactionDescription, validAmount, DEC3, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox, KV } from '@/components/shell';
import { StatStrip, Stat, Chip, Toolbar } from '@/components/kit';
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
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1' && session.role === 'manager');
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
  const paySum = list.filter((x) => x.type === 'payroll').reduce((a, x) => a + Math.round(x.amount * 1000), 0) / 1000;

  return (
    <div>
      <PageHead title={t('المصاريف', 'Expenses')}
        sub={t('كل دينار انصرف. أي مصروف يمس فلوس الرواتب المحجوزة ينرفض.', 'Every dinar spent. Any expense that touches reserved salary money is rejected.')}
        action={isManager ? <Button className="rounded-full h-12 px-6" onClick={() => setOpen(true)} data-testid="button-new-expense"><Plus className="h-4 w-4" />{t('تسجيل مصروف', 'Record expense')}</Button> : <ReadOnlyNote />} />

      <StatStrip className="mb-5">
        <Stat label={t('عدد العمليات', 'Entries')}><span className="num">{list.length}</span></Stat>
        <Stat label={t('المجموع', 'Total')}><Money v={sum} /></Stat>
        <Stat label={t('منها رواتب', 'Of which salaries')}><Money v={paySum} /></Stat>
      </StatStrip>

      <Toolbar>
        <div className="relative flex-1">
          <label htmlFor="input-search-ledger" className="sr-only">{t('بحث', 'Search')}</label>
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 h-4 w-4 text-muted-foreground" />
          <Input id="input-search-ledger" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('ابحث في الوصف', 'Search descriptions')} className="ps-11 bg-card" data-testid="input-search-ledger" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-56 bg-card" data-testid="select-category-filter" aria-label={t('البند', 'Category')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('كل البنود', 'All categories')}</SelectItem>
            {s.categories.map((c) => <SelectItem key={c.id} value={c.id}>{t(c.name, c.nameEn)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Toolbar>

      {list.length === 0 ? (
        <div className="panel p-10 text-center">
          <span className="mx-auto mb-3 h-12 w-12 rounded-full bg-accent text-primary grid place-items-center"><Receipt className="h-5 w-5" /></span>
          <div className="font-semibold text-lg">{s.transactions.length === 0 ? t('ما في مصاريف للحين', 'No expenses yet') : t('ما في شي يطابق البحث', 'Nothing matches')}</div>
          <p className="text-muted-foreground mt-1">{s.transactions.length === 0
            ? (isManager ? t('اضغط "تسجيل مصروف" عشان تضيف أول مصروف.', 'Tap "Record expense" to add the first one.') : t('بتظهر هني أول ما يسجّل المدير المالي مصروف.', 'They will appear once the finance manager records one.'))
            : t('جرّب كلمة ثانية أو اختر "كل البنود".', 'Try another word or choose "All categories".')}</p>
        </div>
      ) : (
        <ul className="panel overflow-hidden divide-y divide-border">
          {list.map((x) => {
            const pay = x.type === 'payroll';
            return (
              <li key={x.id} data-testid={`row-tx-${x.id}`} className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 hover:bg-muted/40 transition-colors">
                <span className={cn('h-10 w-10 rounded-full grid place-items-center shrink-0', pay ? 'bg-accent text-primary' : 'bg-cap/15 text-[hsl(42_60%_30%)]')}>
                  {pay ? <Banknote className="h-[18px] w-[18px]" /> : <Receipt className="h-[18px] w-[18px]" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{transactionDescription(x, lang)}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    <span className="num">{dateLabel(x.date, lang)}</span>
                    <Chip tone="neutral">{catName(x.categoryId)}</Chip>
                  </div>
                </div>
                <Money v={x.amount} exact className="font-display font-semibold text-[16px]" />
              </li>
            );
          })}
        </ul>
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
      <DialogContent className="rounded-[20px]">
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
          <div className={cn('rounded-xl p-4 space-y-1', over ? 'bg-destructive/[.06]' : 'bg-muted/70')} data-testid="card-expense-preview">
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
          <Button variant="outline" className="rounded-full h-11 px-6" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button className="rounded-full h-11 px-6" disabled={!ok || create.isPending} data-testid="button-submit-expense"
            onClick={() => { setErr(null); create.mutate({ data: { categoryId: f.categoryId, amount: Math.round(amt * 1000) / 1000, description: f.description.trim(), date: f.date } }); }}>
            {create.isPending ? t('جاري التسجيل…', 'Recording…') : t('تسجيل', 'Record')} {amt > 0 && <span className="num">{kwd(amt)} {t('د.ك', 'KWD')}</span>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
