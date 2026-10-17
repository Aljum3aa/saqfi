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

/** The Saqfi mark: a gold cap line with three budget bars under it, none crossing it (Gemini concept, redrawn as vector). */
export function Mark({ size = 34, tile = true, onDark = false }: { size?: number; tile?: boolean; onDark?: boolean }) {
  const bar = tile || onDark ? '#FFFFFF' : '#14284B';
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden>
      {tile && !onDark && <rect width="1024" height="1024" rx="232" fill="#14284B" />}
      {onDark && <rect width="1024" height="1024" rx="232" fill="#FFFFFF" fillOpacity="0.08" />}
      <rect x="256" y="256" width="512" height="54" rx="10" fill="#C9A24A" />
      <rect x="299" y="488" width="113" height="280" rx="10" fill={bar} />
      <rect x="455" y="350" width="113" height="418" rx="10" fill={bar} />
      <rect x="612" y="442" width="113" height="326" rx="10" fill={bar} />
    </svg>
  );
}

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      data-testid="button-lang"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={cn('inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-foreground/80 hover:bg-muted transition-colors', className)}
    >
      <Languages className="h-4 w-4" />
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

import crestUrl from '@assets/crest_1792268676116.webp';
import kitUrl from '@assets/kit_1792268676116.webp';
/* Fictional demo club identity (Gemini): Al-Suqoor FC crest + home kit */
export const clubCrest = () => crestUrl;
export const clubKit = () => kitUrl;
const seasonLabel = (s?: ClubState) => (s ? `${s.seasonStart.slice(0, 4)}/${s.seasonEnd.slice(2, 4)}` : '');

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

