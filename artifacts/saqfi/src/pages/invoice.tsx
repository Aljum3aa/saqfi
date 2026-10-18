import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, CreditCard } from 'lucide-react';
import { getPublicInvoice, checkoutPublicInvoice, confirmPublicInvoice, type PublicInvoice } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, dateLabel } from '@/lib/saqfi';
import { Money, clubCrest, LangToggle } from '@/components/shell';
import { Button } from '@/components/ui/button';

/** Public page a sponsor opens from the club's link. No account: the link's token is the access. */
export default function InvoicePage({ id, token }: { id: string; token: string }) {
  const { t, lang } = useLang();
  const [inv, setInv] = useState<PublicInvoice | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const once = useRef(false);

  const load = () => getPublicInvoice(id, token).then(setInv).catch((e) => setErr(apiErr(e, lang).msg));
  useEffect(() => {
    if (once.current) return; once.current = true;
    const u = new URL(window.location.href);
    const payId = u.searchParams.get('pay');
    const sessionId = u.searchParams.get('session_id') ?? undefined;
    const cancelled = u.searchParams.has('cancelled');
    if (payId) window.history.replaceState(null, '', u.pathname);
    (async () => {
      if (payId && !cancelled) {
        setBusy(true);
        try { const m = await confirmPublicInvoice(id, { token, paymentId: payId, sessionId }); setDone(m.message); }
        catch (e) { setErr(apiErr(e, lang).msg); }
        finally { setBusy(false); }
      }
      await load();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const payNow = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await checkoutPublicInvoice(id, { token, returnUrl: window.location.origin + window.location.pathname });
      if (r.provider === 'stripe' && r.url) { window.location.assign(r.url); return; }
      const m = await confirmPublicInvoice(id, { token, paymentId: r.paymentId });
      setDone(m.message); await load();
    } catch (e) { setErr(apiErr(e, lang).msg); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4"><LangToggle /></div>
        <div className="panel overflow-hidden">
          <div className="hero rounded-none p-6">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 rounded-xl bg-white grid place-items-center"><img src={clubCrest()} alt="" className="h-8 w-8 object-contain" /></span>
              <div>
                <div className="font-display font-semibold text-[17px]">{inv ? t(inv.club, inv.clubEn) : '…'}</div>
                <div className="text-[13px] text-white/60">{t('فاتورة رعاية', 'Sponsorship invoice')}</div>
              </div>
            </div>
            {inv && <Money v={inv.amount} raw className="block mt-6 font-display text-[40px] font-semibold leading-none [&_.text-muted-foreground]:text-white/60" />}
          </div>
          <div className="p-6 space-y-4">
            {!inv && !err && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('جاري التحميل…', 'Loading…')}</div>}
            {inv && (
              <dl className="space-y-2.5 text-[15px]">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('إلى', 'To')}</dt><dd className="font-semibold text-end">{inv.sponsor}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('البيان', 'For')}</dt><dd className="text-end">{inv.description}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('الاستحقاق', 'Due')}</dt><dd className="text-end">{dateLabel(inv.due, lang)}</dd></div>
              </dl>
            )}
            {(done || inv?.status === 'paid') && (
              <div className="flex items-center gap-3 rounded-xl bg-accent/70 p-4" data-testid="text-invoice-paid">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span>{done ?? t('الفاتورة مدفوعة، شكراً لكم', 'This invoice is paid. Thank you.')}</span>
              </div>
            )}
            {inv?.status === 'void' && <div className="rounded-xl bg-muted p-4 text-muted-foreground">{t('الفاتورة ملغاة من النادي.', 'The club has voided this invoice.')}</div>}
            {err && <div className="rounded-xl border border-destructive/30 bg-destructive/[.05] p-3 text-destructive" role="alert">{err}</div>}
            {inv?.status === 'open' && !done && (
              <>
                <Button className="w-full rounded-xl h-12 text-[15px]" disabled={busy} onClick={payNow} data-testid="button-pay-invoice">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{t('ادفع الفاتورة', 'Pay invoice')}
                </Button>
                <div className="flex items-start gap-2 text-[13px] text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  {inv.gateway === 'stripe' ? t('الدفع آمن عن طريق Stripe (وضع الاختبار).', 'Secure payment by Stripe (test mode).') : t('دفع تجريبي، ما ينخصم أي مبلغ حقيقي.', 'Test payment; no real money moves.')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
