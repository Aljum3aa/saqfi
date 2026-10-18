import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Gavel, Pencil, X } from 'lucide-react';
import {
  useCreateMatch, useCreateAdjustment, useDeleteAdjustment, useSaveBonusRules, getGetClubStateQueryKey,
  type Session, type ClubState,
} from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, dateLabel, DEC3, validAmount, kwdInput, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox, KV } from '@/components/shell';
import { Avatar, StatStrip, Stat, Chip, SectionTitle } from '@/components/kit';
import { Field } from '@/pages/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const RESULT = {
  W: { ar: 'فوز', en: 'Win', tone: 'good' as const },
  D: { ar: 'تعادل', en: 'Draw', tone: 'neutral' as const },
  L: { ar: 'خسارة', en: 'Loss', tone: 'bad' as const },
};

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() });
}

export default function Bonuses({ session }: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const { toast } = useToast();
  const refresh = useRefresh();
  const [matchOpen, setMatchOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState<null | 'bonus' | 'fine'>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const del = useDeleteAdjustment({
    mutation: {
      onSuccess: () => { refresh(); toast({ title: t('تم الإلغاء', 'Cancelled') }); },
      onError: (e) => toast({ variant: 'destructive', title: apiErr(e, lang).msg }),
    },
  });
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  const player = (id: string) => s.contracts.find((c) => c.id === id);
  const pname = (id: string) => { const c = player(id); return c ? (lang === 'ar' ? c.name : c.nameEn) : id; };
  const pendingList = s.adjustments.filter((a) => !a.settledMonth);
  const manual = pendingList.filter((a) => !a.matchId);
  const byPlayer = [...pendingList.reduce((m, a) => {
    const g = m.get(a.playerId) ?? { id: a.playerId, bonus: 0, fine: 0, count: 0 };
    g[a.kind] += a.amount; g.count += 1;
    return m.set(a.playerId, g);
  }, new Map<string, { id: string; bonus: number; fine: number; count: number }>()).values()].sort((x, y) => (y.bonus - y.fine) - (x.bonus - x.fine));
  const record = s.matches.reduce((r, m) => ({ ...r, [m.result]: r[m.result] + 1 }), { W: 0, D: 0, L: 0 } as Record<'W' | 'D' | 'L', number>);

  return (
    <div>
      <PageHead title={t('المكافآت والغرامات', 'Bonuses & fines')}
        sub={t('سجّل نتيجة المباراة وتنحجز مكافأة كل لاعب من الميزانية على طول، وتنصرف مع الراتب الجاي.', 'Record a result and each player\'s bonus is reserved from the budget at once, then paid with the next salary.')}
        action={isManager ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="rounded-full h-12 px-5" onClick={() => setAdjOpen('fine')} data-testid="button-new-fine"><Gavel className="h-4 w-4" />{t('مكافأة أو غرامة', 'Bonus or fine')}</Button>
            <Button className="rounded-full h-12 px-6" onClick={() => setMatchOpen(true)} data-testid="button-new-match"><Plus className="h-4 w-4" />{t('تسجيل نتيجة', 'Record result')}</Button>
          </div>
        ) : <ReadOnlyNote />} />

      <StatStrip className="mb-5">
        <Stat label={t('مكافآت بتنصرف', 'Bonuses to pay')}><Money v={s.pendingBonuses} /></Stat>
        <Stat label={t('غرامات بتنخصم', 'Fines to deduct')}><Money v={s.pendingFines} /></Stat>
        <Stat label={t('نتائج الموسم', 'Season record')}>
          <span className="num">{record.W}</span><span className="text-[13px] text-muted-foreground font-sans"> {t('فوز', 'W')} </span>
          <span className="num">{record.D}</span><span className="text-[13px] text-muted-foreground font-sans"> {t('تعادل', 'D')} </span>
          <span className="num">{record.L}</span><span className="text-[13px] text-muted-foreground font-sans"> {t('خسارة', 'L')}</span>
        </Stat>
      </StatStrip>

      <section className="panel p-5 md:p-6 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="card-bonus-rules">
        <div>
          <div className="text-[13px] text-muted-foreground">{t('مكافأة الفوز لكل لاعب', 'Win bonus per player')}</div>
          <Money v={s.bonusRules.win} className="font-display text-[22px] font-semibold" />
        </div>
        <div>
          <div className="text-[13px] text-muted-foreground">{t('مكافأة التعادل لكل لاعب', 'Draw bonus per player')}</div>
          <Money v={s.bonusRules.draw} className="font-display text-[22px] font-semibold" />
        </div>
        <span className="flex-1" />
        {isManager && <Button variant="ghost" className="rounded-full h-11" onClick={() => setRulesOpen(true)} data-testid="button-edit-rules"><Pencil className="h-4 w-4" />{t('تعديل', 'Edit')}</Button>}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start">
        <section className="panel overflow-hidden">
          <div className="px-5 pt-5"><SectionTitle aside={t(`${s.matches.length} مباراة`, `${s.matches.length} matches`)}>{t('المباريات', 'Matches')}</SectionTitle></div>
          {s.matches.length === 0 ? (
            <p className="px-5 pb-6 text-muted-foreground">{t('ما في نتائج للحين. سجّل أول نتيجة وتنحسب المكافآت لحالها.', 'No results yet. Record the first and bonuses are worked out for you.')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {s.matches.map((m) => {
                const r = RESULT[m.result];
                return (
                  <li key={m.id} className="px-5 py-3.5 flex items-center gap-4" data-testid={`row-match-${m.id}`}>
                    <div className={cn('h-12 w-12 rounded-2xl grid place-items-center font-display font-semibold text-[17px] shrink-0 num',
                      m.result === 'W' ? 'bg-success/10 text-success' : m.result === 'L' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground')} dir="ltr">
                      {m.goalsFor}-{m.goalsAgainst}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{t('ضد ', 'vs ')}{lang === 'ar' ? m.opponent : m.opponentEn}</div>
                      <div className="text-[13px] text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="num">{dateLabel(m.date, lang)}</span>
                        <span>{m.home ? t('على أرضنا', 'Home') : t('خارج أرضنا', 'Away')}</span>
                        <Chip tone={r.tone}>{t(r.ar, r.en)}</Chip>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      {m.bonusTotal > 0 ? <Money v={m.bonusTotal} className="font-display font-semibold" /> : <span className="text-muted-foreground text-[14px]">{t('بدون مكافأة', 'No bonus')}</span>}
                      {m.bonusPlayers > 0 && <div className="text-[12px] text-muted-foreground">{m.bonusPlayers} {t('لاعب', 'players')}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="px-5 pt-5"><SectionTitle aside={t('مع الراتب الجاي', 'With the next salary')}>{t('بانتظار الصرف', 'Waiting for payroll')}</SectionTitle></div>
          {pendingList.length === 0 ? (
            <p className="px-5 pb-6 text-muted-foreground">{t('ما في مكافآت ولا غرامات معلقة.', 'No pending bonuses or fines.')}</p>
          ) : (
            <>
              {/* One row per player: match bonuses add up instead of repeating 18 times. */}
              <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
                {byPlayer.map((g) => (
                  <li key={g.id} className="px-5 py-3 flex items-center gap-3" data-testid={`row-pending-${g.id}`}>
                    <Avatar name={pname(g.id)} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-[15px]">{pname(g.id)}</div>
                      <div className="text-[13px] text-muted-foreground truncate">{g.count} {g.count === 1 ? t('بند', 'item') : t('بنود', 'items')}</div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {g.bonus > 0 && <span className="font-display font-semibold text-success whitespace-nowrap">+<Money v={g.bonus} exact /></span>}
                      {g.fine > 0 && <span className="font-display font-semibold text-destructive whitespace-nowrap">-<Money v={g.fine} exact /></span>}
                    </div>
                  </li>
                ))}
              </ul>
              {manual.length > 0 && (
                <div className="border-t border-border">
                  <div className="px-5 pt-4 pb-1 text-[14px] font-semibold">{t('مضافة يدوياً', 'Added by hand')}</div>
                  <ul className="divide-y divide-border">
                    {manual.map((a) => (
                      <li key={a.id} className="px-5 py-3 flex items-center gap-3" data-testid={`row-adj-${a.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-[15px]">{pname(a.playerId)}</div>
                          <div className="text-[13px] text-muted-foreground truncate">{a.reason}</div>
                        </div>
                        <span className={cn('font-display font-semibold whitespace-nowrap', a.kind === 'fine' ? 'text-destructive' : 'text-success')}>
                          {a.kind === 'fine' ? '-' : '+'}<Money v={a.amount} exact />
                        </span>
                        {isManager && (
                          <button onClick={() => del.mutate({ id: a.id })} disabled={del.isPending} aria-label={t('إلغاء', 'Cancel')} data-testid={`button-cancel-adj-${a.id}`}
                            className="h-10 w-10 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {isManager && <MatchDialog open={matchOpen} onOpenChange={setMatchOpen} s={s} />}
      {isManager && adjOpen && <AdjustmentDialog kind={adjOpen} onClose={() => setAdjOpen(null)} s={s} />}
      {isManager && <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} s={s} />}
    </div>
  );
}

function MatchDialog({ open, onOpenChange, s }: { open: boolean; onOpenChange: (o: boolean) => void; s: ClubState }) {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const refresh = useRefresh();
  const blank = () => ({ opponent: '', opponentEn: '', date: s.today.slice(0, 10), home: true, gf: '0', ga: '0', competition: t('الدوري', 'League') });
  const [f, setF] = useState(blank);
  const [squad, setSquad] = useState<string[]>(() => s.contracts.slice(0, 18).map((c) => c.id));
  const [err, setErr] = useState<ApiErr | null>(null);
  const create = useCreateMatch({
    mutation: {
      onSuccess: (m) => { refresh(); toast({ title: t('انسجلت النتيجة', 'Result recorded'), description: lang === 'ar' ? m.message : undefined }); setF(blank()); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const gf = Number(f.gf), ga = Number(f.ga);
  const goalsOk = /^\d{1,2}$/.test(f.gf) && /^\d{1,2}$/.test(f.ga);
  const result = !goalsOk ? null : gf > ga ? 'W' : gf === ga ? 'D' : 'L';
  const per = result === 'W' ? s.bonusRules.win : result === 'D' ? s.bonusRules.draw : 0;
  const total = per * squad.length;
  const players = s.categories.find((c) => c.id === 'players');
  const over = !!players && total > players.remaining;
  const ok = f.opponent.trim().length >= 2 && goalsOk && !!f.date;
  const toggle = (id: string) => setSquad((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  return (
    <Dialog open={open} onOpenChange={(o) => { setErr(null); onOpenChange(o); }}>
      <DialogContent className="rounded-[20px] max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('تسجيل نتيجة مباراة', 'Record a match result')}</DialogTitle>
          <DialogDescription>{t('المكافأة تنحجز من بند رواتب اللاعبين، وتنرفض إذا تتعدى السقف.', 'Bonuses are reserved from player salaries and rejected if they break the cap.')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field id="input-opp" label={t('الخصم', 'Opponent')}><Input id="input-opp" value={f.opponent} onChange={(e) => setF({ ...f, opponent: e.target.value })} data-testid="input-opponent" placeholder={t('مثلاً: نادي النجوم', 'e.g. Al-Nujoom')} /></Field>
          <Field id="input-opp-en" label={t('الخصم بالإنجليزي', 'Opponent (English)')}><Input id="input-opp-en" dir="ltr" value={f.opponentEn} onChange={(e) => setF({ ...f, opponentEn: e.target.value })} /></Field>
          <Field id="input-match-date" label={t('التاريخ', 'Date')}><Input id="input-match-date" type="date" className="num" min={s.seasonStart} max={s.today.slice(0, 10)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field id="select-venue" label={t('الملعب', 'Venue')}>
            <Select value={f.home ? 'home' : 'away'} onValueChange={(v) => setF({ ...f, home: v === 'home' })}>
              <SelectTrigger id="select-venue"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="home">{t('على أرضنا', 'Home')}</SelectItem><SelectItem value="away">{t('خارج أرضنا', 'Away')}</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field id="input-gf" label={t('أهدافنا', 'Our goals')}><Input id="input-gf" inputMode="numeric" className="num text-center text-lg" value={f.gf} onChange={(e) => setF({ ...f, gf: e.target.value })} data-testid="input-gf" /></Field>
          <Field id="input-ga" label={t('أهدافهم', 'Their goals')}><Input id="input-ga" inputMode="numeric" className="num text-center text-lg" value={f.ga} onChange={(e) => setF({ ...f, ga: e.target.value })} data-testid="input-ga" /></Field>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[15px]">{t('قائمة المباراة', 'Match-day squad')} <span className="num text-muted-foreground">({squad.length})</span></span>
            <button className="text-primary text-[14px] font-semibold min-h-10 px-2" onClick={() => setSquad(squad.length === s.contracts.length ? [] : s.contracts.map((c) => c.id))}>
              {squad.length === s.contracts.length ? t('شيل الكل', 'Clear all') : t('اختر الكل', 'Select all')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto rounded-xl border border-border p-2">
            {s.contracts.map((c) => (
              <label key={c.id} className="flex items-center gap-2 min-h-10 px-2 rounded-lg hover:bg-muted cursor-pointer text-[14px]">
                <Checkbox checked={squad.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                <span className="truncate">{lang === 'ar' ? c.name : c.nameEn}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={cn('rounded-xl p-4 space-y-1', over ? 'bg-destructive/[.06]' : 'bg-muted/70')} data-testid="card-match-preview">
          <KV k={t('النتيجة', 'Result')} v={result ? <Chip tone={RESULT[result].tone}>{t(RESULT[result].ar, RESULT[result].en)}</Chip> : '-'} />
          <KV k={t('لكل لاعب', 'Per player')} v={<Money v={per} />} />
          <KV k={t('مجموع المكافآت', 'Total bonuses')} strong v={<Money v={total} />} />
          {players && <KV k={t('المتاح في بند الرواتب', 'Available for salaries')} v={<Money v={players.remaining} />} />}
          {over && <div className="text-destructive pt-1">{t('المكافآت أكبر من المتاح، بتنرفض.', 'Bonuses exceed what is available; this will be rejected.')}</div>}
        </div>
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={t('تسجيل النتيجة', 'The result')} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" className="rounded-full h-11 px-6" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button className="rounded-full h-11 px-6" disabled={!ok || create.isPending} data-testid="button-submit-match"
            onClick={() => { setErr(null); create.mutate({ data: { date: f.date, opponent: f.opponent.trim(), opponentEn: f.opponentEn.trim(), home: f.home, goalsFor: gf, goalsAgainst: ga, competition: f.competition, playerIds: squad } }); }}>
            {create.isPending ? t('جاري الحفظ…', 'Saving…') : t('حفظ النتيجة', 'Save result')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDialog({ kind: initial, onClose, s }: { kind: 'bonus' | 'fine'; onClose: () => void; s: ClubState }) {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const refresh = useRefresh();
  const [f, setF] = useState({ kind: initial, playerId: s.contracts[0]?.id ?? '', amount: '', reason: '', date: s.today.slice(0, 10) });
  const [err, setErr] = useState<ApiErr | null>(null);
  const create = useCreateAdjustment({
    mutation: {
      onSuccess: (m) => { refresh(); toast({ title: lang === 'ar' ? m.message : f.kind === 'bonus' ? 'Bonus recorded' : 'Fine recorded' }); onClose(); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const c = s.contracts.find((x) => x.id === f.playerId);
  const limit = c ? c.salary / 2 - c.pendingFine : 0;
  const amt = validAmount(f.amount) ? Number(f.amount) : 0;
  const tooBig = f.kind === 'fine' && amt > limit;
  const ok = !!c && amt > 0 && f.reason.trim().length >= 2 && !tooBig;
  const presets = useMemo(() => f.kind === 'fine'
    ? [t('تأخر عن التدريب', 'Late for training'), t('غياب بدون عذر', 'Unexcused absence'), t('بطاقة حمراء', 'Red card')]
    : [t('هدف الجولة', 'Goal of the round'), t('أفضل لاعب في المباراة', 'Man of the match'), t('مكافأة تأهل', 'Qualification bonus')], [f.kind, t]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-[20px]">
        <DialogHeader>
          <DialogTitle>{f.kind === 'fine' ? t('تسجيل غرامة', 'Record a fine') : t('تسجيل مكافأة', 'Record a bonus')}</DialogTitle>
          <DialogDescription>{f.kind === 'fine' ? t('تنخصم من الراتب الجاي. الغرامات المعلقة ما تتعدى نص راتب اللاعب.', 'Deducted from the next salary. Pending fines may not exceed half the salary.') : t('تنحجز من بند الرواتب وتنصرف مع الراتب الجاي.', 'Reserved from salaries and paid with the next salary.')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          {(['bonus', 'fine'] as const).map((k) => (
            <button key={k} onClick={() => setF({ ...f, kind: k })} data-testid={`button-kind-${k}`}
              className={cn('min-h-10 rounded-full text-[15px] font-semibold transition', f.kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
              {k === 'bonus' ? t('مكافأة', 'Bonus') : t('غرامة', 'Fine')}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Field id="select-adj-player" label={t('اللاعب', 'Player')}>
            <Select value={f.playerId} onValueChange={(v) => setF({ ...f, playerId: v })}>
              <SelectTrigger id="select-adj-player" data-testid="select-adj-player"><SelectValue /></SelectTrigger>
              <SelectContent>{s.contracts.map((x) => <SelectItem key={x.id} value={x.id}>{lang === 'ar' ? x.name : x.nameEn}</SelectItem>)}</SelectContent>
            </Select>
          </Field></div>
          <Field id="input-adj-amount" label={t('المبلغ (د.ك)', 'Amount (KWD)')}><Input id="input-adj-amount" inputMode="decimal" className="num text-end" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} data-testid="input-adj-amount" aria-invalid={f.amount !== '' && !DEC3.test(f.amount)} /></Field>
          <Field id="input-adj-date" label={t('التاريخ', 'Date')}><Input id="input-adj-date" type="date" className="num" min={s.seasonStart} max={s.today.slice(0, 10)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field id="input-adj-reason" label={t('السبب', 'Reason')}><Input id="input-adj-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} data-testid="input-adj-reason" /></Field>
            <div className="flex flex-wrap gap-2 mt-2">{presets.map((p) => <button key={p} onClick={() => setF({ ...f, reason: p })} className="min-h-9 rounded-full border border-border px-3 text-[13px] hover:bg-muted">{p}</button>)}</div>
          </div>
        </div>
        {c && f.kind === 'fine' && (
          <div className={cn('rounded-xl p-4 space-y-1', tooBig ? 'bg-destructive/[.06]' : 'bg-muted/70')}>
            <KV k={t('الراتب الشهري', 'Monthly salary')} v={<Money v={c.salary} exact />} />
            <KV k={t('غرامات معلقة عليه', 'Already pending')} v={<Money v={c.pendingFine} exact />} />
            <KV k={t('أقصى غرامة الحين', 'Most you can fine now')} strong v={<Money v={Math.max(0, limit)} exact />} />
          </div>
        )}
        {err && <ErrorBox msg={err.msg} exceeded={err.exceeded} op={f.kind === 'fine' ? t('الغرامة', 'The fine') : t('المكافأة', 'The bonus')} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" className="rounded-full h-11 px-6" onClick={onClose}>{t('إلغاء', 'Cancel')}</Button>
          <Button className="rounded-full h-11 px-6" disabled={!ok || create.isPending} data-testid="button-submit-adj"
            onClick={() => { setErr(null); create.mutate({ data: { playerId: f.playerId, kind: f.kind, amount: amt, reason: f.reason.trim(), date: f.date } }); }}>
            {create.isPending ? t('جاري الحفظ…', 'Saving…') : t('حفظ', 'Save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RulesDialog({ open, onOpenChange, s }: { open: boolean; onOpenChange: (o: boolean) => void; s: ClubState }) {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const refresh = useRefresh();
  const [win, setWin] = useState(kwdInput(s.bonusRules.win));
  const [draw, setDraw] = useState(kwdInput(s.bonusRules.draw));
  const [err, setErr] = useState<ApiErr | null>(null);
  const save = useSaveBonusRules({
    mutation: {
      onSuccess: () => { refresh(); toast({ title: t('تم حفظ المكافآت', 'Bonuses saved') }); onOpenChange(false); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const ok = DEC3.test(win) && DEC3.test(draw);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px]">
        <DialogHeader>
          <DialogTitle>{t('مكافآت النتائج', 'Result bonuses')}</DialogTitle>
          <DialogDescription>{t('تنطبق على المباريات اللي تسجلها من الحين.', 'Applies to results you record from now on.')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field id="input-win" label={t('الفوز (د.ك)', 'Win (KWD)')}><Input id="input-win" inputMode="decimal" className="num text-end" value={win} onChange={(e) => setWin(e.target.value)} /></Field>
          <Field id="input-draw" label={t('التعادل (د.ك)', 'Draw (KWD)')}><Input id="input-draw" inputMode="decimal" className="num text-end" value={draw} onChange={(e) => setDraw(e.target.value)} /></Field>
        </div>
        {err && <ErrorBox msg={err.msg} />}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" className="rounded-full h-11 px-6" onClick={() => onOpenChange(false)}>{t('إلغاء', 'Cancel')}</Button>
          <Button className="rounded-full h-11 px-6" disabled={!ok || save.isPending} onClick={() => save.mutate({ data: { win: Number(win), draw: Number(draw) } })}>{t('حفظ', 'Save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


