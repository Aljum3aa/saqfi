import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import {
  LoginDemoBody, SaveBudgetBody, CreateContractBody, CreateExpenseBody, RunPayrollBody,
  CreateMatchBody, CreateAdjustmentBody, SaveBonusRulesBody, SaveApprovalThresholdBody,
  CreateRequestBody, DecideRequestBody, AskAdvisorBody, StartCheckoutBody, ConfirmPaymentBody, WithdrawWalletBody,
} from "@workspace/api-zod";
import { ClubError, type Role, type Contract, type Club } from "./types";
import { dataMode, mutateClub, readClub } from "./store";
import { contractMonths, fils, kwd, money, snapshot, validDate, payrollLines, pending, categories, enforce, FINE_LIMIT } from "./finance";
import { provider, assertNotLive, chargeQuote, createCheckout, verifyCheckout } from "./gateway";
import { advise, insights } from "./advisor";
import { getRates, toKwd } from "./fx";

export const saqfiRouter = Router();
const today = () => new Date().toISOString().slice(0, 10);
const cookieName = "saqfi_demo";
const lifetime = 8 * 60 * 60 * 1000;
type DemoSession = { role: Role; name: string; expires: number };
const sessions = new Map<string, DemoSession>();
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const roleNames = { manager: "المدير المالي", president: "رئيس النادي", player: "أحمد العتيبي" };
const purge = setInterval(() => {
  for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
}, 60000);
purge.unref();
saqfiRouter.use(cookieParser());
saqfiRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
saqfiRouter.use((req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.headers["sec-fetch-site"] === "cross-site")
      return next(new ClubError(403, "الطلب غير مسموح", "Cross-site requests are not allowed."));
    if (req.method !== "DELETE" && !req.is("application/json"))
      return next(new ClubError(415, "يلزم طلب JSON", "JSON content type required."));
  }
  next();
});
function session(req: Request) {
  const token: unknown = req.cookies?.[cookieName];
  if (typeof token !== "string") return undefined;
  const key = digest(token);
  const value = sessions.get(key);
  if (value && value.expires > Date.now()) return value;
  sessions.delete(key);
  return undefined;
}
function requireSession(req: Request, _res: Response, next: NextFunction) {
  if (!session(req)) return next(new ClubError(401, "يرجى تسجيل الدخول", "Please sign in."));
  next();
}
const only = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  const role = session(req)?.role;
  if (!role || !roles.includes(role))
    return next(roles.includes("manager")
      ? new ClubError(403, "هذه العملية متاحة للمدير المالي فقط", "Only the finance manager can perform this action.")
      : new ClubError(403, "هذه العملية لرئيس النادي فقط", "Only the club president can perform this action."));
  next();
};
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
/** Every change leaves a line in the club's operations log. */
function log(club: Club, req: Request, action: string, detail: string, detailEn: string) {
  club.audit.push({ id: randomUUID(), at: new Date().toISOString(), role: session(req)!.role, action, detail, detailEn });
}
function fullState(club: Club) {
  const state = snapshot(club, dataMode, today());
  return { ...state, insights: insights(state), gateway: provider() };
}
function checkExpense(club: Club, input: { categoryId: string; date: string }) {
  if (!club.categories.some(c => c.id === input.categoryId))
    throw new ClubError(404, "الفئة غير موجودة", "Category not found.");
  if (input.date < club.seasonStart || input.date > club.seasonEnd || input.date > today())
    throw new ClubError(400, "تاريخ المصروف يجب أن يكون ضمن الموسم وليس في المستقبل", "Expense date must be in the season and cannot be in the future.");
}
/** Validate an expense body and convert a foreign amount to KWD with the live rate (outside the data transaction). */
async function expenseInput(body: unknown) {
  const input = CreateExpenseBody.parse(body);
  money(input.amount); validDate(input.date);
  if (input.description.trim().length < 2 || input.description.length > 250)
    throw new ClubError(400, "أدخل وصفًا من 2 إلى 250 حرفًا", "Description must be 2–250 characters.");
  const currency = (input.currency ?? "KWD").toUpperCase();
  const { kwd: amount, rate } = await toKwd(input.amount, currency);
  if (amount <= 0) throw new ClubError(400, "المبلغ صغير جداً بعد التحويل", "Amount is too small after conversion.");
  const foreign = currency === "KWD" ? {} : { currency, originalAmount: input.amount, rate };
  return { categoryId: input.categoryId, amount, description: input.description.trim(), date: input.date, foreign };
}
const cookieOptions = (req: Request) => ({
  httpOnly: true, sameSite: "strict" as const, path: "/api/saqfi",
  secure: req.secure || req.headers["x-forwarded-proto"] === "https",
});
saqfiRouter.get("/session", (req, res) => {
  const value = session(req);
  res.json({ authenticated: !!value, role: value?.role ?? "", name: value?.name ?? "", demo: true });
});
saqfiRouter.post("/session", (req, res) => {
  const { role } = LoginDemoBody.parse(req.body);
  const old = req.cookies?.[cookieName];
  if (typeof old === "string") sessions.delete(digest(old));
  // These are explicitly public demo identities, not production authentication.
  if (sessions.size > 2000) throw new ClubError(429, "يرجى المحاولة لاحقًا", "Please retry later.");
  const token = randomBytes(32).toString("hex");
  sessions.set(digest(token), { role, name: roleNames[role], expires: Date.now() + lifetime });
  res.cookie(cookieName, token, { ...cookieOptions(req), maxAge: lifetime });
  res.json({ authenticated: true, role, name: roleNames[role], demo: true });
});
saqfiRouter.delete("/session", (req, res) => {
  const token = req.cookies?.[cookieName];
  if (typeof token === "string") sessions.delete(digest(token));
  res.clearCookie(cookieName, cookieOptions(req));
  res.json({ message: "تم تسجيل الخروج" });
});
saqfiRouter.use(requireSession);
saqfiRouter.get("/state", async (req, res) => {
  const club = await readClub();
  const state = fullState(club);
  if (session(req)!.role === "player") {
    // Do not leak another player's salary or club financials to player sessions.
    const ownId = "player-1";
    res.json({
      ...state, totalBudget: 0, categories: [], spent: 0, committed: 0, remaining: 0,
      forecast: 0, monthlyPayroll: 0, alerts: [], trend: [], nextPayrollMonth: "",
      insights: [], requests: [], audit: [], pendingBonuses: 0, pendingFines: 0,
      adjustments: state.adjustments.filter(a => a.playerId === ownId),
      contracts: state.contracts.filter(c => c.id === ownId),
      payrolls: state.payrolls.map(p => {
        const lines = p.lines.filter(l => l.playerId === ownId);
        return { ...p, lines, total: kwd(lines.reduce((s, l) => s + fils(l.net), 0)) };
      }).filter(p => p.lines.length > 0),
      transactions: [], market: [], payments: [],
      wallet: (() => { const entries = club.wallet.filter(w => w.playerId === ownId).sort((a, b) => b.date.localeCompare(a.date));
        return { balance: kwd(entries.reduce((s, w) => s + fils(w.amount), 0)), totalHeld: 0, entries }; })(),
    });
    return;
  }
  res.json(state);
});
saqfiRouter.get("/rates", async (_req, res) => {
  const r = await getRates();
  res.json({ base: "KWD", updated: r.updated, source: r.source, rates: r.rates });
});
saqfiRouter.post("/advisor", only("manager", "president"), async (req, res) => {
  const { question, lang } = AskAdvisorBody.parse(req.body);
  res.json(await advise(question.trim(), fullState(await readClub()), lang === "en" ? "en" : "ar"));
});
saqfiRouter.put("/approval-threshold", only("president"), async (req, res) => {
  const { threshold } = SaveApprovalThresholdBody.parse(req.body);
  money(threshold, true);
  await mutateClub(club => {
    club.approvalThreshold = threshold;
    log(club, req, "settings", `حد موافقة الرئيس صار ${fmt(threshold)} د.ك`, `President approval limit set to KWD ${fmt(threshold)}`);
  });
  res.json({ message: "تم حفظ حد الموافقة" });
});
saqfiRouter.post("/requests/:id/decision", only("president"), async (req, res) => {
  const { approve, note } = DecideRequestBody.parse(req.body);
  let message = "";
  await mutateClub(club => {
    const r = club.requests.find(x => x.id === req.params.id);
    if (!r) throw new ClubError(404, "الطلب غير موجود", "Request not found.");
    if (r.status !== "pending") throw new ClubError(409, "تم البت في هذا الطلب من قبل", "This request was already decided.");
    r.decidedAt = new Date().toISOString();
    r.note = note?.trim().slice(0, 250) || undefined;
    const cat = club.categories.find(c => c.id === r.categoryId);
    if (!cat) throw new ClubError(404, "الفئة غير موجودة", "Category not found.");
    if (!approve) {
      r.status = "rejected";
      log(club, req, "reject", `رفض طلب: ${r.description} ${fmt(r.amount)} د.ك`, `Rejected: ${r.description} KWD ${fmt(r.amount)}`);
      message = "تم رفض الطلب";
      return;
    }
    // If the category cannot hold it, the president's approval moves the shortfall from the reserve.
    const left = (id: string) => fils(categories(club).find(c => c.id === id)!.remaining);
    const short = fils(r.amount) - left(cat.id);
    if (short > 0) {
      const reserve = club.categories.find(c => c.id === "reserve");
      const reserveLeft = reserve ? left("reserve") : 0;
      if (!reserve || cat.id === "reserve" || reserveLeft < short)
        throw new ClubError(409, `الاحتياطي ما يكفي لتغطية الفرق (${fmt(kwd(short))} د.ك)`,
          `The reserve cannot cover the shortfall (KWD ${fmt(kwd(short))}).`, kwd(short - Math.max(0, reserveLeft)));
      reserve.cap = kwd(fils(reserve.cap) - short);
      cat.cap = kwd(fils(cat.cap) + short);
      r.fromReserve = kwd(short);
    }
    r.status = "approved";
    club.transactions.push({ id: randomUUID(), categoryId: r.categoryId, amount: r.amount, description: r.description,
      date: r.date, type: "expense", ...(r.currency ? { currency: r.currency, originalAmount: r.originalAmount, rate: r.rate } : {}) });
    log(club, req, "approve", `موافقة: ${r.description} ${fmt(r.amount)} د.ك${short > 0 ? `، ونقل ${fmt(kwd(short))} د.ك من الاحتياطي` : ""}`,
      `Approved: ${r.description} KWD ${fmt(r.amount)}${short > 0 ? `, KWD ${fmt(kwd(short))} moved from reserve` : ""}`);
    message = short > 0 ? `تمت الموافقة ونقلنا ${fmt(kwd(short))} د.ك من الاحتياطي` : "تمت الموافقة وانسجل المصروف";
  });
  res.json({ message });
});

