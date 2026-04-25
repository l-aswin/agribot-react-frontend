import { DENSITY_COLORS } from '../constants';

const MAX_DIM = 20;
const RANK = { high: 3, medium: 2, low: 1, empty: 0, null: -1 };

function downsample(grid) {
  const rows = grid.length, cols = grid[0]?.length ?? 0;
  if (!rows || !cols || (rows <= MAX_DIM && cols <= MAX_DIM)) return grid;
  const rStep = rows / MAX_DIM, cStep = cols / MAX_DIM;
  const outR = Math.min(rows, MAX_DIM), outC = Math.min(cols, MAX_DIM);
  return Array.from({ length: outR }, (_, ri) =>
    Array.from({ length: outC }, (_, ci) => {
      const r0 = Math.floor(ri * rStep), r1 = Math.floor((ri + 1) * rStep);
      const c0 = Math.floor(ci * cStep), c1 = Math.floor((ci + 1) * cStep);
      let best = null;
      for (let r = r0; r < r1; r++)
        for (let c = c0; c < c1; c++) {
          const v = grid[r]?.[c] ?? null;
          if ((RANK[v] ?? -1) > (RANK[best] ?? -1)) best = v;
        }
      return best;
    })
  );
}

const LEGEND = [
  { key: 'low',    label: 'Low',    cls: 'bg-green-400' },
  { key: 'medium', label: 'Medium', cls: 'bg-orange-300' },
  { key: 'high',   label: 'High',   cls: 'bg-red-400' },
];

/**
 * DensityGrid — renders a 2-D weed-density heatmap.
 *
 * Props:
 *   grid        — 2-D array of density strings ('low' | 'medium' | 'high' | 'empty' | null)
 *   cellSize?   — pixel min-width of each cell (default 26)
 *   cellHeight? — pixel height of each cell (default 24)
 *   showLegend? — show the colour legend (default true)
 *   devicePos?  — { x, y } — highlights the device position cell with a ring
 */
export default function DensityGrid({ grid, cellSize = 26, cellHeight = 24, showLegend = true, devicePos }) {
  const safe = downsample(grid);
  const cols = safe[0]?.length ?? 0;

  return (
    <div>
      {showLegend && (
        <div className="flex gap-3 mb-3 text-xs text-slate-600">
          {LEGEND.map(({ key, label, cls }) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${cls} inline-block`} />
              {label}
            </span>
          ))}
          {devicePos && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm ring-2 ring-green-600 inline-block" />
              Device
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(${cellSize}px, 1fr))` }}
        >
          {safe.map((row, ri) =>
            row.map((density, ci) => {
              const isDevice = devicePos?.x === ci && devicePos?.y === ri;
              return (
                <div
                  key={`${ri}-${ci}`}
                  title={`Row ${ri + 1}, Col ${ci + 1}${density ? ` — ${density}` : ''}`}
                  style={{ height: cellHeight }}
                  className={`${DENSITY_COLORS[density ?? 'null'] ?? 'bg-slate-200'} rounded transition-opacity hover:opacity-70 cursor-default${isDevice ? ' ring-2 ring-green-600' : ''}`}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
