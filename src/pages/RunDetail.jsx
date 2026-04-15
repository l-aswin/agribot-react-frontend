import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PieChart, Pie, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell } from 'recharts';
import Sidebar from '../components/Sidebar';
import { getRun, getRunDensityMap, getRunSpecies, getRunDeviceSummary, getRunDetectionLogs } from '../services/api';

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_RUN = { run_id: '43', run_number: 43, device_id: 'DEV-002', field: 'East Plot', datetime: '2025-03-28T07:44:00', duration: '22m', weeds: 18 };
const MOCK_SPECIES = [
  { name: 'Crabgrass', value: 58, fill: '#15803d' },
  { name: 'Nutsedge',  value: 36, fill: '#f97316' },
  { name: 'Purslane',  value: 19, fill: '#ef4444' },
  { name: 'Other',     value: 11, fill: '#94a3b8' },
];
const MOCK_GRID = Array.from({ length: 6 }, () =>
  Array.from({ length: 8 }, () => ['low', 'low', 'medium', 'high'][Math.floor(Math.random() * 4)])
);
const MOCK_DEVICE_SUMMARY = { device_id: 'DEV-001', connectivity: 'Online', total_weeds: 124, total_photos: 248, run_time: '58m 12s' };
const MOCK_LOGS = {
  total: 124,
  logs: [
    { id: 1, grid_pos: 'G(4,2)', original_url: null, annotated_url: null, species: 'Nutsedge',  lat: '13.0827', lon: '80.2707' },
    { id: 2, grid_pos: 'G(2,1)', original_url: null, annotated_url: null, species: 'Crabgrass', lat: '13.0831', lon: '80.2712' },
    { id: 3, grid_pos: 'G(7,3)', original_url: null, annotated_url: null, species: 'Purslane',  lat: '13.0819', lon: '80.2698' },
    { id: 4, grid_pos: 'G(5,5)', original_url: null, annotated_url: null, species: 'Crabgrass', lat: '13.0824', lon: '80.2703' },
  ],
};

const DENSITY_CELL = { low: 'bg-green-400', medium: 'bg-orange-300', high: 'bg-red-400' };
const SPECIES_COLOR = { Crabgrass: 'bg-green-600', Nutsedge: 'bg-orange-400', Purslane: 'bg-red-400', Other: 'bg-slate-400' };

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const ROWS_OPTIONS = [5, 10, 20];

export default function RunDetail() {
  const { runId }  = useParams();
  const navigate   = useNavigate();
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [run,     setRun]     = useState(MOCK_RUN);
  const [species, setSpecies] = useState(MOCK_SPECIES);
  const [grid,    setGrid]    = useState(MOCK_GRID);
  const [summary, setSummary] = useState(MOCK_DEVICE_SUMMARY);
  const [logs,    setLogs]    = useState(MOCK_LOGS);
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(10);

  useEffect(() => {
    Promise.allSettled([
      getRun(runId),
      getRunSpecies(runId),
      getRunDensityMap(runId),
      getRunDeviceSummary(runId),
      getRunDetectionLogs(runId, page, limit),
    ]).then(([r, s, g, sum, l]) => {
      if (r.status   === 'fulfilled') setRun(r.value);
      if (s.status   === 'fulfilled') setSpecies(s.value);
      if (g.status   === 'fulfilled') setGrid(g.value);
      if (sum.status === 'fulfilled') setSummary(sum.value);
      if (l.status   === 'fulfilled') setLogs(l.value);
    });
  }, [runId, page, limit]);

  const totalPages = Math.ceil((logs.total ?? 0) / limit);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold text-slate-800">Run #{run.run_number} · {run.device_id}</h1>
          </div>
          <span className="text-sm font-semibold text-green-700">{run.weeds} weeds</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Back */}
          <button onClick={() => navigate('/analytics')} className="flex items-center gap-1 text-sm text-green-700 hover:text-green-900 cursor-pointer">
            ← Back to Analytics
          </button>

          {/* Run header card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Run #{run.run_number} · {run.device_id}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{fmt(run.datetime)} · {run.field} · {run.duration} duration</p>
            </div>
            <span className="text-sm font-bold px-3 py-1.5 rounded-full bg-green-100 text-green-700">{run.weeds} weeds</span>
          </div>

          {/* Grid + Species side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Density map */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Field Weed Distribution</p>
              <div className="flex gap-3 mb-3 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block"/> Low</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-300 inline-block"/> Medium</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"/> High</span>
              </div>
              <div className="overflow-x-auto">
                <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${grid[0]?.length ?? 8}, minmax(26px, 1fr))` }}>
                  {grid.map((row, ri) => row.map((d, ci) => (
                    <div key={`${ri}-${ci}`} className={`${DENSITY_CELL[d] ?? 'bg-slate-200'} rounded h-6`} title={`Row ${ri+1}, Col ${ci+1}`} />
                  )))}
                </div>
              </div>
            </div>

            {/* Species breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Weed Species Breakdown</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={species} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {species.map(s => (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm text-slate-700 mb-1">
                        <span>{s.name}</span><span>{s.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${(s.value / species.reduce((a, x) => a + x.value, 0)) * 100}%`, background: s.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Device summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Device</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Device ID', 'Connectivity', 'Total weeds detected', 'Total photos taken', 'Total run time'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 pb-2 pr-6 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3 pr-6 font-semibold text-slate-700">{summary.device_id}</td>
                    <td className="py-3 pr-6">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>
                        {summary.connectivity}
                      </span>
                    </td>
                    <td className="py-3 pr-6 text-slate-700">{summary.total_weeds}</td>
                    <td className="py-3 pr-6 text-slate-700">{summary.total_photos}</td>
                    <td className="py-3 text-slate-700">{summary.run_time}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detection logs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Detection Logs</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Grid position', 'Original photo', 'Annotated photo', 'Species', 'Coordinates'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 pb-2 pr-6 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(logs.logs ?? []).map(log => (
                    <tr key={log.id} className="border-b border-slate-50">
                      <td className="py-3 pr-6 font-mono text-slate-700">{log.grid_pos}</td>
                      <td className="py-3 pr-6">
                        {log.original_url
                          ? <img src={log.original_url} alt="original" className="w-12 h-10 object-cover rounded-md border border-slate-200"/>
                          : <span className="w-12 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-300 bg-slate-50">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            </span>}
                      </td>
                      <td className="py-3 pr-6">
                        {log.annotated_url
                          ? <img src={log.annotated_url} alt="annotated" className="w-12 h-10 object-cover rounded-md border border-red-200"/>
                          : <span className="w-12 h-10 flex items-center justify-center rounded-md border border-red-200 text-red-300 bg-red-50">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            </span>}
                      </td>
                      <td className="py-3 pr-6">
                        <span className={`text-xs px-2 py-1 rounded-full text-white font-medium ${SPECIES_COLOR[log.species] ?? 'bg-slate-400'}`}>{log.species}</span>
                      </td>
                      <td className="py-3 font-mono text-xs text-slate-600">{log.lat}°N {log.lon}°E</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Rows per page:</span>
                <select value={limit} onChange={e => { setLimit(+e.target.value); setPage(1); }}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none bg-white cursor-pointer">
                  {ROWS_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-sm cursor-pointer ${page === i + 1 ? 'bg-green-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {i + 1}
                  </button>
                ))}
                <span className="text-xs text-slate-400 ml-2">Showing 1–{Math.min(limit, logs.total ?? 0)} of {logs.total ?? 0}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
