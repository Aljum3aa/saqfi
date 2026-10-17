import type { Club, Payroll } from "./types";
import { fils, kwd } from "./finance";

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
  const payrolls: Payroll[] = ["2026-07", "2026-08", "2026-09"].map(month => {
    const lines = contracts.map(c => ({
      playerId: c.id, name: c.name, salary: c.salary, bonus: 0, fine: 0, net: c.salary,
    }));
    return { id: `payroll-${month}`, month, lines,
      total: kwd(lines.reduce((s, l) => s + fils(l.net), 0)), paidAt: `${month}-28T10:00:00.000Z` };
  });
  return {
    id: "saqfi-demo-club", revision: 0,
    club: "نادي الصقور", clubEn: "Al-Suqoor FC",
    seasonStart: "2026-07-01", seasonEnd: "2027-06-30", totalBudget: 400000,
    categories: [
      { id: "players", name: "رواتب اللاعبين", nameEn: "Player salaries", cap: 260000 },
      { id: "staff", name: "الجهاز الفني", nameEn: "Technical staff", cap: 60000 },
      { id: "travel", name: "السفر والمعسكرات", nameEn: "Travel & camps", cap: 40000 },
      { id: "equipment", name: "الأطقم والمعدات", nameEn: "Kits & equipment", cap: 25000 },
      { id: "reserve", name: "الاحتياطي", nameEn: "Reserve", cap: 15000 },
    ],
    contracts, payrolls,
    transactions: [
      ...payrolls.map(p => ({ id: `txn-${p.month}`, categoryId: "players", amount: p.total,
        description: `رواتب اللاعبين — ${p.month}`, date: p.paidAt.slice(0, 10), type: "payroll" })),
      { id: "staff-jul", categoryId: "staff", amount: 5000, description: "رواتب الجهاز الفني — يوليو", date: "2026-07-28", type: "expense" },
      { id: "staff-aug", categoryId: "staff", amount: 5000, description: "رواتب الجهاز الفني — أغسطس", date: "2026-08-28", type: "expense" },
      { id: "staff-sep", categoryId: "staff", amount: 5000, description: "رواتب الجهاز الفني — سبتمبر", date: "2026-09-28", type: "expense" },
      { id: "camp-jul", categoryId: "travel", amount: 24000, description: "معسكر الإعداد الصيفي", date: "2026-07-15", type: "expense" },
      { id: "travel-aug", categoryId: "travel", amount: 6500, description: "إقامة وتنقلات الفريق", date: "2026-08-18", type: "expense" },
      { id: "travel-sep", categoryId: "travel", amount: 6300, description: "حجوزات سفر الفريق", date: "2026-09-20", type: "expense" },
      { id: "kits", categoryId: "equipment", amount: 12500, description: "أطقم الموسم الجديد", date: "2026-07-10", type: "expense" },
      { id: "balls", categoryId: "equipment", amount: 3250, description: "معدات التدريب والكرات", date: "2026-08-08", type: "expense" },
    ],
  };
}
