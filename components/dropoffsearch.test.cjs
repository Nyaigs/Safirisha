/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute the production callback, not a copied implementation. React/native
// rendering is outside this unit test; fetch completion order is controlled.
function harness() {
  const source = fs.readFileSync(process.env.SEARCH_SOURCE || path.join(__dirname, 'dropoffsearch.tsx'), 'utf8');
  const start = source.indexOf('  const searchPlaces = useCallback(');
  const end = source.indexOf('\n  useEffect', start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpileModule(source.slice(start, end) + '\nreturn searchPlaces;', {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const state = { results: [], loading: false };
  const pending = [];
  const generation = { current: 0 };
  const search = new Function('useCallback', 'setResults', 'setLoading', 'setError', 'GEOAPIFY_KEY', 'currentLocation', 'fetch', 'requestIdRef', 'maps', code)(
    (callback) => callback, (results) => { state.results = results; }, (loading) => { state.loading = loading; }, (error) => { state.error = error; },
    'unit-test-key', null, () => Promise.reject(new Error('fetch is no longer used by the component')), generation,
    { searchPlaces: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  );
  const resolve = (index, name) => pending[index].resolve([{ id: name, name, address: name, latitude: -1.26, longitude: 36.8 }]);
  return { state, pending, search, resolve, generation };
}

test('older response cannot overwrite the newest query', async () => {
  const h = harness();
  const first = h.search('Westlands');
  const second = h.search('Karen');
  h.resolve(1, 'Karen');
  await second;
  h.resolve(0, 'Westlands');
  await first;
  assert.equal(h.state.results[0].address, 'Karen');
});

test('clearing a query invalidates its in-flight response', async () => {
  const h = harness();
  const first = h.search('Westlands');
  await h.search('');
  h.resolve(0, 'Westlands');
  await first;
  assert.equal(h.state.results.length, 0);
  assert.equal(h.state.loading, false);
});

test('stale completion cannot stop a newer loading indicator', async () => {
  const h = harness();
  const first = h.search('Westlands');
  const second = h.search('Karen');
  h.resolve(0, 'Westlands');
  await first;
  assert.equal(h.state.loading, true);
  h.resolve(1, 'Karen');
  await second;
  assert.equal(h.state.loading, false);
});

test('stale rejection cannot clear newer results', async () => {
  const h = harness();
  const first = h.search('Westlands');
  const second = h.search('Karen');
  h.resolve(1, 'Karen');
  await second;
  h.pending[0].reject(new Error('network lost'));
  await first;
  assert.equal(h.state.results[0].address, 'Karen');
});
