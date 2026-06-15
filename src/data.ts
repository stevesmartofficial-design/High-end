export type PMStatus = "Done" | "Pending" | "Overdue" | "N/A";
export type PMAutoStatus = "Done" | "Pending" | "Overdue" | "N/A" | "Due Soon";

export type PMRecord = {
  sno: number;
  campus: string;
  department: string;
  inventoryNo: string;
  location: string;
  equipment: string;
  model: string;
  serialNo: string;
  make: string;
  contract: string;
  pm1: { sch: string; done: PMStatus };
  pm2: { sch: string; done: PMStatus };
  pm3: { sch: string; done: PMStatus };
};

const campuses = ["Main", "North", "South", "East"];
const departments = ["Radiology", "Cardiology", "ICU", "Lab", "OT", "ER", "OPD", "Pathology"];
const locations = ["Block A", "Block B", "Block C", "Wing 1", "Wing 2", "Wing 3", "Basement", "Ground Floor"];
const equipmentList = [
  "Ventilator",
  "Defibrillator",
  "X-Ray Machine",
  "Ultrasound",
  "Infusion Pump",
  "Patient Monitor",
  "ECG Machine",
  "Anesthesia Machine",
  "CT Scanner",
  "MRI Machine",
  "Dialysis Unit",
  "Autoclave",
];
const makes = ["Philips", "GE", "Siemens", "Mindray", "Drager", "Medtronic", "Fujifilm", "Toshiba"];
const models = ["MX450", "Logiq V2", "Avasys", "Efficia", "IntelliVue", "V60", "LightSpeed", "MAGNETOM"];
const contracts = ["AMC-Active", "CMC-Active", "Warranty", "Outsourced", "In-house"];

/**
 * Format an ISO date "YYYY-MM-DD" as "MM/DD/YYYY" for display.
 */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

/**
 * Parse "MM/DD/YYYY" or "YYYY-MM-DD" into a Date at local midnight.
 */
export function parseDate(value: string): Date | null {
  if (!value) return null;
  const s = value.trim();
  // MM/DD/YYYY
  const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    let [, mm, dd, yy] = slash;
    let y = Number(yy);
    if (yy.length === 2) y = 2000 + y;
    const d = new Date(y, Number(mm) - 1, Number(dd));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Convert a Date to ISO "YYYY-MM-DD".
 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Days between two dates (b - a), ignoring time.
 */
export function daysBetween(a: Date, b: Date): number {
  const ms = 1000 * 60 * 60 * 24;
  const aMid = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid - aMid) / ms);
}

/**
 * Returns "Today" as a local Date at midnight.
 */
export function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const DUE_SOON_DAYS = 7; // a PM is "Due Soon" if within 7 days

export type DueInfo = {
  daysUntil: number; // negative = overdue, positive = upcoming
  effective: PMAutoStatus; // effective status auto-computed from the date
  manual: PMStatus; // what the user manually set
  isOverridden: boolean; // true if manual != effective
};

export function computeDueInfo(pm: { sch: string; done: PMStatus }, now: Date = today()): DueInfo {
  const sch = parseDate(pm.sch);
  if (!sch) {
    return { daysUntil: 0, effective: "N/A", manual: pm.done, isOverridden: false };
  }
  const daysUntil = daysBetween(now, sch);
  let effective: PMAutoStatus;
  if (pm.done === "Done") {
    effective = "Done";
  } else if (pm.done === "N/A") {
    effective = "N/A";
  } else if (pm.done === "Overdue") {
    effective = "Overdue";
  } else if (daysUntil < 0) {
    effective = "Overdue";
  } else if (daysUntil <= DUE_SOON_DAYS) {
    effective = "Due Soon";
  } else {
    effective = "Pending";
  }
  return { daysUntil, effective, manual: pm.done, isOverridden: pm.done !== effective && !(pm.done === "N/A") };
}

function makeRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Build sample PM schedule dates so that, relative to the current date,
 * a healthy mix of Done / Pending / Due Soon / Overdue shows up.
 */
function buildSampleDates() {
  const now = today();
  const isoDays = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return toISODate(d);
  };
  // Templates: [pm1 offset days, pm2 offset days, pm3 offset days, manual status for pm1]
  // We'll generate a mix on the fly per record
  return { isoDays, now };
}

