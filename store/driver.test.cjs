/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadStore({ cached = null, socketFails = false } = {}) {
  const requests = [];
  const events = [];
  const socket = { connected: true, emit: (event) => {
    if (socketFails) throw new Error('Socket unavailable');
    events.push(event);
  } };
  const storage = {
    getItem: async () => cached,
    setItem: async () => {},
    removeItem: async () => {},
  };
  const mocks = {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    '../lib/api': {
      apiFetch: (url, options) => new Promise((resolve, reject) => {
        requests.push({ url, options, resolve, reject });
      }),
    },
    '../lib/socket': { connectSocket: () => socket, getSocket: () => socket },
  };
  function load(file) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    new Function('exports', 'require', code)(exports, (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(file), `${id}.ts`));
      return require(id); // Use the installed Zustand and persist implementations.
    });
    return exports;
  }
  const store = load(path.join(__dirname, 'driver.ts')).useDriverStore;
  return { store, requests, events };
}

test('real driver store changes availability only after backend confirmation, in both directions', async () => {
  const { store, requests, events } = loadStore();
  await store.persist.rehydrate();

  for (const [action, before, requested, expected] of [
    ['goOnline', false, 'ONLINE', true],
    ['goOffline', true, 'OFFLINE', false],
  ]) {
    const profile = { id: 'driver-test', availability: before ? 'ONLINE' : 'OFFLINE' };
    store.setState({ isOnline: before, isToggling: false, error: null, driverProfile: profile });
    const eventsBefore = events.length;

    const rejected = store.getState()[action]();
    const rejection = assert.rejects(rejected, /Backend rejected/);
    assert.equal(store.getState().isOnline, before, `${action}: pending must not flip availability`);
    assert.equal(store.getState().driverProfile, profile);
    assert.equal(store.getState().isToggling, true);
    assert.equal(events.length, eventsBefore, 'no socket availability event before confirmation');
    requests.at(-1).reject(new Error('Backend rejected'));
    await rejection;
    assert.equal(store.getState().isOnline, before, `${action}: rejection must preserve availability`);
    assert.equal(store.getState().driverProfile, profile);
    assert.equal(store.getState().isToggling, false);
    assert.equal(events.length, eventsBefore);

    const confirmed = store.getState()[action]();
    assert.equal(store.getState().isOnline, before);
    assert.equal(store.getState().isToggling, true);
    const request = requests.at(-1);
    assert.equal(request.url, '/drivers/me/availability');
    assert.equal(request.options.method, 'PATCH');
    assert.equal(request.options.body.availability, requested);
    request.resolve({ availability: requested });
    await confirmed;
    assert.equal(store.getState().isOnline, expected, `${action}: confirmation must update availability`);
    assert.equal(store.getState().driverProfile.availability, requested);
    assert.equal(store.getState().isToggling, false);
    assert.equal(store.getState().error, null);
    assert.equal(events.length, eventsBefore + 1);
    assert.equal(events.at(-1), `driver:${requested.toLowerCase()}`);
  }
});

test('legacy persisted online flag is ignored during hydration', async () => {
  const { store } = loadStore({ cached: JSON.stringify({ state: { isOnline: true }, version: 0 }) });
  await store.persist.rehydrate();
  assert.equal(store.getState().isOnline, false);
  assert.equal(store.getState().driverProfile, null);
});

test('socket failure does not undo a REST-confirmed availability change', async () => {
  const { store, requests } = loadStore({ socketFails: true });
  await store.persist.rehydrate();
  for (const [action, requested, expected] of [
    ['goOnline', 'ONLINE', true], ['goOffline', 'OFFLINE', false],
  ]) {
    store.setState({ isOnline: !expected, driverProfile: { id: 'driver-test', availability: expected ? 'OFFLINE' : 'ONLINE' } });
    const pending = store.getState()[action]();
    requests.at(-1).resolve({ availability: requested });
    await pending;
    assert.equal(store.getState().isOnline, expected);
    assert.equal(store.getState().driverProfile.availability, requested);
    assert.equal(store.getState().isToggling, false);
    assert.match(store.getState().error, /live updates are unavailable/);
  }
});

test('duplicate toggles send one request; mismatched confirmation preserves state', async () => {
  const { store, requests, events } = loadStore();
  await store.persist.rehydrate();
  const pending = store.getState().goOnline();
  const rejected = assert.rejects(pending, /did not confirm/);
  await store.getState().goOnline();
  assert.equal(requests.length, 1);
  requests[0].resolve({ availability: 'OFFLINE' });
  await rejected;
  assert.equal(store.getState().isOnline, false);
  assert.equal(store.getState().isToggling, false);
  assert.equal(events.length, 0);
});
