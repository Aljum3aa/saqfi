import { useState } from 'react';
import { ChevronDown, Banknote, CheckCircle2 } from 'lucide-react';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwdText, monthLabel, ym, dateLabel, type ApiErr } from '@/lib/saqfi';
import { usePay, GatewayNote } from '@/components/pay';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox } from '@/components/shell';
import { Avatar, Chip, SectionTitle } from '@/components/kit';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export default function Payroll({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const { pay, busy } = usePay();
  const [confirm, setConfirm] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const month = s.nextPayrollMonth;
  const due = s.contracts.filter((c) => month && ym(c.start) <= month && ym(c.end) >= month);
  const netOf = (c: (typeof due)[number]) => Math.max(0, c.salary + c.pendingBonus - Math.min(c.pendingFine, c.salary + c.pendingBonus));
  const dueTotal = due.reduce((a, c) => a + Math.round(netOf(c) * 1000), 0) / 1000;
  const dueBonus = due.reduce((a, c) => a + c.pendingBonus, 0);
  const dueFine = due.reduce((a, c) => a + c.pendingFine, 0);
  const history = [...s.payrolls].sort((a, b) => b.month.localeCompare(a.month));
  const notYet = !!month && month > s.today.slice(0, 7);
  const name = (id: string, fallback: string) => s.contracts.find((c) => c.id === id)?.[lang === 'ar' ? 'name' : 'nameEn'] ?? fallback;
  const canRun = !!month && !busy && due.length > 0 && !notYet;
  const runPay = async () => {
    setConfirm(false);
    const r = await pay({ kind: 'payroll', month }, t(`انصرفت رواتب ${monthLabel(month, lang)}`, `${monthLabel(month, lang)} salaries paid`));
    if (!r.ok && r.error) setErr(r.error);
  };
  const RunBtn = ({ big = false }: { big?: boolean }) => (
    <Button disabled={!canRun} data-testid={big ? 'button-run-payroll' : 'button-run-payroll-head'} onClick={() => { setErr(null); setConfirm(true); }}
      className={cn('rounded-full px-6', big ? 'h-12 bg-white text-primary hover:bg-white/90 font-semibold' : 'h-12')}>
      <Banknote className="h-4 w-4" />{t('صرف رواتب الشهر', 'Pay this month\'s salaries')}
    </Button>
  );

  return (
    <div>
      <PageHead title={t('الرواتب', 'Payroll')}
        sub={t('صرف الرواتب هني قيد محاسبي بس، ما في تحويل بنكي. كل شهر ينصرف مرة وحدة.', 'Paying salaries here is an accounting entry only, no bank transfer. Each month is paid once.')}
        action={isManager ? undefined : <ReadOnlyNote />} />

      {err && <div className="mb-6"><ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('صرف الرواتب', 'Payroll')} /></div>}

      {/* Next run: the page's one bold card */}
      <section className="hero p-6 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="text-white/70">{t('الشهر الجاي', 'Next month due')}</div>
            <div className="font-display text-[30px] md:text-[38px] font-semibold leading-tight" data-testid="text-payroll-month">{month ? monthLabel(month, lang) : t('خلصت رواتب الموسم', 'All season salaries paid')}</div>
            {month && (
              <div className="mt-2 text-white/80">
                {t(`${due.length} لاعب، المجموع `, `${due.length} players, total `)}
                <Money v={dueTotal} exact className="font-semibold text-white [&_.text-muted-foreground]:text-white/60" />
              </div>
            )}
            {month && (dueBonus > 0 || dueFine > 0) && (
              <div className="mt-1 text-[14px] text-white/70">{t('يشمل مكافآت ', 'Includes bonuses ')}<Money v={dueBonus} className="text-white [&_.text-muted-foreground]:text-white/60" />{t(' وخصم غرامات ', ' and fines of ')}<Money v={dueFine} className="text-white [&_.text-muted-foreground]:text-white/60" /></div>
            )}
            {notYet && <p className="mt-2 text-white/70">{t('ما يمديك تصرف هالشهر قبل لا يبدأ.', 'You can\'t pay this month before it starts.')}</p>}
          </div>
          {isManager && month && <RunBtn big />}
        </div>
        {month && due.length > 0 && (
          <div className="mt-6 flex items-center">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {due.slice(0, 8).map((c) => <Avatar key={c.id} name={lang === 'ar' ? c.name : c.nameEn} size={36} className="ring-2 ring-[#0B6B4C]" />)}
            </div>
            {due.length > 8 && <span className="ms-3 text-[13px] text-white/70">+{due.length - 8}</span>}
          </div>
        )}
        {month && due.length === 0 && <p className="mt-3 text-white/70">{t('ما في لاعبين عقودهم تغطي هالشهر. أضف عقد من صفحة اللاعبين والعقود.', 'No contracts cover this month. Add one on the Players & contracts page.')}</p>}
      </section>

      {month && due.length > 0 && (
        <section className="panel p-5 md:p-7 mb-6">
          <SectionTitle aside={t(`${due.length} لاعب`, `${due.length} players`)}>{t('اللي بينصرف لهم', 'Who gets paid')}</SectionTitle>
          <ul className="grid sm:grid-cols-2 gap-x-8 divide-y divide-border sm:divide-y-0">
            {due.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3 sm:border-b sm:border-border">
                <Avatar name={lang === 'ar' ? c.name : c.nameEn} size={36} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{lang === 'ar' ? c.name : c.nameEn}</span>
                  {(c.pendingBonus > 0 || c.pendingFine > 0) && (
                    <span className="flex flex-wrap gap-1.5 mt-0.5">
                      {c.pendingBonus > 0 && <Chip tone="good">+<Money v={c.pendingBonus} exact unit={false} />&nbsp;{t('مكافأة', 'bonus')}</Chip>}
                      {c.pendingFine > 0 && <Chip tone="bad">-<Money v={c.pendingFine} exact unit={false} />&nbsp;{t('غرامة', 'fine')}</Chip>}
                    </span>
                  )}
                </span>
                <Money v={netOf(c)} exact className="font-display font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>{t('الرواتب اللي انصرفت', 'Paid salaries')}</SectionTitle>
        {history.length === 0 ? (
          <div className="panel p-8 text-center text-muted-foreground">{t('ما انصرفت رواتب للحين. أول ما تصرف رواتب الشهر بتطلع هني.', 'No salaries paid yet. They will show here after the first payroll.')}</div>
        ) : (
          <div className="space-y-3">
            {history.map((p) => {
              const isOpen = openRun === p.id;
              return (
                <div key={p.id} className="panel overflow-hidden" data-testid={`card-payroll-${p.month}`}>
                  <button className="w-full min-h-[72px] flex items-center gap-4 px-5 py-4 text-start hover:bg-muted/40 transition-colors" aria-expanded={isOpen}
                    onClick={() => setOpenRun(isOpen ? null : p.id)} data-testid={`button-toggle-payroll-${p.month}`}>
                    <span className="h-10 w-10 rounded-full bg-success/10 text-success grid place-items-center shrink-0"><CheckCircle2 className="h-5 w-5" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{monthLabel(p.month, lang)}</div>
                      <div className="text-[13px] text-muted-foreground">{t('انصرف ', 'Paid ')}{dateLabel(p.paidAt, lang)}، {p.lines.length} {t('لاعب', 'players')}</div>
                    </div>
                    <Money v={p.total} exact className="font-display font-semibold text-[17px]" />
                    <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <ul className="border-t border-border divide-y divide-border">
                      {p.lines.map((l) => (
                        <li key={l.playerId} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1" data-testid={`card-payroll-line-${p.month}-${l.playerId}`}>
                          <span className="flex items-center gap-3 flex-1 min-w-[180px]"><Avatar name={name(l.playerId, l.name)} size={32} /><span className="truncate">{name(l.playerId, l.name)}</span></span>
                          <span className="text-[13px] text-muted-foreground">{t('الراتب ', 'Salary ')}<Money v={l.salary} exact /></span>
                          {l.bonus > 0 && <Chip tone="good">+<Money v={l.bonus} exact unit={false} />&nbsp;{t('مكافأة', 'bonus')}</Chip>}
                          {l.fine > 0 && <Chip tone="bad">-<Money v={l.fine} exact unit={false} />&nbsp;{t('غرامة', 'fine')}</Chip>}
                          <Money v={l.net} exact className="font-semibold ms-auto" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('صرف رواتب ', 'Pay salaries for ')}{monthLabel(month, lang)}</AlertDialogTitle>
            <AlertDialogDescription className="text-[15px]">
              {t(`بتدفع ${kwdText(dueTotal, lang)} لـ ${due.length} لاعب، وكل راتب ينزل في محفظة صاحبه. ما يتكرر لنفس الشهر.`,
                `You will pay ${kwdText(dueTotal, lang)} to ${due.length} players; each salary lands in the player's wallet. It can't repeat for the same month.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GatewayNote provider={s.gateway} />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-full">{t('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" data-testid="button-confirm-payroll" disabled={busy} onClick={(e) => { e.preventDefault(); runPay(); }}>
              {busy ? t('جاري الدفع…', 'Paying…') : t('ادفع الرواتب', 'Pay salaries')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
