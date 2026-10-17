import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, X } from 'lucide-react';
import { useSaveBudget, getGetClubStateQueryKey, type Session, type ClubState } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr, DEC3, kwd, type ApiErr } from '@/lib/saqfi';
import { useClub, PageHead, Money, PageSkeleton, ErrorPanel, ReadOnlyNote, ErrorBox } from '@/components/shell';
import { Legend, StackBar } from '@/components/category-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const fils = (s: string) => Math.round(Number(s) * 1000);

export default function Budget({ session }: { session: Session }) {
  const { t } = useLang();
  const q = useClub();
  const [editing, setEditing] = useState(false);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const s = q.data;
  const isManager = session.role === 'manager';
  return (
    <div>
      <PageHead
        eyebrow={t('الميزانية', 'Budget')}
        title={t('توزيع سقف الموسم', 'Season cap allocation')}
        sub={t('خمسة بنود ثابتة. مجموع سقوفها يساوي سقف الموسم دائماً، ولا يمكن خفض أي بند تحت ما صُرف وحُجز منه.', 'Five fixed categories. Their caps always sum to the season cap, and none can drop below what is spent plus reserved.')}
        action={isManager ? (!editing && <Button data-testid="button-edit-budget" onClick={() => setEditing(true)} className="gap-2"><Pencil className="h-4 w-4" />{t('تعديل التوزيع', 'Edit allocation')}</Button>) : <ReadOnlyNote />}
      />
      {editing && isManager ? <BudgetEditor s={s} onDone={() => setEditing(false)} /> : <BudgetTable s={s} />}
    </div>
  );
}

