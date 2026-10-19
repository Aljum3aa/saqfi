import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, Send, FilePlus2 } from 'lucide-react';
import { useCreateReserveRequest, getGetClubStateQueryKey, type Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, monthsInclusive, validAmount, DEC3, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ErrorBox, KV } from '@/components/shell';
import { Field } from '@/pages/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * «نقدر عليه؟» — the manager types a monthly salary and sees, before signing anyone,
 * what the contract costs until season end and what it does to the salaries cap.
 * Same arithmetic as the server: whole months from the first unpaid payroll month to season end.
 */
const f3 = (n: number) => Math.round(n * 1000) / 1000;

function monthList(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

export default function Afford({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [salary, setSalary] = useState('');
  const [startPick, setStartPick] = useState('');
  const [err, setErr] = useState<ApiErr | null>(null);
  const [sent, setSent] = useState(false);
  const ask = useCreateReserveRequest({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); setSent(true); setErr(null); toast({ title: t('انرسل الطلب لرئيس النادي', 'Request sent to the club president') }); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const s = q.data;
  const months = useMemo(() => {
    if (!s) return [];
    const first = (s.nextPayrollMonth || s.today.slice(0, 7)) > s.seasonStart.slice(0, 7) ? (s.nextPayrollMonth || s.today.slice(0, 7)) : s.seasonStart.slice(0, 7);
    return monthList(first, s.seasonEnd.slice(0, 7));
  }, [s]);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !s) return <ErrorPanel onRetry={() => q.refetch()} />;

  const isManager = session.role === 'manager';
  const players = s.categories.find((c) => c.id === 'players');
  const reserve = s.categories.find((c) => c.id === 'reserve');
  const start = months.includes(startPick) ? startPick : months[0] ?? '';
  const n = start ? monthsInclusive(`${start}-01`, s.seasonEnd) : 0;
  const ok = validAmount(salary);
  const sal = ok ? Number(salary) : 0;
  const cost = f3(sal * n);
  const avail = players ? players.remaining : 0;
  const after = f3(avail - cost);
  const short = after < 0 ? f3(-after) : 0;
  const maxSalary = n > 0 ? Math.max(0, Math.floor(avail / n)) : 0;
  const reserveLeft = reserve ? reserve.remaining : 0;
  const reserveCovers = short > 0 && reserveLeft >= short;
  const pendingSame = s.requests.some((r) => r.status === 'pending' && r.reason === 'reserve' && r.categoryId === 'players' && Math.abs(r.amount - short) < 0.0005);
  const fmtBad = salary !== '' && !DEC3.test(salary.trim());
  const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' });

  // Bar: used (spent + reserved), the new contract, what is left — against the category cap.
  const cap = players ? players.cap : 0;
  const used = players ? players.spent + players.committed : 0;
  const pct = (v: number) => (cap > 0 ? Math.max(0, Math.min(100, (v / cap) * 100)) : 0);
  const newPart = Math.min(cost, Math.max(0, avail));

  return (
    <div>
      <PageHead title={t('نقدر عليه؟', 'Can we afford him?')} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="panel p-5 md:p-6" data-testid="card-afford-input">
          <div className="grid gap-4">
            <Field id="input-afford-salary" label={t('الراتب الشهري المطلوب', 'Monthly salary asked')}>
              <div className="relative">
                <Input id="input-afford-salary" inputMode="decimal" autoFocus className="num text-end h-14 text-[22px] font-semibold pe-16" placeholder="0"
                  value={salary} onChange={(e) => { setSalary(e.target.value); setSent(false); setErr(null); }} data-testid="input-afford-salary" aria-invalid={fmtBad} />
                <span className="absolute inset-y-0 end-4 grid place-items-center text-muted-foreground text-[14px]">{t('د.ك', 'KWD')}</span>
              </div>
            </Field>
            <Field id="select-afford-start" label={t('يبدأ من', 'Starting')}>
              <Select value={start} onValueChange={(v) => { setStartPick(v); setSent(false); setErr(null); }}>
                <SelectTrigger id="select-afford-start" data-testid="select-afford-start"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{monthName(m)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {fmtBad && <p className="text-destructive text-[14px]" role="alert">{t('اكتب الراتب رقم موجب، وبحد أقصى ثلاث خانات بعد الفاصلة.', 'Enter a positive salary with at most 3 decimals.')}</p>}
            <div className="rounded-xl bg-muted/70 p-4 space-y-1 text-[15px]">
              <KV k={t('أشهر لنهاية الموسم', 'Months to season end')} v={<span className="num">{n}</span>} />
              <KV k={t('أعلى راتب يتحمله السقف', 'Highest salary the cap allows')} strong v={<Money v={maxSalary} />} />
            </div>
          </div>
        </section>

        <section className={cn('panel p-5 md:p-6', ok && (short > 0 ? 'border-destructive/40' : 'border-success/40'))} data-testid="card-afford-result" aria-live="polite">
          {!ok ? (
            <div className="h-full grid place-items-center text-center text-muted-foreground py-10">
              <div>
                <div className="text-[15px]">{t('اكتب الراتب وتشوف أثره على السقف على طول', 'Type a salary to see its effect on the cap instantly')}</div>
                {players && <div className="mt-2 text-[14px]">{t('المتاح الحين في بند الرواتب: ', 'Available now in salaries: ')}<Money v={avail} className="font-semibold text-foreground" /></div>}
              </div>
            </div>
          ) : (
            <>
              <div className={cn('flex items-center gap-3 rounded-xl p-4', short > 0 ? 'bg-destructive/[.07] text-destructive' : 'bg-success/10 text-success')} data-testid="text-afford-verdict">
                {short > 0 ? <AlertTriangle className="h-6 w-6 shrink-0" /> : <CheckCircle2 className="h-6 w-6 shrink-0" />}
                <div>
                  <div className="font-display text-[22px] font-semibold leading-tight">{short > 0 ? t('ما نقدر عليه بالسقف الحالي', 'Not within the current cap') : t('نقدر عليه', 'Yes, we can afford him')}</div>
                  <div className="text-[14px] text-foreground/80 mt-0.5">
                    {short > 0
                      ? <>{t('ناقص ', 'Short by ')}<Money v={short} exact className="font-semibold" /></>
                      : <>{t('يبقى في البند بعد العقد ', 'Left in the category after him ')}<Money v={after} className="font-semibold" /></>}
                  </div>
                </div>
              </div>

              <div className="mt-5" aria-hidden>
                <div className="relative h-4 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-primary/70" style={{ width: `${pct(used)}%` }} />
                  <div className={cn('h-full', short > 0 ? 'bg-destructive' : 'bg-cap')} style={{ width: `${pct(newPart)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-primary/70" />{t('مصروف ومحجوز', 'Spent & reserved')}</span>
                  <span className="inline-flex items-center gap-1.5"><i className={cn('h-2.5 w-2.5 rounded-full', short > 0 ? 'bg-destructive' : 'bg-cap')} />{t('العقد الجديد', 'New contract')}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />{t('الباقي', 'Left')}</span>
                </div>
              </div>

              <div className="mt-5 space-y-1 text-[15px]">
                <KV k={t('سقف بند الرواتب', 'Salaries cap')} v={<Money v={cap} />} />
                <KV k={t('المتاح الحين', 'Available now')} v={<Money v={avail} exact />} />
                <KV k={t(`تكلفة العقد (${n} شهر)`, `Contract cost (${n} months)`)} v={<Money v={cost} exact />} />
                <KV k={t('بعد العقد', 'After the contract')} strong v={<Money v={after} exact className={short > 0 ? 'text-destructive' : ''} />} />
              </div>

              {isManager && (
                <div className="mt-5 pt-5 border-t border-border space-y-3" data-testid="card-afford-next">
                  <div className="text-[13px] font-semibold text-muted-foreground">{t('الخطوة الجاية', 'Next step')}</div>
                  {short === 0 ? (
                    <Button asChild className="rounded-xl h-12 w-full">
                      <Link href={`/contracts?new=1&salary=${encodeURIComponent(String(sal))}&start=${start}-01`} data-testid="button-afford-sign">
                        <FilePlus2 className="h-4 w-4" />{t('سجّل العقد بهالراتب', 'Record the contract at this salary')}
                      </Link>
                    </Button>
                  ) : reserveCovers ? (
                    <>
                      <Button className="rounded-xl h-12 w-full" disabled={ask.isPending || sent || pendingSame} data-testid="button-afford-reserve"
                        onClick={() => { setErr(null); ask.mutate({ data: { categoryId: 'players', amount: short, description: t(`تعاقد جديد براتب ${sal.toLocaleString('en-US')} د.ك بالشهر`, `New signing at KWD ${sal.toLocaleString('en-US')} a month`) } }); }}>
                        <Send className="h-4 w-4 rtl:-scale-x-100" />
                        {sent || pendingSame ? t('الطلب عند الرئيس', 'Waiting for the president') : <>{t('اطلب من الرئيس نقل ', 'Ask the president to move ')}<Money v={short} exact />{t(' من الاحتياطي', ' from the reserve')}</>}
                      </Button>
                      <div className="text-[13px] text-muted-foreground">{t('المتاح في الاحتياطي ', 'Reserve available ')}<Money v={reserveLeft} />{t('. إذا وافق، ينضاف المبلغ لبند الرواتب وتقدر تسجّل العقد.', '. Once approved, it is added to salaries and you can record the contract.')}</div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-muted/70 p-4 text-[14px]">
                      {t('حتى الاحتياطي ما يكفي (المتاح ', 'Even the reserve is not enough (')}<Money v={reserveLeft} />{t('). أعلى راتب ممكن مع كل الاحتياطي ', ' available). The most you can offer using the whole reserve is ')}
                      <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setSalary(String(Math.floor((avail + reserveLeft) / Math.max(1, n))))} data-testid="button-afford-fit">
                        <Money v={Math.max(0, Math.floor((avail + reserveLeft) / Math.max(1, n)))} />
                      </button>.
                    </div>
                  )}
                  {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('الطلب', 'The request')} />}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
