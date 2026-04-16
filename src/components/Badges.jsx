import { weedCountColorClass } from '../utils/formatters';

/**
 * StatusBadge — shows online/offline/working/idle for a device.
 * Props: status (string), online (boolean)
 */
export function StatusBadge({ status, online }) {
  if (!online) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Offline</span>;
  }
  if (status === 'working') {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Working</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Idle</span>;
}

/**
 * WeedBadge — displays a weed count with severity-based colour.
 * Props: count (number)
 */
export function WeedBadge({ count }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${weedCountColorClass(count)}`}>
      {count}
    </span>
  );
}
