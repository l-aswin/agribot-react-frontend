import { useState, useEffect, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import useLocalStorage from '../hooks/useLocalStorage';
import { CONFIG_FIELDS } from '../constants';
import { getDevices, createDevice, deleteDevice, checkDeviceName } from '../services/api';

const ROWS_OPTIONS = [8, 10, 20];
const EMPTY_FORM = { name: '', device_id: '', device_secret: '', server_url: '', serial_port: '/dev/ttyUSB0', serial_baud_rate: '115200', camera_index: '0', confidence_threshold: '0.75', camera_vision_width_cm: '50' };

export default function DeviceManager() {
  const [devices,        setDevices]        = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [nameFilter,     setNameFilter]     = useState('');
  const [dateFilter,     setDateFilter]     = useState('');
  const [filterFavs,     setFilterFavs]     = useState(false);
  const [page,           setPage]           = useState(1);
  const [rowsPerPage,    setRowsPerPage]    = useState(8);

  const [favoriteDeviceIds,  setFavoriteDeviceIds]  = useLocalStorage('favoriteDeviceIds', []);
  const [dashboardDeviceIds, setDashboardDeviceIds] = useLocalStorage('dashboardDeviceIds', []);
  const favSet  = new Set(favoriteDeviceIds);
  const dashSet = new Set(dashboardDeviceIds);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  // Create modal
  const [showCreate,   setShowCreate]   = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [nameStatus,   setNameStatus]   = useState(null); // null | 'checking' | 'available' | 'taken'
  const [formErrors,   setFormErrors]   = useState({});
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    getDevices()
      .then(data => { setDevices(data); setLoadingDevices(false); })
      .catch(() => setLoadingDevices(false));

    const interval = setInterval(() => {
      getDevices().then(data => setDevices(data)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = devices.filter(d => {
    const matchName = nameFilter ? d.name.toLowerCase().includes(nameFilter.toLowerCase()) : true;
    const matchDate = dateFilter ? d.created_date === dateFilter : true;
    const matchFav  = filterFavs ? favSet.has(d.id) : true;
    return matchName && matchDate && matchFav;
  });

  const activeDashCount = devices.filter(d => dashSet.has(d.id)).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    setDeleting(true);
    try { await deleteDevice(deleteTarget.id); } catch (_) {}
    setDevices(ds => ds.filter(d => d.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  // ── Create — name uniqueness check ────────────────────────────────────────
  function handleNameChange(val) {
    setForm(f => ({ ...f, name: val }));
    setNameStatus(null);
    clearTimeout(debounceRef.current);
    if (!val.trim()) return;
    setNameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await checkDeviceName(val.trim());
        setNameStatus(res.available ? 'available' : 'taken');
      } catch (_) {
        setNameStatus('available');
      }
    }, 500);
  }

  function handleFormField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    if (formErrors[key]) setFormErrors(e => ({ ...e, [key]: false }));
  }

  const canCreate = nameStatus === 'available' && CONFIG_FIELDS.every(f => form[f.key].trim() !== '');

  async function handleCreate() {
    const errors = {};
    CONFIG_FIELDS.forEach(f => { if (!form[f.key].trim()) errors[f.key] = true; });
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await createDevice({ name: form.name, ...Object.fromEntries(CONFIG_FIELDS.map(f => [f.key, form[f.key]])) });
      setDevices(ds => [created, ...ds]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setNameStatus(null);
      setFormErrors({});
    } catch (err) {
      setCreateError(err.message || 'Failed to create device. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function toggleFavDevice(id) {
    setFavoriteDeviceIds(prev => {
      const set = new Set(prev);
      set.has(id) ? set.delete(id) : set.add(id);
      return [...set];
    });
  }

  function toggleDashDevice(id) {
    setDashboardDeviceIds(prev => {
      const set = new Set(prev);
      if (set.has(id)) {
        set.delete(id);
      } else if (set.size < 2) {
        set.add(id);
      }
      return [...set];
    });
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setNameStatus(null);
    setFormErrors({});
    setCreateError(null);
    setShowCreate(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageLayout title="Device Manager">

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Search by name</label>
              <input
                type="text" value={nameFilter} placeholder="Device name…"
                onChange={e => { setNameFilter(e.target.value); setPage(1); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Created date</label>
              <input
                type="date" value={dateFilter}
                onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setFilterFavs(v => !v); setPage(1); }}
                title={filterFavs ? 'Show all devices' : 'Show favourites only'}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border cursor-pointer transition-colors ${
                  filterFavs ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={filterFavs ? '#f59e0b' : 'none'} stroke={filterFavs ? '#f59e0b' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Favourites
              </button>
            </div>
            {(nameFilter || dateFilter || filterFavs) && (
              <div className="flex items-end">
                <button onClick={() => { setNameFilter(''); setDateFilter(''); setFilterFavs(false); setPage(1); }}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 cursor-pointer">
                  Reset
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
              activeDashCount >= 2 ? 'bg-green-50 border-green-300 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              Dashboard: {activeDashCount}/2
            </span>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add device
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Devices</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Rows per page:</span>
            <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer">
              {ROWS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs text-slate-400">
              {filtered.length === 0 ? '0 results' : `${(safePage - 1) * rowsPerPage + 1}–${Math.min(safePage * rowsPerPage, filtered.length)} of ${filtered.length}`}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Device Name</th>
                <th className="text-left px-5 py-3">Connectivity</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Created</th>
                <th className="px-3 py-3 text-center" title="Favourite">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </th>
                <th className="px-3 py-3 text-center" title="Pin to Dashboard">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingDevices ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3"><div className="h-3 bg-slate-200 rounded w-32" /></td>
                    <td className="px-5 py-3"><div className="h-3 bg-slate-200 rounded w-16" /></td>
                    <td className="px-5 py-3"><div className="h-3 bg-slate-200 rounded w-12" /></td>
                    <td className="px-5 py-3"><div className="h-3 bg-slate-200 rounded w-20" /></td>
                    <td /><td /><td />
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">No devices found.</td></tr>
              ) : pageRows.map(d => {
                const isFav    = favSet.has(d.id);
                const isDash   = dashSet.has(d.id);
                const dashFull = activeDashCount >= 2 && !isDash;
                return (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{d.name}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${d.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <span className={d.status === 'online' ? 'text-green-700' : 'text-slate-400'}>
                          {d.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        d.status === 'working' ? 'bg-green-100 text-green-700'
                        : d.status === 'idle'  ? 'bg-amber-100 text-amber-700'
                        :                        'bg-slate-100 text-slate-500'}`}>
                        {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{d.created_at?.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => toggleFavDevice(d.id)} title={isFav ? 'Remove from favourites' : 'Add to favourites'}
                        className="p-1 rounded hover:bg-slate-100 cursor-pointer transition-colors">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={isFav ? '#f59e0b' : 'none'} stroke={isFav ? '#f59e0b' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => !dashFull && toggleDashDevice(d.id)}
                        title={isDash ? 'Remove from dashboard' : dashFull ? 'Max 2 devices on dashboard' : 'Pin to dashboard'}
                        className={`p-1 rounded transition-colors ${dashFull ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer'}`}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={isDash ? '#15803d' : 'none'} stroke={isDash ? '#15803d' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                        </svg>
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDeleteTarget(d)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer transition-colors">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-1 px-5 py-3 border-t border-slate-100">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${n === safePage ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} maxWidth="max-w-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Delete device?</p>
              <p className="text-sm text-slate-500">This will permanently remove <span className="font-medium text-slate-700">{deleteTarget.name}</span>.</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={deleting}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 cursor-pointer transition-colors">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* Create device modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Add new device</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Device name <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="text" value={form.name} onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Field Bot Gamma"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 pr-8" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm">
                  {nameStatus === 'checking'  && <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin inline-block"/>}
                  {nameStatus === 'available' && <span className="text-green-600 font-bold">✓</span>}
                  {nameStatus === 'taken'     && <span className="text-red-500 font-bold">✗</span>}
                </span>
              </div>
              {nameStatus === 'taken'     && <p className="text-xs text-red-500 mt-1">Name already in use — choose a different one.</p>}
              {nameStatus === 'available' && <p className="text-xs text-green-600 mt-1">Name is available.</p>}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Configuration</p>
              {CONFIG_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label} <span className="text-red-500">*</span></label>
                  <input type="text" value={form[f.key]} onChange={e => handleFormField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 ${formErrors[f.key] ? 'border-red-400 focus:ring-red-400' : 'border-slate-200'}`} />
                  {formErrors[f.key] && <p className="text-xs text-red-500 mt-1">This field is required.</p>}
                </div>
              ))}
            </div>

            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!canCreate || creating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg disabled:opacity-40 cursor-pointer transition-colors">
                {creating
                  ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/> Creating…</>
                  : 'Create device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
