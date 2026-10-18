import { CreditCard, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { dateLabel } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel } from '@/components/shell';
import { Chip } from '@/components/kit';
import { cn } from '@/lib/utils';

/** Every payment that went through the gateway, with its status and gateway reference. */
export default function Payments({ session: _session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const paid = s.payments.filter((p) => p.status === 'paid');
  const total = paid.reduce((a, p) => a + Math.round(p.amount * 1000), 0) / 1000;
  const status = (st: string) => st === 'paid'
    ? { tone: 'good' as const, icon: CheckCircle2, label: t('مدفوعة', 'Paid') }
    : st === 'pending' ? { tone: 'warn' as const, icon: Clock, label: t('بانتظار الدفع', 'Awaiting payment') }
    : { tone: 'neutral' as const, icon: XCircle, label: st === 'failed' ? t('فشلت', 'Failed') : t('ملغاة', 'Cancelled') };

  return (
    <div>
      <PageHead title={t('المدفوعات', 'Payments')} />
      <div className="panel grid grid-cols-2 md:grid-cols-3 overflow-hidden mb-5 [&>*]:border-border max-md:[&>*:first-child]:border-e md:[&>*:not(:last-child)]:border-e">
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('مدفوع عبر البوابة', 'Paid via gateway')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold"><Money v={total} /></div></div>
        <div className="p-4 md:p-5"><div className="text-[13px] text-muted-foreground">{t('عدد الدفعات', 'Payments')}</div><div className="mt-1 text-[20px] md:text-[22px] font-semibold num font-display">{paid.length}</div></div>
        <div className="p-4 md:p-5 col-span-2 md:col-span-1 max-md:border-t"><div className="text-[13px] text-muted-foreground">{t('بوابة الدفع', 'Gateway')}</div><div className="mt-1 text-[16px] font-semibold flex items-center gap-2" data-testid="text-gateway"><CreditCard className="h-4 w-4 text-primary" />{s.gateway === 'stripe' ? t('Stripe (وضع الاختبار)', 'Stripe (test mode)') : t('بوابة تجريبية', 'Sandbox gateway')}</div></div>
      </div>
      {s.payments.length === 0 ? (
        <div className="panel p-10 text-center text-muted-foreground">
          <CreditCard className="h-5 w-5 mx-auto mb-2" />
          {t('ما في دفعات للحين. صرف الرواتب والتعاقد من سوق الانتقالات يندفعون من هني.', 'No payments yet. Payroll and transfer signings are paid through the gateway.')}
        </div>
      ) : (
        <ul className="panel divide-y divide-border overflow-hidden">
          {s.payments.map((p) => {
            const st = status(p.status);
            return (
              <li key={p.id} className="p-4 md:px-5 flex flex-wrap items-center gap-x-4 gap-y-1.5" data-testid={`row-payment-${p.id}`}>
                <span className={cn('h-10 w-10 rounded-full grid place-items-center shrink-0', p.kind === 'payroll' ? 'bg-accent text-primary' : 'bg-cap/15 text-[hsl(42_60%_30%)]')}><CreditCard className="h-[18px] w-[18px]" /></span>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold">{lang === 'ar' ? p.description : p.descriptionEn}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {dateLabel(p.paidAt ?? p.createdAt, lang)}، {p.provider === 'stripe' ? 'Stripe' : t('تجريبية', 'Sandbox')}
                    {p.chargeCurrency !== 'KWD' && <>، <span className="num">{p.chargeAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.chargeCurrency}</span></>}
                    {p.reference && <>، <span className="num">{p.reference.slice(0, 18)}</span></>}
                  </div>
                </div>
                <Chip tone={st.tone}><st.icon className="h-3.5 w-3.5 me-1" />{st.label}</Chip>
                <Money v={p.amount} raw className="font-display font-semibold text-[16px]" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
