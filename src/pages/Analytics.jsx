import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import FilterSelect from '../components/FilterSelect';
import Pagination from '../components/Pagination';
import { WeedBadge } from '../components/Badges';
import { formatDateTime } from '../utils/formatters';
import { ROWS_OPTIONS } from '../constants';
import { getRuns, getFields, getDevices } from '../services/api';

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_RUNS = {
  total: 23,
  runs: [
    { run_id: '47', run_number: 47, device_id: 'DEV-001', field: 'North Field', datetime: '2025-04-05T08:32:00', weeds: 124, duration: '58m' },
    { run_id: '46', run_number: 46, device_id: 'DEV-001', field: 'North Field', datetime: '2025-04-03T14:10:00', weeds: 87,  duration: '42m' },
    { run_id: '45', run_number: 45, device_id: 'DEV-002', field: 'South Block', datetime: '2025-04-02T09:05:00', weeds: 32,  duration: '31m' },
    { run_id: '44', run_number: 44, device_id: 'DEV-001', field: 'North Field', datetime: '2025-03-30T11:22:00', weeds: 61,  duration: '38m' },
    { run_id: '43', run_number: 43, device_id: 'DEV-002', field: 'East Plot',   datetime: '2025-03-28T07:44:00', weeds: 18,  duration: '22m' },
    { run_id: '42', run_number: 42, device_id: 'DEV-001', field: 'North Field', datetime: '2025-03-26T10:15:00', weeds: 73,  duration: '44m' },
    { run_id: '41', run_number: 41, device_id: 'DEV-003', field: 'South Block', datetime: '2025-03-24T15:50:00', weeds: 49,  duration: '35m' },
    { run_id: '40', run_number: 40, device_id: 'DEV-002', field: 'East Plot',   datetime: '2025-03-22T08:00:00', weeds: 95,  duration: '51m' },
  ],
};
const MOCK_FIELDS  = ['North Field', 'South Block', 'East Plot'];
const MOCK_DEVICES = ['DEV-001', 'DEV-002', 'DEV-003'];
const MONTH_OPTIONS = [
  { value: '',        label: 'All months' },
  { value: '2025-04', label: 'April 2025' },
  { value: '2025-03', label: 'March 2025' },
  { value: '2025-02', label: 'February 2025' },
];

export default function Analytics() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ device_id: '', field_id: '', month: '' });
  const [applied, setApplied] = useState({ device_id: '', field_id: '', month: '' });
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(8);
  const [data,    setData]    = useState(MOCK_RUNS);
  const [fields,  setFields]  = useState(MOCK_FIELDS);
  const [devices, setDevices] = useState(MOCK_DEVICES);

  const fetchData = useCallback(async (f, pg, lim) => {
    try {
      const res = await getRuns({ ...f, page: pg, limit: lim });
      setData(res);
    } catch (_) {}
  }, []);

  useEffect(() => {
    Promise.allSettled([getFields(), getDevices()]).then(([f, d]) => {
      if (f.status === 'fulfilled') setFields(f.value.map(x => x.name ?? x));
      if (d.status === 'fulfilled') setDevices(d.value.map(x => x.id ?? x));
    });
  }, []);

  useEffect(() => { fetchData(applied, page, limit); }, [applied, page, limit]);

  function applyFilters() { setApplied({ ...filters }); setPage(1); }
  function resetFilters() {
    const empty = { device_id: '', field_id: '', month: '' };
    setFilters(empty); setApplied(empty); setPage(1);
  }

  const activeChips = Object.entries(applied).filter(([, v]) => v);
  const totalPages  = Math.ceil((data.total ?? 0) / limit);

  return (
    <PageLayout
      title="Analytics"
      headerRight={<span className="text-sm font-semibold text-green-700">{data.total ?? 0} runs</span>}
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <FilterSelect label="Device ID" value={filters.device_id}
            onChange={v => setFilters(f => ({ ...f, device_id: v }))}
            options={[{ value: '', label: 'All devices' }, ...devices.map(d => ({ value: d, label: d }))]}
          />
          <FilterSelect label="Field" value={filters.field_id}
            onChange={v => setFilters(f => ({ ...f, field_id: v }))}
            options={[{ value: '', label: 'All fields' }, ...fields.map(d => ({ value: d, label: d }))]}
          />
          <FilterSelect label="Month" value={filters.month}
            onChange={v => setFilters(f => ({ ...f, month: v }))}
            options={MONTH_OPTIONS}
          />
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={applyFilters} className="px-4 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">Apply</button>
          <button onClick={resetFilters} className="px-4 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">Reset</button>
        </div>

        {/* Active chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-slate-500 self-center">Active filters:</span>
            {activeChips.map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1">
                {v}
                <button onClick={() => { const n = { ...applied, [k]: '' }; setApplied(n); setFilters(n); }} className="cursor-pointer text-slate-400 hover:text-slate-700">×</button>
              </span>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
          <span>SESSION LOG</span>
          <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data.total ?? 0)} of {data.total ?? 0} results</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Run', 'Device ID', 'Field', 'Date & time', 'Weeds', 'Duration', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.runs ?? []).map(run => (
                <tr key={run.run_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 font-semibold text-slate-700">#{run.run_number}</td>
                  <td className="py-3 pr-4 text-slate-600">{run.device_id}</td>
                  <td className="py-3 pr-4 text-slate-600">{run.field}</td>
                  <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">{formatDateTime(run.datetime)}</td>
                  <td className="py-3 pr-4"><WeedBadge count={run.weeds} /></td>
                  <td className="py-3 pr-4 text-slate-600">{run.duration}</td>
                  <td className="py-3">
                    <button
                      onClick={() => navigate(`/analytics/${run.run_id}`)}
                      className="text-green-700 hover:text-green-900 text-xs font-medium cursor-pointer flex items-center gap-1"
                    >
                      View <span>→</span>
                    </button>
                  </td>
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
          total={data.total ?? 0}
          rowsOptions={ROWS_OPTIONS}
        />
      </div>
    </PageLayout>
  );
}