saqfiRouter.post("/wallet/withdraw", only("player"), async (req, res) => {
  const { amount } = WithdrawWalletBody.parse(req.body);
  money(amount);
  const ownId = "player-1";
  await mutateClub(club => {
    const balance = club.wallet.filter(w => w.playerId === ownId).reduce((s, w) => s + fils(w.amount), 0);
    if (fils(amount) > balance)
      throw new ClubError(400, `الرصيد ما يكفي (المتاح ${fmt(kwd(balance))} د.ك)`, `Insufficient balance (available KWD ${fmt(kwd(balance))}).`);
    club.wallet.push({ id: randomUUID(), playerId: ownId, date: new Date().toISOString(), amount: -amount, kind: "withdrawal",
      description: "تحويل إلى الحساب البنكي (تجريبي)", descriptionEn: "Transfer to bank account (test)" });
    log(club, req, "withdraw", `سحب ${fmt(amount)} د.ك من محفظة اللاعب`, `Player withdrew KWD ${fmt(amount)} from wallet`);
  });
  res.status(201).json({ message: "انرسل التحويل لحسابك البنكي (تجريبي)" });
});

saqfiRouter.use(only("manager"));
saqfiRouter.put("/budget", async (req, res) => {
  const input = SaveBudgetBody.parse(req.body);
  money(input.total);
  input.categories.forEach(c => money(c.cap, true));
  await mutateClub(club => {
    const ids = input.categories.map(c => c.id);
    if (ids.length !== club.categories.length || new Set(ids).size !== ids.length ||
        club.categories.some(c => !ids.includes(c.id)))
      throw new ClubError(400, "أرسل سقوف كل البنود دون تكرار", "Provide every category cap without duplicates.");
    club.totalBudget = input.total;
    club.categories = club.categories.map(c => ({ ...c, cap: input.categories.find(v => v.id === c.id)!.cap }));
    log(club, req, "budget", `تعديل الميزانية: ${fmt(input.total)} د.ك`, `Budget edited: KWD ${fmt(input.total)}`);
  });
  res.json({ message: "تم حفظ ميزانية الموسم" });
});
saqfiRouter.post("/contracts", async (req, res) => {
  const input = CreateContractBody.parse(req.body);
  money(input.salary);
  validDate(input.start); validDate(input.end);
  if (input.name.trim().length < 2 || input.nameEn.trim().length < 2 ||
      input.name.length > 120 || input.nameEn.length > 120 || input.position.length > 60)
    throw new ClubError(400, "أدخل بيانات اللاعب بشكل صحيح", "Enter valid player details.");
  await mutateClub(club => {
    if (input.start < club.seasonStart || input.end > club.seasonEnd || input.end < input.start)
      throw new ClubError(400, "يجب أن يقع العقد ضمن الموسم ويكون تاريخ النهاية بعد البداية", "Contract dates must be ordered and within the season.");
    const lastPaidMonth = club.payrolls.map(p => p.month).sort().at(-1);
    if (lastPaidMonth && input.start.slice(0, 7) <= lastPaidMonth)
      throw new ClubError(400, "لا يمكن إضافة عقد يبدأ في شهر صُرفت رواتبه؛ اختر شهرًا لاحقًا", "Choose a start month after the latest completed payroll.");
    const contract: Contract = { ...input, id: randomUUID(), name: input.name.trim(), nameEn: input.nameEn.trim() };
    if (!contractMonths(club, contract).length)
      throw new ClubError(400, "مدة العقد غير صالحة", "Invalid contract duration.");
    club.contracts.push(contract);
    log(club, req, "contract", `عقد جديد: ${contract.name} براتب ${fmt(contract.salary)} د.ك`, `New contract: ${contract.nameEn} at KWD ${fmt(contract.salary)}`);
  });
  res.status(201).json({ message: "تم تسجيل العقد وحجز إجمالي التزامه" });
});
saqfiRouter.post("/expenses", async (req, res) => {
  const e = await expenseInput(req.body);
  let sent = false;
  await mutateClub(club => {
    sent = false;
    checkExpense(club, e);
    // Large amounts never post directly: they wait for the president.
    if (club.approvalThreshold > 0 && fils(e.amount) >= fils(club.approvalThreshold)) {
      sent = true;
      club.requests.push({ id: randomUUID(), categoryId: e.categoryId, amount: e.amount, description: e.description, date: e.date,
        status: "pending", reason: "threshold", requestedAt: new Date().toISOString(), ...e.foreign });
      log(club, req, "request", `طلب موافقة: ${e.description} ${fmt(e.amount)} د.ك`, `Approval requested: ${e.description} KWD ${fmt(e.amount)}`);
      return;
    }
    club.transactions.push({ categoryId: e.categoryId, amount: e.amount, description: e.description, date: e.date,
      id: randomUUID(), type: "expense", ...e.foreign });
    log(club, req, "expense", `مصروف: ${e.description} ${fmt(e.amount)} د.ك`, `Expense: ${e.description} KWD ${fmt(e.amount)}`);
  });
  res.status(sent ? 202 : 201).json(sent
    ? { message: "المبلغ فوق حد الموافقة، فانرسل لرئيس النادي", pending: true }
    : { message: "تم تسجيل المصروف", pending: false });
});
saqfiRouter.post("/requests", async (req, res) => {
  const e = await expenseInput(CreateRequestBody.parse(req.body));
  await mutateClub(club => {
    checkExpense(club, e);
    club.requests.push({ id: randomUUID(), categoryId: e.categoryId, amount: e.amount, description: e.description, date: e.date,
      status: "pending", reason: "cap", requestedAt: new Date().toISOString(), ...e.foreign });
    log(club, req, "request", `طلب تجاوز سقف: ${e.description} ${fmt(e.amount)} د.ك`, `Over-cap request: ${e.description} KWD ${fmt(e.amount)}`);
  });
  res.status(201).json({ message: "انرسل الطلب لرئيس النادي", pending: true });
});
saqfiRouter.put("/bonus-rules", async (req, res) => {
  const rules = SaveBonusRulesBody.parse(req.body);
  money(rules.win, true); money(rules.draw, true);
  await mutateClub(club => {
    club.bonusRules = { win: rules.win, draw: rules.draw };
    log(club, req, "settings", `مكافأة الفوز ${fmt(rules.win)} والتعادل ${fmt(rules.draw)} د.ك`, `Win bonus KWD ${fmt(rules.win)}, draw KWD ${fmt(rules.draw)}`);
  });
  res.json({ message: "تم حفظ المكافآت" });
});
saqfiRouter.post("/matches", async (req, res) => {
  const m = CreateMatchBody.parse(req.body);
  validDate(m.date);
  if (m.opponent.trim().length < 2 || m.opponent.length > 80) throw new ClubError(400, "اكتب اسم الخصم", "Enter the opponent's name.");
  let message = "";
  await mutateClub(club => {
    if (m.date < club.seasonStart || m.date > club.seasonEnd || m.date > today())
      throw new ClubError(400, "تاريخ المباراة لازم داخل الموسم ومو بالمستقبل", "Match date must be in the season and not in the future.");
    const ids = [...new Set(m.playerIds)];
    if (ids.some(id => !club.contracts.some(c => c.id === id))) throw new ClubError(400, "في لاعب مو مسجل", "Unknown player.");
    const result = m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor === m.goalsAgainst ? "D" : "L";
    const per = result === "W" ? club.bonusRules.win : result === "D" ? club.bonusRules.draw : 0;
    const id = randomUUID();
    const players = per > 0 ? ids : [];
    const opponent = m.opponent.trim();
    for (const playerId of players) club.adjustments.push({ id: randomUUID(), playerId, kind: "bonus", amount: per, date: m.date, matchId: id,
      reason: `${result === "W" ? "مكافأة فوز" : "مكافأة تعادل"} على ${opponent}` });
    const bonusTotal = kwd(fils(per) * players.length);
    club.matches.push({ id, date: m.date, opponent, opponentEn: m.opponentEn.trim() || opponent, home: m.home,
      goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst, competition: m.competition.trim() || "الدوري", result, bonusPlayers: players.length, bonusTotal });
    log(club, req, "match", `نتيجة ${m.goalsFor}-${m.goalsAgainst} ضد ${opponent}${bonusTotal ? `، مكافآت ${fmt(bonusTotal)} د.ك` : ""}`,
      `Result ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponentEn.trim() || opponent}${bonusTotal ? `, bonuses KWD ${fmt(bonusTotal)}` : ""}`);
    message = bonusTotal ? `انسجلت النتيجة وانحجزت مكافآت ${fmt(bonusTotal)} د.ك لـ ${players.length} لاعب` : "انسجلت النتيجة";
  });
  res.status(201).json({ message });
});
saqfiRouter.post("/adjustments", async (req, res) => {
  const a = CreateAdjustmentBody.parse(req.body);
  money(a.amount); validDate(a.date);
  if (a.reason.trim().length < 2 || a.reason.length > 200) throw new ClubError(400, "اكتب السبب", "Enter a reason.");
  await mutateClub(club => {
    const c = club.contracts.find(x => x.id === a.playerId);
    if (!c) throw new ClubError(404, "اللاعب غير موجود", "Player not found.");
    if (a.date < club.seasonStart || a.date > today())
      throw new ClubError(400, "التاريخ لازم داخل الموسم ومو بالمستقبل", "Date must be in the season and not in the future.");
    if (a.kind === "fine" && pending(club, "fine", c.id) + fils(a.amount) > Math.round(fils(c.salary) * FINE_LIMIT))
      throw new ClubError(400, `الغرامات المعلقة على اللاعب ما تتعدى نص راتبه (${fmt(c.salary * FINE_LIMIT)} د.ك)`,
        `Pending fines may not exceed half the monthly salary (KWD ${fmt(c.salary * FINE_LIMIT)}).`);
    club.adjustments.push({ id: randomUUID(), playerId: c.id, kind: a.kind, amount: a.amount, reason: a.reason.trim(), date: a.date });
    log(club, req, a.kind, `${a.kind === "bonus" ? "مكافأة" : "غرامة"} ${fmt(a.amount)} د.ك على ${c.name}: ${a.reason.trim()}`,
      `${a.kind === "bonus" ? "Bonus" : "Fine"} KWD ${fmt(a.amount)} for ${c.nameEn}: ${a.reason.trim()}`);
  });
  res.status(201).json({ message: a.kind === "bonus" ? "انحجزت المكافأة وبتنصرف مع الراتب الجاي" : "انسجلت الغرامة وبتنخصم من الراتب الجاي" });
});
saqfiRouter.delete("/adjustments/:id", async (req, res) => {
  await mutateClub(club => {
    const a = club.adjustments.find(x => x.id === req.params.id);
    if (!a) throw new ClubError(404, "غير موجود", "Not found.");
    if (a.settledMonth) throw new ClubError(409, "انصرفت مع الرواتب، ما تقدر تلغيها", "Already paid with payroll; it cannot be removed.");
    if (a.matchId) throw new ClubError(409, "مكافآت المباراة مربوطة بنتيجتها", "Match bonuses are tied to the match result.");
    club.adjustments = club.adjustments.filter(x => x.id !== a.id);
    const c = club.contracts.find(x => x.id === a.playerId);
    log(club, req, "cancel", `إلغاء ${a.kind === "bonus" ? "مكافأة" : "غرامة"} ${fmt(a.amount)} د.ك على ${c?.name ?? ""}`,
      `Cancelled ${a.kind} KWD ${fmt(a.amount)} for ${c?.nameEn ?? ""}`);
  });
  res.json({ message: "تم الإلغاء" });
});
saqfiRouter.post("/payroll", async (req, res) => {
  const { month } = RunPayrollBody.parse(req.body);
  if (Number(month.slice(5)) < 1 || Number(month.slice(5)) > 12)
    throw new ClubError(400, "الشهر غير صالح", "Invalid month.");
  await mutateClub(club => { payrollEffect(club, req, month); });
  res.status(201).json({ message: "تم تسجيل الرواتب محاسبيًا؛ لم يحدث أي تحويل بنكي" });
});

