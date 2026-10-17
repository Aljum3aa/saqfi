import { useMemo, useState, type ReactNode, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserRound } from 'lucide-react';
import { useCreateContract, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, monthsInclusive, posLabel, POSITIONS, validAmount, dateLabel, DEC3, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox, KV } from '@/components/shell';
import { Avatar, StatStrip, Stat, Chip, Toolbar } from '@/components/kit';
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
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1' && session.role === 'manager');
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
  const owed = s.contracts.reduce((a, c) => a + Math.round(c.outstanding * 1000), 0) / 1000;

  return (
    <div>
      <PageHead title={t('اللاعبين والعقود', 'Players & contracts')}
        sub={t('كل عقد جديد ينحجز راتبه من الميزانية على طول.', 'Each new contract reserves its salary from the budget right away.')}
        action={isManager ? <Button className="rounded-full h-12 px-6" onClick={() => setOpen(true)} data-testid="button-new-contract"><Plus className="h-4 w-4" />{t('إضافة عقد', 'Add contract')}</Button> : <ReadOnlyNote />} />

      <StatStrip className="mb-5">
        <Stat label={t('عدد اللاعبين', 'Players')}><span className="num">{s.contracts.length}</span></Stat>
        <Stat label={t('الرواتب الشهرية', 'Monthly salaries')}><Money v={s.monthlyPayroll} /></Stat>
        <Stat label={t('الباقي على العقود', 'Still owed on contracts')}><Money v={owed} /></Stat>
      </StatStrip>

      <Toolbar>
        <div className="relative flex-1">
          <label htmlFor="input-search" className="sr-only">{t('بحث', 'Search')}</label>
          <Search className="absolute top-1/2 -translate-y-1/2 start-4 h-4 w-4 text-muted-foreground" />
          <Input id="input-search" data-testid="input-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('ابحث باسم اللاعب', 'Search by player name')} className="ps-11 bg-card" />
        </div>
        <Select value={pos} onValueChange={setPos}>
          <SelectTrigger className="sm:w-48 bg-card" data-testid="select-position" aria-label={t('المركز', 'Position')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('كل المراكز', 'All positions')}</SelectItem>
            {POSITIONS.map((p) => <SelectItem key={p.v} value={p.v}>{t(p.ar, p.en)}</SelectItem>)}
          </SelectContent>
        </Select>
      </Toolbar>

      {list.length === 0 ? (
        <div className="panel p-10 text-center">
          <span className="mx-auto mb-3 h-12 w-12 rounded-full bg-accent text-primary grid place-items-center"><UserRound className="h-5 w-5" /></span>
          <div className="font-semibold text-lg">{s.contracts.length === 0 ? t('ما في عقود للحين', 'No contracts yet') : t('ما لقينا عقد بهالبحث', 'No contract matches this search')}</div>
          <p className="text-muted-foreground mt-1">{s.contracts.length === 0
            ? (isManager ? t('اضغط "إضافة عقد" عشان تسجّل أول لاعب.', 'Tap "Add contract" to register the first player.') : t('بيظهر هني أول ما يضيف المدير المالي عقد.', 'Contracts will appear once the finance manager adds one.'))
            : t('جرّب اسم ثاني أو اختر "كل المراكز".', 'Try another name or choose "All positions".')}</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-5 py-3 text-[13px] text-muted-foreground bg-muted/60">
            <span>{t('اللاعب', 'Player')}</span><span>{t('مدة العقد', 'Term')}</span><span className="text-end">{t('الراتب الشهري', 'Monthly salary')}</span><span className="text-end">{t('الباقي عليه', 'Still owed')}</span>
          </div>
          <ul className="divide-y divide-border">
            {list.map((c) => (
              <li key={c.id} data-testid={`row-contract-${c.id}`}
                className="px-4 md:px-5 py-3.5 grid grid-cols-[auto_1fr_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 md:gap-4 items-center hover:bg-muted/40 transition-colors">
                <div className="contents md:flex md:items-center md:gap-3 min-w-0">
                  <Avatar name={lang === 'ar' ? c.name : c.nameEn} size={42} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{name(c)}</div>
                    <div className="mt-0.5"><Chip tone="navy">{posLabel(c.position, lang)}</Chip></div>
                  </div>
                </div>
                <div className="hidden md:block text-[14px] text-muted-foreground">
                  <span className="num">{dateLabel(c.start, lang)}</span> {t('إلى', 'to')} <span className="num">{dateLabel(c.end, lang)}</span>
                  <div className="text-[12px]">{t('قيمة العقد ', 'Value ')}<Money v={c.totalCost} /></div>
                </div>
                <div className="text-end">
                  <Money v={c.salary} exact className="font-display font-semibold text-[16px]" />
                  <div className="md:hidden text-[12px] text-muted-foreground">{t('بالشهر', 'per month')}</div>
                </div>
                <div className="hidden md:block text-end"><Money v={c.outstanding} exact className="font-semibold" /></div>
              </li>
            ))}
          </ul>
        </div>
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
      <DialogContent className="rounded-[20px]">
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
        <div className={cn('rounded-xl p-4 space-y-1', over ? 'bg-destructive/[.06]' : 'bg-muted/70')} data-testid="card-contract-preview">
          <KV k={t('عدد الأشهر', 'Months')} v={<span className="num">{months}</span>} />
          <KV k={t('قيمة العقد كاملة', 'Full contract value')} strong v={<Money v={total} exact />} />
          <KV k={salCat ? t('المتاح في ', 'Available in ') + t(salCat.name, salCat.nameEn) : t('المتاح في الميزانية', 'Available in budget')} v={<Money v={avail} exact />} />
          {over && <div className="text-destructive pt-1">{t('بيتجاوز السقف بـ ', 'Would go over the cap by ')}<Money v={total - avail} exact /></div>}
        </div>
        {issues.length > 0 && <ul className="text-destructive space-y-0.5 text-[15px]" role="alert">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('العقد', 'The contract')} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" className="rounded-full h-11 px-6" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button className="rounded-full h-11 px-6" disabled={!ok || create.isPending} data-testid="button-submit-contract"
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
