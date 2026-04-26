import { useState, useEffect, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import DensityGrid from '../components/DensityGrid';
import { StatusBadge } from '../components/Badges';
import { COMMANDS } from '../constants';
import {
  getDevices, getFields, getRoutes, createRoute,
  startDetection, stopDetection, pollDetectionStatus, pollDetectionGrid,
  sendMoveCommand,
} from '../services/api';
import useErrorToast from '../hooks/useErrorToast';

function weedCountToDensity(count) {
  if (count < 10)  return 'low';
  if (count < 20) return 'medium';
  return 'high';
}

function bucketsToDensityGrid(buckets, gridRows, gridCols, partitionType, currentPath) {
  const grid = Array.from({ length: gridRows }, () => Array(gridCols).fill(null));
  const pathIdx = (currentPath ?? 1) - 1;
  buckets.forEach(({ cell, weed_count, step_count }) => {
    if (cell < 0 || cell >= 20 || step_count === 0) return;
    const density = weedCountToDensity(weed_count);
    if (partitionType === 'row') {
      grid[pathIdx][cell] = density;
    } else {
      grid[cell][pathIdx] = density;
    }
  });
  return grid;
}

export default function DeviceControl() {
  const [showError, errorToast] = useErrorToast();
  const [devices,       setDevices]       = useState([]);
  const [fields,        setFields]        = useState([]);
  const [routes,        setRoutes]        = useState([]);
  const [loading,       setLoading]       = useState(true); // true until first fetch completes
  const [selectedDev,   setSelectedDev]   = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [detectionMode, setDetectionMode] = useState('grid');
  const [currentPath,   setCurrentPath]   = useState('1');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [lastRun,       setLastRun]       = useState(null);
  const [startError,    setStartError]    = useState(null);

  const [running,       setRunning]       = useState(false);
  const [detStatus,     setDetStatus]     = useState(null);
  const [liveGrid,      setLiveGrid]      = useState(() => Array.from({ length: 30 }, () => Array(30).fill(null)));
  const statusPollRef   = useRef(null);
  const gridPollRef     = useRef(null);

  const [moveDistance,  setMoveDistance]  = useState(0.5);
  const [turnAngle,     setTurnAngle]     = useState(90);
  const [moveLoading,   setMoveLoading]   = useState(false);

  const [routeCmd,      setRouteCmd]      = useState('Move forward');
  const [routeVal,      setRouteVal]      = useState('');
  const [routeSteps,    setRouteSteps]    = useState([]);
  const [routeName,     setRouteName]     = useState('');
  const [savingRoute,   setSavingRoute]   = useState(false);

  useEffect(() => {
    Promise.allSettled([getDevices(), getFields()]).then(([d, f]) => {
      if (d.status === 'fulfilled') setDevices(d.value);
      else showError(d.reason?.message || 'Failed to load devices.');
      if (f.status === 'fulfilled') setFields(f.value);
      else showError(f.reason?.message || 'Failed to load fields.');
      setLoading(false);
    });

    let inFlight = false;
    const interval = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await getDevices();
        setDevices(data);
      } catch (err) {
        clearInterval(interval);
        showError(err.message || 'Lost connection while polling devices.');
      } finally {
        inFlight = false;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedDev) return;
    getRoutes(selectedDev)
      .then(setRoutes)
      .catch(err => showError(err.message || 'Failed to load routes.'));
  }, [selectedDev]);

  useEffect(() => {
    setStartError(null);
  }, [selectedDev, selectedField, detectionMode, currentPath, selectedRoute]);

  const currentDevice = devices.find(d => String(d.id) === selectedDev);
  const selectedFieldObj = fields.find(f => String(f.id) === selectedField);
  const GRID_SIZE = 20;
  const partitionType = selectedFieldObj?.partition_type ?? 'row';
  const pathCount = selectedFieldObj?.partition_count ?? GRID_SIZE;
  const gridRows = selectedFieldObj ? (partitionType === 'row' ? pathCount : GRID_SIZE) : 8;
  const gridCols = selectedFieldObj ? (partitionType === 'row' ? GRID_SIZE : pathCount) : 12;
  const cellWidthM  = selectedFieldObj ? (selectedFieldObj.width  / GRID_SIZE).toFixed(2) : null;
  const cellLengthM = selectedFieldObj ? (selectedFieldObj.length / GRID_SIZE).toFixed(2) : null;
  const forwardDistanceCm = selectedFieldObj
    ? Math.round((partitionType === 'row' ? selectedFieldObj.length : selectedFieldObj.width) * 100)
    : 0;
  const camWidthCm = parseFloat(currentDevice?.camera_vision_width_cm) || 0;
  const totalStepsForPath = camWidthCm > 0 ? Math.round(forwardDistanceCm / camWidthCm) : 0;
  const progressPct = (totalStepsForPath > 0 && detStatus?.current_steps != null)
    ? Math.min(100, Math.round((detStatus.current_steps / totalStepsForPath) * 100))
    : 0;
  const startColVal = partitionType === 'row' ? 0 : +currentPath - 1;
  const startRowVal = partitionType === 'row' ? +currentPath - 1 : 0;

  const isGridReady = detectionMode === 'grid' && +currentPath >= 1;
  const isRouteReady = detectionMode === 'route' && !!selectedRoute;
  const isModeReady = isGridReady || isRouteReady;
  const canStart = selectedDev && selectedField && currentDevice?.online && !running && isModeReady;

  function startPolling() {
    stopPolling();
    statusPollRef.current = setInterval(async () => {
      try {
        const s = await pollDetectionStatus(selectedDev);
        setDetStatus(s);
        if (s.status === 'finished' || s.status === 'stopped') {
          stopPolling();
          setRunning(false);
          setLastRun(s.finished_at ?? s.stopped_at ?? new Date().toISOString());
        }
      } catch (err) {
        stopPolling();
        setRunning(false);
        showError(err.message || 'Lost connection while polling detection status.');
      }
    }, 2000);
    gridPollRef.current = setInterval(async () => {
      try {
        const g = await pollDetectionGrid(selectedDev);
        setLiveGrid(bucketsToDensityGrid(g, gridRows, gridCols, partitionType, +currentPath));
      } catch (err) {
        clearInterval(gridPollRef.current);
        showError(err.message || 'Failed to fetch detection grid.');
      }
    }, 3500);
  }

  function stopPolling() {
    clearInterval(statusPollRef.current);
    clearInterval(gridPollRef.current);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleStartDetection() {
    setStartError(null);
    const body = {
      field_id: selectedField,
      partition_type: partitionType,
      ...(detectionMode === 'grid'
        ? { mode: 'grid', grid_x: gridCols, grid_y: gridRows, distance: forwardDistanceCm, start_col: startColVal, start_row: startRowVal }
        : { mode: 'route', route_id: selectedRoute }),
    };
    try {
      await startDetection(selectedDev, body);
    } catch (err) {
      setStartError(err.message || 'Failed to start detection.');
      console.error('Failed to start detection:', err);
      return;
    }
    const emptyGrid = Array.from({ length: gridRows }, () => Array(gridCols).fill(null));
    setRunning(true);
    setDetStatus({ total_distance_cm: 0, cells_scanned: 0, weeds_found: 0 });
    setLiveGrid(emptyGrid);
    startPolling();
  }

  async function handleStopDetection() {
    try {
      await stopDetection(selectedDev);
    } catch (err) {
      showError(err.message || 'Failed to stop detection.');
    }
    stopPolling();
    setRunning(false);
    setLastRun(`Stopped by user at ${new Date().toLocaleTimeString()}`);
  }

  async function handleMove(command) {
    if (!selectedDev || running) return;
    const value = command === 'forward' || command === 'backward' ? moveDistance : turnAngle;
    setMoveLoading(true);
    try {
      await sendMoveCommand(selectedDev, command, value);
    } catch (err) {
      showError(err.message || 'Failed to send move command.');
    }
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
    } catch (err) {
      showError(err.message || 'Failed to save route.');
      setSavingRoute(false);
      return;
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
    <PageLayout
      title="Device Control"
      headerRight={<span className="text-sm font-semibold text-green-700">{devices.length} devices</span>}
    >
      {errorToast}
      {/* Select device & field */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Select Device &amp; Field</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Device ID</label>
            <select key={devices.map(d => `${d.id}:${d.online}`).join(',')} value={selectedDev} onChange={e => setSelectedDev(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer">
              <option value="">{loading ? 'Loading…' : '— Choose device —'}</option>
              {devices.map(d => <option key={d.id} value={String(d.id)}>{d.name}{!d.online ? ' (offline)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Field</label>
            <select value={selectedField} onChange={e => setSelectedField(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white cursor-pointer">
              <option value="">{loading ? 'Loading…' : '— Choose field —'}</option>
              {fields.map(f => <option key={f.id} value={String(f.id)}>{f.name} — {f.width}×{f.length} m</option>)}
            </select>
          </div>
        </div>

        {currentDevice && (
          <div className="flex items-center gap-4 text-sm bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${currentDevice.online ? 'bg-green-500' : 'bg-slate-300'}`} />
            <span className="font-semibold text-slate-700">{currentDevice.name}</span>
            <span className="text-slate-500">Connectivity: <span className={currentDevice.online ? 'text-green-700 font-medium' : 'text-slate-400'}>{currentDevice.online ? 'Online' : 'Offline'}</span></span>
            <StatusBadge status={currentDevice.status} online={currentDevice.online} />
            {selectedField && <span className="text-slate-500 ml-auto">Field: {fields.find(f => String(f.id) === selectedField)?.name}</span>}
          </div>
        )}

        {selectedDev && (
          <p className={`text-xs mt-2 font-medium ${running ? 'text-green-700' : 'text-slate-500'}`}>
            Controlling: {currentDevice?.name ?? selectedDev} · {running ? 'Detection running…' : lastRun ? `Last run: ${lastRun}` : 'No runs yet'}
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
                  <LabeledInput label="Current path" placeholder="e.g. 1" type="number" value={currentPath} onChange={setCurrentPath} min={1} />
                  {selectedFieldObj && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      Grid: <strong>{gridCols} × {gridRows}</strong> cells &nbsp;·&nbsp; Cell: <strong>{cellWidthM} m × {cellLengthM} m</strong>
                      &nbsp;·&nbsp; Scan order: <strong>{partitionType}s</strong>
                      &nbsp;·&nbsp; Forward: <strong>{forwardDistanceCm} cm</strong>
                    </p>
                  )}
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
              {startError && (
                <p className="text-xs text-red-500 mt-1.5 text-center">{startError}</p>
              )}
              {!running && !canStart && !startError && (
                (!selectedDev || !selectedField) ? (
                  <p className="text-xs text-slate-500 mt-1.5 text-center">Please select a device and a field to start detection.</p>
                ) : !currentDevice?.online ? (
                  <p className="text-xs text-red-500 mt-1.5 text-center">Device is offline — cannot start detection.</p>
                ) : !isModeReady ? (
                  <p className="text-xs text-slate-500 mt-1.5 text-center">
                    {detectionMode === 'grid'
                      ? 'Please enter a valid current path number.'
                      : 'Please select a route.'}
                  </p>
                ) : null
              )}
            </>
          ) : (
            <div>
              <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"/> Detection in progress…
              </p>
              <div className="mb-3">
                <DensityGrid
                  grid={liveGrid}
                  cellSize={18}
                  cellHeight={20}
                  showLegend
                  devicePos={detStatus?.device_position}
                />
              </div>
              <div className="space-y-3 text-sm text-slate-700 mb-4">
                <div>
                  <span className="text-xs text-slate-400">Progress</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <strong className="text-sm tabular-nums w-10 text-right">{progressPct}%</strong>
                  </div>
                </div>
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

          <div className="flex flex-col items-center gap-1 mb-4">
            <DPadBtn onClick={() => handleMove('forward')} disabled={running || moveLoading} label="↑" />
            <div className="flex gap-1">
              <DPadBtn onClick={() => handleMove('left')} disabled={running || moveLoading} label="←" />
              <div className="w-10 h-10" />
              <DPadBtn onClick={() => handleMove('right')} disabled={running || moveLoading} label="→" />
            </div>
            <DPadBtn onClick={() => handleMove('backward')} disabled={running || moveLoading} label="↓" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <LabeledInput label="Distance (m)" type="number" value={moveDistance} onChange={v => setMoveDistance(+v)} min={0.1} step={0.1} />
            <LabeledInput label="Turn angle (°)" type="number" value={turnAngle} onChange={v => setTurnAngle(+v)} min={1} step={1} />
          </div>

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
    </PageLayout>
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
