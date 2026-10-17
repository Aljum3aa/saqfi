import type { snapshot } from "./finance";
import { months } from "./finance";

type State = ReturnType<typeof snapshot>;
export type Answer = { answer: string; answerEn: string; source: "ai" | "rules" };

const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const digits = (s: string) => s.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬]/g, "");

/** Months still to come in the season, counting the current one if its payroll is not done. */
function monthsLeft(s: State) {
  const all = months(s.seasonStart, s.seasonEnd);
  const from = s.nextPayrollMonth || s.today.slice(0, 7);
  return all.filter(m => m >= from).length;
}
function elapsed(s: State) {
  return Math.max(1, months(s.seasonStart, s.seasonEnd).filter(m => m <= s.today.slice(0, 7)).length);
}

/** Proactive notes for the home page, computed from the club's own numbers. */
export function insights(s: State) {
  const out: { id: string; message: string; messageEn: string; tone: "good" | "warn" | "bad" }[] = [];
  const left = monthsLeft(s);
  for (const c of s.categories) {
    if (c.id === "players" || c.cap <= 0) continue;
    const rate = c.spent / elapsed(s);
    if (rate <= 0) continue;
    const runway = c.remaining / rate;
    if (runway < left) out.push({
      id: `runway-${c.id}`, tone: runway < 2 ? "bad" : "warn",
      message: runway < 1
        ? `بند «${c.name}» ما يكفي حتى شهر بمعدل الصرف الحالي، والموسم باقي فيه ${left} شهر. فكّر تنقل له من الاحتياطي أو تخفف الصرف.`
        : `بند «${c.name}» يكفي تقريباً ${Math.floor(runway)} شهر بمعدل الصرف الحالي، والموسم باقي فيه ${left} شهر.`,
      messageEn: runway < 1
        ? `${c.nameEn} will not last a month at the current pace, with ${left} months left. Consider moving money from the reserve or slowing spending.`
        : `${c.nameEn} lasts about ${Math.floor(runway)} months at the current pace; ${left} months remain.`,
    });
  }
  const players = s.categories.find(c => c.id === "players");
  if (players && left > 0) {
    const room = Math.floor(players.remaining / left);
    out.push({
      id: "signing-room", tone: room > 0 ? "good" : "warn",
      message: room > 0 ? `تقدر توقّع لاعب جديد براتب لين ${n0(room)} د.ك بالشهر لنهاية الموسم بدون ما تتعدى السقف.`
        : "بند الرواتب ما فيه مجال لعقد جديد هالموسم.",
      messageEn: room > 0 ? `You can sign a new player on up to KWD ${n0(room)} a month until season end without breaking the cap.`
        : "The salary category has no room for a new contract this season.",
    });
  }
  return out;
}

