import { useMemo, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useCreateExpense, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, kwd, dateLabel, validAmount, DEC3, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox } from '@/components/shell';
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
      .filter((x) => (cat === 'all' || x.categoryId === cat) && (!k || x.description.toLowerCase().includes(k)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [q.data, term, cat]);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const catName = (id: string) => { const c = s.categories.find((x) => x.id === id); return c ? t(c.name, c.nameEn) : id; };
  const sum = list.reduce((a, x) => a + Math.round(x.amount * 1000), 0) / 1000;
  const typeLabel = (ty: string) => (ty === 'payroll' ? t('رواتب', 'Payroll') : ty === 'expense' ? t('مصروف', 'Expense') : ty);

  return (
    <div>
      <PageHead eyebrow={t('السجل المالي', 'Ledger')} title={t('كل دينار مسجل', 'Every dinar, recorded')}
        sub={t('لا يُقبل مصروف يمس المبالغ المحجوزة لرواتب الأشهر غير المدفوعة.', 'No expense may touch funds reserved for unpaid salary months.')}
        action={isManager ? <Button className="gap-2" onClick={() => setOpen(true)} data-testid="button-new-expense"><Plus className="h-4 w-4" />{t('مصروف جديد', 'New expense')}</Button> : <ReadOnlyNote />} />

      <div className="panel overflow-hidden rise">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('ابحث في الوصف', 'Search descriptions')} className="ps-9" data-testid="input-search-ledger" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="sm:w-52" data-testid="select-category-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('كل البنود', 'All categories')}</SelectItem>
              {s.categories.map((c) => <SelectItem key={c.id} value={c.id}>{t(c.name, c.nameEn)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border flex justify-between">
          <span>{list.length} {t('قيد', 'entries')}</span><span>{t('المجموع ', 'Sum ')}<Money v={sum} className="text-foreground" /></span>
        </div>
        {list.length === 0 ? (
          <div className="p-12 text-center"><div className="font-medium">{t('لا توجد قيود', 'No entries')}</div><p className="text-sm text-muted-foreground mt-1">{t('لا شيء يطابق التصفية الحالية.', 'Nothing matches the current filter.')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-[11px] text-muted-foreground"><tr className="border-b border-border">
                <th className="text-start font-medium p-3">{t('التاريخ', 'Date')}</th><th className="text-start font-medium p-3">{t('الوصف', 'Description')}</th>
                <th className="text-start font-medium p-3">{t('البند', 'Category')}</th><th className="text-start font-medium p-3">{t('النوع', 'Type')}</th>
                <th className="text-end font-medium p-3">{t('المبلغ', 'Amount')}</th>
              </tr></thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.id} className="border-b border-border/60 hover:bg-accent/30" data-testid={`row-tx-${x.id}`}>
                    <td className="p-3 num text-xs text-muted-foreground whitespace-nowrap">{dateLabel(x.date, lang)}</td>
                    <td className="p-3">{x.description}</td>
                    <td className="p-3 text-muted-foreground">{catName(x.categoryId)}</td>
                    <td className="p-3"><span className={cn('text-[11px] rounded px-1.5 py-0.5 border', x.type === 'payroll' ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground')}>{typeLabel(x.type)}</span></td>
                    <td className="p-3 text-end num">{kwd(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
      onSuccess: (m) => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم تسجيل المصروف', 'Expense recorded'), description: m.message }); setF(blank); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const c = s.categories.find((x) => x.id === f.categoryId);
  const amt = validAmount(f.amount) ? Number(f.amount) : 0;
  const over = c ? amt > c.remaining : false;
  const fmtBad = f.amount !== '' && !DEC3.test(f.amount.trim());
  const outside = f.date < s.seasonStart || f.date > s.seasonEnd;
  const ok = !!c && amt > 0 && f.description.trim().length >= 2 && !!f.date && !outside;
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={(o) => { setErr(null); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('تسجيل مصروف', 'Record expense')}</DialogTitle>
          <DialogDescription>{t('يُقارن المبلغ بالمتاح فعلاً بعد خصم المصروف والمحجوز.', 'Checked against what is truly available after spent and reserved funds.')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label={t('البند', 'Category')}>
            <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}>
              <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
              <SelectContent>{s.categories.map((x) => <SelectItem key={x.id} value={x.id}>{t(x.name, x.nameEn)}</SelectItem>)}</SelectContent>
            </Select>
          </Field></div>
          <Field label={t('المبلغ (د.ك)', 'Amount (KWD)')}><Input inputMode="decimal" className="num text-end" placeholder="0.000" value={f.amount} onChange={set('amount')} data-testid="input-amount" /></Field>
          <Field label={t('التاريخ', 'Date')}><Input type="date" className="num" min={s.seasonStart} max={s.seasonEnd} value={f.date} onChange={set('date')} data-testid="input-date" /></Field>
          <div className="col-span-2"><Field label={t('الوصف', 'Description')}><Input value={f.description} onChange={set('description')} data-testid="input-description" /></Field></div>
        </div>
        {c && (
          <div className={cn('rounded-lg border p-3 text-sm space-y-1.5', over ? 'border-destructive/50 bg-destructive/[.07]' : 'border-primary/30 bg-primary/[.04]')} data-testid="card-expense-preview">
            <div className="flex justify-between"><span className="text-xs text-muted-foreground">{t('السقف', 'Cap')}</span><Money v={c.cap} /></div>
            <div className="flex justify-between"><span className="text-xs text-muted-foreground">{t('مصروف + محجوز', 'Spent + reserved')}</span><Money v={c.spent + c.committed} /></div>
            <div className="flex justify-between"><span className="text-xs text-muted-foreground">{t('المتاح فعلاً', 'Truly available')}</span><Money v={c.remaining} className="text-primary" /></div>
            {over && <div className="text-xs text-destructive pt-1">{t('سيتجاوز السقف بـ ', 'Would exceed the cap by ')}<Money v={amt - c.remaining} /></div>}
          </div>
        )}
        {fmtBad && <p className="text-xs text-destructive">{t('المبلغ رقم موجب بثلاث خانات عشرية كحد أقصى.', 'Amount must be positive with at most 3 decimals.')}</p>}
        {outside && <p className="text-xs text-destructive">{t('التاريخ خارج الموسم.', 'Date is outside the season.')}</p>}
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button disabled={!ok || create.isPending} data-testid="button-submit-expense"
            onClick={() => { setErr(null); create.mutate({ data: { categoryId: f.categoryId, amount: Math.round(amt * 1000) / 1000, description: f.description.trim(), date: f.date } }); }}>
            {create.isPending ? t('جارٍ التسجيل…', 'Recording…') : t('تسجيل', 'Record')} {amt > 0 && <span className="num ms-1">{kwd(amt)}</span>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
