import { PMRecord, PMStatus, autoStatusColors, computeDueInfo, formatDueLabel, PMAutoStatus } from "../data";
import { ChevronDown, ChevronUp, ChevronsUpDown, Calendar as CalIcon, AlertCircle, Clock } from "lucide-react";

export type SortKey = keyof PMRecord | null;
export type SortDir = "asc" | "desc";

type Props = {
  records: PMRecord[];
  referenceDate: Date;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: keyof PMRecord) => void;
  onUpdateStatus: (sno: number, pmIndex: 1 | 2 | 3, status: PMStatus) => void;
  onUpdateDate: (sno: number, pmIndex: 1 | 2 | 3, date: string) => void;
};

function HeaderCell({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  className = "",
}: {
  label: string;
  k: keyof PMRecord;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: keyof PMRecord) => void;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <th
      scope="col"
      className={`sticky top-0 z-10 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      <button
        onClick={() => onSort(k)}
        className="flex items-center gap-1 hover:text-slate-700"
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        )}
      </button>
    </th>
  );
}

function PMCellGroup({
  record,
  pmIndex,
  referenceDate,
  onUpdateStatus,
  onUpdateDate,
}: {
  record: PMRecord;
  pmIndex: 1 | 2 | 3;
  referenceDate: Date;
  onUpdateStatus: (sno: number, pmIndex: 1 | 2 | 3, status: PMStatus) => void;
  onUpdateDate: (sno: number, pmIndex: 1 | 2 | 3, date: string) => void;
}) {
  const pm = record[`pm${pmIndex}` as keyof PMRecord] as { sch: string; done: PMStatus };
  const due = computeDueInfo(pm, referenceDate);
  const displayStatus: PMAutoStatus = due.effective;
  const colors = autoStatusColors[displayStatus];

  // Convert MM/DD/YYYY -> YYYY-MM-DD for <input type="date">
  const toDateInput = (s: string) => {
    const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!parts) return s;
    let [, m, d, y] = parts;
    if (y.length === 2) y = "20" + y;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-1 min-w-[120px]">
      <div className="relative group">
        <input
          type="date"
          value={toDateInput(pm.sch)}
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              const [y, m, d] = v.split("-");
              onUpdateDate(record.sno, pmIndex, `${m}/${d}/${y}`);
            }
          }}
          className="w-[110px] rounded-md border border-slate-200 bg-white py-1 pl-7 pr-1 text-[11px] text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <CalIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>

      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${colors.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}></span>
        {displayStatus}
      </div>

      <div className="relative">
        <select
          value={pm.done}
          onChange={(e) => onUpdateStatus(record.sno, pmIndex, e.target.value as PMStatus)}
          title="Manual status. Pending means auto-calculate from the scheduled date."
          className="select-caret appearance-none rounded-md border border-slate-200 bg-white px-2 py-0.5 pr-6 text-[10px] text-slate-500 outline-none cursor-pointer hover:text-slate-700"
        >
          <option value="Pending">Auto</option>
          <option value="Done">Done</option>
          <option value="Overdue">Force overdue</option>
          <option value="N/A">N/A</option>
        </select>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-slate-500">
        {displayStatus === "Overdue" ? (
          <AlertCircle className="h-3 w-3 text-rose-500" />
        ) : displayStatus === "Due Soon" ? (
          <Clock className="h-3 w-3 text-amber-500" />
        ) : displayStatus === "Done" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
        )}
        <span className={colors.text}>{formatDueLabel(due.daysUntil)}</span>
      </div>
    </div>
  );
}

export function PMTable({ records, referenceDate, sortKey, sortDir, onSort, onUpdateStatus, onUpdateDate }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead>
          <tr>
            <HeaderCell label="SNO" k="sno" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-12" />
            <HeaderCell label="CAMPUS" k="campus" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="DEPARTMENT" k="department" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="INVENTORY NO" k="inventoryNo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="LOCATION" k="location" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="EQUIPMENT" k="equipment" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="MODEL" k="model" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="SERIAL NO" k="serialNo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="MAKE" k="make" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <HeaderCell label="CONTRACT" k="contract" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th colSpan={3} className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              PM 1
            </th>
            <th colSpan={3} className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              PM 2
            </th>
            <th colSpan={3} className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              PM 3
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {records.map((r) => (
            <tr key={r.sno} className="hover:bg-slate-50/60">
              <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.sno}</td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{r.campus}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.department}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600">{r.inventoryNo}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.location}</td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{r.equipment}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.model}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600">{r.serialNo}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.make}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.contract}</td>
              <td colSpan={3} className="px-3 py-2">
                <PMCellGroup record={r} pmIndex={1} referenceDate={referenceDate} onUpdateStatus={onUpdateStatus} onUpdateDate={onUpdateDate} />
              </td>
              <td colSpan={3} className="px-3 py-2">
                <PMCellGroup record={r} pmIndex={2} referenceDate={referenceDate} onUpdateStatus={onUpdateStatus} onUpdateDate={onUpdateDate} />
              </td>
              <td colSpan={3} className="px-3 py-2">
                <PMCellGroup record={r} pmIndex={3} referenceDate={referenceDate} onUpdateStatus={onUpdateStatus} onUpdateDate={onUpdateDate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 && (
        <div className="py-16 text-center text-sm text-slate-500">No records match your filters.</div>
      )}
    </div>
  );
}