/** Deterministic answers from the club's figures. Used when no AI key is set, and as a fallback. */
export function ruleAnswer(question: string, s: State): Answer {
  const q = digits(question.toLowerCase());
  const amount = Number(q.match(/\d+(\.\d+)?/)?.[0] ?? NaN);
  const left = monthsLeft(s);
  const players = s.categories.find(c => c.id === "players");
  const rules = (ar: string, en: string): Answer => ({ answer: ar, answerEn: en, source: "rules" });

  if (/وق[ّ]?ع|توقيع|لاعب جديد|sign|contract|عقد/.test(q) && players) {
    const room = left > 0 ? Math.floor(players.remaining / left) : 0;
    if (Number.isFinite(amount) && amount > 0) {
      const cost = amount * left;
      return cost <= players.remaining
        ? rules(`إي تقدر. راتب ${n0(amount)} د.ك لمدة ${left} شهر يكلف ${n0(cost)} د.ك، والمتاح في بند الرواتب ${n0(players.remaining)} د.ك. بيبقى لك ${n0(players.remaining - cost)} د.ك.`,
          `Yes. KWD ${n0(amount)} for ${left} months costs KWD ${n0(cost)}; the salary category has KWD ${n0(players.remaining)} available, leaving KWD ${n0(players.remaining - cost)}.`)
        : rules(`لا، ما تقدر. راتب ${n0(amount)} د.ك لمدة ${left} شهر يكلف ${n0(cost)} د.ك، والمتاح ${n0(players.remaining)} د.ك بس. أعلى راتب تقدر عليه ${n0(room)} د.ك بالشهر، أو انقل من الاحتياطي بموافقة الرئيس.`,
          `No. KWD ${n0(amount)} for ${left} months costs KWD ${n0(cost)}, but only KWD ${n0(players.remaining)} is available. The highest salary you can afford is KWD ${n0(room)} a month, or move money from the reserve with the president's approval.`);
    }
    return rules(`أعلى راتب شهري تقدر توقّع فيه لاعب جديد لنهاية الموسم: ${n0(room)} د.ك (المتاح ${n0(players.remaining)} د.ك على ${left} شهر).`,
      `The highest monthly salary you can offer a new player until season end: KWD ${n0(room)} (KWD ${n0(players.remaining)} available over ${left} months).`);
  }
  if (/يخلص|يكفي|متى|run out|last/.test(q)) {
    // If the question names a category ("السفر", "travel"), answer about that one only.
    const named = s.categories.filter(c => [...c.name.split(/\s+/), ...c.nameEn.toLowerCase().split(/\W+/)]
      .some(w => w.length >= 4 && !/^(رواتب|and)$/.test(w) && q.includes(w)));
    const list = insights(s).filter(i => i.id.startsWith("runway") && (!named.length || named.some(c => i.id === `runway-${c.id}`)));
    if (!list.length && named.length) {
      const c = named[0]!;
      return rules(`بند «${c.name}» يكفي لنهاية الموسم بمعدل الصرف الحالي. المتاح فيه ${n0(c.remaining)} د.ك.`,
        `${c.nameEn} lasts to season end at the current pace. KWD ${n0(c.remaining)} is available.`);
    }
    return list.length
      ? rules(list.map(i => i.message).join("\n"), list.map(i => i.messageEn).join("\n"))
      : rules("كل البنود تكفي لنهاية الموسم بمعدل الصرف الحالي.", "Every category lasts to season end at the current pace.");
  }
  if (/وين|أكثر|اكثر|most|where|biggest/.test(q)) {
    const top = [...s.categories].sort((a, b) => b.spent - a.spent).slice(0, 3);
    const big = s.transactions.filter(t => t.type !== "payroll").sort((a, b) => b.amount - a.amount).slice(0, 3);
    return rules(
      `أكثر البنود صرفاً: ${top.map(c => `${c.name} ${n0(c.spent)} د.ك`).join("، ")}. وأكبر المصاريف: ${big.map(t => `${t.description} ${n0(t.amount)} د.ك`).join("، ")}.`,
      `Top categories: ${top.map(c => `${c.nameEn} KWD ${n0(c.spent)}`).join(", ")}. Biggest expenses: ${big.map(t => `${t.description} KWD ${n0(t.amount)}`).join(", ")}.`);
  }
  if (/رواتب|راتب|payroll|salar/.test(q)) {
    return rules(`رواتب الشهر الجاي (${s.nextPayrollMonth}) تقريباً ${n0(s.monthlyPayroll)} د.ك، وفوقها مكافآت معلقة ${n0(s.pendingBonuses)} د.ك وتنخصم غرامات ${n0(s.pendingFines)} د.ك.`,
      `Next payroll (${s.nextPayrollMonth}) is about KWD ${n0(s.monthlyPayroll)}, plus KWD ${n0(s.pendingBonuses)} pending bonuses, minus KWD ${n0(s.pendingFines)} fines.`);
  }
  const over = s.forecast > s.totalBudget;
  return rules(
    `الوضع: انصرف ${n0(s.spent)} د.ك، ومحجوز ${n0(s.committed)} د.ك، وتقدر تصرف بعد ${n0(s.remaining)} د.ك. التوقع لنهاية الموسم ${n0(s.forecast)} د.ك، ${over ? `يعني فوق السقف بـ ${n0(s.forecast - s.totalBudget)} د.ك، خفّف الصرف.` : "يعني داخل السقف."}`,
    `Spent KWD ${n0(s.spent)}, reserved KWD ${n0(s.committed)}, still available KWD ${n0(s.remaining)}. Season-end forecast KWD ${n0(s.forecast)}, ${over ? `over the cap by KWD ${n0(s.forecast - s.totalBudget)}; slow spending.` : "inside the cap."}`);
}

/**
 * AI answer when an OpenAI-compatible key is configured (Replit AI Integrations or OPENAI_API_KEY).
 * The model only sees aggregate figures, never acts, and falls back to the rule engine on any error.
 */
export async function advise(question: string, s: State, lang: "ar" | "en"): Promise<Answer> {
  const base = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? (process.env.OPENAI_API_KEY ? "https://api.openai.com/v1" : "");
  const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!base || !key) return ruleAnswer(question, s);
  const facts = {
    club: s.clubEn, season: `${s.seasonStart}..${s.seasonEnd}`, today: s.today, totalBudget: s.totalBudget,
    spent: s.spent, reserved: s.committed, available: s.remaining, forecast: s.forecast, monthsLeft: monthsLeft(s),
    monthlyPayroll: s.monthlyPayroll, pendingBonuses: s.pendingBonuses, pendingFines: s.pendingFines,
    categories: s.categories.map(c => ({ name: c.nameEn, cap: c.cap, spent: c.spent, reserved: c.committed, available: c.remaining })),
    players: s.contracts.length, matches: s.matches.slice(0, 6).map(m => `${m.date} ${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponentEn}`),
  };
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.SAQFI_AI_MODEL ?? "gpt-4o-mini", temperature: 0.2, max_tokens: 400,
        messages: [
          { role: "system", content: "You are Saqfi's finance advisor for a football club. Answer only from the JSON facts. Amounts are KWD. Be short and concrete (max 4 sentences). You give advice only and never claim to have changed anything. " +
            (lang === "ar" ? "Reply in Kuwaiti Arabic." : "Reply in English.") },
          { role: "user", content: `Facts: ${JSON.stringify(facts)}\n\nQuestion: ${question}` },
        ],
      }),
    });
    const body = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!res.ok || !text) throw new Error("no answer");
    return { answer: text, answerEn: text, source: "ai" };
  } catch {
    return ruleAnswer(question, s);
  }
}
