import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwd, monthLabel, monthsInclusive, posLabel, dateLabel } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, KV } from '@/components/shell';

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
      <PageHead title={session.name} sub={t('عقدك ورواتبك. أرقام النادي الثانية مو ظاهرة لك.', 'Your contract and salaries. Other club figures are not shown to you.')} />
      {s.contracts.length === 0 ? (
        <div className="panel p-10 text-center text-muted-foreground mb-6">{t('ما في عقد مسجّل باسمك. تواصل مع المدير المالي.', 'No contract is registered to you. Contact the finance manager.')}</div>
      ) : s.contracts.map((c) => (
        <section key={c.id} className="panel p-5 md:p-8 mb-6" data-testid={`card-own-contract-${c.id}`}>
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <div className="text-xl font-semibold">{lang === 'ar' ? c.name : c.nameEn}</div>
              <div className="text-muted-foreground">{posLabel(c.position, lang)} · {t(s.club, s.clubEn)}</div>
            </div>
            <div className="text-end"><div className="text-muted-foreground">{t('الراتب الشهري', 'Monthly salary')}</div><Money v={c.salary} exact className="text-[28px] font-semibold" /></div>
          </div>
          <div className="mt-5 pt-4 border-t border-border sm:grid sm:grid-cols-2 sm:gap-x-8">
            <KV k={t('يبدأ', 'Starts')} v={<span className="num">{dateLabel(c.start, lang)}</span>} />
            <KV k={t('ينتهي', 'Ends')} v={<span className="num">{dateLabel(c.end, lang)}</span>} />
            <KV k={t('قيمة العقد', 'Contract value')} v={<Money v={c.totalCost} exact />} />
            <KV k={t('الباقي لك', 'Still to be paid')} v={<Money v={c.outstanding} exact />} />
            <KV k={t('المدة', 'Length')} v={<span>{monthsInclusive(c.start, c.end)} {t('شهر', 'months')}</span>} />
          </div>
        </section>
      ))}
      <section className="panel p-5 md:p-8">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-4">
          <h2 className="text-xl font-semibold">{t('رواتبك', 'Your salaries')}</h2>
          <span className="text-muted-foreground">{t('المستلم ', 'Received ')}<Money v={received} exact className="text-foreground font-semibold" /></span>
        </div>
        {lines.length === 0 ? <p className="text-muted-foreground">{t('ما انصرف لك راتب للحين. بيظهر هني أول ما ينصرف.', 'No salary paid yet. It will show here once paid.')}</p> : (
          <>
            <table className="w-full hidden md:table">
              <thead className="text-[15px] text-muted-foreground"><tr className="border-b border-border">
                <th className="text-start font-semibold p-3">{t('الشهر', 'Month')}</th><th className="text-end font-semibold p-3">{t('الراتب', 'Salary')}</th>
                <th className="text-end font-semibold p-3">{t('مكافأة', 'Bonus')}</th><th className="text-end font-semibold p-3">{t('غرامة', 'Fine')}</th><th className="text-end font-semibold p-3">{t('الصافي', 'Net')}</th>
              </tr></thead>
              <tbody>{lines.map((l) => (
                <tr key={l.id + l.playerId} className="border-b border-border last:border-0">
                  <td className="p-3">{monthLabel(l.month, lang)}</td><td className="p-3 text-end num">{kwd(l.salary)}</td>
                  <td className="p-3 text-end num">{kwd(l.bonus)}</td><td className="p-3 text-end num">{kwd(l.fine)}</td><td className="p-3 text-end num font-semibold">{kwd(l.net)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="md:hidden divide-y divide-border">
              {lines.map((l) => (
                <div key={l.id + l.playerId} className="py-3" data-testid={`card-salary-${l.month}`}>
                  <div className="font-semibold mb-1">{monthLabel(l.month, lang)}</div>
                  <KV k={t('الراتب', 'Salary')} v={<Money v={l.salary} exact />} />
                  <KV k={t('مكافأة', 'Bonus')} v={<Money v={l.bonus} exact />} />
                  <KV k={t('غرامة', 'Fine')} v={<Money v={l.fine} exact />} />
                  <KV k={t('الصافي', 'Net')} strong v={<Money v={l.net} exact />} />
                </div>
              ))}
            </div>
          </>
        )}
        <p className="text-[15px] text-muted-foreground mt-4">{t('هذي قيود محاسبية، مو إشعارات تحويل بنكي.', 'These are accounting entries, not bank transfer receipts.')}</p>
      </section>
    </div>
  );
}
