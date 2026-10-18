import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, ArrowDownLeft, ArrowUpRight, Landmark, Zap } from 'lucide-react';
import { useWithdrawWallet, useRequestAdvance, getGetClubStateQueryKey, type Wallet as WalletT, type Advance } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, dateLabel, validAmount } from '@/lib/saqfi';
import { Money, ErrorBox } from '@/components/shell';
import { SectionTitle } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/** The player's wallet: salaries paid through the gateway arrive here; he can move them to his bank. */
export function WalletCard({ wallet, salary, advances }: { wallet: WalletT; salary: number; advances: Advance[] }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const w = useWithdrawWallet({
    mutation: {
      onSuccess: (m) => { setOpen(false); qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم التحويل', 'Transfer sent'), description: lang === 'ar' ? m.message : undefined }); },
      onError: (e) => setErr(apiErr(e, lang).msg),
    },
  });
  const valid = validAmount(amount) && Number(amount) <= wallet.balance;
  const [adv, setAdv] = useState(false);
  const [advAmount, setAdvAmount] = useState('');
  const limit = Math.floor(salary * 500) / 1000;
  const openAdvance = advances.find((a) => !a.settledMonth);
  const advValid = validAmount(advAmount) && Number(advAmount) <= limit;
  const ra = useRequestAdvance({
    mutation: {
      onSuccess: (m) => { setAdv(false); qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('نزلت السلفة', 'Advance received'), description: lang === 'ar' ? m.message : undefined }); },
      onError: (e) => setErr(apiErr(e, lang).msg),
    },
  });

  return (
    <section className="panel p-5 md:p-7 mb-6" data-testid="card-wallet">
      <SectionTitle>{t('محفظتي', 'My wallet')}</SectionTitle>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-muted-foreground flex items-center gap-1.5"><Wallet className="h-4 w-4" />{t('الرصيد', 'Balance')}</div>
          <Money v={wallet.balance} exact className="block mt-1 font-display text-[34px] font-semibold leading-none" />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button variant="outline" className="rounded-xl h-11 bg-card" disabled={!!openAdvance || salary <= 0} onClick={() => { setErr(null); setAdvAmount(String(limit)); setAdv(true); }} data-testid="button-advance">
            <Zap className="h-4 w-4" />{t('سلفة على الراتب', 'Salary advance')}
          </Button>
          <Button className="rounded-xl h-11" disabled={wallet.balance <= 0} onClick={() => { setErr(null); setAmount(String(wallet.balance)); setOpen(true); }} data-testid="button-withdraw">
            <Landmark className="h-4 w-4" />{t('حوّل للبنك', 'To my bank')}
          </Button>
        </div>
      </div>
      {openAdvance && (
        <div className="mt-4 rounded-xl bg-warning/[.08] px-4 py-3 text-[14px]" data-testid="text-open-advance">
          {t('سلفة ', 'Advance of ')}<Money v={openAdvance.amount} exact raw className="font-semibold" />{t(' بتنخصم من راتبك الجاي', ' will be deducted from your next salary')}
        </div>
      )}
      {wallet.entries.length === 0 ? (
        <p className="mt-5 text-[14px] text-muted-foreground">{t('رواتبك بتنزل هني أول ما يدفعها النادي عن طريق بوابة الدفع.', 'Your salaries land here once the club pays them through the gateway.')}</p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {wallet.entries.map((e) => (
            <li key={e.id} className="py-3 flex items-center gap-3" data-testid={`wallet-${e.id}`}>
              <span className={cn('h-9 w-9 rounded-full grid place-items-center shrink-0', e.amount > 0 ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}>
                {e.kind === 'advance' ? <Zap className="h-4 w-4" /> : e.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0"><div className="font-semibold text-[14.5px]">{lang === 'ar' ? e.description : e.descriptionEn}</div><div className="text-[12.5px] text-muted-foreground">{dateLabel(e.date, lang)}</div></div>
              <span className={cn('font-display font-semibold', e.amount > 0 ? 'text-primary' : 'text-foreground')}>{e.amount > 0 ? '+' : '-'}<Money v={Math.abs(e.amount)} exact /></span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adv} onOpenChange={setAdv}>
        <DialogContent className="rounded-[20px] max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('سلفة على الراتب', 'Salary advance')}</DialogTitle>
            <DialogDescription>{t('تنزل في محفظتك الحين وتنخصم من راتبك الجاي', 'Paid into your wallet now, deducted from your next salary')}</DialogDescription>
          </DialogHeader>
          <label className="text-[14px] font-medium" htmlFor="input-advance">{t('المبلغ (د.ك)', 'Amount (KWD)')}</label>
          <Input id="input-advance" inputMode="decimal" dir="ltr" value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} className="h-11 rounded-xl num" data-testid="input-advance" />
          <div className="text-[13px] text-muted-foreground">{t('الحد الأعلى نص راتبك ', 'Up to half your salary: ')}<Money v={limit} exact raw /></div>
          {err && <ErrorBox msg={err} />}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-xl h-11" onClick={() => setAdv(false)}>{t('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl h-11" disabled={!advValid || ra.isPending} onClick={() => ra.mutate({ data: { amount: Number(advAmount) } })} data-testid="button-confirm-advance">
              {ra.isPending ? t('جاري الصرف…', 'Paying…') : t('اصرف السلفة', 'Get advance')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[20px] max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('تحويل للحساب البنكي', 'Transfer to bank')}</DialogTitle>
            <DialogDescription>{t('تحويل تجريبي من محفظتك', 'Test transfer from your wallet')}</DialogDescription>
          </DialogHeader>
          <label className="text-[14px] font-medium" htmlFor="input-withdraw">{t('المبلغ (د.ك)', 'Amount (KWD)')}</label>
          <Input id="input-withdraw" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl num" data-testid="input-withdraw" />
          <div className="text-[13px] text-muted-foreground">{t('المتاح ', 'Available ')}<Money v={wallet.balance} exact raw /></div>
          {err && <ErrorBox msg={err} />}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-xl h-11" onClick={() => setOpen(false)}>{t('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl h-11" disabled={!valid || w.isPending} onClick={() => w.mutate({ data: { amount: Number(amount) } })} data-testid="button-confirm-withdraw">
              {w.isPending ? t('جاري التحويل…', 'Sending…') : t('حوّل', 'Transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
