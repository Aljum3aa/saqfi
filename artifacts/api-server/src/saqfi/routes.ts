import { Router, type Request, type Response, type NextFunction } from "express";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import {
  LoginDemoBody, SaveBudgetBody, CreateContractBody, CreateExpenseBody, RunPayrollBody,
} from "@workspace/api-zod";
import { ClubError, type Role, type Contract } from "./types";
import { dataMode, mutateClub, readClub } from "./store";
import { contractMonths, fils, kwd, money, snapshot, validDate } from "./finance";

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
function requireManager(req: Request, _res: Response, next: NextFunction) {
  if (session(req)?.role !== "manager")
    return next(new ClubError(403, "هذه العملية متاحة للمدير المالي فقط", "Only the finance manager can perform this action."));
  next();
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
  const state = snapshot(club, dataMode, today());
  if (session(req)!.role === "player") {
    // Do not leak another player's salary or club financials to player sessions.
    const ownId = "player-1";
    res.json({
      ...state, totalBudget: 0, categories: [], spent: 0, committed: 0, remaining: 0,
      forecast: 0, monthlyPayroll: 0, alerts: [], trend: [], nextPayrollMonth: "",
      contracts: state.contracts.filter(c => c.id === ownId),
      payrolls: state.payrolls.map(p => {
        const lines = p.lines.filter(l => l.playerId === ownId);
        return { ...p, lines, total: kwd(lines.reduce((s, l) => s + fils(l.net), 0)) };
      }).filter(p => p.lines.length > 0),
      transactions: [],
    });
    return;
  }
  res.json(state);
});
saqfiRouter.use(requireManager);
saqfiRouter.put("/budget", async (req, res) => {
  const input = SaveBudgetBody.parse(req.body);
  money(input.total);
  input.categories.forEach(c => money(c.cap, true));
  await mutateClub(club => {
    const ids = input.categories.map(c => c.id);
    if (ids.length !== club.categories.length || new Set(ids).size !== ids.length ||
        club.categories.some(c => !ids.includes(c.id)))
      throw new ClubError(400, "أرسل سقوف الفئات الخمس دون تكرار", "Provide all five category caps without duplicates.");
    club.totalBudget = input.total;
    club.categories = club.categories.map(c => ({ ...c, cap: input.categories.find(v => v.id === c.id)!.cap }));
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
  });
  res.status(201).json({ message: "تم تسجيل العقد وحجز إجمالي التزامه" });
});
saqfiRouter.post("/expenses", async (req, res) => {
  const input = CreateExpenseBody.parse(req.body);
  money(input.amount); validDate(input.date);
  if (input.description.trim().length < 2 || input.description.length > 250)
    throw new ClubError(400, "أدخل وصفًا من 2 إلى 250 حرفًا", "Description must be 2–250 characters.");
  await mutateClub(club => {
    if (!club.categories.some(c => c.id === input.categoryId))
      throw new ClubError(404, "الفئة غير موجودة", "Category not found.");
    if (input.date < club.seasonStart || input.date > club.seasonEnd || input.date > today())
      throw new ClubError(400, "تاريخ المصروف يجب أن يكون ضمن الموسم وليس في المستقبل", "Expense date must be in the season and cannot be in the future.");
    club.transactions.push({ ...input, description: input.description.trim(), id: randomUUID(), type: "expense" });
  });
  res.status(201).json({ message: "تم تسجيل المصروف" });
});
saqfiRouter.post("/payroll", async (req, res) => {
  const { month } = RunPayrollBody.parse(req.body);
  if (Number(month.slice(5)) < 1 || Number(month.slice(5)) > 12)
    throw new ClubError(400, "الشهر غير صالح", "Invalid month.");
  await mutateClub(club => {
    if (club.payrolls.some(p => p.month === month))
      throw new ClubError(409, "تم تسجيل رواتب هذا الشهر مسبقًا؛ لا يمكن صرفها مرتين", "This month has already been paid. Duplicate payroll is not allowed.");
    if (month > today().slice(0, 7))
      throw new ClubError(400, "لا يمكن صرف رواتب شهر مستقبلي", "Future payroll is not allowed.");
    const state = snapshot(club, dataMode, today());
    if (month !== state.nextPayrollMonth)
      throw new ClubError(400, "ابدأ بأقدم شهر غير مدفوع ضمن الموسم", "Run the oldest unpaid month in the season first.");
    const lines = club.contracts.filter(c => contractMonths(club, c).includes(month)).map(c => ({
      playerId: c.id, name: c.name, salary: c.salary, bonus: 0, fine: 0, net: c.salary,
    }));
    if (!lines.length) throw new ClubError(400, "لا توجد عقود مستحقة لهذا الشهر", "No eligible contracts for this month.");
    const total = kwd(lines.reduce((s, l) => s + fils(l.net), 0));
    const paidAt = new Date().toISOString();
    club.payrolls.push({ id: randomUUID(), month, total, paidAt, lines });
    club.transactions.push({
      id: randomUUID(), categoryId: "players", amount: total,
      description: `رواتب اللاعبين — ${month}`, date: today(), type: "payroll",
    });
  });
  res.status(201).json({ message: "تم تسجيل الرواتب محاسبيًا؛ لم يحدث أي تحويل بنكي" });
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
