import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Banknote } from 'lucide-react';
import { useRunPayroll, getGetClubStateQueryKey, type Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, kwd, kwdText, monthLabel, ym, dateLabel, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox, KV } from '@/components/shell';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Payroll({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const run = useRunPayroll({
    mutation: {
      onSuccess: (m) => { setConfirm(false); qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم صرف رواتب الشهر', 'Salaries paid for the month'), description: lang === 'ar' ? m.message : undefined }); },
      onError: (e) => { setConfirm(false); setErr(apiErr(e, lang)); },
    },
  });
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const month = s.nextPayrollMonth;
  const due = s.contracts.filter((c) => month && ym(c.start) <= month && ym(c.end) >= month);
  const dueTotal = due.reduce((a, c) => a + Math.round(c.salary * 1000), 0) / 1000;
  const history = [...s.payrolls].sort((a, b) => b.month.localeCompare(a.month));
  const notYet = !!month && month > s.today.slice(0, 7);
  const name = (id: string, fallback: string) => s.contracts.find((c) => c.id === id)?.[lang === 'ar' ? 'name' : 'nameEn'] ?? fallback;

  return (
    <div>
      <PageHead title={t('الرواتب', 'Payroll')}
        sub={t('صرف الرواتب هني قيد محاسبي بس، ما في تحويل بنكي. كل شهر ينصرف مرة وحدة.', 'Paying salaries here is an accounting entry only, no bank transfer. Each month is paid once.')}
        action={isManager ? (month ? (
          <Button disabled={run.isPending || due.length === 0 || notYet} data-testid="button-run-payroll" onClick={() => { setErr(null); setConfirm(true); }}>
            <Banknote className="h-4 w-4" />{t('صرف رواتب الشهر', 'Pay this month\'s salaries')}
          </Button>) : undefined) : <ReadOnlyNote />} />

      {err && <div className="mb-6"><ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('صرف الرواتب', 'Payroll')} /></div>}

      <section className="panel p-5 md:p-8 mb-6">
        <div className="text-muted-foreground">{t('الشهر الجاي', 'Next month due')}</div>
        <div className="text-[26px] font-semibold" data-testid="text-payroll-month">{month ? monthLabel(month, lang) : t('خلصت رواتب الموسم', 'All season salaries paid')}</div>
        {month && <div className="mt-1">{t(`${due.length} لاعب، المجموع `, `${due.length} players, total `)}<Money v={dueTotal} exact className="font-semibold" /></div>}
        {notYet && <p className="mt-2 text-muted-foreground">{t('ما يمديك تصرف هالشهر قبل لا يبدأ.', 'You can\'t pay this month before it starts.')}</p>}
        {month && due.length > 0 && (
          <ul className="mt-5 divide-y divide-border border-t border-border">
            {due.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-3"><span>{lang === 'ar' ? c.name : c.nameEn}</span><Money v={c.salary} exact /></li>
            ))}
          </ul>
        )}
        {month && due.length === 0 && <p className="mt-3 text-muted-foreground">{t('ما في لاعبين عقودهم تغطي هالشهر. أضف عقد من صفحة اللاعبين والعقود.', 'No contracts cover this month. Add one on the Players & contracts page.')}</p>}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">{t('الرواتب اللي انصرفت', 'Paid salaries')}</h2>
        {history.length === 0 ? (
          <div className="panel p-8 text-center text-muted-foreground">{t('ما انصرفت رواتب للحين. أول ما تصرف رواتب الشهر بتطلع هني.', 'No salaries paid yet. They will show here after the first payroll.')}</div>
        ) : (
          <div className="space-y-3">
            {history.map((p) => {
              const isOpen = openRun === p.id;
              return (
                <div key={p.id} className="panel overflow-hidden" data-testid={`card-payroll-${p.month}`}>
                  <button className="w-full min-h-16 flex items-center gap-3 p-4 text-start hover:bg-background" aria-expanded={isOpen}
                    onClick={() => setOpenRun(isOpen ? null : p.id)} data-testid={`button-toggle-payroll-${p.month}`}>
                    <div className="flex-1">
                      <div className="font-semibold">{monthLabel(p.month, lang)}</div>
                      <div className="text-[15px] text-muted-foreground">{t('انصرف ', 'Paid ')}{dateLabel(p.paidAt, lang)} · {p.lines.length} {t('لاعب', 'players')}</div>
                    </div>
                    <Money v={p.total} exact className="font-semibold" />
                    <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border">
                      <table className="w-full hidden md:table">
                        <thead className="text-[15px] text-muted-foreground bg-background"><tr>
                          <th className="text-start font-semibold p-3 ps-4">{t('اللاعب', 'Player')}</th><th className="text-end font-semibold p-3">{t('الراتب', 'Salary')}</th>
                          <th className="text-end font-semibold p-3">{t('مكافأة', 'Bonus')}</th><th className="text-end font-semibold p-3">{t('غرامة', 'Fine')}</th><th className="text-end font-semibold p-3 pe-4">{t('الصافي', 'Net')}</th>
                        </tr></thead>
                        <tbody>{p.lines.map((l) => (
                          <tr key={l.playerId} className="border-t border-border">
                            <td className="p-3 ps-4">{name(l.playerId, l.name)}</td>
                            <td className="p-3 text-end num">{kwd(l.salary)}</td><td className="p-3 text-end num">{kwd(l.bonus)}</td>
                            <td className="p-3 text-end num">{kwd(l.fine)}</td><td className="p-3 pe-4 text-end num font-semibold">{kwd(l.net)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                      <div className="md:hidden divide-y divide-border">
                        {p.lines.map((l) => (
                          <div key={l.playerId} className="p-4" data-testid={`card-payroll-line-${p.month}-${l.playerId}`}>
                            <div className="font-semibold mb-1">{name(l.playerId, l.name)}</div>
                            <KV k={t('الراتب', 'Salary')} v={<Money v={l.salary} exact />} />
                            <KV k={t('مكافأة', 'Bonus')} v={<Money v={l.bonus} exact />} />
                            <KV k={t('غرامة', 'Fine')} v={<Money v={l.fine} exact />} />
                            <KV k={t('الصافي', 'Net')} strong v={<Money v={l.net} exact />} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('صرف رواتب ', 'Pay salaries for ')}{monthLabel(month, lang)}</AlertDialogTitle>
            <AlertDialogDescription className="text-[15px]">
              {t(`بيتسجّل ${due.length} راتب بمجموع ${kwdText(dueTotal, lang)} كمصروف. قيد محاسبي بس بدون تحويل بنكي، وما يتكرر لنفس الشهر.`,
                `${due.length} salaries totalling ${kwdText(dueTotal, lang)} will be recorded as spent. Accounting entry only, no bank transfer, and it can't repeat for the same month.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-payroll" disabled={run.isPending} onClick={(e) => { e.preventDefault(); run.mutate({ data: { month } }); }}>
              {run.isPending ? t('جاري الصرف…', 'Paying…') : t('تأكيد الصرف', 'Confirm payment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
