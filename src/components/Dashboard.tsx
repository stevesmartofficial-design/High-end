import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  Calendar as CalIcon,
  Package,
  Clock,
  X,
  Save,
  Loader2,
  Database,
} from "lucide-react";
import {
  initialRecords,
  PMRecord,
  PMStatus,
  computeDueInfo,
  today,
  toISODate,
  formatDate,
  PMAutoStatus,
} from "../data";
import { StatCard } from "./StatCard";
import { PMBarChart } from "./PMBarChart";
import { DonutChart } from "./DonutChart";
import { PMTable, SortDir, SortKey } from "./PMTable";
import { exportToExcel, exportToCSV, importFromFile } from "../io";
import { loadRecordsFromBackend, saveRecordsToBackend } from "../backend";

type BackendStatus = "connecting" | "connected" | "saving" | "saved" | "offline" | "error";

export function Dashboard() {
  const [records, setRecords] = useState<PMRecord[]>(initialRecords);
  const [search, setSearch] = useState("");
  const [campus, setCampus] = useState("All");
  const [dept, setDept] = useState("All");
  const [contract, setContract] = useState("All");
  const [status, setStatus] = useState("Any status");
  const [sortKey, setSortKey] = useState<SortKey>("sno");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("connecting");
  const [backendMessage, setBackendMessage] = useState("Connecting backend...");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backendReadyRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  // The "as-of" date the dashboard is evaluated against. Defaults to today.
  // Users can pick a different date to see how the dashboard would look in the past/future.
  const [asOf, setAsOf] = useState<Date>(today());
  // Keep "now" up to date so date-based calculations stay accurate.
  const [now, setNow] = useState<Date>(today());
  useEffect(() => {
    const id = setInterval(() => setNow(today()), 60_000);
    return () => clearInterval(id);
  }, []);

  const referenceDate = asOf; // what dates are compared against

  useEffect(() => {
    let active = true;

    async function loadBackendData() {
      setBackendStatus("connecting");
      setBackendMessage("Connecting backend...");
      const result = await loadRecordsFromBackend();
      if (!active) return;

      if (!result.ok) {
        backendReadyRef.current = false;
        setBackendStatus("offline");
        setBackendMessage(result.message || "Backend is not connected.");
        return;
      }

      backendReadyRef.current = true;
      setBackendStatus("connected");
      setBackendMessage(result.records?.length ? "Loaded saved backend records." : "Backend connected. Click Save to store sample data.");

      if (result.records?.length) {
        skipNextSaveRef.current = true;
        setRecords(result.records);
      }
      if (result.updatedAt) setLastSavedAt(result.updatedAt);
    }

    loadBackendData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!backendReadyRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setBackendStatus("saving");
    setBackendMessage("Saving changes to backend...");
    const id = setTimeout(async () => {
      const result = await saveRecordsToBackend(records);
      if (result.ok) {
        setBackendStatus("saved");
        setBackendMessage("All changes saved to backend.");
        setLastSavedAt(result.updatedAt || new Date().toISOString());
      } else {
        setBackendStatus("error");
        setBackendMessage(result.message || "Could not save to backend.");
      }
    }, 900);

    return () => clearTimeout(id);
  }, [records]);

  // Derived lists for filter dropdowns
  const campuses = useMemo(() => Array.from(new Set(records.map((r) => r.campus))).sort(), [records]);
  const departments = useMemo(() => Array.from(new Set(records.map((r) => r.department))).sort(), [records]);
  const contracts = useMemo(() => Array.from(new Set(records.map((r) => r.contract))).sort(), [records]);

  // Compute effective status for each PM
  const effectiveForRecord = (r: PMRecord) => {
    return [computeDueInfo(r.pm1, referenceDate), computeDueInfo(r.pm2, referenceDate), computeDueInfo(r.pm3, referenceDate)];
  };

  // Filter
  const filtered = useMemo(() => {
    return records.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        [r.campus, r.department, r.inventoryNo, r.location, r.equipment, r.model, r.serialNo, r.make]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesCampus = campus === "All" || r.campus === campus;
      const matchesDept = dept === "All" || r.department === dept;
      const matchesContract = contract === "All" || r.contract === contract;
      const eff = effectiveForRecord(r).map((d) => {
        // Lock to manual Done / N/A when set
        if (d.manual === "Done" || d.manual === "N/A") return d.manual as PMAutoStatus;
        return d.effective;
      });
      const matchesStatus =
        status === "Any status" || eff.some((s) => s === status);
      return matchesSearch && matchesCampus && matchesDept && matchesContract && matchesStatus;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, search, campus, dept, contract, status, referenceDate]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey] as unknown;
      const bv = b[sortKey] as unknown;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const s = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? s : -s;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Stats (computed dynamically based on referenceDate)
  const stats = useMemo(() => {
    const counts: Record<PMAutoStatus, number> = {
      Done: 0,
      Pending: 0,
      Overdue: 0,
      "N/A": 0,
      "Due Soon": 0,
    };
    let earliestOverdueDays = 0;
    let nearestDueDays = Number.POSITIVE_INFINITY;
    let totalPMScheduled = 0;

    records.forEach((r) => {
      effectiveForRecord(r).forEach((d) => {
        let s: PMAutoStatus;
        if (d.manual === "Done" || d.manual === "N/A") s = d.manual as PMAutoStatus;
        else s = d.effective;
        counts[s] = (counts[s] || 0) + 1;
        if (s === "Overdue" || s === "Due Soon" || s === "Pending") {
          totalPMScheduled++;
          if (s === "Overdue" && d.daysUntil < earliestOverdueDays) earliestOverdueDays = d.daysUntil;
          if (d.daysUntil < nearestDueDays) nearestDueDays = d.daysUntil;
        }
      });
    });

    const scheduled = counts.Done + counts.Pending + counts["Due Soon"] + counts.Overdue;
    const compliance = scheduled > 0 ? Math.round((counts.Done / scheduled) * 100) : 0;
    return {
      counts,
      compliance,
      total: records.length,
      earliestOverdueDays,
      nearestDueDays: Number.isFinite(nearestDueDays) ? nearestDueDays : null,
      totalPMScheduled,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, referenceDate]);

  const handleSort = (k: keyof PMRecord) => {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const handleUpdateStatus = (sno: number, pmIndex: 1 | 2 | 3, status: PMStatus) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.sno !== sno) return r;
        const key = `pm${pmIndex}` as const;
        return { ...r, [key]: { ...r[key], done: status } };
      })
    );
  };

  const handleUpdateDate = (sno: number, pmIndex: 1 | 2 | 3, date: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.sno !== sno) return r;
        const key = `pm${pmIndex}` as const;
        return { ...r, [key]: { ...r[key], sch: date } };
      })
    );
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importFromFile(file);
      setRecords(imported);
      setImportMsg(`Successfully imported ${imported.length} records from "${file.name}"`);
      setTimeout(() => setImportMsg(null), 4000);
    } catch (err) {
      setImportMsg(`Failed to import: ${(err as Error).message}`);
      setTimeout(() => setImportMsg(null), 4000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleReset = () => {
    setRecords(initialRecords);
    setSearch("");
    setCampus("All");
    setDept("All");
    setContract("All");
    setStatus("Any status");
    setAsOf(today());
    setImportMsg(`Reset to sample data (${initialRecords.length} records)`);
    setTimeout(() => setImportMsg(null), 3000);
  };

  const handleSaveNow = async () => {
    setBackendStatus("saving");
    setBackendMessage("Saving changes to backend...");
    const result = await saveRecordsToBackend(records);
    if (result.ok) {
      backendReadyRef.current = true;
      setBackendStatus("saved");
      setBackendMessage("All changes saved to backend.");
      setLastSavedAt(result.updatedAt || new Date().toISOString());
    } else {
      setBackendStatus("error");
      setBackendMessage(result.message || "Could not save to backend.");
    }
  };

  const isViewingToday = toISODate(asOf) === toISODate(now);
  const overdueCaption =
    stats.earliestOverdueDays < 0
      ? `Oldest: ${Math.abs(stats.earliestOverdueDays)} days late`
      : "Requires immediate attention";
  const dueSoonCount = stats.counts["Due Soon"];
  const backendClass =
    backendStatus === "saved" || backendStatus === "connected"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : backendStatus === "saving" || backendStatus === "connecting"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  const backendLabel =
    backendStatus === "connecting"
      ? "Connecting"
      : backendStatus === "saving"
        ? "Saving"
        : backendStatus === "saved"
          ? "Saved"
          : backendStatus === "connected"
            ? "Backend ready"
            : "Backend offline";
  const savedTime = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Preventive Maintenance Dashboard</h1>
              <p className="text-xs text-slate-500">Auto-calculated PM status from scheduled dates</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* As-of date picker */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm">
              <CalIcon className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500">As of</span>
              <input
                type="date"
                value={toISODate(asOf)}
                onChange={(e) => {
                  if (e.target.value) {
                    const [y, m, d] = e.target.value.split("-").map(Number);
                    setAsOf(new Date(y, m - 1, d));
                  }
                }}
                className="bg-transparent text-sm font-medium text-slate-800 outline-none w-[120px]"
              />
              {!isViewingToday && (
                <button
                  onClick={() => setAsOf(today())}
                  className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                  title="Reset to today"
                >
                  Today
                </button>
              )}
              {isViewingToday && (
                <span className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              )}
            </div>

            <div
              className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium ${backendClass}`}
              title={backendMessage}
            >
              {backendStatus === "saving" || backendStatus === "connecting" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5" />
              )}
              <span>{backendLabel}</span>
              {savedTime && backendStatus !== "connecting" && (
                <span className="hidden sm:inline opacity-75">{savedTime}</span>
              )}
            </div>

            <button
              onClick={handleSaveNow}
              disabled={backendStatus === "saving" || backendStatus === "connecting"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {backendStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <Upload className="h-4 w-4" /> Import
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((s) => !s)}
                onBlur={() => setTimeout(() => setShowExportMenu(false), 150)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <Download className="h-4 w-4" /> Export
                <svg className="h-3 w-3 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-30">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); exportToExcel(sorted); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (.xlsx)
                  </button>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); exportToCSV(sorted); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg"
                  >
                    <FileText className="h-4 w-4 text-sky-600" /> CSV (.csv)
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <RefreshCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>
        {importMsg && (
          <div className="mx-auto max-w-[1600px] px-6 pb-3">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {importMsg}
              <button onClick={() => setImportMsg(null)} className="ml-auto text-emerald-700 hover:text-emerald-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Equipment"
            value={stats.total}
            caption={`${stats.total} tracked assets`}
            iconBg="bg-indigo-500"
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            label="PM Overdue"
            value={stats.counts.Overdue}
            caption={overdueCaption}
            iconBg="bg-rose-500"
            valueColor="text-rose-600"
            icon={<AlertTriangle className="h-6 w-6" />}
          />
          <StatCard
            label="PM Due Soon"
            value={dueSoonCount}
            caption="Within next 7 days"
            iconBg="bg-amber-500"
            valueColor="text-amber-600"
            icon={<Clock className="h-6 w-6" />}
          />
          <StatCard
            label="Compliance Rate"
            value={`${stats.compliance}%`}
            caption={`${stats.counts.Done} done / ${stats.counts.Done + stats.counts.Pending + stats.counts["Due Soon"] + stats.counts.Overdue} scheduled`}
            iconBg="bg-emerald-500"
            icon={<CheckCircle2 className="h-6 w-6" />}
          />
        </div>

        {/* As-of banner (only show when not today) */}
        {!isViewingToday && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800 flex items-center gap-2">
            <CalIcon className="h-4 w-4" />
            <span>
              Viewing dashboard as of <strong>{formatDate(toISODate(asOf))}</strong> (not today).
            </span>
            <button
              onClick={() => setAsOf(today())}
              className="ml-auto text-xs font-medium underline-offset-2 hover:underline"
            >
              Return to today
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SNO, equipment, serial, location…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 className="h-3.5 w-3.5" />
            <span>Campus</span>
            <select
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              className="select-caret rounded-md border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-sm text-slate-700"
            >
              <option>All</option>
              {campuses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Dept</span>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="select-caret rounded-md border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-sm text-slate-700"
            >
              <option>All</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Contract</span>
            <select
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              className="select-caret rounded-md border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-sm text-slate-700"
            >
              <option>All</option>
              {contracts.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select-caret rounded-md border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-sm text-slate-700"
            >
              <option>Any status</option>
              <option>Done</option>
              <option>Pending</option>
              <option>Due Soon</option>
              <option>Overdue</option>
              <option>N/A</option>
            </select>
          </div>
          <div className="ml-auto text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{sorted.length}</span> of {records.length}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">PM Status by Campus</h2>
                <p className="text-xs text-slate-500">Auto-calculated from scheduled dates as of {formatDate(toISODate(asOf))}</p>
              </div>
            </div>
            <PMBarChart records={records} referenceDate={referenceDate} />
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Overall PM Distribution</h2>
              <p className="text-xs text-slate-500">Across all scheduled dates</p>
            </div>
            <DonutChart data={stats.counts} />
          </div>
        </div>

        {/* Table */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Equipment PM Schedule</h2>
              <p className="text-xs text-slate-500">
                Status auto-recalculates from each scheduled date. Edit the date or click the chip to override.
              </p>
            </div>
          </div>
          <PMTable
            records={sorted}
            referenceDate={referenceDate}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onUpdateStatus={handleUpdateStatus}
            onUpdateDate={handleUpdateDate}
          />
        </div>

        <footer className="pt-4 pb-8 text-center text-xs text-slate-400">
          Preventive Maintenance Dashboard · Built with React + Vite + Tailwind
        </footer>
      </main>
    </div>
  );
}