/** Record a month's payroll; when it was paid through the gateway, each net salary lands in the player's wallet. */
function payrollEffect(club: Club, req: Request, month: string, paid?: { paymentId: string }) {
  {
    if (club.payrolls.some(p => p.month === month))
      throw new ClubError(409, "تم تسجيل رواتب هذا الشهر مسبقًا؛ لا يمكن صرفها مرتين", "This month has already been paid. Duplicate payroll is not allowed.");
    if (month > today().slice(0, 7))
      throw new ClubError(400, "لا يمكن صرف رواتب شهر مستقبلي", "Future payroll is not allowed.");
    const state = snapshot(club, dataMode, today());
    if (month !== state.nextPayrollMonth)
      throw new ClubError(400, "ابدأ بأقدم شهر غير مدفوع ضمن الموسم", "Run the oldest unpaid month in the season first.");
    const { lines, settle } = payrollLines(club, month);
    if (!lines.length) throw new ClubError(400, "لا توجد عقود مستحقة لهذا الشهر", "No eligible contracts for this month.");
    for (const a of club.adjustments) if (settle.includes(a.id)) a.settledMonth = month;
    const total = kwd(lines.reduce((s, l) => s + fils(l.net), 0));
    const paidAt = new Date().toISOString();
    club.payrolls.push({ id: randomUUID(), month, total, paidAt, lines });
    club.transactions.push({
      id: randomUUID(), categoryId: "players", amount: total,
      description: `رواتب اللاعبين — ${month}`, date: today(), type: "payroll",
    });
    if (paid) for (const l of lines) if (fils(l.net) > 0) club.wallet.push({ id: randomUUID(), playerId: l.playerId, date: paidAt, amount: l.net,
      kind: "salary", description: `راتب ${month}`, descriptionEn: `Salary ${month}` });
    log(club, req, "payroll", `صرف رواتب ${month}: ${fmt(total)} د.ك${paid ? " عبر بوابة الدفع" : ""}`, `Ran payroll for ${month}: KWD ${fmt(total)}${paid ? " via the payment gateway" : ""}`);
    return total;
  }
}

