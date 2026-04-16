import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import { CONFIG_KEYS } from '../constants';
import { getDevices, getDeviceSettings, sendDeviceSettings } from '../services/api';

const MOCK_DEVICES = [
  { id: 'DEV-001', online: true,  status: 'idle' },
  { id: 'DEV-002', online: true,  status: 'idle' },
  { id: 'DEV-003', online: false, status: 'offline' },
];
const MOCK_SETTINGS = {
  device_id: 'DEV-001',
  server_url: 'http://192.168.1.18:5000',
  serial_port: '/dev/ttyUSB0',
  serial_baud_rate: '115200',
  camera_index: '0',
  confidence_threshold: '0.75',
};

export default function Settings() {
  const [devices,     setDevices]     = useState(MOCK_DEVICES);
  const [selectedDev, setSelectedDev] = useState('');
  const [fetching,    setFetching]    = useState(false);
  const [sending,     setSending]     = useState(false);
  const [config,      setConfig]      = useState(null);
  const [editRow,     setEditRow]     = useState(null);
  const [editVal,     setEditVal]     = useState('');
  const [banner,      setBanner]      = useState(null); // { type: 'success'|'error', msg }

  useEffect(() => {
    getDevices().then(setDevices).catch(() => {});
  }, []);

  const currentDev = devices.find(d => d.id === selectedDev);
  const canFetch = selectedDev && currentDev?.online;
  const canSend  = config && currentDev?.online && currentDev?.status === 'idle' && !sending;

  async function handleFetch() {
    setFetching(true);
    setBanner(null);
    try {
      const data = await getDeviceSettings(selectedDev);
      setConfig(data);
    } catch (_) {
      setConfig({ ...MOCK_SETTINGS, device_id: selectedDev });
    }
    setFetching(false);
  }

  async function handleSend() {
    setSending(true);
    setBanner(null);
    try {
      await sendDeviceSettings(selectedDev, config);
      setBanner({ type: 'success', msg: 'Settings sent successfully — device updated.' });
    } catch (_) {
      setBanner({ type: 'error', msg: 'Failed to send settings. Please try again.' });
    }
    setSending(false);
  }

  function startEdit(key) { setEditRow(key); setEditVal(config[key] ?? ''); }
  function saveEdit(key)  { setConfig(c => ({ ...c, [key]: editVal })); setEditRow(null); }

  return (
    <PageLayout title="Settings">

      {/* Device selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Device</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Select device</label>
            <select
              value={selectedDev}
              onChange={e => { setSelectedDev(e.target.value); setConfig(null); setBanner(null); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer"
            >
              <option value="">— Choose device —</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.id}{!d.online ? ' (offline)' : ''}</option>)}
            </select>
          </div>
          <button
            onClick={handleFetch}
            disabled={!canFetch || fetching}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
          >
            {fetching
              ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/> Fetching…</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/></svg> Fetch settings</>}
          </button>
        </div>

        {currentDev && (
          <div className="mt-3 flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
            <span className={`w-2.5 h-2.5 rounded-full ${currentDev.online ? 'bg-green-500' : 'bg-slate-300'}`} />
            <span className="font-semibold text-slate-700">{currentDev.id}</span>
            <span className="text-slate-500">
              Connectivity: <span className={currentDev.online ? 'text-green-700 font-medium' : 'text-slate-400'}>{currentDev.online ? 'Online' : 'Offline'}</span>
            </span>
            {currentDev.online && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentDev.status === 'working' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {currentDev.status === 'working' ? 'Working' : 'Idle'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Config table */}
      {config && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Device Configuration</p>
            <p className="text-xs text-slate-400">Click Edit to modify a value</p>
          </div>

          <div className="border border-slate-100 rounded-lg overflow-hidden">
            {CONFIG_KEYS.map((key, i) => (
              <div key={key} className={`flex items-center gap-4 px-4 py-3 ${i < CONFIG_KEYS.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <span className="w-44 text-sm font-medium text-slate-600 shrink-0">{key}</span>
                {editRow === key ? (
                  <div className="flex flex-1 gap-2 items-center">
                    <input value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus
                      className="flex-1 border border-green-400 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                    <button onClick={() => saveEdit(key)} className="text-xs px-3 py-1.5 bg-green-700 text-white rounded-lg cursor-pointer hover:bg-green-800">Save</button>
                    <button onClick={() => setEditRow(null)} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-700 font-mono">{config[key]}</span>
                    <button onClick={() => startEdit(key)} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-600">Edit</button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <p className="text-xs text-slate-400">
              {canSend ? 'Device is connected and idle — ready to receive settings.' : 'Device must be online and idle to send settings.'}
            </p>
            <button onClick={handleSend} disabled={!canSend}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg disabled:opacity-40 cursor-pointer transition-colors">
              {sending
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/> Sending…</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send settings</>}
            </button>
          </div>

          {banner && (
            <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${banner.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {banner.type === 'success'
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
              {banner.msg}
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
