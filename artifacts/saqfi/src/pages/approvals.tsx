import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Check, X, Pencil, Clock3 } from 'lucide-react';
import {
  useDecideRequest, useSaveApprovalThreshold, getGetClubStateQueryKey, type Session, type ApprovalRequest, type ClubState,
} from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, dateLabel, DEC3, kwdInput, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ErrorBox, KV } from '@/components/shell';
import { Chip, SectionTitle } from '@/components/kit';
import { Field } from '@/pages/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const foreignLabel = (x: { currency?: string; originalAmount?: number }) =>
  x.currency && x.originalAmount ? `${x.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${x.currency}` : '';

export default function Approvals({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const [deciding, setDeciding] = useState<{ r: ApprovalRequest; approve: boolean } | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isPresident = session.role === 'president';
  const cat = (id: string) => s.categories.find((c) => c.id === id);
  const pending = s.requests.filter((r) => r.status === 'pending');
  const done = s.requests.filter((r) => r.status !== 'pending');

  return (
    <div>
      <PageHead title={t('الموافقات', 'Approvals')}
        sub={isPresident
          ? t('المصاريف الكبيرة أو اللي تتعدى سقف البند تنتظر قرارك. إذا وافقت والبند ما يكفي، ينتقل الفرق من الاحتياطي.', 'Large or over-cap expenses wait for your decision. If you approve and the category is short, the difference moves from the reserve.')
          : t('أي مصروف فوق حد الموافقة، أو يتعدى سقف البند، يروح لرئيس النادي قبل لا ينسجل.', 'Any expense above the approval limit, or over a category cap, goes to the club president before it is recorded.')} />

      <section className="panel p-5 md:p-6 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="card-threshold">
        <span className="h-11 w-11 rounded-full bg-accent text-primary grid place-items-center shrink-0"><ShieldCheck className="h-5 w-5" /></span>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[13px] text-muted-foreground">{t('حد موافقة الرئيس', 'President approval limit')}</div>
          <div className="font-semibold">{t('أي مصروف من ', 'Any expense from ')}<Money v={s.approvalThreshold} className="font-display text-[20px]" />{t(' وفوق', ' and up')}</div>
        </div>
        {isPresident && <Button variant="ghost" className="rounded-full h-11" onClick={() => setLimitOpen(true)} data-testid="button-edit-threshold"><Pencil className="h-4 w-4" />{t('تعديل الحد', 'Change limit')}</Button>}
      </section>

      <SectionTitle aside={pending.length ? t(`${pending.length} بانتظار القرار`, `${pending.length} waiting`) : undefined}>{t('بانتظار القرار', 'Waiting for a decision')}</SectionTitle>
      {pending.length === 0 ? (
        <div className="panel p-8 text-center text-muted-foreground mb-8" data-testid="text-no-requests">{t('ما في طلبات تنتظر. كل شي محسوم.', 'Nothing is waiting. Everything is decided.')}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {pending.map((r) => {
            const c = cat(r.categoryId);
            const short = c ? Math.max(0, r.amount - c.remaining) : 0;
            const reserve = cat('reserve');
            return (
              <article key={r.id} className="panel p-5" data-testid={`card-request-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[17px]">{r.description}</div>
                    <div className="text-[13px] text-muted-foreground mt-0.5">{c ? t(c.name, c.nameEn) : r.categoryId}، <span className="num">{dateLabel(r.date, lang)}</span></div>
                  </div>
                  <Chip tone={r.reason === 'cap' ? 'bad' : 'gold'}>{r.reason === 'cap' ? t('يتعدى السقف', 'Over cap') : t('مبلغ كبير', 'Large amount')}</Chip>
                </div>
                <Money v={r.amount} exact className="block mt-4 font-display text-[30px] font-semibold tracking-tight" />
                {foreignLabel(r) && <div className="text-[13px] text-muted-foreground">{t('المبلغ الأصلي ', 'Original ')}<span className="num" dir="ltr">{foreignLabel(r)}</span></div>}
                {c && (
                  <div className={cn('mt-4 rounded-xl p-3.5 space-y-0.5 text-[14px]', short > 0 ? 'bg-warning/[.08]' : 'bg-muted/70')}>
                    <KV k={t('المتاح في البند', 'Available in category')} v={<Money v={c.remaining} exact />} />
                    {short > 0 && <KV k={t('بينتقل من الاحتياطي', 'Moves from reserve')} strong v={<Money v={short} exact />} />}
                    {short > 0 && reserve && <KV k={t('المتاح في الاحتياطي', 'Reserve available')} v={<Money v={reserve.remaining} exact className={reserve.remaining < short ? 'text-destructive' : ''} />} />}
                  </div>
                )}
                {isPresident ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="rounded-full h-11" onClick={() => setDeciding({ r, approve: false })} data-testid={`button-reject-${r.id}`}><X className="h-4 w-4" />{t('رفض', 'Reject')}</Button>
                    <Button className="rounded-full h-11" onClick={() => setDeciding({ r, approve: true })} data-testid={`button-approve-${r.id}`}><Check className="h-4 w-4" />{t('موافقة', 'Approve')}</Button>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 text-[14px] text-muted-foreground"><Clock3 className="h-4 w-4" />{t('بانتظار رئيس النادي', 'Waiting for the club president')}</div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <SectionTitle>{t('القرارات السابقة', 'Past decisions')}</SectionTitle>
      {done.length === 0 ? <div className="panel p-6 text-muted-foreground">{t('ما في قرارات للحين.', 'No decisions yet.')}</div> : (
        <ul className="panel overflow-hidden divide-y divide-border">
          {done.map((r) => (
            <li key={r.id} className="px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className={cn('h-9 w-9 rounded-full grid place-items-center shrink-0', r.status === 'approved' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                {r.status === 'approved' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-[160px]">
                <div className="font-semibold">{r.description}</div>
                <div className="text-[13px] text-muted-foreground">
                  {r.status === 'approved' ? t('وافق الرئيس', 'Approved') : t('رفض الرئيس', 'Rejected')} <span className="num">{r.decidedAt ? dateLabel(r.decidedAt, lang) : ''}</span>
                  {r.fromReserve ? <>{t('، ونقل من الاحتياطي ', ', moved from reserve ')}<Money v={r.fromReserve} exact /></> : null}
                  {r.note ? `، ${r.note}` : ''}
                </div>
              </div>
              <Money v={r.amount} exact className="font-display font-semibold" />
            </li>
          ))}
        </ul>
      )}

      {deciding && <DecisionDialog {...deciding} onClose={() => setDeciding(null)} />}
      {isPresident && <LimitDialog open={limitOpen} onOpenChange={setLimitOpen} s={s} />}
    </div>
  );
}

function DecisionDialog({ r, approve, onClose }: { r: ApprovalRequest; approve: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<ApiErr | null>(null);
  const decide = useDecideRequest({
    mutation: {
      onSuccess: (m) => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: lang === 'ar' ? m.message : approve ? 'Approved' : 'Rejected' }); onClose(); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-[20px]">
        <DialogHeader>
          <DialogTitle>{approve ? t('موافقة على الطلب', 'Approve request') : t('رفض الطلب', 'Reject request')}</DialogTitle>
          <DialogDescription>{r.description}، <Money v={r.amount} exact /></DialogDescription>
        </DialogHeader>
        <Field id="input-note" label={t('ملاحظة (اختياري)', 'Note (optional)')}><Input id="input-note" value={note} maxLength={250} onChange={(e) => setNote(e.target.value)} data-testid="input-decision-note" /></Field>
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('الموافقة', 'The approval')} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" className="rounded-full h-11 px-6" onClick={onClose}>{t('رجوع', 'Back')}</Button>
          <Button className={cn('rounded-full h-11 px-6', !approve && 'bg-destructive hover:bg-destructive/90')} disabled={decide.isPending} data-testid="button-confirm-decision"
            onClick={() => { setErr(null); decide.mutate({ id: r.id, data: { approve, note: note.trim() || undefined } }); }}>
            {approve ? t('تأكيد الموافقة', 'Confirm approval') : t('تأكيد الرفض', 'Confirm rejection')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LimitDialog({ open, onOpenChange, s }: { open: boolean; onOpenChange: (o: boolean) => void; s: ClubState }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [v, setV] = useState(kwdInput(s.approvalThreshold));
  const [err, setErr] = useState<ApiErr | null>(null);
  const save = useSaveApprovalThreshold({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم حفظ الحد', 'Limit saved') }); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px]">
        <DialogHeader>
          <DialogTitle>{t('حد موافقة الرئيس', 'President approval limit')}</DialogTitle>
          <DialogDescription>{t('أي مصروف بهالمبلغ أو أكثر ينتظر موافقتك. صفر يعني بدون حد.', 'Any expense of this amount or more waits for you. Zero means no limit.')}</DialogDescription>
        </DialogHeader>
        <Field id="input-threshold" label={t('الحد (د.ك)', 'Limit (KWD)')}><Input id="input-threshold" inputMode="decimal" className="num text-end" value={v} onChange={(e) => setV(e.target.value)} /></Field>
        {err && <ErrorBox msg={err.msg} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" className="rounded-full h-11 px-6" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button className="rounded-full h-11 px-6" disabled={!DEC3.test(v) || save.isPending} onClick={() => save.mutate({ data: { threshold: Number(v) } })}>{t('حفظ', 'Save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