/** Sign a market player: transfer fee booked under Transfers, salary reserved from the remaining season. */
function transferEffect(club: Club, req: Request, listingId: string) {
  const l = club.market.find(x => x.id === listingId);
  if (!l) throw new ClubError(404, "اللاعب مو موجود في السوق", "Player not on the market.");
  if (l.status !== "available") throw new ClubError(409, "اللاعب انباع", "This player has already been signed.");
  const lastPaid = club.payrolls.map(p => p.month).sort().at(-1) ?? "";
  const nextAfter = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
  let startMonth = today().slice(0, 7);
  if (lastPaid && startMonth <= lastPaid) startMonth = nextAfter(lastPaid);
  if (`${startMonth}-01` > club.seasonEnd) throw new ClubError(400, "الموسم خلص، ما يمدي توقّع", "The season is over; no signings possible.");
  const contract: Contract = { id: `signed-${l.id}`, name: l.name, nameEn: l.nameEn, position: l.position, salary: l.salary,
    start: `${startMonth}-01`, end: club.seasonEnd };
  club.contracts.push(contract);
  club.transactions.push({ id: randomUUID(), categoryId: "transfers", amount: l.fee, description: `رسوم انتقال: ${l.name}`, date: today(), type: "transfer" });
  l.status = "sold"; l.soldAt = new Date().toISOString();
  log(club, req, "transfer", `تعاقد مع ${l.name} من ${l.fromClub}: رسوم ${fmt(l.fee)} د.ك وراتب ${fmt(l.salary)} د.ك`,
    `Signed ${l.nameEn} from ${l.fromClubEn}: fee KWD ${fmt(l.fee)}, salary KWD ${fmt(l.salary)}`);
}

