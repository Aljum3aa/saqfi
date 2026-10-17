import { useMemo, useState, type ReactNode, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useCreateContract, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, kwd, monthsInclusive, posLabel, POSITIONS, validAmount, dateLabel, DEC3, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox, KV } from '@/components/shell';
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
  const name = (c: { name: string; nameEn: string }) => (lang === 'ar' ? c.name : c.nameEn);

  return (
    <div>
      <PageHead title={t('اللاعبين والعقود', 'Players & contracts')}
        sub={t(`${s.contracts.length} عقد، ورواتبها الشهرية ${kwd(s.monthlyPayroll, false)} د.ك. كل عقد جديد ينحجز راتبه من الميزانية على طول.`,
          `${s.contracts.length} contracts, ${kwd(s.monthlyPayroll, false)} KWD in monthly salaries. Each new contract reserves its salary from the budget right away.`)}
        action={isManager ? <Button onClick={() => setOpen(true)} data-testid="button-new-contract"><Plus className="h-4 w-4" />{t('إضافة عقد', 'Add contract')}</Button> : <ReadOnlyNote />} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <label htmlFor="input-search" className="sr-only">{t('بحث', 'Search')}</label>
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
          <Input id="input-search" data-testid="input-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('ابحث باسم اللاعب', 'Search by player name')} className="ps-10" />
        </div>
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger className="sm:w-48" data-testid="select-position" aria-label={t('المركز', 'Position')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('كل المراكز', 'All positions')}</SelectItem>
            {POSITIONS.map((p) => <SelectItem key={p.v} value={p.v}>{t(p.ar, p.en)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 ? (
        <div className="panel p-10 text-center">
          <div className="font-semibold text-lg">{s.contracts.length === 0 ? t('ما في عقود للحين', 'No contracts yet') : t('ما لقينا عقد بهالبحث', 'No contract matches this search')}</div>
          <p className="text-muted-foreground mt-1">{s.contracts.length === 0
            ? (isManager ? t('اضغط "إضافة عقد" عشان تسجّل أول لاعب.', 'Tap "Add contract" to register the first player.') : t('بيظهر هني أول ما يضيف المدير المالي عقد.', 'Contracts will appear once the finance manager adds one.'))
            : t('جرّب اسم ثاني أو اختر "كل المراكز".', 'Try another name or choose "All positions".')}</p>
        </div>
      ) : (
        <>
          <div className="panel hidden md:block overflow-hidden">
            <table className="w-full">
              <thead className="text-[15px] text-muted-foreground bg-background">
                <tr className="border-b border-border">
                  <th className="text-start font-semibold p-4">{t('اللاعب', 'Player')}</th>
                  <th className="text-start font-semibold p-4">{t('المركز', 'Position')}</th>
                  <th className="text-start font-semibold p-4">{t('مدة العقد', 'Term')}</th>
                  <th className="text-end font-semibold p-4">{t('الراتب الشهري', 'Monthly salary')}</th>
                  <th className="text-end font-semibold p-4">{t('قيمة العقد', 'Contract value')}</th>
                  <th className="text-end font-semibold p-4">{t('الباقي عليه', 'Still owed')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0" data-testid={`row-contract-${c.id}`}>
                    <td className="p-4 font-semibold">{name(c)}</td>
                    <td className="p-4 text-muted-foreground">{posLabel(c.position, lang)}</td>
                    <td className="p-4 text-[15px]"><span className="num">{dateLabel(c.start, lang)}</span> {t('إلى', 'to')} <span className="num">{dateLabel(c.end, lang)}</span></td>
                    <td className="p-4 text-end num">{kwd(c.salary)}</td>
                    <td className="p-4 text-end num">{kwd(c.totalCost)}</td>
                    <td className="p-4 text-end num font-semibold">{kwd(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-4 text-[15px] text-muted-foreground border-t border-border">{t('المبالغ بالدينار الكويتي.', 'Amounts in KWD.')}</p>
          </div>
          <div className="md:hidden space-y-3">
            {list.map((c) => (
              <div key={c.id} className="panel p-4" data-testid={`card-contract-${c.id}`}>
                <div className="flex justify-between gap-3 mb-2"><span className="font-semibold">{name(c)}</span><span className="text-muted-foreground">{posLabel(c.position, lang)}</span></div>
                <KV k={t('المدة', 'Term')} v={<span className="text-[15px]">{dateLabel(c.start, lang)} {t('إلى', 'to')} {dateLabel(c.end, lang)}</span>} />
                <KV k={t('الراتب الشهري', 'Monthly salary')} v={<Money v={c.salary} exact />} />
                <KV k={t('قيمة العقد', 'Contract value')} v={<Money v={c.totalCost} exact />} />
                <KV k={t('الباقي عليه', 'Still owed')} strong v={<Money v={c.outstanding} exact />} />
              </div>
            ))}
          </div>
        </>
      )}
      {isManager && <ContractDialog open={open} onOpenChange={setOpen} s={s} />}
    </div>
  );
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
      onSuccess: (m) => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم إضافة العقد', 'Contract added'), description: lang === 'ar' ? m.message : undefined }); setF(blank); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const months = monthsInclusive(f.start, f.end);
  const salaryOk = validAmount(f.salary);
  const total = salaryOk ? Math.round(Number(f.salary) * 1000) * months / 1000 : 0;
  const salCat = s.categories.find((c) => /salar|wage|payroll|player/i.test(c.id + c.nameEn));
  const avail = salCat ? salCat.remaining : s.remaining;
  const issues: string[] = [];
  if (f.name && f.name.trim().length < 2) issues.push(t('الاسم بالعربي لازم حرفين على الأقل', 'Arabic name needs at least 2 characters'));
  if (f.nameEn && f.nameEn.trim().length < 2) issues.push(t('الاسم بالإنجليزي لازم حرفين على الأقل', 'English name needs at least 2 characters'));
  if (f.salary && !DEC3.test(f.salary)) issues.push(t('الراتب رقم موجب، وبحد أقصى ثلاث خانات بعد الفاصلة', 'Salary must be positive with at most 3 decimals'));
  if (f.start < s.seasonStart || f.end > s.seasonEnd) issues.push(t('العقد لازم يكون داخل الموسم', 'The contract must be inside the season'));
  if (f.end < f.start) issues.push(t('تاريخ النهاية قبل البداية', 'End date is before start date'));
  if (months > 60) issues.push(t('أقصى مدة 60 شهر', 'Maximum 60 months'));
  const over = salaryOk && total > avail;
  const ok = issues.length === 0 && salaryOk && months > 0 && f.name.trim().length >= 2 && f.nameEn.trim().length >= 2;
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={(o) => { setErr(null); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('إضافة عقد', 'Add contract')}</DialogTitle>
          <DialogDescription>{t('ينرفض العقد إذا قيمته أكبر من المتاح في بند الرواتب.', 'Rejected if its value is more than what is available for salaries.')}</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="input-name" label={t('الاسم بالعربي', 'Name (Arabic)')}><Input id="input-name" dir="rtl" data-testid="input-name" value={f.name} onChange={set('name')} /></Field>
          <Field id="input-name-en" label={t('الاسم بالإنجليزي', 'Name (English)')}><Input id="input-name-en" dir="ltr" data-testid="input-name-en" value={f.nameEn} onChange={set('nameEn')} /></Field>
          <Field id="select-contract-position" label={t('المركز', 'Position')}>
            <Select value={f.position} onValueChange={(v) => setF({ ...f, position: v })}>
              <SelectTrigger id="select-contract-position" data-testid="select-contract-position"><SelectValue /></SelectTrigger>
              <SelectContent>{POSITIONS.map((p) => <SelectItem key={p.v} value={p.v}>{t(p.ar, p.en)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="input-salary" label={t('الراتب الشهري (د.ك)', 'Monthly salary (KWD)')}><Input id="input-salary" inputMode="decimal" className="num text-end" data-testid="input-salary" value={f.salary} onChange={set('salary')} placeholder="1250" /></Field>
          <Field id="input-start" label={t('يبدأ', 'Starts')}><Input id="input-start" type="date" className="num" min={s.seasonStart} max={s.seasonEnd} data-testid="input-start" value={f.start} onChange={set('start')} /></Field>
          <Field id="input-end" label={t('ينتهي', 'Ends')}><Input id="input-end" type="date" className="num" min={s.seasonStart} max={s.seasonEnd} data-testid="input-end" value={f.end} onChange={set('end')} /></Field>
        </div>
        <div className={cn('rounded-lg border p-4 space-y-1', over ? 'border-destructive/40 bg-destructive/[.05]' : 'border-border bg-background')} data-testid="card-contract-preview">
          <KV k={t('عدد الأشهر', 'Months')} v={<span className="num">{months}</span>} />
          <KV k={t('قيمة العقد كاملة', 'Full contract value')} strong v={<Money v={total} exact />} />
          <KV k={salCat ? t('المتاح في ', 'Available in ') + t(salCat.name, salCat.nameEn) : t('المتاح في الميزانية', 'Available in budget')} v={<Money v={avail} exact />} />
          {over && <div className="text-destructive pt-1">{t('بيتجاوز السقف بـ ', 'Would go over the cap by ')}<Money v={total - avail} exact /></div>}
        </div>
        {issues.length > 0 && <ul className="text-destructive space-y-0.5 text-[15px]" role="alert">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('العقد', 'The contract')} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button disabled={!ok || create.isPending} data-testid="button-submit-contract"
            onClick={() => { setErr(null); create.mutate({ data: { name: f.name.trim(), nameEn: f.nameEn.trim(), position: f.position, salary: Number(f.salary), start: f.start, end: f.end } }); }}>
            {create.isPending ? t('جاري الحفظ…', 'Saving…') : t('حفظ العقد', 'Save contract')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="block font-semibold text-[15px]">{label}</label>{children}</div>;
}
