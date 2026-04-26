import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import FilterSelect from '../components/FilterSelect';
import Pagination from '../components/Pagination';
import { WeedBadge } from '../components/Badges';
import { formatDateTime } from '../utils/formatters';
import { ROWS_OPTIONS } from '../constants';
import { getRuns, getFields, getDevices, deleteFilteredRuns } from '../services/api';
import useErrorToast from '../hooks/useErrorToast';

const MONTH_OPTIONS = (() => {
  const now = new Date();
  const options = [{ value: '', label: 'All months' }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
})();

export default function Analytics() {
  const navigate = useNavigate();
  const [showError, errorToast] = useErrorToast();

  const [filters, setFilters] = useState({ device_id: '', field_id: '', month: '' });
  const [applied, setApplied] = useState({ device_id: '', field_id: '', month: '' });
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(8);
  const [data,    setData]    = useState({ total: 0, runs: [] });
  const [fields,  setFields]  = useState([]);
  const [devices, setDevices] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchData = useCallback(async (f, pg, lim) => {
    try {
      const res = await getRuns({ ...f, page: pg, limit: lim });
      setData(res);
    } catch (err) {
      showError(err.message || 'Failed to load runs.');
    }
  }, [showError]);

  useEffect(() => {
    Promise.allSettled([getFields(), getDevices()]).then(([f, d]) => {
      if (f.status === 'fulfilled' && Array.isArray(f.value)) setFields(f.value.map(x => ({ id: x.id, name: x.name ?? String(x.id) })).filter(x => x.id != null));
      else showError(f.reason?.message || 'Failed to load fields.');
      if (d.status === 'fulfilled' && Array.isArray(d.value)) setDevices(d.value.map(x => x.device_id).filter(Boolean));
      else showError(d.reason?.message || 'Failed to load devices.');
    });
  }, []);

  useEffect(() => { fetchData(applied, page, limit); }, [applied, page, limit]);

  async function handleDelete() {
    try {
      await deleteFilteredRuns(applied);
      setConfirmDelete(false);
      setPage(1);
      fetchData(applied, 1, limit);
    } catch (err) {
      showError(err.message || 'Failed to delete runs.');
      setConfirmDelete(false);
    }
  }

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
      {errorToast}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <FilterSelect label="Device ID" value={filters.device_id}
            onChange={v => setFilters(f => ({ ...f, device_id: v }))}
            options={[{ value: '', label: 'All devices' }, ...devices.map(d => ({ value: d, label: d }))]}
          />
          <FilterSelect label="Field" value={filters.field_id}
            onChange={v => setFilters(f => ({ ...f, field_id: v }))}
            options={[{ value: '', label: 'All fields' }, ...fields.map(f => ({ value: String(f.id), label: f.name }))]}
          />
          <FilterSelect label="Month" value={filters.month}
            onChange={v => setFilters(f => ({ ...f, month: v }))}
            options={MONTH_OPTIONS}
          />
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={applyFilters} className="px-4 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">Apply</button>
          <button onClick={resetFilters} className="px-4 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">Reset</button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={activeChips.length === 0}
            className="px-4 py-1.5 text-sm font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >Delete filtered</button>
        </div>

        {/* Active chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-slate-500 self-center">Active filters:</span>
            {activeChips.map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1">
                {k === 'field_id' ? (fields.find(f => String(f.id) === v)?.name ?? v) : v}
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
                {['Run', 'Device ID', 'Field', 'Date & time', 'Weeds', 'Duration', ''].map((h, i) => (
                  <th key={i} className="text-left text-xs font-semibold text-slate-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.runs ?? []).map(run => (
                <tr key={run.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4 font-semibold text-slate-700">#{run.run_number}</td>
                  <td className="py-3 pr-4 text-slate-600">{run.device_id}</td>
                  <td className="py-3 pr-4 text-slate-600">{run.field?.name ?? run.field}</td>
                  <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">{formatDateTime(run.datetime)}</td>
                  <td className="py-3 pr-4"><WeedBadge count={run.weeds} /></td>
                  <td className="py-3 pr-4 text-slate-600">{run.duration}</td>
                  <td className="py-3">
                    <button
                      onClick={() => navigate(`/analytics/${run.id}`)}
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
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <p className="font-semibold text-slate-800">Delete filtered runs?</p>
            <p className="text-sm text-slate-500">
              This will permanently delete all {data.total} run{data.total !== 1 ? 's' : ''} matching the active filters. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
