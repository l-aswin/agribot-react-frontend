/**
 * FormField — labeled wrapper for any form control.
 *
 * Usage (wrapper mode):
 *   <FormField label="Field name">
 *     <input ... />
 *   </FormField>
 *
 * Usage (input shorthand):
 *   <FormField label="Width (m)" type="number" value={w} onChange={setW} placeholder="40" />
 */
export default function FormField({ label, children, type = 'text', value, onChange, placeholder, min, max, step, ...rest }) {
  const isWrapper = children != null;
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {isWrapper ? children : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          {...rest}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
        />
      )}
    </div>
  );
}
