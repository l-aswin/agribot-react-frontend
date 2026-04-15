import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import {
  getDevices, getFields, getRoutes, createRoute, deleteRoute,
  startDetection, stopDetection, pollDetectionStatus, pollDetectionGrid,
  sendMoveCommand,
} from '../services/api';

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_DEVICES = [
  { id: 'DEV-001', online: true,  status: 'idle' },
  { id: 'DEV-002', online: true,  status: 'idle' },
  { id: 'DEV-003', online: false, status: 'offline' },
];
const MOCK_FIELDS = [
  { id: '1', name: 'North Field', width: 40, height: 30 },
  { id: '2', name: 'South Block', width: 60, height: 20 },
  { id: '3', name: 'East Plot',   width: 25, height: 25 },
];
const MOCK_ROUTES = [
  { id: 'r1', name: 'Route A', instructions: [
    { command: 'move_forward', value: 3 }, { command: 'turn_right', value: 90 },
    { command: 'move_forward', value: 3 }, { command: 'detect_weed', value: 2 },
  ]},
];
const COMMANDS = ['Move forward', 'Move backward', 'Turn left', 'Turn right', 'Detect weed'];
const EMPTY_GRID = Array.from({ length: 8 }, () => Array.from({ length: 12 }, () => null));

function statusTag(status, online) {
  if (!online) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Offline</span>;
  if (status === 'working') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Working</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Idle</span>;
}

const DENSITY_CELL = { low: 'bg-green-400', medium: 'bg-orange-300', high: 'bg-red-400', null: 'bg-slate-100' };

