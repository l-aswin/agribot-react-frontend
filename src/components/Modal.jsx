/**
 * Modal — full-screen backdrop with a centred card.
 *
 * Props:
 *   onClose   — called when the backdrop is clicked
 *   maxWidth? — Tailwind max-w class (default 'max-w-md')
 *   children
 */
export default function Modal({ onClose, maxWidth = 'max-w-md', children }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} p-6`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
