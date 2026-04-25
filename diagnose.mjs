/**
 * diagnose.mjs — Login, hit dashboard, intercept API responses to find what's crashing the page.
 */
import puppeteer from 'puppeteer';

const BASE     = 'http://localhost:5174';
const API_BASE = 'http://localhost:5000';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();

// ── Intercept API responses ────────────────────────────────────────────────────
const apiResponses = {};
const consoleErrors = [];
const crashSignals = [];

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => {
  crashSignals.push('PAGE ERROR: ' + err.message);
  console.error('  PAGE ERROR:', err.message);
});
page.on('requestfailed', req => {
  console.warn('  REQUEST FAILED:', req.url(), req.failure()?.errorText);
});

// Intercept responses from the API
page.on('response', async resp => {
  const url = resp.url();
  if (!url.includes('/api/')) return;
  const path = new URL(url).pathname + new URL(url).search;
  try {
    const ct = resp.headers()['content-type'] || '';
    if (ct.includes('application/json')) {
      const body = await resp.json();
      apiResponses[path] = body;
      // For grid-like responses, log dimensions immediately
      if (Array.isArray(body) && Array.isArray(body[0])) {
        const rows = body.length;
        const cols = body[0].length;
        const total = rows * cols;
        console.log(`  [API] ${path} → ${rows} rows × ${cols} cols = ${total} cells`);
        if (total > 5000) {
          console.error(`  ⚠️  CRASH RISK: ${total} cells would render ${total} DOM nodes!`);
        }
      } else if (Array.isArray(body)) {
        console.log(`  [API] ${path} → array[${body.length}]`);
      } else {
        console.log(`  [API] ${path} → object keys: ${Object.keys(body).join(', ')}`);
      }
    }
  } catch {}
});

// ── Login ─────────────────────────────────────────────────────────────────────
console.log('\n=== Logging in ===');
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
await page.waitForSelector('input[name="username"]', { timeout: 5000 });
await page.type('input[name="username"]', 'guest');
await page.type('input[type="password"]', 'guest1234');
await page.keyboard.press('Enter');
await page.waitForNavigation({ timeout: 8000 }).catch(() => {});
console.log('  URL after login:', page.url());

if (page.url().includes('/login')) {
  console.error('  Login failed — stopping.');
  await browser.close();
  process.exit(1);
}

// ── Navigate to dashboard and catch the crash ─────────────────────────────────
console.log('\n=== Navigating to dashboard, watching for grid responses ===');

// Patch fetch to count calls and log density-map response sizes before React renders them
await page.evaluateOnNewDocument(() => {
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    const res = await origFetch.apply(this, args);
    if (url?.includes('density-map')) {
      const clone = res.clone();
      clone.json().then(data => {
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const rows = data.length, cols = data[0].length;
          console.error(`DENSITY-MAP SIZE: ${rows} rows × ${cols} cols = ${rows * cols} cells`);
        } else {
          console.error(`DENSITY-MAP DATA (non-grid):`, JSON.stringify(data).slice(0, 200));
        }
      }).catch(() => {});
    }
    return res;
  };
});

await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => {
  console.error('  Navigation error (page may have crashed):', e.message);
});

console.log('  URL:', page.url());

// Give it 5 seconds to load APIs and potentially crash
await new Promise(r => setTimeout(r, 5000));

// Check DOM node count
const domInfo = await page.evaluate(() => ({
  nodeCount: document.querySelectorAll('*').length,
  gridCells: document.querySelectorAll('[title*="Row"]').length,
  heapMB: (performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(1),
})).catch(() => null);

if (domInfo) {
  console.log(`\n=== DOM snapshot ===`);
  console.log(`  Total nodes : ${domInfo.nodeCount}`);
  console.log(`  Grid cells  : ${domInfo.gridCells}`);
  console.log(`  JS heap     : ${domInfo.heapMB} MB`);
  if (domInfo.gridCells > 5000) {
    console.error(`  ⚠️  ${domInfo.gridCells} grid cells rendered — this is the crash cause!`);
  }
}

// ── API response summary ──────────────────────────────────────────────────────
console.log('\n=== API responses captured ===');
for (const [path, body] of Object.entries(apiResponses)) {
  if (Array.isArray(body) && Array.isArray(body[0])) {
    console.log(`  ${path}: 2D grid ${body.length}×${body[0]?.length}`);
  } else if (Array.isArray(body)) {
    console.log(`  ${path}: array[${body.length}]`);
  } else {
    console.log(`  ${path}: ${JSON.stringify(body).slice(0, 120)}`);
  }
}

console.log('\n=== Console errors ===');
consoleErrors.forEach(e => console.log(' ', e));
console.log('\n=== Page crash signals ===');
crashSignals.forEach(e => console.log(' ', e));

await browser.close();
