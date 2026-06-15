import { PMStatus, statusColors } from "../data";

export function StatusChip({ status }: { status: PMStatus }) {
  const c = statusColors[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`}></span>
      {status}
    </span>
  );
}
