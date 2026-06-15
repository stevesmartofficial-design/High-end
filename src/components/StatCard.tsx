import { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  caption: string;
  icon: ReactNode;
  iconBg: string;
  valueColor?: string;
};

export function StatCard({ label, value, caption, icon, iconBg, valueColor = "text-slate-900" }: Props) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-1 text-3xl font-semibold ${valueColor}`}>{value}</p>
        <p className="mt-1 text-xs text-slate-500">{caption}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg} text-white shadow-md`}>
        {icon}
      </div>
    </div>
  );
}
