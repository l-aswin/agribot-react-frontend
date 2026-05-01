import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import PageLayout from '../components/PageLayout';
import DensityGrid from '../components/DensityGrid';
import Pagination from '../components/Pagination';
import { formatDateTime, formatDuration } from '../utils/formatters';
import { SPECIES_COLORS, ROWS_OPTIONS } from '../constants';
import { getRun, getRunDensityMap, getRunSpecies, getRunDeviceSummary, getRunDetectionLogs } from '../services/api';
import useErrorToast from '../hooks/useErrorToast';

function mapCountsToDensity(rawGrid) {
  return rawGrid.map(row =>
    row.map(val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') return val;
      if (val < 10)  return 'low';
      if (val < 20)  return 'medium';
      return 'high';
    })
  );
}

export default function RunDetail() {
  const { runId } = useParams();
  const navigate  = useNavigate();
  const [showError, errorToast] = useErrorToast();

  const [run,     setRun]     = useState(null);
  const [species, setSpecies] = useState([]);
  const [grid,    setGrid]    = useState([]);
  const [summary, setSummary] = useState(null);
  const [logs,    setLogs]    = useState({ total: 0, logs: [] });
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(10);
  const [lightbox, setLightbox] = useState(null); // { src, label }

  useEffect(() => {
    Promise.allSettled([
      getRun(runId),
      getRunSpecies(runId),
      getRunDensityMap(runId),
      getRunDeviceSummary(runId),
      getRunDetectionLogs(runId, page, limit),
    ]).then(([r, s, g, sum, l]) => {
      if (r.status   === 'fulfilled') setRun(r.value);
      else showError(r.reason?.message || 'Failed to load run details.');
      if (s.status   === 'fulfilled') setSpecies(s.value.map(x => ({
        name: x.species,
        value: x.count,
        fill: SPECIES_COLORS[x.species] ?? '#94a3b8',
      })));
      else showError(s.reason?.message || 'Failed to load species breakdown.');
      if (g.status   === 'fulfilled') setGrid(mapCountsToDensity(g.value));
      else showError(g.reason?.message || 'Failed to load density map.');
      if (sum.status === 'fulfilled') setSummary(sum.value);
      else showError(sum.reason?.message || 'Failed to load device summary.');
      if (l.status   === 'fulfilled') setLogs(l.value);
      else showError(l.reason?.message || 'Failed to load detection logs.');
    });
  }, [runId, page, limit]);

  const totalPages = Math.ceil((logs.total ?? 0) / limit);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = e => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (!run) {
    return (
      <PageLayout title="Run Detail">
        {errorToast}
        <p className="text-sm text-slate-400">Loading run details…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Run #${run.run_number} · ${run.device_id}`}
      headerRight={<span className="text-sm font-semibold text-green-700">{run.weeds} weeds</span>}
    >
      {errorToast}

      {/* Back */}
      <button onClick={() => navigate('/analytics')} className="flex items-center gap-1 text-sm text-green-700 hover:text-green-900 cursor-pointer">
        ← Back to Analytics
      </button>

      {/* Run header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Run #{run.run_number} · {run.device_id}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{formatDateTime(run.datetime, ' · ')} · {run.field?.name ?? run.field} · {formatDuration(run.duration) ?? 'ongoing'} duration</p>
        </div>
        <span className="text-sm font-bold px-3 py-1.5 rounded-full bg-green-100 text-green-700">{run.weeds} weeds</span>
      </div>

      {/* Grid + Species side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Density map */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Field Weed Distribution</p>
          <DensityGrid grid={grid} cellSize={26} cellHeight={24} showLegend />
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
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Device</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Device ID', 'Device Name', 'Camera Index', 'Confidence Threshold', 'Serial Port'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 pb-2 pr-6 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-3 pr-6 font-semibold text-slate-700">{summary.device_id}</td>
                  <td className="py-3 pr-6 text-slate-700">{summary.device_name}</td>
                  <td className="py-3 pr-6 text-slate-700">{summary.camera_index}</td>
                  <td className="py-3 pr-6 text-slate-700">{summary.confidence_threshold}</td>
                  <td className="py-3 text-slate-700">{summary.serial_port}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detection logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Detection Logs</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Grid position', 'Photo', 'Species', 'Confidence', 'Timestamp'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 pb-2 pr-6 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(logs.logs ?? []).map(log => (
                <tr key={log.id} className="border-b border-slate-50">
                  <td className="py-3 pr-6 font-mono text-slate-700">{log.cell}</td>
                  <td className="py-3 pr-6">
                    {log.image_url
                      ? <button onClick={() => setLightbox({ src: log.image_url, label: 'Photo' })} className="cursor-pointer focus:outline-none">
                          <img src={log.image_url} alt="photo" className="w-12 h-10 object-cover rounded-md border border-slate-200 hover:ring-2 hover:ring-slate-400 transition"/>
                        </button>
                      : <span className="w-12 h-10 flex items-center justify-center rounded-md border border-slate-200 text-slate-300 bg-slate-50">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </span>}
                  </td>
                  <td className="py-3 pr-6">
                    <span className={`text-xs px-2 py-1 rounded-full text-white font-medium ${SPECIES_COLORS[log.species] ?? 'bg-slate-400'}`}>{log.species}</span>
                  </td>
                  <td className="py-3 pr-6 text-slate-600 text-xs">{log.confidence != null ? log.confidence.toFixed(2) : '—'}</td>
                  <td className="py-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          rowsPerPage={limit}
          onRowsPerPageChange={v => { setLimit(v); setPage(1); }}
          total={logs.total ?? 0}
          rowsOptions={ROWS_OPTIONS}
        />
      </div>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div className="relative flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm font-semibold tracking-wide">{lightbox.label}</p>
            <img
              src={lightbox.src}
              alt={lightbox.label}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-lg leading-none transition cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
