import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Play } from 'lucide-react';
import { useRunPayroll, getGetClubStateQueryKey, type Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, kwd, monthLabel, ym, dateLabel, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox } from '@/components/shell';
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
      onSuccess: (m) => { setConfirm(false); qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم ترحيل كشف الرواتب', 'Payroll posted'), description: m.message }); },
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

  return (
    <div>
      <PageHead eyebrow={t('الرواتب', 'Payroll')} title={t('كشف الرواتب الشهري', 'Monthly payroll')}
        sub={t('قيود محاسبية فقط — لا يتم أي تحويل بنكي. كل شهر يُرحّل مرة واحدة.', 'Accounting entries only — no bank transfer is made. Each month posts once.')}
        action={!isManager ? <ReadOnlyNote /> : undefined} />

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="panel p-5 rise">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow mb-1.5">{t('الشهر المستحق', 'Month due')}</div>
              <div className="text-2xl font-bold" data-testid="text-payroll-month">{month ? monthLabel(month, lang) : t('لا يوجد شهر مستحق', 'Nothing due')}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t(`${due.length} لاعب · الإجمالي `, `${due.length} players · total `)}<Money v={dueTotal} className="text-foreground font-semibold" /></div>
            </div>
            {isManager && month && (
              <Button size="lg" className="gap-2" disabled={run.isPending || due.length === 0 || month > s.today.slice(0, 7)} data-testid="button-run-payroll" onClick={() => { setErr(null); setConfirm(true); }}>
                <Play className="h-4 w-4 rtl:rotate-180" />{t('تشغيل الكشف', 'Run payroll')}
              </Button>
            )}
          </div>
          <div className="mt-3 inline-block text-[11px] rounded border border-primary/30 text-primary/90 px-2 py-0.5">{t('محاسبي فقط · بدون دفع بنكي', 'Accounting only · no bank payout')}</div>
          {err && <div className="mt-4"><ErrorBox msg={err.msg} exceeded={err.exceeded} /></div>}
          <div className="mt-5 max-h-[420px] overflow-y-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-muted-foreground sticky top-0 bg-card"><tr><th className="text-start font-medium p-2">{t('اللاعب', 'Player')}</th><th className="text-end font-medium p-2">{t('الراتب', 'Salary')}</th></tr></thead>
              <tbody>
                {due.map((c) => (
                  <tr key={c.id} className="border-t border-border/60"><td className="p-2">{lang === 'ar' ? c.name : c.nameEn}</td><td className="p-2 text-end num">{kwd(c.salary)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-5 rise" style={{ animationDelay: '.06s' }}>
          <h2 className="font-semibold mb-3">{t('سجل الكشوف', 'Payroll history')}</h2>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">{t('لم يُرحّل أي كشف بعد.', 'No payroll posted yet.')}</p> : (
            <div className="space-y-2">
              {history.map((p) => (
                <div key={p.id} className="rounded-lg border border-border" data-testid={`card-payroll-${p.month}`}>
                  <button className="w-full flex items-center gap-3 p-3 text-start" onClick={() => setOpenRun(openRun === p.id ? null : p.id)} data-testid={`button-toggle-payroll-${p.month}`}>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{monthLabel(p.month, lang)}</div>
                      <div className="text-[11px] text-muted-foreground">{t('رُحّل ', 'Posted ')}{dateLabel(p.paidAt, lang)} · {p.lines.length} {t('سطر', 'lines')}</div>
                    </div>
                    <Money v={p.total} className="text-sm font-semibold" />
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', openRun === p.id && 'rotate-180')} />
                  </button>
                  {openRun === p.id && (
                    <div className="border-t border-border overflow-x-auto">
                      <table className="w-full text-xs min-w-[420px]">
                        <thead className="text-muted-foreground"><tr>
                          <th className="text-start font-medium p-2">{t('اللاعب', 'Player')}</th><th className="text-end font-medium p-2">{t('الراتب', 'Salary')}</th>
                          <th className="text-end font-medium p-2">{t('مكافأة', 'Bonus')}</th><th className="text-end font-medium p-2">{t('غرامة', 'Fine')}</th><th className="text-end font-medium p-2">{t('الصافي', 'Net')}</th>
                        </tr></thead>
                        <tbody>{p.lines.map((l) => (
                          <tr key={l.playerId} className="border-t border-border/50">
                            <td className="p-2">{s.contracts.find((c) => c.id === l.playerId)?.[lang === 'ar' ? 'name' : 'nameEn'] ?? l.name}</td>
                            <td className="p-2 text-end num">{kwd(l.salary)}</td><td className="p-2 text-end num">{kwd(l.bonus)}</td>
                            <td className="p-2 text-end num">{kwd(l.fine)}</td><td className="p-2 text-end num text-primary">{kwd(l.net)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('تأكيد ترحيل كشف ', 'Confirm payroll for ')}{monthLabel(month, lang)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`سيتم تسجيل ${due.length} راتباً بإجمالي ${kwd(dueTotal)} د.ك كمصروف فعلي، وتحرير الحجز المقابل. قيد محاسبي فقط بدون أي تحويل بنكي، ولا يمكن تكراره لنفس الشهر.`,
                `${due.length} salaries totalling ${kwd(dueTotal)} KWD will be booked as spent and the matching reservation released. Accounting entry only, no bank transfer, and it cannot repeat for the same month.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-payroll" disabled={run.isPending} onClick={(e) => { e.preventDefault(); run.mutate({ data: { month } }); }}>
              {run.isPending ? t('جارٍ الترحيل…', 'Posting…') : t('ترحيل الكشف', 'Post payroll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
