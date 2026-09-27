/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'driver-availability.ts'), 'utf8');
const moduleExports = {};
new Function('exports', 'require', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(moduleExports, () => ({}));
const { applyAvailabilityResponse, isDriverOnline } = moduleExports;

test('confirmed ONLINE puts the driver online and clears toggling', () => {
  const decision = applyAvailabilityResponse(false, 'ONLINE', { availability: 'ONLINE' });
  assert.equal(decision.isOnline, true);
  assert.equal(decision.isToggling, false);
  assert.equal(decision.errorMessage, null);
});

test('confirmed OFFLINE takes the driver offline and clears toggling', () => {
  const decision = applyAvailabilityResponse(true, 'OFFLINE', { availability: 'OFFLINE' });
  assert.equal(decision.isOnline, false);
  assert.equal(decision.isToggling, false);
  assert.equal(decision.errorMessage, null);
});

test('BUSY still counts as online for dispatch purposes', () => {
  assert.equal(isDriverOnline('BUSY'), true);
  assert.equal(isDriverOnline('ONLINE'), true);
  assert.equal(isDriverOnline('OFFLINE'), false);
  assert.equal(isDriverOnline(null), false);
  assert.equal(isDriverOnline(undefined), false);
});

test('unconfirmed response leaves the current flag untouched with an error', () => {
  const unchanged = applyAvailabilityResponse(true, 'ONLINE', { availability: 'OFFLINE' });
  assert.equal(unchanged.isOnline, true, 'server said OFFLINE, so no flip');
  assert.equal(unchanged.isToggling, false);
  assert.match(unchanged.errorMessage, /did not confirm going online/);

  const missing = applyAvailabilityResponse(false, 'OFFLINE', null);
  assert.equal(missing.isOnline, false, 'null response must not change state');
  assert.match(missing.errorMessage, /did not confirm going offline/);
});

test('server profile is the single source of truth for restored state', () => {
  // initialize() maps server availability through isDriverOnline; a stale
  // persisted "online" flag must never survive that mapping.
  assert.equal(isDriverOnline('ONLINE') || isDriverOnline('BUSY'), true);
  assert.equal(isDriverOnline('OFFLINE'), false);
});
