const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderResult(params) {
  const source = fs.readFileSync(require.resolve('../app/result.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const component = (name) => ({ children }) => React.createElement(name, null, children);
  const native = { View: component('div'), Text: component('span'), Image: component('img'), Pressable: component('button'), StyleSheet: { create: (styles) => styles } };
  const router = { router: { back() {} }, useLocalSearchParams: () => params };
  const exports = {};
  const mockRequire = (name) => name === 'react-native' ? native : name === 'expo-router' ? router : name === 'expo-symbols' ? { SymbolView: component('i') } : name === '@/lib/feedback' ? { showMessage() {} } : require(name);
  vm.runInNewContext(code, { exports, require: mockRequire });
  return renderToStaticMarkup(React.createElement(exports.default));
}

test('legacy result without AI data shows unavailable status, not a sample diagnosis', () => {
  const html = renderResult({});
  assert.match(html, /Menunggu model AI/i);
  assert.doesNotMatch(html, /Bercak Cercospora|87\.5|TERDETEKSI SAKIT|SEHAT/);
});

test('untrusted result parameters cannot produce a diagnosis or confidence', () => {
  const html = renderResult({ disease: 'Penyakit Palsu', confidence: '99.9', imageUri: 'https://example.com/image.jpg' });
  assert.match(html, /Menunggu model AI/i);
  assert.doesNotMatch(html, /Penyakit Palsu|99\.9|TERDETEKSI SAKIT|SEHAT/);
});
