import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { startCheckout, confirmPayment, cancelPayment, getGetClubStateQueryKey } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr } from '@/lib/saqfi';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/shell';

type PayInput = { kind: 'payroll'; month: string } | { kind: 'transfer'; listingId: string; plan?: 'full' | 'installments' } | { kind: 'installment'; installmentId: string };
type Receipt = { title: string; amount: number; message: string; provider: string };
type Ctx = { pay: (i: PayInput, title: string) => Promise<{ ok: boolean; error?: ReturnType<typeof apiErr> }>; busy: boolean };
const PayCtx = createContext<Ctx>({ pay: async () => ({ ok: false }), busy: false });
export const usePay = () => useContext(PayCtx);

/**
 * One payment flow for the whole app. Stripe (test mode): create a Checkout Session and send the
 * browser to Stripe; on return the server verifies the session before booking anything.
 * Sandbox (no Stripe key): the server confirms straight away, so the same flow can be demoed.
 */
export function PayProvider({ children }: { children: ReactNode }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const handled = useRef(false);
  const refresh = () => qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() });

  // Coming back from Stripe Checkout: ?pay=<id>&session_id=cs_test_… or &cancelled=1
  useEffect(() => {
    if (handled.current) return;
    const u = new URL(window.location.href);
    const id = u.searchParams.get('pay');
    if (!id) return;
    handled.current = true;
    const sessionId = u.searchParams.get('session_id') ?? undefined;
    const cancelled = u.searchParams.has('cancelled');
    ['pay', 'session_id', 'cancelled'].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
    (async () => {
      try {
        if (cancelled) {
          await cancelPayment(id, {});
          toast({ title: t('انلغى الدفع', 'Payment cancelled'), description: t('ما انخصم أي مبلغ.', 'Nothing was charged.') });
        } else {
          setBusy(true);
          const m = await confirmPayment(id, { sessionId });
          setReceipt({ title: t('تم الدفع', 'Payment complete'), amount: 0, message: m.message, provider: 'Stripe' });
        }
      } catch (e) {
        toast({ variant: 'destructive', title: t('ما اكتمل الدفع', 'Payment not completed'), description: apiErr(e, lang).msg });
      } finally { setBusy(false); refresh(); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pay: Ctx['pay'] = async (input, title) => {
    setBusy(true);
    try {
      const returnUrl = window.location.origin + window.location.pathname;
      const r = await startCheckout({ ...input, returnUrl });
      if (r.provider === 'stripe' && r.url) {
        window.location.assign(r.url);       // Stripe hosts the card form; we never see card details
        return { ok: true };
      }
      const m = await confirmPayment(r.paymentId, {});
      setReceipt({ title, amount: r.amount, message: m.message, provider: t('البوابة التجريبية', 'Sandbox gateway') });
      refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiErr(e, lang) };
    } finally { setBusy(false); }
  };

  return (
    <PayCtx.Provider value={{ pay, busy }}>
      {children}
      {busy && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/60 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="panel px-6 py-5 flex items-center gap-3 text-[15px]"><Loader2 className="h-5 w-5 animate-spin text-primary" />{t('جاري تنفيذ الدفع…', 'Processing payment…')}</div>
        </div>
      )}
      <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) setReceipt(null); }}>
        <DialogContent className="rounded-[20px] max-w-sm text-center">
          <DialogHeader className="items-center text-center">
            <span className="mx-auto mb-2 h-12 w-12 rounded-full bg-accent text-primary grid place-items-center"><CheckCircle2 className="h-6 w-6" /></span>
            <DialogTitle className="text-center">{receipt?.title}</DialogTitle>
            <DialogDescription>{receipt?.message}</DialogDescription>
          </DialogHeader>
          {receipt && receipt.amount > 0 && <Money v={receipt.amount} exact className="block font-display text-[30px] font-semibold" />}
          <p className="text-[14px] text-muted-foreground">{receipt?.message}</p>
          <div className="flex items-center justify-center gap-1.5 text-[12.5px] text-muted-foreground"><ShieldCheck className="h-4 w-4" />{receipt?.provider}</div>
          <Button className="rounded-xl h-11 mt-2" onClick={() => setReceipt(null)} data-testid="button-receipt-done">{t('تمام', 'Done')}</Button>
        </DialogContent>
      </Dialog>
    </PayCtx.Provider>
  );
}

/** Small line that says which gateway will take the payment. */
export function GatewayNote({ provider }: { provider: string }) {
  const { t } = useLang();
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-[13.5px] text-muted-foreground">
      <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
      {provider === 'stripe'
        ? t('الدفع عن طريق Stripe بوضع الاختبار. بتنتقل لصفحة Stripe الآمنة، واستخدم بطاقة الاختبار 4242 4242 4242 4242.', 'Paid through Stripe in test mode. You will go to Stripe\'s secure page; use the test card 4242 4242 4242 4242.')
        : t('الدفع عن طريق البوابة التجريبية، ما ينخصم أي مبلغ حقيقي.', 'Paid through the sandbox gateway; no real money moves.')}
    </div>
  );
}
