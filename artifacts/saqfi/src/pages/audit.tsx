import { useMemo, useState } from 'react';
import { Banknote, Receipt, Trophy, Gavel, ShieldCheck, Wallet, UserPlus, Settings2, X, Check, Send, Gift } from 'lucide-react';
import type { Session } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { displayText } from '@/lib/saqfi';
import { useClub, PageHead, PageSkeleton, ErrorPanel, roleLabel } from '@/components/shell';
import { Chip, Toolbar } from '@/components/kit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ICONS: Record<string, typeof Receipt> = {
  payroll: Banknote, expense: Receipt, match: Trophy, fine: Gavel, bonus: Gift, approve: Check, reject: X,
  request: Send, budget: Wallet, contract: UserPlus, settings: Settings2, cancel: X,
};

export default function Audit(_: { session: Session }) {
  const { t, lang } = useLang();
  const q = useClub();
  const [role, setRole] = useState('all');
  const groups = useMemo(() => {
    const list = (q.data?.audit ?? []).filter((a) => role === 'all' || a.role === role);
    const by = new Map<string, typeof list>();
    for (const a of list) {
      const d = a.at.slice(0, 10);
      by.set(d, [...(by.get(d) ?? []), a]);
    }
    return [...by.entries()];
  }, [q.data, role]);
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data) return <ErrorPanel onRetry={() => q.refetch()} />;
  const dayLabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-4xl">
      <PageHead title={t('سجل العمليات', 'Activity log')} sub={t('كل تغيير على فلوس النادي: مين سواه ومتى. ما ينحذف ولا يتعدل.', 'Every change to club money: who did it and when. It cannot be edited or deleted.')} />
      <Toolbar>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="sm:w-56 bg-card" aria-label={t('الدور', 'Role')} data-testid="select-audit-role"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('كل الأدوار', 'All roles')}</SelectItem>
            <SelectItem value="manager">{t('المدير المالي', 'Finance manager')}</SelectItem>
            <SelectItem value="president">{t('رئيس النادي', 'Club president')}</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>
      {groups.length === 0 ? <div className="panel p-8 text-center text-muted-foreground">{t('ما في عمليات مسجلة.', 'No activity recorded.')}</div> : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="text-[14px] font-semibold text-muted-foreground mb-2">{dayLabel(day)}</h2>
              <ul className="panel overflow-hidden divide-y divide-border">
                {items.map((a) => {
                  const Icon = ICONS[a.action] ?? ShieldCheck;
                  return (
                    <li key={a.id} className="px-4 md:px-5 py-3.5 flex items-start gap-3" data-testid={`row-audit-${a.id}`}>
                      <span className="h-9 w-9 rounded-full bg-accent text-primary grid place-items-center shrink-0 mt-0.5"><Icon className="h-[17px] w-[17px]" /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px]">{displayText(lang === 'ar' ? a.detail : a.detailEn, lang)}</div>
                        <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                          <Chip tone={a.role === 'president' ? 'gold' : 'navy'}>{roleLabel(a.role, t)}</Chip>
                          <span className="num">{time(a.at)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
