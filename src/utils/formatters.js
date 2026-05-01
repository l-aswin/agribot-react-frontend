/**
 * Format an ISO datetime string to a human-readable date + time.
 * @param {string} iso
 * @param {string} [separator=' '] - separator between date and time parts
 */
export function formatDateTime(iso, separator = ' ') {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    separator +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

export const formatDuration = (seconds) => {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
};

/**
 * Return Tailwind bg+text classes for a weed count severity level.
 */
export function weedCountColorClass(count) {
  if (count >= 100) return 'bg-red-100 text-red-700';
  if (count >= 50)  return 'bg-orange-100 text-orange-700';
  return 'bg-green-100 text-green-700';
}
