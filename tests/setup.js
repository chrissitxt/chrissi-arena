// Loads the actual index.html body into the happy-dom test environment
// before any test file runs, so modules that look up DOM elements at
// import time (src/dom.js) find the real elements instead of crashing.
// This means tests exercise the real markup, not a hand-maintained stub
// that could quietly drift out of sync with it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const bodyMatch = html.match(/<body>([\s\S]*)<script/);
document.body.innerHTML = bodyMatch[1];

// happy-dom returns null from canvas.getContext('2d') — it doesn't implement
// a real 2D rendering context. That's fine for these tests (they check game
// *state*, never pixels), but src/dom.js touches ctx.imageSmoothingEnabled
// at import time, so something has to answer that call. This stub covers
// every ctx.* method render/canvas.js actually calls — grep for `ctx\.` in
// that file and extend this list if a future change adds a new one.
const ctxMethods = ['arc', 'beginPath', 'closePath', 'fill', 'fillRect', 'fillText',
  'lineTo', 'measureText', 'moveTo', 'restore', 'rotate', 'save', 'stroke', 'translate'];
const ctxStub = {};
for (const m of ctxMethods) ctxStub[m] = () => (m === 'measureText' ? { width: 0 } : undefined);
['fillStyle', 'font', 'globalAlpha', 'lineWidth', 'strokeStyle', 'textAlign'].forEach(prop => {
  ctxStub[prop] = '';
});
HTMLCanvasElement.prototype.getContext = () => ctxStub;

