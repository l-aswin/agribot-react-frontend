import { useEffect } from 'react';

export default function ErrorToast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white border border-red-200 rounded-xl shadow-lg p-4 flex items-start gap-3">
      <div className="shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">Error</p>
        <p className="text-sm text-slate-600 mt-0.5 break-words">{message}</p>
      </div>
      <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
