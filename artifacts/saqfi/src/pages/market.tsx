import { useMemo, useState } from 'react';
import { ShoppingCart, CheckCircle2, Search } from 'lucide-react';
import type { Session, Listing } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { posLabel, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox } from '@/components/shell';
import { Avatar, Chip, Toolbar } from '@/components/kit';
import { usePay, GatewayNote } from '@/components/pay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Transfer market: sign a player by paying the transfer fee through the gateway. Caps are checked before paying. */
export default function Market({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const { pay, busy } = usePay();
  const [pick, setPick] = useState<Listing | null>(null);
  const [err, setErr] = useState<ApiErr | null>(null);
  const [query, setQuery] = useState('');
  const s = q.data;
  const list = useMemo(() => {
    const k = query.trim().toLowerCase();
    return (s?.market ?? []).filter((l) => !k || l.name.includes(k) || l.nameEn.toLowerCase().includes(k) || l.position.includes(k) || l.fromClub.includes(k));
  }, [s, query]);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !s) return <ErrorPanel onRetry={() => q.refetch()} />;
  const isManager = session.role === 'manager';
  const transfers = s.categories.find((c) => c.id === 'transfers');
  const players = s.categories.find((c) => c.id === 'players');
  const lastPaid = [...s.payrolls].map((p) => p.month).sort().at(-1) ?? '';
  const seasonEnd = s.seasonEnd.slice(0, 7);
  /* Months of salary the new contract would reserve (same rule as the server: starts after the last paid month) */
  const monthsLeft = (() => {
    let [y, m] = s.today.slice(0, 7).split('-').map(Number);
    if (lastPaid && `${y}-${String(m).padStart(2, '0')}` <= lastPaid) { [y, m] = lastPaid.split('-').map(Number); m += 1; if (m > 12) { m = 1; y += 1; } }
    const [ey, em] = seasonEnd.split('-').map(Number);
    return Math.max(0, (ey - y) * 12 + (em - m) + 1);
  })();
  const fits = (l: Listing) => ({
    fee: !!transfers && l.fee <= transfers.remaining,
    salary: !!players && l.salary * monthsLeft <= players.remaining,
  });

  const buy = async () => {
    if (!pick) return;
    setErr(null);
    const r = await pay({ kind: 'transfer', listingId: pick.id }, t(`تم التعاقد مع ${pick.name}`, `${pick.nameEn} signed`));
    if (r.ok) setPick(null); else if (r.error) setErr(r.error);
  };

  return (
    <div>
      <PageHead title={t('سوق الانتقالات', 'Transfer market')} action={isManager ? undefined : <ReadOnlyNote />} />

      <div className="panel grid grid-cols-2 md:grid-cols-3 overflow-hidden mb-5 [&>*]:border-border max-md:[&>*:first-child]:border-e md:[&>*:not(:last-child)]:border-e">
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('ميزانية الانتقالات المتاحة', 'Transfer budget left')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold"><Money v={transfers?.remaining ?? 0} /></div></div>
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('متاح لرواتب جديدة', 'Free for new salaries')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold"><Money v={players?.remaining ?? 0} /></div></div>
        <div className="p-4 md:p-5 col-span-2 md:col-span-1 max-md:border-t"><div className="text-[13px] text-muted-foreground">{t('لاعبين متاحين', 'Players available')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold num font-display">{s.market.filter((l) => l.status === 'available').length}</div></div>
      </div>

      <Toolbar>
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ابحث باسم اللاعب أو النادي أو المركز', 'Search player, club or position')} className="ps-10 bg-card" data-testid="input-market-search" />
        </div>
      </Toolbar>

      {list.length === 0 ? (
        <div className="panel p-10 text-center text-muted-foreground">{t('ما في لاعب يطابق البحث.', 'No player matches your search.')}</div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((l) => {
            const f = fits(l);
            const sold = l.status === 'sold';
            return (
              <li key={l.id} className={cn('panel p-5 flex flex-col', sold && 'opacity-70')} data-testid={`card-listing-${l.id}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={lang === 'ar' ? l.name : l.nameEn} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[16px] truncate">{lang === 'ar' ? l.name : l.nameEn}</div>
                    <div className="text-[13px] text-muted-foreground truncate">{posLabel(l.position, lang)}، <span className="num">{l.age}</span> {t('سنة', 'yrs')}، {lang === 'ar' ? l.nationality : l.nationalityEn}</div>
                    <div className="text-[13px] text-muted-foreground truncate">{t('من ', 'From ')}{lang === 'ar' ? l.fromClub : l.fromClubEn}</div>
                  </div>
                  {sold ? <Chip tone="good">{t('انضم للنادي', 'Signed')}</Chip> : null}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
                  <div><dt className="text-[12px] text-muted-foreground">{t('رسوم الانتقال', 'Transfer fee')}</dt><dd className={cn('font-semibold', !sold && !f.fee && 'text-destructive')}><Money v={l.fee} /></dd></div>
                  <div><dt className="text-[12px] text-muted-foreground">{t('الراتب الشهري', 'Monthly salary')}</dt><dd className={cn('font-semibold', !sold && !f.salary && 'text-destructive')}><Money v={l.salary} /></dd></div>
                </dl>
                {!sold && (!f.fee || !f.salary) && (
                  <p className="mt-2 text-[13px] text-destructive">{!f.fee ? t('الرسوم أكبر من ميزانية الانتقالات', 'Fee exceeds the transfer budget') : t('راتبه يتعدى سقف الرواتب لباقي الموسم', 'Salary would break the salary cap for the rest of the season')}</p>
                )}
                {isManager && !sold && (
                  <Button className="mt-4 rounded-xl h-11" disabled={busy || !f.fee || !f.salary} onClick={() => { setErr(null); setPick(l); }} data-testid={`button-buy-${l.id}`}>
                    <ShoppingCart className="h-4 w-4" />{t('تعاقد وادفع', 'Sign and pay')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!pick} onOpenChange={(o) => { if (!o) { setPick(null); setErr(null); } }}>
        <DialogContent className="rounded-[20px] max-w-md">
          {pick && (
            <>
              <DialogHeader>
                <DialogTitle>{t(`التعاقد مع ${pick.name}`, `Sign ${pick.nameEn}`)}</DialogTitle>
                <DialogDescription>{t('ادفع رسوم الانتقال وينضاف عقده للنادي', 'Pay the transfer fee and his contract is added')}</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 text-[14.5px]">
                <li className="flex justify-between gap-3"><span className="text-muted-foreground">{t('رسوم الانتقال (تندفع الحين)', 'Transfer fee (paid now)')}</span><Money v={pick.fee} className="font-semibold" /></li>
                <li className="flex justify-between gap-3"><span className="text-muted-foreground">{t(`راتب ${monthsLeft} شهر (ينحجز من الميزانية)`, `${monthsLeft} months of salary (reserved)`)}</span><Money v={pick.salary * monthsLeft} className="font-semibold" /></li>
                <li className="flex justify-between gap-3 pt-2 border-t border-border"><span className="text-muted-foreground">{t('يبقى في ميزانية الانتقالات', 'Transfer budget after')}</span><Money v={(transfers?.remaining ?? 0) - pick.fee} className="font-semibold" /></li>
              </ul>
              <GatewayNote provider={s.gateway} />
              {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('التعاقد', 'Signing')} />}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" className="rounded-xl h-11" onClick={() => setPick(null)}>{t('إلغاء', 'Cancel')}</Button>
                <Button className="rounded-xl h-11" disabled={busy} onClick={buy} data-testid="button-confirm-buy">
                  <CheckCircle2 className="h-4 w-4" />{t('ادفع ', 'Pay ')}<Money v={pick.fee} raw className="[&_.text-muted-foreground]:text-primary-foreground/70" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
