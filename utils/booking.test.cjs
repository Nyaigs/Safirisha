const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'booking.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleExports = {};
new Function('exports', 'require', compiled)(moduleExports, () => ({}));
const {
  choosePickupInDraft,
  chooseDropoffInDraft,
  previousBookingStep,
  hasValidLoadDescription,
  buildLoadDescription,
  distanceBetweenKm,
  buildRequestPayload,
  toLocationPoint,
  INITIAL_BOOKING_DRAFT,
} = moduleExports;

const nairobiPoint = { latitude: -1.286389, longitude: 36.817223, address: 'Nairobi CBD' };
const westlandsPoint = { latitude: -1.2673, longitude: 36.8065, address: 'Westlands' };

test('choosing pickup preserves an independently selected drop-off', () => {
  const draft = { ...INITIAL_BOOKING_DRAFT, dropoff: toLocationPoint(westlandsPoint), vehicle: 'bike', step: 'pickup' };
  const next = choosePickupInDraft(draft, nairobiPoint);
  assert.equal(next.dropoff, draft.dropoff, 'dropoff must be the same object, not cleared');
  assert.equal(next.step, 'dropoff');
  assert.equal(next.vehicle, null, 'vehicle must reset when the route changes');
  assert.equal(next.pickup.address, 'Nairobi CBD');
});

test('choosing pickup without a dropoff starts the dropoff step', () => {
  const next = choosePickupInDraft(INITIAL_BOOKING_DRAFT, nairobiPoint);
  assert.equal(next.step, 'dropoff');
  assert.equal(next.dropoff, null);
  assert.deepEqual(next.pickup, { latitude: -1.286389, longitude: 36.817223, address: 'Nairobi CBD', placeId: undefined });
});

test('pinned locations get an honest fallback label', () => {
  const next = chooseDropoffInDraft(INITIAL_BOOKING_DRAFT, { latitude: 0.1, longitude: 36.8 });
  assert.equal(next.dropoff.address, 'Pinned location');
  assert.equal(next.step, 'details');
});

test('step chain walks back to idle and stops there', () => {
  assert.equal(previousBookingStep('dropoff'), 'pickup');
  assert.equal(previousBookingStep('details'), 'dropoff');
  assert.equal(previousBookingStep('load'), 'details');
  assert.equal(previousBookingStep('vehicle'), 'load');
  assert.equal(previousBookingStep('confirm'), 'vehicle');
  assert.equal(previousBookingStep('pickup'), 'idle');
  assert.equal(previousBookingStep('idle'), 'idle');
});

test('custom loads require a description, other loads do not', () => {
  assert.equal(hasValidLoadDescription('Custom', ''), false);
  assert.equal(hasValidLoadDescription('Custom', '  '), false);
  assert.equal(hasValidLoadDescription('Custom', 'Two fridges'), true);
  assert.equal(hasValidLoadDescription('Small', ''), true);
  assert.equal(hasValidLoadDescription(null, ''), true);
});

test('load description joins parts and returns null when empty', () => {
  assert.equal(buildLoadDescription('Package', 'laptop', true), 'Package · laptop · Fragile');
  assert.equal(buildLoadDescription(null, '  ', false), null);
});

test('haversine distance matches the backend formula scale', () => {
  const km = distanceBetweenKm(toLocationPoint(nairobiPoint), toLocationPoint(westlandsPoint));
  assert.ok(km > 2 && km < 3, `expected ~2.4km, got ${km}`);
  assert.equal(distanceBetweenKm(toLocationPoint(nairobiPoint), toLocationPoint(nairobiPoint)), 0);
});

test('request payload requires both endpoints, vehicle, load and distance', () => {
  const draft = { ...INITIAL_BOOKING_DRAFT, pickup: toLocationPoint(nairobiPoint), dropoff: toLocationPoint(westlandsPoint), loadSize: 'Small', notes: ' gate B ', category: 'Package', fragile: true };
  const payload = buildRequestPayload(draft, 'bike', 2.42, 283);
  assert.equal(payload.pickupAddress, 'Nairobi CBD');
  assert.equal(payload.loadDescription, 'Package · Fragile');
  assert.equal(payload.specialNotes, 'gate B');
  assert.equal(payload.distanceKm, 2.42);
  assert.equal(buildRequestPayload({ ...draft, dropoff: null }, 'bike', 2.42, 283), null);
  assert.equal(buildRequestPayload(draft, 'bike', 0, 283), null, 'zero distance must not submit');
  assert.equal(buildRequestPayload({ ...draft, loadSize: 'Custom', description: ' ' }, 'bike', 2.42, 283), null, 'custom load needs a description');
});
