import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Languages, Home, Wallet, Users, Banknote, Receipt, MessageCircleQuestion, AlertCircle, RotateCw } from 'lucide-react';
import {
  useLogout, getGetSessionQueryKey, getGetClubStateQueryKey, useGetClubState, type Session, type ClubState,
} from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { kwd } from '@/lib/saqfi';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect x="0" y="0" width="40" height="40" rx="11" fill="hsl(214 60% 22%)" />
      <path d="M9 15 L20 9 L31 15" fill="none" stroke="hsl(43 70% 58%)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="11" y="21" width="4" height="10" rx="1.5" fill="hsl(43 70% 58%)" />
      <rect x="18" y="18" width="4" height="13" rx="1.5" fill="hsl(43 70% 58%)" />
      <rect x="25" y="23" width="4" height="8" rx="1.5" fill="hsl(43 70% 58%)" />
    </svg>
  );
}

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      data-testid="button-lang"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={cn('inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-muted transition-colors', className)}
    >
      <Languages className="h-4 w-4" />
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

export function useClub() {
  return useGetClubState({ query: { queryKey: getGetClubStateQueryKey(), refetchInterval: 30000, refetchOnWindowFocus: true } });
}

const NAV = [
  { href: '/dashboard', ar: 'الرئيسية', en: 'Home', sar: 'الرئيسية', sen: 'Home', icon: Home },
  { href: '/budget', ar: 'الميزانية', en: 'Budget', sar: 'الميزانية', sen: 'Budget', icon: Wallet },
  { href: '/contracts', ar: 'اللاعبين والعقود', en: 'Players & contracts', sar: 'اللاعبين', sen: 'Players', icon: Users },
  { href: '/payroll', ar: 'الرواتب', en: 'Payroll', sar: 'الرواتب', sen: 'Payroll', icon: Banknote },
  { href: '/transactions', ar: 'المصاريف', en: 'Expenses', sar: 'المصاريف', sen: 'Expenses', icon: Receipt },
];

export const roleLabel = (r: string, t: (a: string, e: string) => string) =>
  r === 'manager' ? t('المدير المالي', 'Finance manager') : r === 'president' ? t('رئيس النادي', 'Club president') : t('لاعب', 'Player');

function AdvisorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLang();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-advisor">
        <DialogHeader>
          <DialogTitle>{t('المستشار', 'Advisor')}</DialogTitle>
          <DialogDescription>{t('غير مفعّل بعد', 'Not active yet')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[15px]">
          <p>{t('المستشار راح يجاوب على أسئلتك من أرقام النادي نفسها، مثل: هل أقدر أوقّع لاعب جديد هالشهر؟',
            'The advisor will answer your questions from the club\'s own figures, for example: can I sign a new player this month?')}</p>
          <p className="text-muted-foreground">{t('للنصيحة فقط. ما يسجّل مصروف ولا يغيّر الميزانية ولا يصرف رواتب، والقرار دايماً لك.',
            'Advice only. It will never record expenses, change the budget or run payroll. The decision is always yours.')}</p>
        </div>
        <div className="flex justify-end"><Button onClick={() => onOpenChange(false)} data-testid="button-close-advisor">{t('تمام', 'OK')}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

export function Shell({ session, children }: { session: Session; children: ReactNode }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [loc, setLoc] = useLocation();
  const qc = useQueryClient();
  const club = useClub();
  const [advisor, setAdvisor] = useState(false);
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetClubStateQueryKey() });
        qc.setQueryData(getGetSessionQueryKey(), { authenticated: false, role: '', name: '', demo: false });
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        setLoc('/');
      },
      onError: () => toast({ variant: 'destructive', title: t('ما قدرنا نسجّل خروجك. حاول مرة ثانية.', 'Sign-out failed. Please try again.') }),
    },
  });
  const isPlayer = session.role === 'player';
  const s = club.data as ClubState | undefined;
  const active = (h: string) => loc === h || (h === '/dashboard' && loc === '/');

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto max-w-[1200px] px-4 md:px-6 h-16 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3 shrink-0 min-h-11" data-testid="link-home">
            <Mark size={34} />
            <div className="leading-tight">
              <div className="font-semibold text-[17px]">{t('سقفي', 'Saqfi')}</div>
              <div className="text-[13px] text-muted-foreground hidden sm:block">{s ? t(s.club, s.clubEn) : t('ولا دينار فوق السقف', 'Not one dinar over the cap')}</div>
            </div>
          </Link>
          {!isPlayer && (
            <nav className="hidden lg:flex items-center gap-1 mx-auto">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.slice(1)}`}
                  className={cn('min-h-11 inline-flex items-center px-3.5 rounded-lg text-[15px] transition-colors',
                    active(n.href) ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-muted')}>
                  {t(n.ar, n.en)}
                </Link>
              ))}
            </nav>
          )}
          <div className={cn('flex items-center gap-2 ms-auto', !isPlayer && 'lg:ms-0')}>
            {!isPlayer && (
              <button onClick={() => setAdvisor(true)} data-testid="button-advisor" aria-label={t('المستشار', 'Advisor')}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-muted">
                <MessageCircleQuestion className="hidden sm:block h-4 w-4" />
                <span>{t('المستشار', 'Advisor')}</span>
              </button>
            )}
            <LangToggle />
            <Button size="icon" variant="ghost" data-testid="button-logout" disabled={logout.isPending} onClick={() => logout.mutate()} aria-label={t('خروج', 'Sign out')} title={t('خروج', 'Sign out')}>
              <LogOut className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </header>
      <div className="border-b border-border bg-background text-[13px] text-muted-foreground" data-testid="status-mode">
        <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-2 truncate whitespace-nowrap">
          <span className="text-foreground" data-testid="text-session-role">{roleLabel(session.role, t)}</span>
          {s?.mode === 'demo' && <span> · {t('بيانات تجريبية', 'Demo data')}</span>}
          {s?.mode === 'database' && !isPlayer && <span> · {t('قاعدة البيانات', 'Database')}</span>}
        </div>
      </div>
      <main className={cn('flex-1 mx-auto w-full max-w-[1200px] px-4 md:px-6 py-6 md:py-10', !isPlayer && 'pb-28 lg:pb-10')}>{children}</main>
      <footer className={cn('border-t border-border py-4 text-center text-[13px] text-muted-foreground', !isPlayer && 'hidden lg:block')}>
        {t('سقفي · جميع المبالغ بالدينار الكويتي', 'Saqfi · All amounts in Kuwaiti dinar')}
      </footer>
      {!isPlayer && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]" data-testid="nav-mobile">
          <div className="grid grid-cols-5">
            {NAV.map((n) => {
              const Icon = n.icon;
              const on = active(n.href);
              return (
                <Link key={n.href} href={n.href} data-testid={`link-tab-${n.href.slice(1)}`}
                  className={cn('flex flex-col items-center justify-center gap-1 min-h-[60px] px-1 text-[12px] leading-tight', on ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                  <span className={cn('inline-flex h-7 w-12 items-center justify-center rounded-lg', on && 'bg-accent')}><Icon className="h-5 w-5" /></span>
                  <span className="text-center">{t(n.sar, n.sen)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <AdvisorDialog open={advisor} onOpenChange={setAdvisor} />
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-[28px] md:text-[32px] font-semibold leading-tight">{title}</h1>
        {sub && <p className="text-muted-foreground mt-2 max-w-2xl">{sub}</p>}
      </div>
      {action && <div className="shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  );
}

/** exact: show 3 decimals only when the value carries fils. Default: whole dinars. */
export function Money({ v, className, unit = true, exact = false }: { v: number; className?: string; unit?: boolean; exact?: boolean }) {
  const { t } = useLang();
  return (
    <span className={cn('whitespace-nowrap', className)}>
      <span className="num">{v < 0 ? '-' : ''}{kwd(Math.abs(v), exact)}</span>
      {unit && <span className="text-[0.8em] text-muted-foreground ms-1">{t('د.ك', 'KWD')}</span>}
    </span>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-56 bg-muted" />
      <Skeleton className="h-5 w-80 max-w-full bg-muted" />
      <Skeleton className="h-44 bg-muted" />
      <Skeleton className="h-64 bg-muted" />
    </div>
  );
}

export function ErrorPanel({ onRetry, msg }: { onRetry: () => void; msg?: string }) {
  const { t } = useLang();
  return (
    <div className="panel p-8 text-center max-w-lg mx-auto">
      <AlertCircle className="h-6 w-6 mx-auto mb-3 text-muted-foreground" />
      <div className="text-lg font-semibold mb-2">{t('ما قدرنا نحمّل بيانات النادي', 'Could not load club data')}</div>
      <p className="text-muted-foreground mb-5">{msg ?? t('الخادم ما يرد الحين. جرّب مرة ثانية.', 'The server is not responding right now. Please try again.')}</p>
      <Button onClick={onRetry} data-testid="button-retry"><RotateCw className="h-4 w-4" />{t('حاول مرة ثانية', 'Try again')}</Button>
    </div>
  );
}

export function ReadOnlyNote() {
  const { t } = useLang();
  return (
    <span className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm text-muted-foreground" data-testid="status-readonly">
      {t('عرض فقط، التعديل للمدير المالي', 'View only. Edits are for the finance manager')}
    </span>
  );
}

/** Server rejection. If `exceeded` is present it's a cap rejection: show operation, amount over and advice. */
export function ErrorBox({ msg, exceeded, op }: { msg: string; exceeded?: number; op?: string }) {
  const { t } = useLang();
  if (exceeded === undefined) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/[.05] p-4" data-testid="text-api-error" role="alert">
        <div className="font-semibold text-destructive mb-1">{t('ما تم الحفظ', 'Not saved')}</div>
        <div>{msg}</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/[.05] p-4 space-y-2" data-testid="text-api-error" role="alert">
      <div className="font-semibold text-destructive">{op ? t(`انرفض ${op} لأنه يتجاوز السقف`, `${op} rejected: over the cap`) : t('انرفض لأنه يتجاوز السقف', 'Rejected: over the cap')}</div>
      <div>{t('تكلفة هالعملية أكبر من المتاح في البند.', 'This would cost more than the available category budget.')}</div>
      <div>{t('الزيادة فوق السقف: ', 'Over the cap by: ')}<Money v={exceeded} exact className="font-semibold text-destructive" /></div>
      <div className="text-muted-foreground text-[15px]">{t('قلّل المبلغ أو الراتب، أو عدّل سقف البند من صفحة الميزانية، وبعدين حاول مرة ثانية.',
        'Reduce the amount or salary, or adjust the category cap on the Budget page, then try again.')}</div>
    </div>
  );
}

/** Mobile stacked card row */
export function KV({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-muted-foreground text-[15px]">{k}</span>
      <span className={cn('text-end', strong && 'font-semibold')}>{v}</span>
    </div>
  );
}