function BudgetTable({ s }: { s: ClubState }) {
  const { t } = useLang();
  return (
    <div className="panel overflow-hidden rise">
      <div className="p-4 border-b border-border flex flex-wrap justify-between gap-2"><Legend /><span className="text-xs text-muted-foreground">{t('سقف الموسم ', 'Season cap ')}<Money v={s.totalBudget} className="text-foreground" /></span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-[11px] text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-start font-medium p-3">{t('البند', 'Category')}</th>
              <th className="text-end font-medium p-3">{t('السقف', 'Cap')}</th>
              <th className="text-end font-medium p-3">{t('مصروف', 'Spent')}</th>
              <th className="text-end font-medium p-3">{t('محجوز', 'Reserved')}</th>
              <th className="text-end font-medium p-3">{t('متاح فعلاً', 'Available')}</th>
              <th className="p-3 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {s.categories.map((c) => (
              <tr key={c.id} className="border-b border-border/60 hover:bg-accent/30" data-testid={`row-budget-${c.id}`}>
                <td className="p-3"><div className="font-medium">{t(c.name, c.nameEn)}</div><div className="num text-[10px] text-muted-foreground">{c.id}</div></td>
                <td className="p-3 text-end num">{kwd(c.cap)}</td>
                <td className="p-3 text-end num">{kwd(c.spent)}</td>
                <td className="p-3 text-end num text-primary/80">{kwd(c.committed)}</td>
                <td className={cn('p-3 text-end num font-semibold', c.remaining <= 0 ? 'text-destructive' : 'text-primary')}>{kwd(c.remaining)}</td>
                <td className="p-3"><StackBar cap={c.cap} spent={c.spent} committed={c.committed} /></td>
              </tr>
            ))}
            <tr className="bg-accent/20 font-semibold">
              <td className="p-3">{t('الإجمالي', 'Total')}</td>
              <td className="p-3 text-end num">{kwd(s.totalBudget)}</td>
              <td className="p-3 text-end num">{kwd(s.spent)}</td>
              <td className="p-3 text-end num">{kwd(s.committed)}</td>
              <td className="p-3 text-end num text-primary">{kwd(s.remaining)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BudgetEditor({ s, onDone }: { s: ClubState; onDone: () => void }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [total, setTotal] = useState(s.totalBudget.toFixed(3));
  const [caps, setCaps] = useState<Record<string, string>>(() => Object.fromEntries(s.categories.map((c) => [c.id, c.cap.toFixed(3)])));
  const [err, setErr] = useState<ApiErr | null>(null);
  const save = useSaveBudget({
    mutation: {
      onSuccess: (m) => { qc.invalidateQueries({ queryKey: getGetClubStateQueryKey() }); toast({ title: t('تم حفظ التوزيع', 'Allocation saved'), description: m.message }); onDone(); },
      onError: (e) => setErr(apiErr(e, lang)),
    },
  });
  const badFmt = !DEC3.test(total) || Object.values(caps).some((v) => !DEC3.test(v));
  const sum = Object.values(caps).reduce((a, v) => a + (DEC3.test(v) ? fils(v) : 0), 0);
  const diff = fils(total) - sum;
  const below = s.categories.filter((c) => DEC3.test(caps[c.id]) && fils(caps[c.id]) < Math.round((c.spent + c.committed) * 1000));
  const ok = !badFmt && diff === 0 && below.length === 0 && Number(total) >= 1;

  return (
    <div className="panel p-5 rise">
      <div className="flex flex-wrap items-end gap-4 mb-5">
        <label className="block">
          <span className="eyebrow">{t('سقف الموسم (د.ك)', 'Season cap (KWD)')}</span>
          <Input data-testid="input-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="num mt-1.5 w-56 text-end" />
        </label>
        <div className={cn('text-sm rounded-md border px-3 py-2', diff === 0 ? 'border-border text-muted-foreground' : 'border-destructive/50 text-destructive')} data-testid="text-budget-diff">
          {diff === 0 ? t('المجموع مطابق للسقف', 'Categories match the cap') : <>{t('الفرق غير الموزع: ', 'Unallocated difference: ')}<span className="num">{kwd(diff / 1000)}</span></>}
        </div>
      </div>
      <div className="divide-y divide-border">
        {s.categories.map((c) => {
          const floor = c.spent + c.committed;
          const v = caps[c.id];
          const invalid = !DEC3.test(v) || fils(v) < Math.round(floor * 1000);
          return (
            <div key={c.id} className="py-3 grid sm:grid-cols-[1fr_220px] gap-3 items-center">
              <div>
                <div className="font-medium text-sm">{t(c.name, c.nameEn)} <span className="num text-[10px] text-muted-foreground ms-1">{c.id}</span></div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{t('الحد الأدنى (مصروف + محجوز): ', 'Floor (spent + reserved): ')}<Money v={floor} unit={false} className="text-foreground" /></div>
              </div>
              <Input data-testid={`input-cap-${c.id}`} inputMode="decimal" value={v} onChange={(e) => setCaps({ ...caps, [c.id]: e.target.value })}
                className={cn('num text-end', invalid && 'border-destructive focus-visible:ring-destructive')} />
            </div>
          );
        })}
      </div>
      {badFmt && <p className="text-xs text-destructive mt-3">{t('المبالغ أرقام موجبة بثلاث خانات عشرية كحد أقصى.', 'Amounts must be positive numbers with at most 3 decimals.')}</p>}
      {below.length > 0 && <p className="text-xs text-destructive mt-2">{t('بنود تحت الحد الأدنى: ', 'Below floor: ')}{below.map((c) => t(c.name, c.nameEn)).join('، ')}</p>}
      {err && <div className="mt-4"><ErrorBox msg={err.msg} exceeded={err.exceeded} /></div>}
      <div className="flex gap-2 mt-5 justify-end">
        <Button variant="ghost" onClick={onDone} data-testid="button-cancel-budget" className="gap-1.5"><X className="h-4 w-4" />{t('إلغاء', 'Cancel')}</Button>
        <Button disabled={!ok || save.isPending} data-testid="button-save-budget"
          onClick={() => { setErr(null); save.mutate({ data: { total: fils(total) / 1000, categories: s.categories.map((c) => ({ id: c.id, cap: fils(caps[c.id]) / 1000 })) } }); }}>
          {save.isPending ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ التوزيع', 'Save allocation')}
        </Button>
      </div>
    </div>
  );
}