function origin(req: Request) {
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
  return `${proto}://${host}`;
}

saqfiRouter.post("/payments/checkout", async (req, res) => {
  assertNotLive();
  const input = StartCheckoutBody.parse(req.body);
  let ret: URL;
  try { ret = new URL(input.returnUrl); } catch { throw new ClubError(400, "رابط الرجوع غير صالح", "Invalid return URL."); }
  if (ret.origin !== origin(req) && ret.origin !== String(req.headers.origin ?? ""))
    throw new ClubError(400, "رابط الرجوع لازم يكون من نفس التطبيق", "Return URL must be on this app.");
  const back = `${ret.origin}${ret.pathname}`;

  // Dry run on a copy: caps and rules are checked BEFORE anyone is charged.
  const club = await readClub();
  const draft = structuredClone(club);
  let amount = 0, description = "", descriptionEn = "", ref = "";
  if (input.kind === "payroll") {
    const month = input.month ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) throw new ClubError(400, "الشهر غير صالح", "Invalid month.");
    amount = payrollEffect(draft, req, month)!;
    description = `رواتب اللاعبين — ${month}`; descriptionEn = `Player salaries — ${month}`; ref = month;
  } else {
    const l = club.market.find(x => x.id === input.listingId);
    transferEffect(draft, req, input.listingId ?? "");
    amount = l!.fee; ref = l!.id;
    description = `رسوم انتقال ${l!.name}`; descriptionEn = `Transfer fee — ${l!.nameEn}`;
  }
  enforce(draft);
  if (club.payments.some(p => p.status === "pending" && p.kind === input.kind && p.ref === ref)) {
    /* an older unfinished attempt is simply replaced */
  }
  const prov = provider();
  const quote = await chargeQuote(amount);
  const id = randomUUID();
  let url: string | undefined, sessionId: string | undefined;
  if (prov === "stripe") {
    const s = await createCheckout({ paymentId: id, name: `${descriptionEn} (Saqfi)`, chargeAmount: quote.chargeAmount,
      successUrl: `${back}?pay=${id}&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${back}?pay=${id}&cancelled=1` });
    url = s.url; sessionId = s.id;
  }
  await mutateClub(c => {
    for (const p of c.payments) if (p.status === "pending" && p.kind === input.kind && p.ref === ref) p.status = "cancelled";
    c.payments.push({ id, kind: input.kind, ref, description, descriptionEn, amount, status: "pending", provider: prov,
      createdAt: new Date().toISOString(), ...quote, sessionId });
  });
  res.status(201).json({ paymentId: id, provider: prov, url, amount, ...quote });
});

