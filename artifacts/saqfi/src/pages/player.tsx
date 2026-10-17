import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwd, monthLabel, monthsInclusive, posLabel, dateLabel } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel } from '@/components/shell';

export default function PlayerHome({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const lines = s.payrolls.flatMap((p) => p.lines.map((l) => ({ ...l, month: p.month, paidAt: p.paidAt, id: p.id }))).sort((a, b) => b.month.localeCompare(a.month));
  const received = lines.reduce((a, l) => a + Math.round(l.net * 1000), 0) / 1000;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHead eyebrow={t('ملفي', 'My file')} title={session.name} sub={t('عقدك وسجل رواتبك فقط. البيانات المالية للنادي غير متاحة لدور اللاعب.', 'Your contract and salary history only. Club finances are not available to the player role.')} />
      {s.contracts.length === 0 ? (
        <div className="panel p-10 text-center text-muted-foreground">{t('لا يوجد عقد مسجل باسمك.', 'No contract is registered to you.')}</div>
      ) : s.contracts.map((c) => (
        <div key={c.id} className="panel p-6 mb-4 rise relative overflow-hidden" data-testid={`card-own-contract-${c.id}`}>
          <div className="absolute top-0 inset-x-0 gold-rule" />
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <div className="text-xl font-bold">{lang === 'ar' ? c.name : c.nameEn}</div>
              <div className="text-sm text-muted-foreground">{posLabel(c.position, lang)} · {t(s.club, s.clubEn)}</div>
            </div>
            <div className="text-end"><div className="eyebrow mb-1">{t('الراتب الشهري', 'Monthly salary')}</div><Money v={c.salary} className="text-2xl font-semibold text-primary" /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
            <div><div className="eyebrow mb-1">{t('البداية', 'Start')}</div><span className="num">{dateLabel(c.start, lang)}</span></div>
            <div><div className="eyebrow mb-1">{t('النهاية', 'End')}</div><span className="num">{dateLabel(c.end, lang)}</span></div>
            <div><div className="eyebrow mb-1">{t('القيمة الكلية', 'Total value')}</div><Money v={c.totalCost} /></div>
            <div><div className="eyebrow mb-1">{t('المتبقي', 'Outstanding')}</div><Money v={c.outstanding} /></div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-4">{monthsInclusive(c.start, c.end)} {t('شهراً شاملة', 'months inclusive')}</div>
        </div>
      ))}
      <div className="panel p-5 rise" style={{ animationDelay: '.06s' }}>
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="font-semibold">{t('سجل الرواتب', 'Salary history')}</h2>
          <span className="text-xs text-muted-foreground">{t('المستلم ', 'Received ')}<Money v={received} className="text-foreground" /></span>
        </div>
        {lines.length === 0 ? <p className="text-sm text-muted-foreground">{t('لم يُرحّل أي راتب بعد.', 'No salary posted yet.')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="text-[11px] text-muted-foreground"><tr className="border-b border-border">
                <th className="text-start font-medium p-2">{t('الشهر', 'Month')}</th><th className="text-end font-medium p-2">{t('الراتب', 'Salary')}</th>
                <th className="text-end font-medium p-2">{t('مكافأة', 'Bonus')}</th><th className="text-end font-medium p-2">{t('غرامة', 'Fine')}</th><th className="text-end font-medium p-2">{t('الصافي', 'Net')}</th>
              </tr></thead>
              <tbody>{lines.map((l) => (
                <tr key={l.id + l.playerId} className="border-b border-border/60">
                  <td className="p-2">{monthLabel(l.month, lang)}</td><td className="p-2 text-end num">{kwd(l.salary)}</td>
                  <td className="p-2 text-end num">{kwd(l.bonus)}</td><td className="p-2 text-end num">{kwd(l.fine)}</td><td className="p-2 text-end num text-primary">{kwd(l.net)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">{t('قيود محاسبية فقط، وليست إشعارات تحويل بنكي.', 'Accounting entries only, not bank transfer receipts.')}</p>
      </div>
    </div>
  );
}
