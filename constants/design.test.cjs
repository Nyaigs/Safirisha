const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'design.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleExports = {};
const requireShim = (name) => {
  if (name === 'react-native') return { Platform: { select: (options) => options.default ?? options.android } };
  throw new Error(`Unexpected import: ${name}`);
};
new Function('exports', 'require', compiled)(moduleExports, requireShim);
const { snapPoints, scaled } = moduleExports;

test('sheet snap heights match per-size visibility ratios', () => {
  const small = snapPoints(1000, 'small');
  assert.deepEqual(small.map((value) => Math.round(value)), [300, 650, 920]);

  const medium = snapPoints(1000, 'medium');
  assert.deepEqual(medium.map((value) => Math.round(value)), [250, 600, 900]);

  const large = snapPoints(1000, 'large');
  assert.deepEqual(large.map((value) => Math.round(value)), [250, 600, 900]);

  const tablet = snapPoints(1000, 'tablet');
  assert.deepEqual(tablet.map((value) => Math.round(value)), [220, 550, 880]);
});

test('sheet snap heights default to medium ratios', () => {
  assert.deepEqual(snapPoints(1000), snapPoints(1000, 'medium'));
});

test('sheet snap heights scale with the provided screen height', () => {
  assert.deepEqual(snapPoints(800, 'small'), [240, 520, 736]);
});

test('scaled typography multiplies by the device font scale', () => {
  assert.equal(scaled(16, 0.9), 14.4);
  assert.equal(scaled(16, 1), 16);
  assert.equal(scaled(16, 1.1), 17.6);
});
