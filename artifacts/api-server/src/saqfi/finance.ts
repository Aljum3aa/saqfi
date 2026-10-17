import { ClubError, type Club, type Contract } from "./types";

// All arithmetic is integer fils. Public API and Mongo amounts are KWD.
export const fils = (n: number) => Math.round(n * 1000);
export const kwd = (n: number) => n / 1000;
export function money(n: number, allowZero = false) {
  if (!Number.isFinite(n) || !Number.isSafeInteger(fils(n)) || Math.abs(n * 1000 - fils(n)) > 0.00001 ||
      n > 1_000_000_000 || (allowZero ? n < 0 : n <= 0))
    throw new ClubError(400, "أدخل مبلغًا صحيحًا بثلاث منازل عشرية كحد أقصى", "Enter a valid amount with at most three decimals.");
  return n;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value)
    throw new ClubError(400, "التاريخ غير صالح", "Invalid date.");
  return value;
}
export function months(start: string, end: string) {
  const a = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1;
  const b = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1;
  if (b < a || b - a > 59) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => {
    const n = a + i;
    return `${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, "0")}`;
  });
}
export function contractMonths(club: Club, c: Contract) {
  return months(c.start > club.seasonStart ? c.start : club.seasonStart,
    c.end < club.seasonEnd ? c.end : club.seasonEnd);
}
export function outstanding(club: Club, contract: Contract) {
  return contractMonths(club, contract).filter(month =>
    !club.payrolls.some(p => p.month === month && p.lines.some(l => l.playerId === contract.id))
  ).length * fils(contract.salary);
}
export function categories(club: Club) {
  return club.categories.map(c => {
    const spent = club.transactions.filter(t => t.categoryId === c.id).reduce((sum, t) => sum + fils(t.amount), 0);
    const committed = c.id === "players" ? club.contracts.reduce((sum, contract) => sum + outstanding(club, contract), 0) : 0;
    return { ...c, spent: kwd(spent), committed: kwd(committed), remaining: kwd(fils(c.cap) - spent - committed) };
  });
}
export function enforce(club: Club) {
  const values = categories(club);
  for (const c of values) {
    if (fils(c.remaining) < 0) {
      const exceeded = kwd(-fils(c.remaining));
      throw new ClubError(409,
        `رُفضت العملية: تجاوز سقف «${c.name}» بمقدار ${exceeded.toFixed(3)} د.ك`,
        `Rejected: ${c.nameEn} cap exceeded by KWD ${exceeded.toFixed(3)}.`, exceeded);
    }
  }
  const total = values.reduce((sum, c) => sum + fils(c.cap), 0);
  if (total !== fils(club.totalBudget))
    throw new ClubError(400, "يجب أن يساوي مجموع سقوف الفئات ميزانية الموسم", "Category caps must sum to the season budget.");
}
export function snapshot(club: Club, mode: "demo" | "database", today: string) {
  const cats = categories(club);
  const spent = kwd(cats.reduce((s, c) => s + fils(c.spent), 0));
  const committed = kwd(cats.reduce((s, c) => s + fils(c.committed), 0));
  const seasonMonths = months(club.seasonStart, club.seasonEnd);
  const currentMonth = today.slice(0, 7);
  const elapsed = Math.max(1, Math.min(seasonMonths.length, seasonMonths.filter(m => m <= currentMonth).length));
  const overdue = seasonMonths.filter(m => m < currentMonth && club.contracts.some(c =>
    contractMonths(club, c).includes(m) && !club.payrolls.some(p => p.month === m && p.lines.some(l => l.playerId === c.id))));
  const nextPayrollMonth = seasonMonths.find(m => m <= currentMonth && club.contracts.some(c =>
    contractMonths(club, c).includes(m) && !club.payrolls.some(p => p.month === m && p.lines.some(l => l.playerId === c.id))))
    ?? seasonMonths.find(m => m > currentMonth) ?? "";
  const alerts = cats.filter(c => c.spent >= c.cap * .8 && c.cap > 0).map(c => ({
    id: c.id, type: "cap",
    message: `بلغ الصرف في «${c.name}» ${(c.spent / c.cap * 100).toFixed(0)}% من السقف`,
    messageEn: `${c.nameEn} spending has reached ${(c.spent / c.cap * 100).toFixed(0)}% of its cap.`,
  }));
  for (const month of overdue) alerts.push({
    id: `late-${month}`, type: "late",
    message: `رواتب ${month} متأخرة ولم تُسجّل بعد`,
    messageEn: `Payroll for ${month} is overdue and has not been recorded.`,
  });
  const trend = seasonMonths.filter(m => m <= currentMonth).map(month => ({
    month, amount: kwd(club.transactions.filter(t => t.date.startsWith(month)).reduce((s, t) => s + fils(t.amount), 0)),
  }));
  return {
    club: club.club, clubEn: club.clubEn, seasonStart: club.seasonStart, seasonEnd: club.seasonEnd,
    totalBudget: club.totalBudget, mode, categories: cats,
    contracts: club.contracts.map(c => ({
      ...c, totalCost: kwd(contractMonths(club, c).length * fils(c.salary)),
      outstanding: kwd(outstanding(club, c)),
    })),
    payrolls: [...club.payrolls].sort((a, b) => b.month.localeCompare(a.month)),
    transactions: [...club.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    alerts, trend, spent, committed, remaining: kwd(fils(club.totalBudget) - fils(spent) - fils(committed)),
    forecast: kwd(Math.round(fils(spent) / elapsed * seasonMonths.length)),
    monthlyPayroll: kwd(club.contracts.filter(c => contractMonths(club, c).includes(currentMonth)).reduce((s, c) => s + fils(c.salary), 0)),
    nextPayrollMonth, today,
  };
}
