/**
 * FilterSelect — labeled <select> for filter dropdowns.
 *
 * Props:
 *   label    — string label shown above the select
 *   value    — current value
 *   onChange — (newValue: string) => void
 *   options  — [{ value: string, label: string }]
 */
export default function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
