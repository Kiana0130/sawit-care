const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function render(quota) {
  let i = 0;
  const states = [quota, quota ? { total_scans: 12, pending_scans: 3 } : null, null, !quota];
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const mocks = {
    react: { useCallback: fn => fn, useState: () => [states[i++], () => {}] },
    'react/jsx-runtime': jsx,
    'react-native': { StyleSheet: { create: x => x }, Text: 'Text', View: 'View', ActivityIndicator: 'ActivityIndicator' },
    'expo-router': { useFocusEffect: () => {} },
    'expo-symbols': { SymbolView: 'SymbolView' },
    '@/lib/scan-api': { ScanApiError: class extends Error {} },
  };
  const source = ts.transpileModule(fs.readFileSync('app/(tabs)/index.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})')(name => mocks[name], module, module.exports);
  const tree = module.exports.default();
  function text(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(text).join(' ');
    return node && node.props ? text(node.props.children) : '';
  }
  return text(tree);
}

const free = render({ plan: 'free', limit: 5, remaining: 4 });
assert.match(free, /7 hari terakhir/i, 'Free summary must disclose the 7-day period');
const pro = render({ plan: 'pro', limit: null, remaining: null });
assert.match(pro, /seluruh (?:riwayat|waktu)/i, 'PRO summary must disclose the unrestricted period');
assert.doesNotMatch(render(null), /7 hari terakhir|seluruh (?:riwayat|waktu)/i, 'unknown plan must not claim a period');
console.log('dashboard period labels: free, pro, unknown passed');
