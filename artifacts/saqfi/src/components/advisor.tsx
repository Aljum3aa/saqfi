import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useAskAdvisor } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { apiErr } from '@/lib/saqfi';
import { Mark } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Msg = { from: 'me' | 'advisor'; text: string; ai?: boolean };

const SUGGESTED = [
  { ar: 'أقدر أوقّع لاعب براتب 1500؟', en: 'Can I sign a player on 1500 a month?' },
  { ar: 'متى بيخلص بند السفر؟', en: 'When will the travel budget run out?' },
  { ar: 'وين أكثر شي نصرف؟', en: 'Where do we spend the most?' },
  { ar: 'كم رواتب الشهر الجاي؟', en: 'How much is next month\'s payroll?' },
];

/** Advice-only assistant: answers from the club's own figures, never changes anything. */
export function AdvisorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang } = useLang();
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const ask = useAskAdvisor({
    mutation: {
      onSuccess: (a) => setMsgs((m) => [...m, { from: 'advisor', text: lang === 'ar' ? a.answer : a.answerEn, ai: a.source === 'ai' }]),
      onError: (e) => setMsgs((m) => [...m, { from: 'advisor', text: apiErr(e, lang).msg }]),
    },
  });
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs, ask.isPending]);
  const send = (text: string) => {
    const v = text.trim();
    if (v.length < 2 || ask.isPending) return;
    setMsgs((m) => [...m, { from: 'me', text: v }]);
    setQ('');
    ask.mutate({ data: { question: v, lang } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[20px] max-w-lg p-0 overflow-hidden gap-0" data-testid="dialog-advisor">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border text-start">
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cap" />{t('المستشار المالي', 'Finance advisor')}</DialogTitle>
          <DialogDescription>{t('يجاوب من أرقام النادي نفسها. للنصيحة بس، ما يغيّر أي شي.', 'Answers from the club\'s own figures. Advice only; it never changes anything.')}</DialogDescription>
        </DialogHeader>
        <div className="h-[46vh] max-h-[420px] overflow-y-auto px-6 py-4 space-y-3 bg-muted/30" aria-live="polite">
          {msgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-[15px]">{t('جرّب واحد من هالأسئلة، أو اكتب سؤالك:', 'Try one of these, or type your own:')}</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map((s) => (
                  <button key={s.en} onClick={() => send(t(s.ar, s.en))} data-testid="button-advisor-suggestion"
                    className="min-h-10 rounded-full border border-border bg-card px-4 text-[14px] hover:border-primary/40 hover:bg-accent transition-colors text-start">
                    {t(s.ar, s.en)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn('flex gap-2', m.from === 'me' ? 'justify-start flex-row-reverse' : 'justify-start')}>
              {m.from === 'advisor' && <span className="shrink-0 mt-0.5"><Mark size={28} /></span>}
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line',
                m.from === 'me' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border')}>
                {m.text}
                {m.from === 'advisor' && <div className="mt-1 text-[11.5px] text-muted-foreground">{m.ai ? t('ذكاء اصطناعي', 'AI') : t('محسوب من أرقام النادي', 'Computed from club figures')}</div>}
              </div>
            </div>
          ))}
          {ask.isPending && <div className="flex gap-2"><Mark size={28} /><div className="rounded-2xl bg-card border border-border px-4 py-3"><span className="inline-flex gap-1">{[0, 1, 2].map((d) => <i key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}</span></div></div>}
          <div ref={end} />
        </div>
        <form className="flex gap-2 p-4 border-t border-border" onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <label htmlFor="input-advisor" className="sr-only">{t('سؤالك', 'Your question')}</label>
          <Input id="input-advisor" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder={t('اكتب سؤالك…', 'Ask a question…')} className="rounded-full h-11" data-testid="input-advisor" />
          <Button type="submit" size="icon" className="rounded-xl h-11 w-11 shrink-0" disabled={q.trim().length < 2 || ask.isPending} aria-label={t('إرسال', 'Send')} data-testid="button-advisor-send">
            <Send className="h-4 w-4 rtl:-scale-x-100" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
