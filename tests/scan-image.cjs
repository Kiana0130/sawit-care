const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(mocks) {
  const code = ts.transpileModule(fs.readFileSync('lib/scan-image.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')((name) => { if (name in mocks) return mocks[name]; throw Error(name); }, module, module.exports);
  return module.exports;
}

(async () => {
  const calls = [];
  const image = { width: 4000, height: 3000, saveAsync: async () => ({ uri: 'cache:output', width: 2048, height: 1536 }), release() {} };
  const context = { resize: (size) => calls.push(size), renderAsync: async () => image, release() {} };
  const mocks = { 'react-native': { Platform: { OS: 'android' } }, 'expo-image-manipulator': { ImageManipulator: { manipulate: () => context }, SaveFormat: { JPEG: 'jpeg' } }, 'expo-file-system': { File: class { constructor(uri) { this.uri = uri; this.size = 100; this.exists = true; } delete() { calls.push('deleted'); } } } };
  const { prepareScanImage } = load(mocks);
  const result = await prepareScanImage('original');
  assert.deepEqual(calls[0], { width: 2048, height: null });
  assert.equal(result.uri, 'cache:output');
  assert.equal(result.mimeType, 'image/jpeg');
  result.release();
  assert.equal(calls[1], 'deleted');
  mocks['expo-file-system'].File = class { constructor() { this.size = 10 * 1024 * 1024 + 1; this.exists = true; } delete() { calls.push('oversize deleted'); } };
  await assert.rejects(prepareScanImage('original'), /10 MB/);
  assert.equal(calls.at(-1), 'oversize deleted');
  mocks['react-native'].Platform.OS = 'web';
  const oldFetch = global.fetch;
  global.fetch = async () => ({ blob: async () => new Blob(['image']) });
  const webResult = await prepareScanImage('original');
  assert.equal(webResult.mimeType, 'image/jpeg');
  webResult.release();
  global.fetch = oldFetch;
  console.log('scan-image tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
