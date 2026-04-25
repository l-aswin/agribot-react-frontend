import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Legend,
} from 'recharts';
import PageLayout from '../components/PageLayout';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import DensityGrid from '../components/DensityGrid';
import { StatusBadge } from '../components/Badges';
import useLocalStorage from '../hooks/useLocalStorage';
import useErrorToast from '../hooks/useErrorToast';
import {
  getDashboardMetrics, getSpeciesBreakdown, getDensityMap, getFieldPartitionDensity, getRunsChart,
  getFields, createField, deleteField, getDevices,
} from '../services/api';

const MAX_GRID_DIM = 20; // never render more than 20×20 = 400 cells

function downsampleGrid(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return grid;
  if (rows <= MAX_GRID_DIM && cols <= MAX_GRID_DIM) return grid;

  const rStep = rows / MAX_GRID_DIM;
  const cStep = cols / MAX_GRID_DIM;
  const outRows = Math.min(rows, MAX_GRID_DIM);
  const outCols = Math.min(cols, MAX_GRID_DIM);

  // Pick the dominant non-null density value in each sampled block
  const rank = { high: 3, medium: 2, low: 1, empty: 0, null: -1 };
  return Array.from({ length: outRows }, (_, ri) =>
    Array.from({ length: outCols }, (_, ci) => {
      const r0 = Math.floor(ri * rStep), r1 = Math.floor((ri + 1) * rStep);
      const c0 = Math.floor(ci * cStep), c1 = Math.floor((ci + 1) * cStep);
      let best = null;
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          const v = grid[r]?.[c] ?? null;
          if ((rank[v] ?? -1) > (rank[best] ?? -1)) best = v;
        }
      }
      return best;
    })
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [showError, errorToast] = useErrorToast();

  const [fields,   setFields]   = useState([]);
  const [devices,  setDevices]  = useState([]);
  const [metrics,  setMetrics]  = useState({ total_weeds: null, total_runs: null, active_devices: null, total_devices: null });
  const [runsData, setRunsData] = useState([]);
  const [species,  setSpecies]  = useState([]);
  const [grid,     setGrid]     = useState([]);
  const [partitionGrid, setPartitionGrid] = useState([]);

  const [defaultFieldId, setDefaultFieldId] = useLocalStorage('defaultFieldId', null);
  const [favoriteFieldIds, setFavoriteFieldIds] = useLocalStorage('favoriteFieldIds', []);
  const favoriteIds = new Set(favoriteFieldIds);

  const [activeFieldId, setActiveFieldId] = useState(defaultFieldId ?? null);
  const [showManage,    setShowManage]    = useState(false);
  const [showAddField,  setShowAddField]  = useState(false);
  const [addForm, setAddForm] = useState({ name: '', width: '', length: '', partition_type: 'row', partition_count: '' });
  const [addError, setAddError] = useState('');

  const fetchAll = useCallback(async (fieldId, signal) => {
    const [m, r, s, d, p, devs, flds] = await Promise.allSettled([
      getDashboardMetrics(fieldId),
      getRunsChart(fieldId),
      getSpeciesBreakdown(fieldId),
      getDensityMap(fieldId),
      getFieldPartitionDensity(fieldId),
      getDevices(),
      getFields(),
    ]);
    if (signal?.aborted) return null;
    if (m.status === 'fulfilled')    setMetrics(m.value);
    else showError(m.reason?.message || 'Failed to load metrics.');
    if (r.status === 'fulfilled')    setRunsData(r.value);
    else showError(r.reason?.message || 'Failed to load run history.');
    if (s.status === 'fulfilled')    setSpecies(s.value);
    else showError(s.reason?.message || 'Failed to load species breakdown.');
    if (d.status === 'fulfilled')    setGrid(downsampleGrid(d.value));
    else showError(d.reason?.message || 'Failed to load density map.');
    if (p.status === 'fulfilled') {
      console.log('[partition-density] response:', p.value);
      setPartitionGrid(p.value);
    } else {
      console.warn('[partition-density] failed:', p.reason);
    }
    if (devs.status === 'fulfilled') setDevices(devs.value);
    else showError(devs.reason?.message || 'Failed to load devices.');
    if (flds.status === 'fulfilled') {
      setFields(flds.value);
      return flds.value;
    } else {
      showError(flds.reason?.message || 'Failed to load fields.');
      return null;
    }
  }, [showError]);

  // On mount: fetch everything once and initialise the active field ID
  useEffect(() => {
    const controller = new AbortController();
    fetchAll(defaultFieldId, controller.signal).then(fetchedFields => {
      if (!fetchedFields || controller.signal.aborted) return;
      const ids = fetchedFields.map(f => f.id);
      setActiveFieldId(prev =>
        ids.includes(Number(prev)) ? Number(prev) : (ids[0] ?? prev)
      );
    });
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when the user switches fields (activeFieldId set by user action, not by fetchAll)
  useEffect(() => {
    if (activeFieldId == null) return;
    const controller = new AbortController();
    fetchAll(activeFieldId, controller.signal);
    return () => controller.abort();
  }, [activeFieldId, fetchAll]);

  // Poll device status every 30s with in-flight guard
  useEffect(() => {
    let inFlight = false;
    const id = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const devs = await getDevices();
        setDevices(devs);
      } catch (err) {
        showError(err.message || 'Lost connection while polling devices.');
      } finally {
        inFlight = false;
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  function toggleFavorite(id) {
    setFavoriteFieldIds(prev => {
      const set = new Set(prev);
      set.has(id) ? set.delete(id) : set.add(id);
      return [...set];
    });
  }

  function handleLogout() {
    localStorage.removeItem('access_token');
    navigate('/login');
  }

  async function handleDeleteField(id) {
    try {
      await deleteField(id);
    } catch (err) {
      showError(err.message || 'Failed to delete field.');
      return;
    }
    const updated = fields.filter(f => f.id !== id);
    setFields(updated);
    if (activeFieldId === id) setActiveFieldId(updated[0]?.id ?? null);
  }

  async function handleAddField(e) {
    e.preventDefault();
    const { name, width, length, partition_type, partition_count } = addForm;
    if (!name || !width || !length || !partition_count) {
      setAddError('All fields are required.');
      return;
    }
    const body = { name, width: +width, length: +length, partition_type, partition_count: +partition_count };
    try {
      const created = await createField(body);
      setFields(prev => [...prev, created]);
    } catch (err) {
      showError(err.message || 'Failed to create field.');
      return;
    }
    setAddForm({ name: '', width: '', length: '', partition_type: 'row', partition_count: '' });
    setAddError('');
    setShowAddField(false);
    setShowManage(false);
  }

  const activeField = fields.find(f => f.id === activeFieldId) ?? fields[0];

  const layoutPreview = addForm.width && addForm.length && addForm.partition_count
    ? `${addForm.width}×${addForm.length} m · ${addForm.partition_count} ${addForm.partition_type}s`
    : null;

  const logoutBtn = (
    <button
      onClick={handleLogout}
      className="text-sm text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-md px-3 py-1.5 transition-colors cursor-pointer"
    >
      Logout
    </button>
  );

  return (
    <PageLayout title="Dashboard" headerRight={logoutBtn}>
      {errorToast}

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Weeds Detected" value={metrics.total_weeds?.toLocaleString()} />
        <MetricCard label="Total Runs" value={metrics.total_runs} />
        <MetricCard
          label="Active Devices"
          value={metrics.active_devices == null ? null : `${metrics.active_devices} / ${metrics.total_devices}`}
        />
        {/* Device status card */}
        {(() => {
          const dashIds = new Set(JSON.parse(localStorage.getItem('dashboardDeviceIds') ?? '[]'));
          const pinned  = dashIds.size > 0 ? devices.filter(d => dashIds.has(d.id)) : devices;
          return (
            <div className="col-span-2 lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Device Status</p>
              <div className="space-y-2 flex-1">
                {pinned.length === 0 ? (
                  <p className="text-xs text-slate-400">No devices pinned to dashboard.</p>
                ) : pinned.map(d => (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${d.online ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <span className="text-sm text-slate-700 font-medium">{d.name ?? d.id}</span>
                    </div>
                    <StatusBadge status={d.status} online={d.online} />
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/device-manager')}
                className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1 cursor-pointer w-fit"
              >
                View more
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          );
        })()}
      </div>

      {/* ── Field selector + Field stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Field selector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Field</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-full sm:w-[35%] items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 min-w-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              <select
                value={activeFieldId ?? ''}
                onChange={e => setActiveFieldId(Number(e.target.value))}
                className="flex-1 bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer"
              >
                {fields.length === 0 && <option value="">— No fields —</option>}
                {[...fields].sort((a, b) => {
                  if (a.id === defaultFieldId) return -1;
                  if (b.id === defaultFieldId) return 1;
                  if (favoriteIds.has(a.id) && !favoriteIds.has(b.id)) return -1;
                  if (favoriteIds.has(b.id) && !favoriteIds.has(a.id)) return 1;
                  return 0;
                }).map(f => (
                  <option key={f.id} value={f.id}>
                    {f.id === defaultFieldId ? '★ ' : favoriteIds.has(f.id) ? '☆ ' : ''}{f.name} — {f.width}×{f.length} m
                  </option>
                ))}
              </select>
              <StarButton active={favoriteIds.has(activeFieldId)} onClick={() => activeFieldId && toggleFavorite(activeFieldId)} title={favoriteIds.has(activeFieldId) ? 'Remove from favourites' : 'Add to favourites'} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeFieldId === defaultFieldId && activeFieldId && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Default</span>
              )}
              {activeFieldId !== defaultFieldId && activeFieldId && (
                <button
                  onClick={() => activeFieldId && setDefaultFieldId(activeFieldId)}
                  className="text-sm text-green-700 border border-green-300 rounded-lg px-3 py-2 hover:bg-green-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Set as default
                </button>
              )}
              <button
                onClick={() => setShowManage(true)}
                className="text-sm text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Manage fields
              </button>
              <button
                onClick={() => setShowAddField(true)}
                className="text-sm text-white bg-green-700 hover:bg-green-800 rounded-lg px-4 py-2 transition-colors cursor-pointer font-medium"
              >
                + Add field
              </button>
            </div>
          </div>
        </div>

        {/* Field statistics card */}
        {(() => {
          const lastRun   = runsData.length ? runsData[runsData.length - 1] : null;
          const prevRun   = runsData.length > 1 ? runsData[runsData.length - 2] : null;
          const trend     = lastRun && prevRun
            ? lastRun.weeds > prevRun.weeds ? 'up' : lastRun.weeds < prevRun.weeds ? 'down' : 'flat'
            : null;
          const trendDiff = trend && trend !== 'flat' ? Math.abs(lastRun.weeds - prevRun.weeds) : null;
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {activeField?.name ?? '—'} · Statistics
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-slate-400 font-medium">Total runs</p>
                  <p className={`text-2xl font-bold ${metrics.total_runs == null ? 'text-slate-300' : 'text-slate-800'}`}>
                    {metrics.total_runs ?? '—'}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-slate-400 font-medium">Last run</p>
                  <p className={`text-2xl font-bold ${lastRun ? 'text-slate-800' : 'text-slate-300'}`}>
                    {lastRun ? lastRun.run : '—'}
                  </p>
                  {lastRun && <p className="text-xs text-slate-400">{lastRun.weeds} weeds</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-slate-400 font-medium">Weed trend</p>
                  {trend === null ? (
                    <p className="text-2xl font-bold text-slate-300">—</p>
                  ) : trend === 'flat' ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span className="text-sm font-semibold text-slate-500">Stable</span>
                    </div>
                  ) : trend === 'up' ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                      <div>
                        <span className="text-sm font-semibold text-red-500">Increasing</span>
                        <p className="text-xs text-red-400">+{trendDiff} vs prev</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      <div>
                        <span className="text-sm font-semibold text-green-700">Decreasing</span>
                        <p className="text-xs text-green-600">−{trendDiff} vs prev</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">History · 30 days</p>
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Weeds Detected Per Run</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={runsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="run" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Line type="monotone" dataKey="weeds" stroke="#15803d" strokeWidth={2.5} dot={{ r: 4, fill: '#15803d' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Latest Run</p>
          <h2 className="text-sm font-semibold text-slate-800 mb-2">Weed Species Breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={species} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Density Map ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
              Weed Density Map · {activeField?.name}
            </p>
            <h2 className="text-sm font-semibold text-slate-800">
              Last run per {activeField?.partition_type ?? 'row'} · {activeField?.partition_count ?? '—'} {activeField?.partition_type ?? 'row'}s
            </h2>
          </div>
        </div>
        {partitionGrid.length > 0 ? (
          <div className="space-y-1">
            {partitionGrid.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-14 shrink-0 text-right">
                  {activeField?.partition_type === 'column' ? `Col ${i + 1}` : `Row ${i + 1}`}
                </span>
                <DensityGrid grid={[row]} cellSize={18} cellHeight={18} showLegend={i === 0} />
              </div>
            ))}
          </div>
        ) : (
          <DensityGrid grid={grid} cellSize={28} cellHeight={28} showLegend />
        )}
      </div>

      {/* ── Manage fields modal ── */}
      {showManage && (
        <Modal onClose={() => setShowManage(false)}>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Manage fields</h3>
          <div className="space-y-1 mb-6">
            {fields.map(f => (
              <div key={f.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StarButton active={favoriteIds.has(f.id)} onClick={() => toggleFavorite(f.id)} title={favoriteIds.has(f.id) ? 'Remove from favourites' : 'Add to favourites'} size={14} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                      {f.id === defaultFieldId && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">Default</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{f.width}×{f.length} m · {f.partition_count} {f.partition_type}s</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {f.id !== defaultFieldId && (
                    <button
                      onClick={() => setDefaultFieldId(f.id)}
                      className="text-xs text-green-700 border border-green-300 rounded-lg px-2 py-1.5 hover:bg-green-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteField(f.id)}
                    className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {fields.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No fields yet.</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowManage(false)} className="text-sm border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer">Close</button>
            <button onClick={() => { setShowManage(false); setShowAddField(true); }} className="text-sm text-white bg-green-700 hover:bg-green-800 rounded-lg px-4 py-2 cursor-pointer font-medium">+ Add field</button>
          </div>
        </Modal>
      )}

      {/* ── Add field modal ── */}
      {showAddField && (
        <Modal onClose={() => { setShowAddField(false); setAddError(''); }}>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Add field</h3>
          <form onSubmit={handleAddField} className="space-y-4">
            <FormField label="Field name">
              <input
                type="text" placeholder="e.g. North Field"
                value={addForm.name}
                onChange={e => setAddForm(v => ({ ...v, name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Width (m)">
                <input type="number" min="1" max="9999" placeholder="e.g. 40"
                  value={addForm.width}
                  onChange={e => setAddForm(v => ({ ...v, width: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </FormField>
              <FormField label="Length (m)">
                <input type="number" min="1" max="9999" placeholder="e.g. 30"
                  value={addForm.length}
                  onChange={e => setAddForm(v => ({ ...v, length: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Partition type">
                <select
                  value={addForm.partition_type}
                  onChange={e => setAddForm(v => ({ ...v, partition_type: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="row">Row</option>
                  <option value="column">Column</option>
                </select>
              </FormField>
              <FormField label="Partition count">
                <input type="number" min="1" max="100" placeholder="e.g. 6"
                  value={addForm.partition_count}
                  onChange={e => setAddForm(v => ({ ...v, partition_count: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </FormField>
            </div>
            {layoutPreview && (
              <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                Layout preview: <strong>{layoutPreview}</strong>
              </p>
            )}
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => { setShowAddField(false); setAddError(''); }} className="text-sm border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" className="text-sm text-white bg-green-700 hover:bg-green-800 rounded-lg px-4 py-2 cursor-pointer font-medium">Create field</button>
            </div>
          </form>
        </Modal>
      )}
    </PageLayout>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────
function MetricCard({ label, value }) {
  const display = value == null ? '—' : value;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${display === '—' ? 'text-slate-300' : 'text-slate-800'}`}>{display}</p>
    </div>
  );
}

function StarButton({ active, onClick, title, size = 16 }) {
  return (
    <button onClick={onClick} title={title} className="shrink-0 p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer">
      <svg width={size} height={size} viewBox="0 0 24 24"
        fill={active ? '#f59e0b' : 'none'}
        stroke={active ? '#f59e0b' : '#94a3b8'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  );
}
