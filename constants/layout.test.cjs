const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'layout.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const fakeReactNative = { useWindowDimensions: () => ({ width: 390, height: 844 }) };
const loadLayout = (width, height) => {
  const moduleExports = {};
  const requireShim = (name) => {
    if (name === 'react-native') return { ...fakeReactNative, useWindowDimensions: () => ({ width, height }) };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function('exports', 'require', compiled)(moduleExports, requireShim);
  return moduleExports.useLayout();
};

test('breakpoint bands classify small, medium, large and tablet widths', () => {
  const small = loadLayout(340, 800);
  assert.equal(small.isSmall, true);
  assert.equal(small.isMedium, false);
  assert.equal(small.isLarge, false);
  assert.equal(small.isTablet, false);

  const medium = loadLayout(360, 800);
  assert.equal(medium.isSmall, false);
  assert.equal(medium.isMedium, true);
  assert.equal(medium.isLarge, false);

  const large = loadLayout(414, 900);
  assert.equal(large.isMedium, false);
  assert.equal(large.isLarge, true);
  assert.equal(large.isTablet, false);

  const tablet = loadLayout(768, 1000);
  assert.equal(tablet.isTablet, true);
  assert.equal(large.isTablet, false);
});

test('font scale shrinks on small phones and grows on tablets', () => {
  assert.equal(loadLayout(340, 800).fontScale, 0.9);
  assert.equal(loadLayout(390, 844).fontScale, 1);
  assert.equal(loadLayout(768, 1000).fontScale, 1.1);
});

test('landscape detection follows width versus height', () => {
  assert.equal(loadLayout(844, 390).isLandscape, true);
  assert.equal(loadLayout(390, 844).isLandscape, false);
});

test('spacing tokens and safe-area placeholders are stable', () => {
  const layout = loadLayout(390, 844);
  assert.deepEqual(layout.spacing, { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, safeTop: 0, safeBottom: 0 });
});
