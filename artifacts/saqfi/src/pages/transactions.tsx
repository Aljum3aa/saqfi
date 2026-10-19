import { useMemo, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Banknote, Receipt, Download, Send, ArrowLeftRight } from 'lucide-react';
import { useCreateExpense, useCreateRequest, useCreateReserveRequest, useGetRates, getGetRatesQueryKey, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { foreignLabel } from '@/pages/approvals';
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
        action={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl h-12 px-5" onClick={() => exportCsv(list, s, lang)} data-testid="button-export"><Download className="h-4 w-4" />{t('تصدير Excel', 'Export to Excel')}</Button>
            {isManager ? <Button className="rounded-xl h-12 px-6" onClick={() => setOpen(true)} data-testid="button-new-expense"><Plus className="h-4 w-4" />{t('تسجيل مصروف', 'Record expense')}</Button> : <ReadOnlyNote />}
          </div>
        } />

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
                    {foreignLabel(x) && <span className="inline-flex items-center gap-1"><ArrowLeftRight className="h-3 w-3" /><span className="num" dir="ltr">{foreignLabel(x)}</span></span>}
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
  const blank = { categoryId: s.categories[0]?.id ?? '', amount: '', description: '', date: s.today.slice(0, 10), currency: 'KWD' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<ApiErr | null>(null);
  const create = useCreateExpense({
    mutation: {
      onSuccess: (m) => {
        qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() });
        toast({ title: m.pending ? t('انرسل لرئيس النادي', 'Sent to the club president') : t('تم تسجيل المصروف', 'Expense recorded'),
          description: m.pending ? t('المبلغ فوق حد الموافقة، بينسجل بعد موافقته.', 'Above the approval limit; it is recorded once approved.') : undefined });
        setF(blank); onOpenChange(false);
      },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const request = useCreateRequest({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('انرسل الطلب لرئيس النادي', 'Request sent to the club president') }); setF(blank); setErr(null); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const moveReq = useCreateReserveRequest({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('انرسل طلب النقل لرئيس النادي', 'Transfer request sent to the club president'), description: t('بعد موافقته يزيد البند وتقدر تسجّل المصروف.', 'Once approved the category grows and you can record the expense.') }); setErr(null); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const rates = useGetRates({ query: { queryKey: getGetRatesQueryKey(), enabled: open && f.currency !== 'KWD', staleTime: 30 * 60 * 1000 } });
  const rate = f.currency === 'KWD' ? 1 : rates.data?.rates?.[f.currency];
  const c = s.categories.find((x) => x.id === f.categoryId);
  const raw = validAmount(f.amount) ? Number(f.amount) : 0;
  const amt = rate ? Math.round((raw / rate) * 1000) / 1000 : 0;
  const payload = () => ({ categoryId: f.categoryId, amount: Math.round(raw * 1000) / 1000, description: f.description.trim(), date: f.date, currency: f.currency });
  const needsApproval = s.approvalThreshold > 0 && amt >= s.approvalThreshold;
  const over = c ? amt > c.remaining : false;
  const fmtBad = f.amount !== '' && !DEC3.test(f.amount.trim());
  const outside = f.date < s.seasonStart || f.date > s.seasonEnd;
  const descShort = f.description !== '' && f.description.trim().length < 2;
  const ok = !!c && amt > 0 && !!rate && f.description.trim().length >= 2 && !!f.date && !outside;
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
          <Field id="input-amount" label={t('المبلغ', 'Amount')}>
            <div className="flex gap-2">
              <Input id="input-amount" inputMode="decimal" className="num text-end flex-1 min-w-0" placeholder="0" value={f.amount} onChange={set('amount')} data-testid="input-amount" aria-invalid={fmtBad} />
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}>
                <SelectTrigger className="w-[92px] shrink-0" aria-label={t('العملة', 'Currency')} data-testid="select-currency"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((cur) => <SelectItem key={cur} value={cur}>{cur}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </Field>
          <Field id="input-date" label={t('التاريخ', 'Date')}><Input id="input-date" type="date" className="num" min={s.seasonStart} max={s.seasonEnd} value={f.date} onChange={set('date')} data-testid="input-date" aria-invalid={outside} /></Field>
          <div className="sm:col-span-2"><Field id="input-description" label={t('الوصف', 'Description')}><Input id="input-description" value={f.description} onChange={set('description')} data-testid="input-description" placeholder={t('مثلاً: إيجار ملعب التدريب', 'e.g. Training pitch rent')} /></Field></div>
        </div>
        {f.currency !== 'KWD' && (
          <div className="rounded-xl border border-border p-4 space-y-1 text-[15px]" data-testid="card-fx">
            {rates.isLoading ? <span className="text-muted-foreground">{t('نجيب سعر الصرف…', 'Fetching the exchange rate…')}</span>
              : !rate ? <span className="text-destructive">{t('سعر الصرف مو متوفر الحين. سجّل بالدينار.', 'Exchange rate unavailable. Enter it in KWD.')}</span> : (<>
                <KV k={t('سعر الصرف', 'Rate')} v={<span className="num" dir="ltr">1 KWD = {rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} {f.currency}</span>} />
                <KV k={t('بالدينار الكويتي', 'In Kuwaiti dinar')} strong v={<Money v={amt} exact />} />
                <div className="text-[12px] text-muted-foreground">{t('سعر مباشر من ExchangeRate-API، والخادم يحسبه مرة ثانية وقت الحفظ.', 'Live rate from ExchangeRate-API; the server recalculates on save.')}</div>
              </>)}
          </div>
        )}
        {needsApproval && !over && <div className="rounded-xl bg-cap/10 p-4 text-[15px]" data-testid="text-needs-approval">{t('المبلغ فوق حد موافقة الرئيس ', "This is above the president's approval limit ")}(<Money v={s.approvalThreshold} />){t('، فبينرسل له وينسجل بعد موافقته.', ', so it goes to them and is recorded once approved.')}</div>}
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
        {(over || err?.exceeded !== undefined) && ok && c && (() => {
          /* Over the cap: never a dead end — two clear next steps (instructor feedback 2026-10-19). */
          const short = Math.round(Math.max(amt - c.remaining, err?.exceeded ?? 0) * 1000) / 1000;
          const res = s.categories.find((x) => x.id === 'reserve');
          const resLeft = res ? res.remaining : 0;
          const canMove = !!res && c.id !== 'reserve' && resLeft >= short;
          return (
            <div className="rounded-xl border border-border p-4 space-y-3" data-testid="card-next-steps">
              <div className="text-[13px] font-semibold text-muted-foreground">{t('الخطوة الجاية', 'Next step')}</div>
              <div>
                <Button className="rounded-xl h-11 w-full" disabled={request.isPending} data-testid="button-request-approval"
                  onClick={() => { setErr(null); request.mutate({ data: payload() }); }}>
                  <Send className="h-4 w-4 rtl:-scale-x-100" />{t('أرسله لرئيس النادي للموافقة', 'Send it to the club president for approval')}
                </Button>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{t('إذا وافق، ينسجل المصروف وينتقل الفرق ', 'If approved, the expense is recorded and the difference of ')}<Money v={short} exact />{t(' من الاحتياطي تلقائياً.', ' moves from the reserve automatically.')}</p>
              </div>
              {res && c.id !== 'reserve' && (
                <div>
                  <Button variant="outline" className="rounded-xl h-11 w-full border-cap/60" disabled={!canMove || moveReq.isPending} data-testid="button-request-reserve"
                    onClick={() => { setErr(null); moveReq.mutate({ data: { categoryId: c.id, amount: short, description: t(`لتغطية: ${f.description.trim()}`, `To cover: ${f.description.trim()}`) } }); }}>
                    {t('اطلب نقل ', 'Ask to move ')}<Money v={short} exact />{t(' من الاحتياطي أول', ' from the reserve first')}
                  </Button>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {canMove ? <>{t('المتاح في الاحتياطي ', 'Reserve available ')}<Money v={resLeft} />{t('. بعد موافقة الرئيس يزيد سقف البند وتسجّل المصروف بنفسك.', '. Once the president approves, the cap grows and you record it yourself.')}</>
                      : <span className="text-destructive">{t('الاحتياطي ما يكفي (المتاح ', 'The reserve is not enough (')}<Money v={resLeft} />{t(').', ' available).')}</span>}
                  </p>
                </div>
              )}
            </div>
          );
        })()}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" className="rounded-xl h-11 px-6" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button className="rounded-xl h-11 px-6" disabled={!ok || create.isPending} data-testid="button-submit-expense"
            onClick={() => { setErr(null); create.mutate({ data: payload() }); }}>
            {create.isPending ? t('جاري التسجيل…', 'Recording…') : needsApproval ? t('أرسل للموافقة', 'Send for approval') : t('تسجيل', 'Record')} {amt > 0 && <span className="num">{kwd(amt)} {t('د.ك', 'KWD')}</span>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CURRENCIES = ['KWD', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'QAR', 'BHD', 'OMR', 'EGP', 'TRY'];

/** CSV with a BOM so Excel opens Arabic correctly. */
function exportCsv(list: ClubState['transactions'], s: ClubState, lang: 'ar' | 'en') {
  const cat = (id: string) => { const c = s.categories.find((x) => x.id === id); return c ? (lang === 'ar' ? c.name : c.nameEn) : id; };
  const head = lang === 'ar' ? ['التاريخ', 'الوصف', 'البند', 'النوع', 'المبلغ (د.ك)', 'العملة الأصلية', 'المبلغ الأصلي', 'سعر الصرف']
    : ['Date', 'Description', 'Category', 'Type', 'Amount (KWD)', 'Original currency', 'Original amount', 'Rate'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = list.map((x) => [x.date, transactionDescription(x, lang), cat(x.categoryId), x.type === 'payroll' ? (lang === 'ar' ? 'رواتب' : 'Payroll') : (lang === 'ar' ? 'مصروف' : 'Expense'),
    x.amount.toFixed(3), x.currency ?? 'KWD', x.originalAmount ?? '', x.rate ?? '']);
  const csv = '\ufeff' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `saqfi-ledger-${s.today.slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
