const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'sheet.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleExports = {};
new Function('exports', compiled)(moduleExports);
const { sheetSnapOffsets, clampSheetDrag, nearestSheetSnap } = moduleExports;

test('snap offsets preserve fully expanded zero and clamp percentages', () => {
  assert.deepEqual(sheetSnapOffsets(800, [0, 50, 100, -10, 120]), [800, 400, 0, 800, 0]);
});

test('snap positions respond to available height', () => {
  assert.deepEqual(sheetSnapOffsets(400, [25, 50, 100]), [300, 200, 0]);
});

test('upward drag expands and downward drag collapses', () => {
  assert.equal(clampSheetDrag(400, -100, [600, 300, 0]), 300);
  assert.equal(clampSheetDrag(300, 100, [600, 300, 0]), 400);
});

test('drag clamps at both edges regardless of snap ordering', () => {
  assert.equal(clampSheetDrag(300, -900, [600, 300, 0]), 0);
  assert.equal(clampSheetDrag(300, 900, [0, 300, 600]), 600);
});

test('release snaps to nearest position and respects velocity', () => {
  assert.equal(nearestSheetSnap(100, 0, [600, 300, 0]), 0);
  assert.equal(nearestSheetSnap(300, -1800, [600, 300, 0]), 0);
  assert.equal(nearestSheetSnap(300, 1800, [600, 300, 0]), 600);
});
