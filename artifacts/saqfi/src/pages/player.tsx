import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { monthLabel, monthsInclusive, posLabel, dateLabel } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, clubCrest, clubKit } from '@/components/shell';
import { Avatar, Chip, SectionTitle } from '@/components/kit';
import { cn } from '@/lib/utils';
import { WalletCard } from '@/components/wallet';

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
      ) : s.contracts.map((c) => {
        const total = monthsInclusive(c.start, c.end);
        const paidPct = c.totalCost > 0 ? Math.min(100, ((c.totalCost - c.outstanding) / c.totalCost) * 100) : 0;
        return (
          <section key={c.id} data-testid={`card-own-contract-${c.id}`}
            className="hero p-6 md:p-8 mb-6">
            <img aria-hidden src={clubKit()} alt="" className="pointer-events-none absolute -end-8 top-6 h-56 w-56 object-contain opacity-95 hidden sm:block drop-shadow-2xl" />
            <div className="relative flex items-center gap-4">
              <Avatar name={lang === 'ar' ? c.name : c.nameEn} size={52} className="ring-2 ring-white/20" />
              <div className="min-w-0">
                <div className="text-[20px] font-semibold truncate">{lang === 'ar' ? c.name : c.nameEn}</div>
                <div className="text-white/70 text-[14px] flex items-center gap-1.5"><img src={clubCrest()} alt="" className="h-4 w-4 object-contain" />{posLabel(c.position, lang)}، {t(s.club, s.clubEn)}</div>
              </div>
            </div>
            <div className="mt-7 text-white/70">{t('راتبك الشهري', 'Your monthly salary')}</div>
            <Money v={c.salary} exact className="block font-display text-[40px] md:text-[52px] font-semibold leading-none tracking-tight [&_.text-muted-foreground]:text-white/60" />
            <div className="mt-6 h-2 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-valuenow={Math.round(paidPct)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-white" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px] text-white/70">
              <span>{t('انصرف ', 'Paid ')}<span className="num">{Math.round(paidPct)}%</span> {t('من العقد', 'of the contract')}</span>
              <span>{t('الباقي لك ', 'Still to be paid ')}<Money v={c.outstanding} exact className="text-white font-semibold [&_.text-muted-foreground]:text-white/60" /></span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-[13px]">
              <div className="rounded-2xl bg-white/[.07] p-3"><div className="text-white/60">{t('يبدأ', 'Starts')}</div><div className="font-semibold num">{dateLabel(c.start, lang)}</div></div>
              <div className="rounded-2xl bg-white/[.07] p-3"><div className="text-white/60">{t('ينتهي', 'Ends')}</div><div className="font-semibold num">{dateLabel(c.end, lang)}</div></div>
              <div className="rounded-2xl bg-white/[.07] p-3"><div className="text-white/60">{t('المدة', 'Length')}</div><div className="font-semibold">{total} {t('شهر', 'months')}</div></div>
            </div>
          </section>
        );
      })}
      <WalletCard wallet={s.wallet} />
      {s.adjustments.some((a) => !a.settledMonth) && (
        <section className="panel p-5 md:p-7 mb-6" data-testid="card-own-pending">
          <SectionTitle aside={t('مع راتبك الجاي', 'With your next salary')}>{t('مكافآت وغرامات', 'Bonuses & fines')}</SectionTitle>
          <ul className="divide-y divide-border">
            {s.adjustments.filter((a) => !a.settledMonth).map((a) => (
              <li key={a.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0"><div className="font-semibold">{a.reason}</div><div className="text-[13px] text-muted-foreground num">{dateLabel(a.date, lang)}</div></div>
                <span className={cn('font-display font-semibold', a.kind === 'fine' ? 'text-destructive' : 'text-success')}>{a.kind === 'fine' ? '-' : '+'}<Money v={a.amount} exact /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel p-5 md:p-7">
        <SectionTitle aside={<span>{t('المستلم ', 'Received ')}<Money v={received} exact className="text-foreground font-semibold" /></span>}>{t('رواتبك', 'Your salaries')}</SectionTitle>
        {lines.length === 0 ? <p className="text-muted-foreground">{t('ما انصرف لك راتب للحين. بيظهر هني أول ما ينصرف.', 'No salary paid yet. It will show here once paid.')}</p> : (
          <ul className="divide-y divide-border">
            {lines.map((l) => (
              <li key={l.id + l.playerId} className="py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1" data-testid={`card-salary-${l.month}`}>
                <div className="flex-1 min-w-[140px]">
                  <div className="font-semibold">{monthLabel(l.month, lang)}</div>
                  <div className="text-[13px] text-muted-foreground">{t('الراتب ', 'Salary ')}<Money v={l.salary} exact /></div>
                </div>
                {l.bonus > 0 && <Chip tone="good">+<Money v={l.bonus} exact unit={false} />&nbsp;{t('مكافأة', 'bonus')}</Chip>}
                {l.fine > 0 && <Chip tone="bad">-<Money v={l.fine} exact unit={false} />&nbsp;{t('غرامة', 'fine')}</Chip>}
                <Money v={l.net} exact className={cn('font-display font-semibold text-[17px]')} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
