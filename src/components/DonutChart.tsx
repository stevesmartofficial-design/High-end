import { PMAutoStatus, autoStatusColors } from "../data";

type Props = {
  data: Record<PMAutoStatus, number>;
};

const order: PMAutoStatus[] = ["Done", "Pending", "Due Soon", "Overdue", "N/A"];

export function DonutChart({ data }: Props) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const size = 220;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          {order.map((k) => {
            const v = data[k] || 0;
            const len = (v / total) * circumference;
            const seg = (
              <circle
                key={k}
                r={radius}
                cx={0}
                cy={0}
                fill="transparent"
                stroke={autoStatusColors[k].bar}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return seg;
          })}
        </g>
      </svg>
      <div className="-mt-32 mb-32 text-center pointer-events-none">
        <div className="text-3xl font-semibold text-slate-900">{total}</div>
        <div className="text-xs text-slate-500">Total PMs</div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
        {order.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: autoStatusColors[k].bar }}></span>
            <span className="text-slate-600">{k}</span>
            <span className="font-semibold text-slate-900">{data[k] || 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}