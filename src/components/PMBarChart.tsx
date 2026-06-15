import { PMRecord, autoStatusColors, computeDueInfo, PMAutoStatus, today } from "../data";

type Props = {
  records: PMRecord[];
  referenceDate?: Date;
};

const order: PMAutoStatus[] = ["Done", "Pending", "Due Soon", "Overdue", "N/A"];

export function PMBarChart({ records, referenceDate = today() }: Props) {
  const campuses = Array.from(new Set(records.map((r) => r.campus)));
  const data = campuses.map((campus) => {
    const recs = records.filter((r) => r.campus === campus);
    const counts: Record<PMAutoStatus, number> = { Done: 0, Pending: 0, "Due Soon": 0, Overdue: 0, "N/A": 0 };
    recs.forEach((r) => {
      ([r.pm1, r.pm2, r.pm3] as const).forEach((pm) => {
        const due = computeDueInfo(pm, referenceDate);
        counts[due.effective] = (counts[due.effective] || 0) + 1;
      });
    });
    return { campus, counts };
  });

  const maxY = Math.max(
    20,
    ...data.map((d) => order.reduce((sum, key) => sum + d.counts[key], 0))
  );
  const chartHeight = 220;
  const yTicks = 4;

  return (
    <div className="w-full">
      <div className="relative" style={{ height: chartHeight + 30 }}>
        <div className="absolute inset-x-0 top-0" style={{ height: chartHeight }}>
          {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const v = Math.round((maxY / yTicks) * i);
            return (
              <div
                key={i}
                className="absolute w-full border-t border-dashed border-slate-200"
                style={{ top: `${(i / yTicks) * 100}%` }}
              >
                <span className="absolute -left-2 -translate-x-full -translate-y-1/2 text-[11px] text-slate-400">
                  {v}
                </span>
              </div>
            );
          })}
        </div>

        <div className="absolute inset-0 flex items-end justify-around pb-0 pl-6 pr-2" style={{ height: chartHeight }}>
          {data.map((d) => {
            const total = order.reduce((sum, key) => sum + d.counts[key], 0);
            let bottom = 0;
            return (
              <div key={d.campus} className="flex h-full w-16 flex-col items-center justify-end">
                <div
                  className="relative w-10 overflow-hidden rounded-md"
                  style={{ height: `${total === 0 ? 0 : (total / maxY) * 100}%`, minHeight: 2 }}
                >
                  {order.map((key) => {
                    const h = (d.counts[key] / maxY) * 100;
                    const segment = (
                      <div
                        key={key}
                        className="absolute inset-x-0"
                        style={{ bottom: `${bottom}%`, height: `${h}%`, background: autoStatusColors[key].bar }}
                      />
                    );
                    bottom += h;
                    return segment;
                  })}
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500">{d.campus}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
        {order.map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: autoStatusColors[key].bar }}></span>
            <span className="text-slate-600">{key}</span>
          </span>
        ))}
      </div>
    </div>
  );
}