saqfiRouter.post("/payments/:id/confirm", async (req, res) => {
  assertNotLive();
  const { sessionId } = ConfirmPaymentBody.parse(req.body ?? {});
  const before = (await readClub()).payments.find(p => p.id === req.params.id);
  if (!before) throw new ClubError(404, "الدفعة غير موجودة", "Payment not found.");
  if (before.status === "paid") { res.json({ message: "الدفعة مسجلة من قبل" }); return; }
  if (before.status !== "pending") throw new ClubError(409, "الدفعة ملغاة", "This payment was cancelled.");
  let reference = `sandbox-${before.id.slice(0, 8)}`;
  if (before.provider === "stripe") {
    if (!sessionId || sessionId !== before.sessionId) throw new ClubError(400, "مرجع الدفع غير مطابق", "Payment reference does not match.");
    reference = (await verifyCheckout(sessionId, before.id, before.chargeAmount)).reference;
  }
  let message = "";
  await mutateClub(club => {
    const p = club.payments.find(x => x.id === before.id)!;
    if (p.status === "paid") { message = "الدفعة مسجلة من قبل"; return; }
    if (p.kind === "payroll") { payrollEffect(club, req, p.ref, { paymentId: p.id }); message = `انصرفت رواتب ${p.ref} ونزلت في محافظ اللاعبين`; }
    else { transferEffect(club, req, p.ref); message = "تم التعاقد ودُفعت رسوم الانتقال"; }
    p.status = "paid"; p.paidAt = new Date().toISOString(); p.reference = reference;
    log(club, req, "payment", `دفعة ناجحة عبر ${p.provider === "stripe" ? "Stripe" : "البوابة التجريبية"}: ${p.description} ${fmt(p.amount)} د.ك`,
      `Payment captured via ${p.provider}: ${p.descriptionEn} KWD ${fmt(p.amount)}`);
  });
  res.json({ message });
});

saqfiRouter.post("/payments/:id/cancel", async (req, res) => {
  await mutateClub(club => {
    const p = club.payments.find(x => x.id === req.params.id);
    if (!p) throw new ClubError(404, "الدفعة غير موجودة", "Payment not found.");
    if (p.status === "pending") p.status = "cancelled";
  });
  res.json({ message: "انلغت عملية الدفع، وما انخصم شي" });
});
saqfiRouter.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ClubError) {
    res.status(err.status).json({ error: err.message, errorEn: err.errorEn, exceeded: err.exceeded });
    return;
  }
  if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
    res.status(400).json({ error: "تحقق من جميع الحقول المطلوبة", errorEn: "Check all required fields." });
    return;
  }
  // Do not log database error objects: they may include credentials or URIs.
  req.log.error("Saqfi operation failed");
  res.status(503).json({ error: "تعذر إتمام العملية؛ لم تُحفظ التغييرات", errorEn: "Operation unavailable; changes were not saved." });
});