export const initialRecords: PMRecord[] = (() => {
  const { isoDays } = buildSampleDates();
  const records: PMRecord[] = [];
  // 24 records, each with 3 PMs. Distribute statuses so demo has variety.
  // Distribution: 5 records with all 3 PMs Done, 6 with mixed, rest with various.
  // We'll just pseudo-randomize with a seeded RNG.
  const rng = makeRandom(123);

  // status templates: -1 = done manually; otherwise the # of days from today
  // Each entry is [pm1Days, pm1StatusOverride, pm2Days, pm2StatusOverride, pm3Days, pm3StatusOverride]
  // StatusOverride = "DONE" | "" (auto)
  const templates: Array<[number, string, number, string, number, string]> = [
    [-20, "DONE", -5, "", 15, ""],          // 1 done, 1 overdue, 1 upcoming
    [-30, "DONE", -10, "DONE", 25, ""],     // 2 done, 1 upcoming
    [-45, "DONE", -15, "DONE", -2, ""],     // 2 done, 1 overdue
    [3, "", 20, "", 40, ""],                // all upcoming
    [-60, "DONE", -30, "DONE", -10, "DONE"],// all done
    [-2, "", 10, "", 30, ""],               // overdue, upcoming, upcoming
    [-90, "DONE", 1, "", 18, ""],           // done, due soon, upcoming
    [-15, "", 5, "", 22, ""],               // overdue, due soon, upcoming
    [-200, "DONE", -100, "DONE", -50, "DONE"], // all done (old)
    [-8, "", 12, "", 28, ""],               // overdue, upcoming, upcoming
    [-25, "DONE", -3, "", 14, ""],          // done, overdue, upcoming
    [0, "", 17, "", 35, ""],                // due today, upcoming, upcoming
    [-12, "", -2, "", 8, ""],               // 2 overdue, 1 due soon
    [-70, "DONE", -40, "DONE", 2, ""],      // 2 done, 1 due soon
    [-18, "DONE", 4, "", 20, ""],           // done, due soon, upcoming
    [-3, "", 10, "", 25, ""],               // overdue, upcoming, upcoming
    [-150, "DONE", -80, "DONE", -20, "DONE"],// all done
    [6, "", 22, "", 38, ""],                // all upcoming
    [-1, "", 14, "", 30, ""],               // overdue, upcoming, upcoming
    [-22, "DONE", 3, "", 17, ""],           // done, due soon, upcoming
    [-9, "", -4, "", 11, ""],               // 2 overdue, 1 upcoming
    [-35, "DONE", -18, "DONE", 7, ""],      // 2 done, 1 due soon
    [-4, "", 13, "", 26, ""],               // overdue, upcoming, upcoming
    [-55, "DONE", 2, "", 19, ""],           // done, due soon, upcoming
  ];

  for (let i = 0; i < 24; i++) {
    const t = templates[i] || templates[0];
    const r = makeRandom(i * 7 + 3);
    const campus = campuses[Math.floor(r() * campuses.length)] ?? "Main";
    const done: PMStatus = "Done";
    const other: PMStatus = "Pending";
    const mk = (days: number, override: string): { sch: string; done: PMStatus } => {
      const doneFlag = override === "DONE";
      return { sch: isoDays(days), done: doneFlag ? done : other };
    };
    records.push({
      sno: i + 1,
      campus,
      department: departments[Math.floor(r() * departments.length)] ?? "ICU",
      inventoryNo: "INV-" + Math.floor(10000 + r() * 89999),
      location: locations[Math.floor(r() * locations.length)] ?? "Block A",
      equipment: equipmentList[Math.floor(r() * equipmentList.length)] ?? "Ventilator",
      model: models[Math.floor(r() * models.length)] ?? "MX450",
      serialNo: "SN" + Math.floor(100000 + r() * 899999),
      make: makes[Math.floor(r() * makes.length)] ?? "Philips",
      contract: contracts[Math.floor(r() * contracts.length)] ?? "AMC-Active",
      pm1: mk(t[0], t[1]),
      pm2: mk(t[2], t[3]),
      pm3: mk(t[4], t[5]),
    });
  }
  // touch rng to satisfy unused warning
  void rng;
  return records;
})();

export const statusColors: Record<PMStatus, { dot: string; chip: string; text: string; bar: string }> = {
  Done: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700", text: "text-emerald-700", bar: "#10b981" },
  Pending: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700", text: "text-amber-700", bar: "#f59e0b" },
  Overdue: { dot: "bg-rose-500", chip: "bg-rose-100 text-rose-700", text: "text-rose-700", bar: "#f43f5e" },
  "N/A": { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600", text: "text-slate-600", bar: "#94a3b8" },
};

export const autoStatusColors: Record<PMAutoStatus, { dot: string; chip: string; text: string; bar: string }> = {
  ...statusColors,
  "Due Soon": { dot: "bg-orange-500", chip: "bg-orange-100 text-orange-700", text: "text-orange-700", bar: "#f97316" },
};

/**
 * Format the days-until value into a short human label:
 * "Today", "in 3 days", "5 days overdue", "Yesterday"
 */
export function formatDueLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days overdue`;
}
