import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard, CheckCircle2, Clock, XCircle, Plus, Link2, Ban, CalendarClock, HandCoins } from 'lucide-react';
import { useCreateInvoice, useVoidInvoice, getGetClubStateQueryKey, type Session, type Invoice } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, dateLabel, validAmount } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ErrorBox } from '@/components/shell';
import { Chip, SectionTitle } from '@/components/kit';
import { usePay } from '@/components/pay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const invoiceLink = (i: Invoice) => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/invoice/${i.id}/${i.token}`;

/** Money in (sponsor invoices), money owed (installments) and money out (gateway payments) in one place. */
export default function Payments({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { pay, busy } = usePay();
  const [newInv, setNewInv] = useState(false);
  const [f, setF] = useState({ sponsor: '', description: '', amount: '', due: '' });
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() });
  const create = useCreateInvoice({ mutation: {
    onSuccess: (m) => { setNewInv(false); refresh(); toast({ title: t('انسوت الفاتورة', 'Invoice created'), description: lang === 'ar' ? m.message : undefined }); },
    onError: (e) => setErr(apiErr(e, lang).msg) } });
  const voidInv = useVoidInvoice({ mutation: { onSuccess: () => refresh(), onError: (e) => toast({ variant: 'destructive', title: apiErr(e, lang).msg }) } });
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const paidOut = s.payments.filter((p) => p.status === 'paid' && p.kind !== 'invoice').reduce((a, p) => a + Math.round(p.amount * 1000), 0) / 1000;
  const scheduled = s.installments.filter((i) => i.status === 'scheduled');
  const owed = scheduled.reduce((a, i) => a + Math.round(i.amount * 1000), 0) / 1000;
  const status = (st: string) => st === 'paid'
    ? { tone: 'good' as const, icon: CheckCircle2, label: t('مدفوعة', 'Paid') }
    : st === 'pending' || st === 'open' ? { tone: 'warn' as const, icon: Clock, label: st === 'open' ? t('بانتظار الراعي', 'Awaiting sponsor') : t('بانتظار الدفع', 'Awaiting payment') }
    : { tone: 'neutral' as const, icon: XCircle, label: st === 'failed' ? t('فشلت', 'Failed') : t('ملغاة', 'Cancelled') };
  const copy = async (i: Invoice) => {
    try { await navigator.clipboard.writeText(invoiceLink(i)); toast({ title: t('انسخ رابط الدفع', 'Payment link copied') }); }
    catch { window.prompt(t('انسخ الرابط', 'Copy the link'), invoiceLink(i)); }
  };
  const payInstallment = async (id: string) => {
    const r = await pay({ kind: 'installment', installmentId: id }, t('انصرف القسط', 'Installment paid'));
    if (!r.ok && r.error) toast({ variant: 'destructive', title: t('ما انصرف القسط', 'Installment not paid'), description: r.error.msg });
  };
  const fValid = f.sponsor.trim().length >= 2 && f.description.trim().length >= 2 && validAmount(f.amount) && /^\d{4}-\d{2}-\d{2}$/.test(f.due);

  return (
    <div>
      <PageHead title={t('المدفوعات', 'Payments')} action={isManager ? (
        <Button className="rounded-xl h-11" onClick={() => { setErr(null); setF({ sponsor: '', description: '', amount: '', due: s.today.slice(0, 10) }); setNewInv(true); }} data-testid="button-new-invoice">
          <Plus className="h-4 w-4" />{t('فاتورة راعي', 'Sponsor invoice')}
        </Button>) : undefined} />

      <div className="panel grid grid-cols-2 lg:grid-cols-4 overflow-hidden mb-6 [&>*]:border-border max-lg:[&>*:nth-child(odd)]:border-e max-lg:[&>*:nth-child(-n+2)]:border-b lg:[&>*:not(:last-child)]:border-e">
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('دخل من الرعاة', 'Sponsor income')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold text-primary"><Money v={s.income} /></div></div>
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('مدفوع عبر البوابة', 'Paid via gateway')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold"><Money v={paidOut} /></div></div>
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('أقساط قادمة', 'Installments due')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold"><Money v={owed} /></div></div>
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('بوابة الدفع', 'Gateway')}</div><div className="mt-1 text-[15px] font-semibold flex items-center gap-2" data-testid="text-gateway"><CreditCard className="h-4 w-4 text-primary" />{s.gateway === 'stripe' ? t('Stripe (اختبار)', 'Stripe (test)') : t('تجريبية', 'Sandbox')}</div></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 items-start mb-6">
        <section className="panel p-5 md:p-6" data-testid="card-invoices">
          <SectionTitle aside={t(`${s.invoices.filter((i) => i.status === 'open').length} مفتوحة`, `${s.invoices.filter((i) => i.status === 'open').length} open`)}>{t('فواتير الرعاة', 'Sponsor invoices')}</SectionTitle>
          {s.invoices.length === 0 ? (
            <div className="text-[14px] text-muted-foreground flex items-start gap-3"><HandCoins className="h-5 w-5 shrink-0 text-primary" />{t('سوّ فاتورة لراعي وأرسل له رابط الدفع. أول ما يدفع، المبلغ يضاف لميزانية النادي.', 'Create an invoice and send the sponsor its payment link. Once paid, the money is added to the club budget.')}</div>
          ) : (
            <ul className="divide-y divide-border -my-1">
              {s.invoices.map((i) => {
                const st = status(i.status);
                return (
                  <li key={i.id} className="py-3.5 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid={`row-invoice-${i.id}`}>
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold">{i.sponsor}</div>
                      <div className="text-[13px] text-muted-foreground">{i.description}، {t('الاستحقاق ', 'due ')}{dateLabel(i.due, lang)}</div>
                    </div>
                    <Money v={i.amount} raw className="font-display font-semibold" />
                    <Chip tone={st.tone}><st.icon className="h-3.5 w-3.5 me-1" />{st.label}</Chip>
                    {isManager && i.status === 'open' && (
                      <span className="flex gap-1 w-full sm:w-auto">
                        <Button size="sm" variant="outline" className="rounded-lg h-9 flex-1 sm:flex-none bg-card" onClick={() => copy(i)} data-testid={`button-copy-${i.id}`}><Link2 className="h-4 w-4" />{t('نسخ الرابط', 'Copy link')}</Button>
                        <Button size="sm" variant="ghost" className="rounded-lg h-9 text-muted-foreground" onClick={() => voidInv.mutate({ id: i.id, data: {} })} aria-label={t('إلغاء الفاتورة', 'Void invoice')}><Ban className="h-4 w-4" /></Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel p-5 md:p-6" data-testid="card-installments">
          <SectionTitle aside={scheduled.length ? t(`${scheduled.length} قسط`, `${scheduled.length} due`) : undefined}>{t('أقساط الانتقالات', 'Transfer installments')}</SectionTitle>
          {s.installments.length === 0 ? (
            <div className="text-[14px] text-muted-foreground flex items-start gap-3"><CalendarClock className="h-5 w-5 shrink-0 text-primary" />{t('لما تتعاقد مع لاعب بالتقسيط من سوق الانتقالات، أقساطه تطلع هني.', 'Sign a player in installments from the transfer market and the schedule appears here.')}</div>
          ) : (
            <ul className="divide-y divide-border -my-1">
              {s.installments.map((i) => (
                <li key={i.id} className="py-3.5 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid={`row-installment-${i.id}`}>
                  <span className={cn('h-9 w-9 rounded-full grid place-items-center shrink-0 text-[12px] font-bold num', i.status === 'paid' ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}>{i.n}/{i.of}</span>
                  <div className="flex-1 min-w-[140px]">
                    <div className="font-semibold">{lang === 'ar' ? i.playerName : i.playerNameEn}</div>
                    <div className="text-[13px] text-muted-foreground">{i.status === 'paid' ? t('انصرف ', 'Paid ') + dateLabel(i.paidAt ?? i.due, lang) : t('يستحق ', 'Due ') + dateLabel(i.due, lang)}</div>
                  </div>
                  <Money v={i.amount} raw className="font-display font-semibold" />
                  {isManager && i.status === 'scheduled' && (
                    <Button size="sm" className="rounded-lg h-9 w-full sm:w-auto" disabled={busy} onClick={() => payInstallment(i.id)} data-testid={`button-pay-installment-${i.id}`}>{t('ادفع القسط', 'Pay')}</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <SectionTitle>{t('سجل الدفعات', 'Payment history')}</SectionTitle>
      {s.payments.length === 0 ? (
        <div className="panel p-10 text-center text-muted-foreground"><CreditCard className="h-5 w-5 mx-auto mb-2" />{t('ما في دفعات للحين.', 'No payments yet.')}</div>
      ) : (
        <ul className="panel divide-y divide-border overflow-hidden">
          {s.payments.map((p) => {
            const st = status(p.status);
            const inbound = p.kind === 'invoice';
            return (
              <li key={p.id} className="p-4 md:px-5 flex flex-wrap items-center gap-x-4 gap-y-1.5" data-testid={`row-payment-${p.id}`}>
                <span className={cn('h-10 w-10 rounded-full grid place-items-center shrink-0', inbound ? 'bg-accent text-primary' : 'bg-muted text-foreground')}>{inbound ? <HandCoins className="h-[18px] w-[18px]" /> : <CreditCard className="h-[18px] w-[18px]" />}</span>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold">{lang === 'ar' ? p.description : p.descriptionEn}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {dateLabel(p.paidAt ?? p.createdAt, lang)}، {p.provider === 'stripe' ? 'Stripe' : t('تجريبية', 'Sandbox')}
                    {p.chargeCurrency !== 'KWD' && <>، <span className="num">{p.chargeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.chargeCurrency}</span></>}
                  </div>
                </div>
                <Chip tone={st.tone}><st.icon className="h-3.5 w-3.5 me-1" />{st.label}</Chip>
                <span className={cn('font-display font-semibold text-[16px]', inbound && p.status === 'paid' && 'text-primary')}>{inbound ? '+' : ''}<Money v={p.amount} raw /></span>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={newInv} onOpenChange={setNewInv}>
        <DialogContent className="rounded-[20px] max-w-md">
          <DialogHeader>
            <DialogTitle>{t('فاتورة راعي', 'Sponsor invoice')}</DialogTitle>
            <DialogDescription>{t('الراعي يدفع من رابط، والمبلغ يضاف للاحتياطي', 'The sponsor pays from a link; the amount goes to the reserve')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-[14px] font-medium">{t('اسم الراعي', 'Sponsor')}<Input value={f.sponsor} onChange={(e) => setF({ ...f, sponsor: e.target.value })} className="h-11 rounded-xl" placeholder={t('مثال: شركة الخليج للاتصالات', 'e.g. Gulf Telecom')} data-testid="input-sponsor" /></label>
            <label className="grid gap-1.5 text-[14px] font-medium">{t('الوصف', 'Description')}<Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="h-11 rounded-xl" placeholder={t('مثال: رعاية قميص الموسم', 'e.g. Shirt sponsorship')} data-testid="input-invoice-desc" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-[14px] font-medium">{t('المبلغ (د.ك)', 'Amount (KWD)')}<Input inputMode="decimal" dir="ltr" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="h-11 rounded-xl num" data-testid="input-invoice-amount" /></label>
              <label className="grid gap-1.5 text-[14px] font-medium">{t('الاستحقاق', 'Due')}<Input type="date" dir="ltr" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} className="h-11 rounded-xl" data-testid="input-invoice-due" /></label>
            </div>
          </div>
          {err && <ErrorBox msg={err} />}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="rounded-xl h-11" onClick={() => setNewInv(false)}>{t('إلغاء', 'Cancel')}</Button>
            <Button className="rounded-xl h-11" disabled={!fValid || create.isPending} onClick={() => create.mutate({ data: { sponsor: f.sponsor.trim(), description: f.description.trim(), amount: Number(f.amount), due: f.due } })} data-testid="button-create-invoice">
              {create.isPending ? t('جاري الحفظ…', 'Saving…') : t('سوّ الفاتورة', 'Create invoice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
