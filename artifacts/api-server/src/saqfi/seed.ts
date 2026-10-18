import type { Adjustment, Club, Listing, Match, Payroll } from "./types";
import { fils, kwd, payrollLines } from "./finance";

/** Fictional players on the market. Fees and salaries are KWD; salary is monthly. */
export function marketSeed(): Listing[] {
  const rows: [string, string, string, number, string, string, string, string, number, number][] = [
    ["فيصل الرفاعي", "Faisal Al-Refaei", "وسط", 24, "الكويت", "Kuwait", "نادي الوادي", "Al-Wadi", 18000, 900],
    ["لوكاس ميندز", "Lucas Mendes", "مهاجم", 27, "البرازيل", "Brazil", "إي سي باهيا", "EC Bahia", 42000, 2400],
    ["عمر الشطي", "Omar Al-Shatti", "مدافع", 22, "الكويت", "Kuwait", "نادي النجوم", "Al-Nujoom", 12000, 700],
    ["يوسف بن علي", "Youssef Ben Ali", "جناح", 25, "تونس", "Tunisia", "النادي الصفاقسي", "CS Sfaxien", 26000, 1300],
    ["سالم العجمي", "Salem Al-Ajmi", "حارس مرمى", 29, "الكويت", "Kuwait", "نادي الشروق", "Al-Shorouq", 9000, 650],
    ["كريم ديالو", "Karim Diallo", "وسط", 26, "السنغال", "Senegal", "جينيراسيون فوت", "Generation Foot", 31000, 1600],
    ["مشاري الهاجري", "Meshari Al-Hajri", "مدافع", 23, "الكويت", "Kuwait", "نادي البحّارة", "Al-Bahhara", 15000, 800],
    ["أندريه سيلفا", "Andre Silva", "مهاجم", 30, "البرتغال", "Portugal", "إف سي فيزيلا", "FC Vizela", 38000, 2200],
  ];
  return rows.map(([name, nameEn, position, age, nationality, nationalityEn, fromClub, fromClubEn, fee, salary], i) => ({
    id: `listing-${i + 1}`, name, nameEn, position, age, nationality, nationalityEn, fromClub, fromClubEn, fee, salary, status: "available" as const,
  }));
}

