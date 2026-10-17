import { useMemo, useState, type ReactNode, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useCreateContract, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, kwd, monthsInclusive, posLabel, POSITIONS, validAmount, dateLabel, DEC3, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Contracts({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const [term, setTerm] = useState('');
  const [pos, setPos] = useState('all');
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const c = q.data?.contracts ?? [];
    const k = term.trim().toLowerCase();
    return c.filter((x) => (pos === 'all' || posLabel(x.position, 'en') === posLabel(pos, 'en')) && (!k || x.name.includes(k) || x.nameEn.toLowerCase().includes(k) || x.id.toLowerCase().includes(k)));
  }, [q.data, term, pos]);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const totalOutstanding = s.contracts.reduce((a, c) => a + c.outstanding, 0);

  return (
    <div>
      <PageHead eyebrow={t('العقود', 'Contracts')} title={t('عقود اللاعبين', 'Player contracts')}
        sub={t('كل عقد يحجز رواتب أشهره غير المدفوعة من بند الرواتب فور توقيعه.', 'Each contract reserves its unpaid months from the salaries category the moment it is signed.')}
        action={isManager ? <Button onClick={() => setOpen(true)} className="gap-2" data-testid="button-new-contract"><Plus className="h-4 w-4" />{t('عقد جديد', 'New contract')}</Button> : <ReadOnlyNote />} />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label={t('عدد العقود', 'Contracts')} value={<span className="num">{s.contracts.length}</span>} />
        <Stat label={t('الكشف الشهري', 'Monthly payroll')} value={<Money v={s.monthlyPayroll} />} />
        <Stat label={t('المتبقي على العقود', 'Outstanding')} value={<Money v={totalOutstanding} />} />
      </div>

      <div className="panel overflow-hidden rise">
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
            <Input data-testid="input-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('ابحث بالاسم أو الرقم', 'Search by name or ID')} className="ps-9" />
          </div>
          <Select value={pos} onValueChange={setPos}>
            <SelectTrigger className="sm:w-44" data-testid="select-position"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('كل المراكز', 'All positions')}</SelectItem>
              {POSITIONS.map((p) => <SelectItem key={p.v} value={p.v}>{t(p.ar, p.en)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {list.length === 0 ? (
          <div className="p-12 text-center">
            <div className="font-medium">{t('لا توجد عقود مطابقة', 'No matching contracts')}</div>
            <p className="text-sm text-muted-foreground mt-1">{t('غيّر البحث أو المركز.', 'Adjust the search or position filter.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-[11px] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-start font-medium p-3">{t('اللاعب', 'Player')}</th>
                  <th className="text-start font-medium p-3">{t('المركز', 'Position')}</th>
                  <th className="text-start font-medium p-3">{t('المدة', 'Term')}</th>
                  <th className="text-end font-medium p-3">{t('الراتب الشهري', 'Monthly')}</th>
                  <th className="text-end font-medium p-3">{t('القيمة الكلية', 'Total')}</th>
                  <th className="text-end font-medium p-3">{t('المتبقي', 'Outstanding')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 hover:bg-accent/30" data-testid={`row-contract-${c.id}`}>
                    <td className="p-3"><div className="font-medium">{lang === 'ar' ? c.name : c.nameEn}</div><div className="text-[11px] text-muted-foreground">{lang === 'ar' ? c.nameEn : c.name}</div></td>
                    <td className="p-3 text-muted-foreground">{posLabel(c.position, lang)}</td>
                    <td className="p-3 text-xs"><span className="num">{dateLabel(c.start, lang)}</span> — <span className="num">{dateLabel(c.end, lang)}</span><div className="text-[10px] text-muted-foreground">{monthsInclusive(c.start, c.end)} {t('شهر', 'months')}</div></td>
                    <td className="p-3 text-end num">{kwd(c.salary)}</td>
                    <td className="p-3 text-end num">{kwd(c.totalCost)}</td>
                    <td className="p-3 text-end num text-primary">{kwd(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isManager && <ContractDialog open={open} onOpenChange={setOpen} s={s} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="panel p-3 md:p-4"><div className="eyebrow mb-1.5">{label}</div><div className="text-sm md:text-lg font-semibold">{value}</div></div>;
}

function ContractDialog({ open, onOpenChange, s }: { open: boolean; onOpenChange: (o: boolean) => void; s: ClubState }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const blank = { name: '', nameEn: '', position: 'MF', salary: '', start: s.today > s.seasonStart ? s.today.slice(0, 10) : s.seasonStart, end: s.seasonEnd };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<ApiErr | null>(null);
  const create = useCreateContract({
    mutation: {
      onSuccess: (m) => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم توقيع العقد', 'Contract signed'), description: m.message }); setF(blank); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const months = monthsInclusive(f.start, f.end);
  const salaryOk = validAmount(f.salary);
  const total = salaryOk ? Math.round(Number(f.salary) * 1000) * months / 1000 : 0;
  const salCat = s.categories.find((c) => /salar|wage|payroll|player/i.test(c.id + c.nameEn));
  const avail = salCat ? salCat.remaining : s.remaining;
  const issues: string[] = [];
  if (f.name.trim().length < 2) issues.push(t('الاسم العربي حرفان على الأقل', 'Arabic name: at least 2 characters'));
  if (f.nameEn.trim().length < 2) issues.push(t('الاسم الإنجليزي حرفان على الأقل', 'English name: at least 2 characters'));
  if (f.salary && !DEC3.test(f.salary)) issues.push(t('الراتب بثلاث خانات عشرية كحد أقصى', 'Salary: at most 3 decimals'));
  if (f.start < s.seasonStart || f.end > s.seasonEnd) issues.push(t('العقد يجب أن يكون داخل الموسم', 'Contract must sit inside the season'));
  if (f.end < f.start) issues.push(t('تاريخ النهاية قبل البداية', 'End is before start'));
  if (months > 60) issues.push(t('الحد الأقصى 60 شهراً', 'Maximum 60 months'));
  const over = salaryOk && total > avail;
  const ok = issues.length === 0 && salaryOk && months > 0;
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={(o) => { setErr(null); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('عقد لاعب جديد', 'New player contract')}</DialogTitle>
          <DialogDescription>{t('يُرفض العقد إذا تجاوزت قيمته الكلية المتاح فعلاً في بند الرواتب.', 'Rejected if its total value exceeds what is truly available in salaries.')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('الاسم بالعربية', 'Name (Arabic)')}><Input dir="rtl" data-testid="input-name" value={f.name} onChange={set('name')} /></Field>
          <Field label={t('الاسم بالإنجليزية', 'Name (English)')}><Input dir="ltr" data-testid="input-name-en" value={f.nameEn} onChange={set('nameEn')} /></Field>
          <Field label={t('المركز', 'Position')}>
            <Select value={f.position} onValueChange={(v) => setF({ ...f, position: v })}>
              <SelectTrigger data-testid="select-contract-position"><SelectValue /></SelectTrigger>
              <SelectContent>{POSITIONS.map((p) => <SelectItem key={p.v} value={p.v}>{t(p.ar, p.en)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={t('الراتب الشهري (د.ك)', 'Monthly salary (KWD)')}><Input inputMode="decimal" className="num text-end" data-testid="input-salary" value={f.salary} onChange={set('salary')} placeholder="1250.000" /></Field>
          <Field label={t('البداية', 'Start')}><Input type="date" className="num" min={s.seasonStart} max={s.seasonEnd} data-testid="input-start" value={f.start} onChange={set('start')} /></Field>
          <Field label={t('النهاية', 'End')}><Input type="date" className="num" min={s.seasonStart} max={s.seasonEnd} data-testid="input-end" value={f.end} onChange={set('end')} /></Field>
        </div>
        <div className={cn('rounded-lg border p-3 text-sm space-y-1.5', over ? 'border-destructive/50 bg-destructive/[.07]' : 'border-primary/30 bg-primary/[.04]')} data-testid="card-contract-preview">
          <Row k={t('عدد الأشهر (شامل، الشهر الجزئي كامل)', 'Months (inclusive, partial = full)')} v={<span className="num">{months}</span>} />
          <Row k={t('القيمة الكلية المحجوزة', 'Total to reserve')} v={<Money v={total} />} />
          <Row k={salCat ? t('المتاح في بند ', 'Available in ') + t(salCat.name, salCat.nameEn) : t('المتاح في سقف الموسم', 'Available under season cap')} v={<Money v={avail} />} />
          <Row k={t('سقف الموسم', 'Season cap')} v={<Money v={s.totalBudget} />} />
          {over && <div className="text-destructive text-xs pt-1">{t('سيتجاوز السقف بـ ', 'Would exceed the cap by ')}<Money v={total - avail} /></div>}
        </div>
        {issues.length > 0 && <ul className="text-xs text-destructive space-y-0.5">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button disabled={!ok || create.isPending} data-testid="button-submit-contract"
            onClick={() => { setErr(null); create.mutate({ data: { name: f.name.trim(), nameEn: f.nameEn.trim(), position: f.position, salary: Number(f.salary), start: f.start, end: f.end } }); }}>
            {create.isPending ? t('جارٍ التوقيع…', 'Signing…') : t('توقيع العقد', 'Sign contract')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>;
}
function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground text-xs">{k}</span>{v}</div>;
}
