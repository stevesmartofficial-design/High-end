import * as XLSX from "xlsx";
import { PMRecord, PMStatus, initialRecords } from "./data";

const HEADERS = [
  "SNO",
  "CAMPUS",
  "DEPARTMENT",
  "INVENTORY NO",
  "LOCATION",
  "EQUIPMENT",
  "MODEL",
  "SERIAL NO",
  "MAKE",
  "CONTRACT",
  "PM1 SCH",
  "PM1 DONE",
  "PM2 SCH",
  "PM2 DONE",
  "PM3 SCH",
  "PM3 DONE",
];

function toRow(r: PMRecord) {
  return {
    SNO: r.sno,
    CAMPUS: r.campus,
    DEPARTMENT: r.department,
    "INVENTORY NO": r.inventoryNo,
    LOCATION: r.location,
    EQUIPMENT: r.equipment,
    MODEL: r.model,
    "SERIAL NO": r.serialNo,
    MAKE: r.make,
    CONTRACT: r.contract,
    "PM1 SCH": r.pm1.sch,
    "PM1 DONE": r.pm1.done,
    "PM2 SCH": r.pm2.sch,
    "PM2 DONE": r.pm2.done,
    "PM3 SCH": r.pm3.sch,
    "PM3 DONE": r.pm3.done,
  };
}

function normalizeStatus(v: unknown): PMStatus {
  const s = String(v ?? "").trim();
  if (s === "Done" || s === "Pending" || s === "Overdue" || s === "N/A") return s;
  const lower = s.toLowerCase();
  if (lower.startsWith("done") || lower === "completed" || lower === "complete") return "Done";
  if (lower.startsWith("pend") || lower === "in progress" || lower === "scheduled") return "Pending";
  if (lower.startsWith("over") || lower === "late" || lower === "missed") return "Overdue";
  return "N/A";
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.trim().toLowerCase() === k.toLowerCase()) {
        const v = row[rk];
        if (v != null && v !== "") return String(v);
      }
    }
  }
  return "";
}

function fromRow(row: Record<string, unknown>, fallbackSno: number): PMRecord {
  return {
    sno: Number(row["SNO"] ?? row["sno"] ?? fallbackSno) || fallbackSno,
    campus: pick(row, ["CAMPUS", "Campus"]) || "Main",
    department: pick(row, ["DEPARTMENT", "Department"]) || "ICU",
    inventoryNo: pick(row, ["INVENTORY NO", "InventoryNo", "INVENTORY"]) || "INV-00000",
    location: pick(row, ["LOCATION", "Location"]) || "Block A",
    equipment: pick(row, ["EQUIPMENT", "Equipment"]) || "Ventilator",
    model: pick(row, ["MODEL", "Model"]) || "MX450",
    serialNo: pick(row, ["SERIAL NO", "SerialNo", "SERIAL"]) || "SN000000",
    make: pick(row, ["MAKE", "Make"]) || "Philips",
    contract: pick(row, ["CONTRACT", "Contract"]) || "AMC-Active",
    pm1: {
      sch: pick(row, ["PM1 SCH", "PM1 SCHEDULE", "PM1 Schedule"]) || "01/15/2025",
      done: normalizeStatus(pick(row, ["PM1 DONE", "PM1 STATUS", "PM1 Status"])),
    },
    pm2: {
      sch: pick(row, ["PM2 SCH", "PM2 SCHEDULE", "PM2 Schedule"]) || "04/15/2025",
      done: normalizeStatus(pick(row, ["PM2 DONE", "PM2 STATUS", "PM2 Status"])),
    },
    pm3: {
      sch: pick(row, ["PM3 SCH", "PM3 SCHEDULE", "PM3 Schedule"]) || "07/15/2025",
      done: normalizeStatus(pick(row, ["PM3 DONE", "PM3 STATUS", "PM3 Status"])),
    },
  };
}

export function exportToExcel(records: PMRecord[]) {
  const rows = records.map(toRow);
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(10, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PM Records");
  XLSX.writeFile(wb, `PM_Records_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportToCSV(records: PMRecord[]) {
  const rows = records.map(toRow);
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PM_Records_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(file: File): Promise<PMRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (json.length === 0) {
          resolve(initialRecords);
          return;
        }
        const records: PMRecord[] = json.map((row, i) => fromRow(row, i + 1));
        resolve(records);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
