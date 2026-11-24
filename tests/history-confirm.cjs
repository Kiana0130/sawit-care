const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, mocks) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})')((name) => {
    if (name in mocks) return mocks[name];
    throw new Error(name);
  }, module, module.exports);
  return module.exports;
}

async function check(platform, accept) {
  let dialog, deleted = [];
  const native = { Platform: { OS: platform }, Alert: { alert: (title, message, buttons) => { dialog = { title, message, buttons }; } }, StyleSheet: { create: (styles) => styles } };
  global.window = { confirm: (message) => { dialog = { message }; return accept; } };
  const feedback = load('lib/feedback.ts', { 'react-native': native });
  const item = { id: 'scan-1', status: 'pending', scanned_at: '2026-01-01T00:00:00Z' };
  let stateIndex = 0;
  const react = { useCallback: (fn) => fn, useState: () => [ [ 'all', [item], false, null, null ][stateIndex++], () => {} ] };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const screen = load('app/(tabs)/history.tsx', {
    react, 'react/jsx-runtime': jsx, 'react-native': native,
    'expo-router': { useFocusEffect: () => {}, router: {} }, 'expo-symbols': {},
    '@/lib/feedback': feedback,
    '@/lib/scan-api': { deleteScan: async (id) => { deleted.push(id); }, ScanApiError: class extends Error {} },
  }).default();
  const list = screen.props.children[1];
  const card = list.props.renderItem({ item });
  const button = card.props.children[1];
  button.props.onPress();
  assert.ok(dialog, 'a confirmation must be shown before deleting');
  assert.match(dialog.message, /hapus/i);
  if (platform !== 'web') {
    assert.deepEqual(deleted, []);
    assert.equal(dialog.buttons[0].style, 'cancel');
    assert.equal(dialog.buttons[1].style, 'destructive');
    if (accept) dialog.buttons[1].onPress();
  }
  assert.deepEqual(deleted, accept ? ['scan-1'] : []);
}
(async () => {
  for (const platform of ['web', 'ios', 'android']) {
    await check(platform, false);
    await check(platform, true);
  }
  console.log('history delete confirmation: web, iOS, Android cancel/confirm passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