export default function DeviceControl() {
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [devices,       setDevices]       = useState(MOCK_DEVICES);
  const [fields,        setFields]        = useState(MOCK_FIELDS);
  const [routes,        setRoutes]        = useState(MOCK_ROUTES);
  const [selectedDev,   setSelectedDev]   = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [detectionMode, setDetectionMode] = useState('grid'); // 'grid' | 'route'
  const [gridX,         setGridX]         = useState('');
  const [gridY,         setGridY]         = useState('');
  const [distance,      setDistance]      = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [lastRun,       setLastRun]       = useState(null);

  // Detection running state
  const [running,       setRunning]       = useState(false);
  const [detStatus,     setDetStatus]     = useState(null); // { cells_total, cells_scanned, weeds_found, device_position }
  const [liveGrid,      setLiveGrid]      = useState(EMPTY_GRID);
  const statusPollRef   = useRef(null);
  const gridPollRef     = useRef(null);

  // Manual control
  const [moveDistance,  setMoveDistance]  = useState(0.5);
  const [turnAngle,     setTurnAngle]     = useState(90);
  const [moveLoading,   setMoveLoading]   = useState(false);

  // Route designer
  const [routeCmd,      setRouteCmd]      = useState('Move forward');
  const [routeVal,      setRouteVal]      = useState('');
  const [routeSteps,    setRouteSteps]    = useState([]);
  const [routeName,     setRouteName]     = useState('');
  const [savingRoute,   setSavingRoute]   = useState(false);

  useEffect(() => {
    Promise.allSettled([getDevices(), getFields()]).then(([d, f]) => {
      if (d.status === 'fulfilled') setDevices(d.value);
      if (f.status === 'fulfilled') setFields(f.value);
    });
  }, []);

  useEffect(() => {
    if (!selectedDev) return;
    getRoutes(selectedDev).then(setRoutes).catch(() => {});
  }, [selectedDev]);

  const currentDevice = devices.find(d => d.id === selectedDev);
  const canStart = selectedDev && selectedField && currentDevice?.online && !running;

  function startPolling() {
    statusPollRef.current = setInterval(async () => {
      try {
        const s = await pollDetectionStatus(selectedDev);
        setDetStatus(s);
        if (s.status === 'completed' || s.status === 'stopped') {
          stopPolling();
          setRunning(false);
          setLastRun(s.finished_at ?? s.stopped_at ?? new Date().toISOString());
        }
      } catch (_) {}
    }, 2000);

    gridPollRef.current = setInterval(async () => {
      try {
        const g = await pollDetectionGrid(selectedDev);
        setLiveGrid(g);
      } catch (_) {}
    }, 3500);
  }

  function stopPolling() {
    clearInterval(statusPollRef.current);
    clearInterval(gridPollRef.current);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleStartDetection() {
    const body = detectionMode === 'grid'
      ? { mode: 'grid', grid_x: +gridX, grid_y: +gridY, distance: +distance }
      : { mode: 'route', route_id: selectedRoute };
    try {
      await startDetection(selectedDev, body);
    } catch (_) {}
    setRunning(true);
    setDetStatus({ cells_total: 0, cells_scanned: 0, weeds_found: 0 });
    setLiveGrid(EMPTY_GRID);
    startPolling();
  }

  async function handleStopDetection() {
    try { await stopDetection(selectedDev); } catch (_) {}
    stopPolling();
    setRunning(false);
    setLastRun(`Stopped by user at ${new Date().toLocaleTimeString()}`);
  }

  async function handleMove(command) {
    if (!selectedDev || running) return;
    const value = command === 'forward' || command === 'backward' ? moveDistance : turnAngle;
    setMoveLoading(true);
    try { await sendMoveCommand(selectedDev, command, value); } catch (_) {}
    setMoveLoading(false);
  }

  function addRouteStep() {
    if (!routeVal) return;
    setRouteSteps(s => [...s, { command: routeCmd, value: +routeVal }]);
    setRouteVal('');
  }

  async function handleSaveRoute() {
    if (!routeName || !routeSteps.length) return;
    setSavingRoute(true);
    try {
      const created = await createRoute({ name: routeName, device_id: selectedDev, instructions: routeSteps });
      setRoutes(r => [...r, created]);
    } catch (_) {
      setRoutes(r => [...r, { id: Date.now().toString(), name: routeName, instructions: routeSteps }]);
    }
    setRouteSteps([]);
    setRouteName('');
    setSavingRoute(false);
  }

  const needsDistance = cmd => ['Move forward', 'Move backward', 'Detect weed'].includes(cmd);
  const valLabel = cmd => needsDistance(cmd) ? 'Distance (m)' : 'Angle (°)';

  function stepLabel({ command, value }) {
    return `${command} · ${value}${needsDistance(command) ? ' m' : '°'}`;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(v => !v)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold text-slate-800">Device Control</h1>
          </div>
          <span className="text-sm font-semibold text-green-700">{devices.length} devices</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

          {/* Select device & field */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Select Device &amp; Field</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Device ID</label>
                <select value={selectedDev} onChange={e => setSelectedDev(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer">
                  <option value="">— Choose device —</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.id}{!d.online ? ' (offline)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Field</label>
                <select value={selectedField} onChange={e => setSelectedField(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer">
                  <option value="">— Choose field —</option>
                  {fields.map(f => <option key={f.id} value={f.id}>{f.name} — {f.width}×{f.height} m</option>)}
                </select>
              </div>
            </div>

            {currentDevice && (
              <div className="flex items-center gap-4 text-sm bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentDevice.online ? 'bg-green-500' : 'bg-slate-300'}`} />
                <span className="font-semibold text-slate-700">{currentDevice.id}</span>
                <span className="text-slate-500">Connectivity: <span className={currentDevice.online ? 'text-green-700 font-medium' : 'text-slate-400'}>{currentDevice.online ? 'Online' : 'Offline'}</span></span>
                {statusTag(currentDevice.status, currentDevice.online)}
                {selectedField && <span className="text-slate-500 ml-auto">Field: {fields.find(f => f.id === selectedField)?.name}</span>}
              </div>
            )}

            {selectedDev && (
              <p className={`text-xs mt-2 font-medium ${running ? 'text-green-700' : 'text-slate-500'}`}>
                Controlling: {selectedDev} · {running ? `Detection running…` : lastRun ? `Last run: ${lastRun}` : 'No runs yet'}
              </p>
            )}
          </div>

          {/* Weed detection + Manual control */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Weed detection panel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Weed Detection</p>

              {!running ? (
                <>
                  {/* Mode toggle */}
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-4 w-fit">
                    {['grid', 'route'].map(m => (
                      <button key={m} onClick={() => setDetectionMode(m)}
                        className={`px-5 py-2 text-sm font-medium cursor-pointer transition-colors ${detectionMode === m ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                        {m === 'grid' ? 'Grid position' : 'Select route'}
                      </button>
                    ))}
                  </div>

                  {detectionMode === 'grid' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <LabeledInput label="Grid X" placeholder="e.g. 4" type="number" value={gridX} onChange={setGridX} />
                        <LabeledInput label="Grid Y" placeholder="e.g. 2" type="number" value={gridY} onChange={setGridY} />
                      </div>
                      <LabeledInput label="Forward distance (metres)" placeholder="e.g. 5.0" type="number" value={distance} onChange={setDistance} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Select route</label>
                      <select value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer">
                        <option value="">— Choose a route —</option>
                        {routes.map(r => <option key={r.id} value={r.id}>{r.name} — {r.instructions?.length ?? 0} steps</option>)}
                      </select>
                      {selectedRoute && (
                        <p className="text-xs text-slate-400 italic">
                          {routes.find(r => r.id === selectedRoute)?.instructions?.map(stepLabel).join(' → ')}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleStartDetection}
                    disabled={!canStart}
                    className={`mt-4 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2
                      ${canStart ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                  >
                    <span>⊙</span> Start weed detection
                  </button>
                  {!currentDevice?.online && selectedDev && (
                    <p className="text-xs text-red-500 mt-1.5 text-center">Device is offline — cannot start detection.</p>
                  )}
                </>
              ) : (
                /* Running view */
                <div>
                  <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5 mb-3">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"/> Detection in progress…
                  </p>
                  {/* Mini live grid */}
                  <div className="overflow-x-auto mb-3">
                    <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${liveGrid[0]?.length ?? 12}, minmax(18px, 1fr))` }}>
                      {liveGrid.map((row, ri) => row.map((d, ci) => {
                        const isDevice = detStatus?.device_position?.x === ci && detStatus?.device_position?.y === ri;
                        return (
                          <div key={`${ri}-${ci}`}
                            className={`${DENSITY_CELL[d ?? 'null']} rounded h-5 relative ${isDevice ? 'ring-2 ring-green-600' : ''}`}
                            title={isDevice ? 'Device position' : ''} />
                        );
                      }))}
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block"/> Low</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-300 inline-block"/> Medium</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block"/> High</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm ring-2 ring-green-600 inline-block"/> Device</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-700 mb-4">
                    <div><span className="text-xs text-slate-400">Cells scanned</span><br/><strong>{detStatus?.cells_scanned ?? 0} / {detStatus?.cells_total ?? 0}</strong></div>
                    <div><span className="text-xs text-slate-400">Weeds found</span><br/><strong>{detStatus?.weeds_found ?? 0}</strong></div>
                  </div>
                  <button onClick={handleStopDetection}
                    className="w-full py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold cursor-pointer transition-colors">
                    ⏹ Stop weed detection
                  </button>
                </div>
              )}
            </div>

            {/* Manual control */}
            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${running ? 'opacity-60' : ''}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Manual Control</p>
              {running && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">Manual control is disabled during weed detection.</p>}

              {/* D-pad */}
              <div className="flex flex-col items-center gap-1 mb-4">
                <DPadBtn onClick={() => handleMove('forward')} disabled={running || moveLoading} label="↑" />
                <div className="flex gap-1">
                  <DPadBtn onClick={() => handleMove('left')} disabled={running || moveLoading} label="←" />
                  <div className="w-10 h-10" />
                  <DPadBtn onClick={() => handleMove('right')} disabled={running || moveLoading} label="→" />
                </div>
                <DPadBtn onClick={() => handleMove('backward')} disabled={running || moveLoading} label="↓" />
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <LabeledInput label="Distance (m)" type="number" value={moveDistance} onChange={v => setMoveDistance(+v)} min={0.1} step={0.1} />
                <LabeledInput label="Turn angle (°)" type="number" value={turnAngle} onChange={v => setTurnAngle(+v)} min={1} step={1} />
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                {[['forward','Move fwd'],['backward','Move bwd'],['left','Turn left'],['right','Turn right']].map(([cmd, label]) => (
                  <button key={cmd} onClick={() => handleMove(cmd)} disabled={running || moveLoading}
                    className="py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Route designer */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Design Route</p>

            {/* Add step */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Command</label>
                <select value={routeCmd} onChange={e => setRouteCmd(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer">
                  {COMMANDS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-xs font-semibold text-slate-500 mb-1">{valLabel(routeCmd)}</label>
                <input type="number" min={0.1} step={0.1} placeholder="e.g. 2.5" value={routeVal} onChange={e => setRouteVal(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex items-end">
                <button onClick={addRouteStep} className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">+ Add</button>
              </div>
            </div>

            {/* Step list */}
            {routeSteps.length > 0 && (
              <div className="space-y-2 mb-4">
                {routeSteps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                      {stepLabel(step)}
                    </span>
                    <button onClick={() => setRouteSteps(s => s.filter((_, j) => j !== i))}
                      className="text-xs text-slate-500 border border-slate-200 rounded-md px-2 py-1 hover:bg-slate-100 cursor-pointer">Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Save */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Route name</label>
                <input type="text" placeholder="e.g. Route A" value={routeName} onChange={e => setRouteName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <button onClick={handleSaveRoute} disabled={savingRoute || !routeName || !routeSteps.length}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg disabled:opacity-40 cursor-pointer transition-colors">
                Save route
              </button>
              <button onClick={() => { setRouteSteps([]); setRouteName(''); }}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">Clear all</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder, min, step }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      <input type={type} placeholder={placeholder} value={value} min={min} step={step}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" />
    </div>
  );
}

function DPadBtn({ label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center justify-center text-base transition-colors">
      {label}
    </button>
  );
}