export function seedClub(): Club {
  const names = [
    ["أحمد العتيبي", "Ahmad Al-Otaibi", "حارس مرمى"],
    ["خالد المطيري", "Khaled Al-Mutairi", "مدافع"],
    ["محمد الرشيدي", "Mohammed Al-Rashidi", "مهاجم"],
    ["يوسف العنزي", "Yousef Al-Enezi", "وسط"],
    ["عبدالله الدوسري", "Abdullah Al-Dosari", "مدافع"],
    ["فهد الشمري", "Fahad Al-Shammari", "وسط"],
    ["سالم الهاجري", "Salem Al-Hajri", "مهاجم"],
    ["ناصر القحطاني", "Nasser Al-Qahtani", "مدافع"],
    ["بدر العازمي", "Bader Al-Azmi", "حارس مرمى"],
    ["علي الكندري", "Ali Al-Kandari", "وسط"],
    ["حسن البلوشي", "Hassan Al-Balushi", "مهاجم"],
    ["راشد السعيد", "Rashed Al-Saeed", "مدافع"],
    ["مشعل الفضلي", "Meshal Al-Fadhli", "وسط"],
    ["عبدالعزيز الحربي", "Abdulaziz Al-Harbi", "مهاجم"],
    ["طلال العجمي", "Talal Al-Ajmi", "مدافع"],
    ["حمد النبهان", "Hamad Al-Nabhan", "وسط"],
    ["إبراهيم الصالح", "Ibrahim Al-Saleh", "مدافع"],
    ["جاسم المري", "Jassem Al-Marri", "وسط"],
    ["سعود الفهد", "Saud Al-Fahad", "مهاجم"],
    ["وليد الغانم", "Waleed Al-Ghanim", "حارس مرمى"],
  ];
  const contracts = names.map(([name, nameEn, position], i) => ({
    id: `player-${i + 1}`, name: name!, nameEn: nameEn!, position: position!,
    salary: 650 + i * 35, start: "2026-07-01", end: "2027-06-30",
  }));
  const bonusRules = { win: 150, draw: 50 };
  // Fictional opponents. The match-day squad (first 18) earns the result bonus.
  const fixtures: [string, string, string, boolean, number, number][] = [
    ["2026-09-04", "نادي النجوم", "Al-Nujoom", true, 2, 0],
    ["2026-09-12", "نادي الشروق", "Al-Shorouq", false, 1, 1],
    ["2026-09-19", "نادي البحّارة", "Al-Bahhara", true, 0, 1],
    ["2026-10-03", "نادي الوادي", "Al-Wadi", false, 3, 1],
    ["2026-10-11", "نادي الريان الشمالي", "North Rayyan", true, 2, 2],
  ];
  const squad = contracts.slice(0, 18).map(c => c.id);
  const adjustments: Adjustment[] = [];
  const matches: Match[] = fixtures.map(([date, opponent, opponentEn, home, gf, ga], i) => {
    const result = gf > ga ? "W" : gf === ga ? "D" : "L";
    const per = result === "W" ? bonusRules.win : result === "D" ? bonusRules.draw : 0;
    const id = `match-${i + 1}`;
    if (per > 0) for (const playerId of squad) adjustments.push({
      id: `${id}-${playerId}`, playerId, kind: "bonus", amount: per, date, matchId: id,
      reason: `${result === "W" ? "مكافأة فوز" : "مكافأة تعادل"} على ${opponent}`,
    });
    return { id, date, opponent, opponentEn, home, goalsFor: gf, goalsAgainst: ga, competition: "الدوري",
      result, bonusPlayers: per > 0 ? squad.length : 0, bonusTotal: per * (per > 0 ? squad.length : 0) };
  });
  adjustments.push(
    { id: "fine-1", playerId: "player-7", kind: "fine", amount: 50, reason: "تأخر عن التدريب", date: "2026-09-09" },
    { id: "fine-2", playerId: "player-11", kind: "fine", amount: 100, reason: "بطاقة حمراء بسبب الاعتراض", date: "2026-10-11" },
    { id: "bonus-x", playerId: "player-3", kind: "bonus", amount: 200, reason: "هدف الجولة", date: "2026-10-03" },
  );
  const club: Club = {
    id: "saqfi-demo-club", revision: 0,
    club: "نادي الصقور", clubEn: "Al-Suqoor FC",
    seasonStart: "2026-07-01", seasonEnd: "2027-06-30", totalBudget: 500000,
    categories: [
      { id: "players", name: "رواتب اللاعبين", nameEn: "Player salaries", cap: 260000 },
      { id: "staff", name: "الجهاز الفني", nameEn: "Technical staff", cap: 60000 },
      { id: "travel", name: "السفر والمعسكرات", nameEn: "Travel & camps", cap: 40000 },
      { id: "equipment", name: "الأطقم والمعدات", nameEn: "Kits & equipment", cap: 25000 },
      { id: "reserve", name: "الاحتياطي", nameEn: "Reserve", cap: 15000 },
      { id: "transfers", name: "الانتقالات", nameEn: "Transfers", cap: 100000 },
    ],
    contracts, payrolls: [], adjustments, matches, bonusRules, approvalThreshold: 5000,
    transactions: [
      { id: "staff-jul", categoryId: "staff", amount: 5000, description: "رواتب الجهاز الفني — يوليو", date: "2026-07-28", type: "expense" },
      { id: "staff-aug", categoryId: "staff", amount: 5000, description: "رواتب الجهاز الفني — أغسطس", date: "2026-08-28", type: "expense" },
      { id: "staff-sep", categoryId: "staff", amount: 5000, description: "رواتب الجهاز الفني — سبتمبر", date: "2026-09-28", type: "expense" },
      { id: "camp-jul", categoryId: "travel", amount: 24000, description: "معسكر الإعداد الصيفي في تركيا", date: "2026-07-15", type: "expense",
        currency: "EUR", originalAmount: 70800, rate: 2.95 },
      { id: "travel-aug", categoryId: "travel", amount: 6500, description: "إقامة وتنقلات الفريق", date: "2026-08-18", type: "expense" },
      { id: "travel-sep", categoryId: "travel", amount: 6300, description: "حجوزات سفر الفريق", date: "2026-09-20", type: "expense" },
      { id: "kits", categoryId: "equipment", amount: 12500, description: "أطقم الموسم الجديد", date: "2026-07-10", type: "expense" },
      { id: "balls", categoryId: "equipment", amount: 3250, description: "معدات التدريب والكرات", date: "2026-08-08", type: "expense" },
    ],
    requests: [{
      id: "req-doha", categoryId: "travel", amount: 9000, description: "معسكر الدوحة الشتوي", date: "2026-10-15",
      status: "pending", reason: "threshold", requestedAt: "2026-10-15T09:30:00.000Z",
      currency: "QAR", originalAmount: 106650, rate: 11.85,
    }],
    audit: [], market: marketSeed(), payments: [], wallet: [], invoices: [], installments: [], advances: [],
  };
  // Run the seeded months through the same payroll logic the API uses.
  for (const month of ["2026-07", "2026-08", "2026-09"]) {
    const { lines, settle } = payrollLines(club, month);
    for (const a of club.adjustments) if (settle.includes(a.id)) a.settledMonth = month;
    const p: Payroll = { id: `payroll-${month}`, month, lines, paidAt: `${month}-28T10:00:00.000Z`,
      total: kwd(lines.reduce((s, l) => s + fils(l.net), 0)) };
    club.payrolls.push(p);
    club.transactions.push({ id: `txn-${month}`, categoryId: "players", amount: p.total,
      description: `رواتب اللاعبين — ${month}`, date: p.paidAt.slice(0, 10), type: "payroll" });
  }
  const at = (d: string, h: string) => `${d}T${h}:00.000Z`;
  club.audit = [
    { id: "a1", at: at("2026-07-01", "08:00"), role: "president", action: "budget", detail: "اعتماد ميزانية الموسم 400,000 د.ك", detailEn: "Approved the season budget of KWD 400,000" },
    ...club.payrolls.map((p, i) => ({ id: `a-p${i}`, at: p.paidAt, role: "manager" as const, action: "payroll",
      detail: `صرف رواتب ${p.month}: ${Math.round(p.total).toLocaleString("en-US")} د.ك`, detailEn: `Ran payroll for ${p.month}: KWD ${Math.round(p.total).toLocaleString("en-US")}` })),
    ...club.matches.map((m, i) => ({ id: `a-m${i}`, at: at(m.date, "22:00"), role: "manager" as const, action: "match",
      detail: `نتيجة ${m.goalsFor}-${m.goalsAgainst} ضد ${m.opponent}${m.bonusTotal ? `، مكافآت ${m.bonusTotal} د.ك` : ""}`,
      detailEn: `Result ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponentEn}${m.bonusTotal ? `, bonuses KWD ${m.bonusTotal}` : ""}` })),
    { id: "a-req", at: "2026-10-15T09:30:00.000Z", role: "manager", action: "request", detail: "طلب موافقة: معسكر الدوحة الشتوي 9,000 د.ك", detailEn: "Approval requested: Doha winter camp KWD 9,000" },
  ];
  return club;
}