function Brand({ s, dark = false }: { s?: ClubState; dark?: boolean }) {
  const { t } = useLang();
  return (
    <Link href="/dashboard" className="flex items-center gap-3 min-h-11" data-testid="link-home">
      <Mark size={36} onDark={dark} />
      <div className="leading-tight min-w-0">
        <div className="font-display font-semibold text-[19px]">{t('سقفي', 'Saqfi')}</div>
        <div className={cn('text-[13px] truncate max-[359px]:hidden', dark ? 'text-white/60' : 'text-muted-foreground')}>{s && !dark ? t(s.club, s.clubEn) : t('ولا دينار فوق السقف', 'Not one dinar over the cap')}</div>
      </div>
    </Link>
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
  const modeText = s?.mode === 'demo' ? t('بيانات تجريبية', 'Demo data') : s?.mode === 'database' ? t('قاعدة البيانات', 'Database') : '';

  return (
    <div className="min-h-[100dvh] lg:flex">
      {/* Desktop: fixed side menu on the start side (right in Arabic) */}
      {!isPlayer && (
        <aside className="hidden lg:flex lg:flex-col w-[268px] shrink-0 sticky top-0 h-[100dvh] bg-[#0f1f3d] text-white px-4 py-6">
          <div className="px-2"><Brand s={s} dark /></div>
          {s && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/[.06] p-3" data-testid="card-club">
              <img src={clubCrest()} alt="" className="h-11 w-11 object-contain shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold truncate">{t(s.club, s.clubEn)}</div>
                <div className="text-[12px] text-white/60">{t('موسم ', 'Season ')}<span className="num">{seasonLabel(s)}</span></div>
              </div>
            </div>
          )}
          <nav className="mt-8 flex flex-col gap-1" aria-label={t('الأقسام', 'Sections')}>
            {NAV.map((n) => {
              const Icon = n.icon;
              const on = active(n.href);
              return (
                <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.slice(1)}`} aria-current={on ? 'page' : undefined}
                  className={cn('min-h-11 flex items-center gap-3 px-4 rounded-full text-[15px] transition-colors',
                    on ? 'bg-white text-[#0f1f3d] font-semibold shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white')}>
                  <Icon className="h-[18px] w-[18px]" />
                  {t(n.ar, n.en)}
                </Link>
              );
            })}
          </nav>
          <button onClick={() => setAdvisor(true)} data-testid="button-advisor"
            className="mt-5 min-h-11 flex items-center gap-3 px-4 rounded-full border border-white/15 text-[15px] text-white/85 hover:bg-white/10">
            <MessageCircleQuestion className="h-[18px] w-[18px]" />
            {t('اسأل المستشار', 'Ask the advisor')}
          </button>
          <div className="mt-auto rounded-2xl bg-white/[.06] p-4">
            <div className="text-[15px] font-semibold" data-testid="text-session-role">{roleLabel(session.role, t)}</div>
            {modeText && <div className="text-[13px] text-white/60" data-testid="status-mode">{modeText}</div>}
            <div className="mt-3 flex items-center justify-between gap-2">
              <LangToggle className="px-2 text-white/80 hover:bg-white/10" />
              <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" data-testid="button-logout" disabled={logout.isPending} onClick={() => logout.mutate()}>
                <LogOut className="h-4 w-4 rtl:rotate-180" />{t('خروج', 'Sign out')}
              </Button>
            </div>
          </div>
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col min-h-[100dvh]">
        {/* Top bar: always on mobile, and for the player view on desktop */}
        <header className={cn('sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur', !isPlayer && 'lg:hidden')}>
          <div className="mx-auto max-w-[1240px] px-4 md:px-6 h-16 flex items-center gap-2">
            <Brand s={s} />
            <div className="ms-auto flex items-center gap-1">
              {!isPlayer && (
                <button onClick={() => setAdvisor(true)} data-testid="button-advisor-mobile" aria-label={t('المستشار', 'Advisor')}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-muted">
                  <MessageCircleQuestion className="h-5 w-5" />
                </button>
              )}
              <LangToggle />
              <Button size="icon" variant="ghost" data-testid="button-logout-mobile" disabled={logout.isPending} onClick={() => logout.mutate()} aria-label={t('خروج', 'Sign out')}>
                <LogOut className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </header>

        <main className={cn('flex-1 mx-auto w-full max-w-[1240px] px-4 md:px-8 xl:px-10 py-6 md:py-10', !isPlayer && 'pb-28 lg:pb-12')}>
          {modeText && (
            <div className="lg:hidden mb-5 text-[13px] text-muted-foreground truncate">{roleLabel(session.role, t)} · {modeText}</div>
          )}
          {children}
        </main>
      </div>

      {!isPlayer && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]" data-testid="nav-mobile">
          <div className="grid grid-cols-5">
            {NAV.map((n) => {
              const Icon = n.icon;
              const on = active(n.href);
              return (
                <Link key={n.href} href={n.href} data-testid={`link-tab-${n.href.slice(1)}`} aria-current={on ? 'page' : undefined}
                  className={cn('flex flex-col items-center justify-center gap-1 min-h-[64px] px-1 text-[12px] leading-tight', on ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                  <span className={cn('inline-flex h-7 w-12 items-center justify-center rounded-full', on && 'bg-accent')}><Icon className="h-5 w-5" /></span>
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
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="text-muted-foreground mt-1.5 max-w-2xl">{sub}</p>}
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
      <span className="num font-display">{v < 0 ? '-' : ''}{kwd(Math.abs(v), exact)}</span>
      {unit && <span className="text-[0.62em] font-medium text-muted-foreground ms-1.5">{t('د.ك', 'KWD')}</span>}
    </span>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-56 bg-muted" />
      <Skeleton className="h-5 w-80 max-w-full bg-muted" />
      <Skeleton className="h-52 bg-muted" />
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
    <span className="inline-flex min-h-11 items-center rounded-lg bg-muted px-4 text-sm text-muted-foreground" data-testid="status-readonly">
      {t('عرض فقط، التعديل للمدير المالي', 'View only. Edits are for the finance manager')}
    </span>
  );
}

/** Server rejection. If `exceeded` is present it's a cap rejection: show operation, amount over and advice. */
export function ErrorBox({ msg, exceeded, op }: { msg: string; exceeded?: number; op?: string }) {
  const { t } = useLang();
  if (exceeded === undefined) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/[.05] p-4" data-testid="text-api-error" role="alert">
        <div className="font-semibold text-destructive mb-1">{t('ما تم الحفظ', 'Not saved')}</div>
        <div>{msg}</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/[.05] p-4 space-y-2" data-testid="text-api-error" role="alert">
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
