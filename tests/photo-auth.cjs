const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = (path, mocks) => {
  const code = ts.transpile(fs.readFileSync(path, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports,process,fetch,Headers,FormData,AbortController,setTimeout,clearTimeout,URL){' + code + '\n})')(
    (name) => { if (name in mocks) return mocks[name]; throw Error(name); }, module, module.exports, process, global.fetch, Headers, FormData, AbortController, setTimeout, clearTimeout, URL);
  return module.exports;
};
(async () => {
  let access = 'expired', refresh = 'refresh'; const calls = [];
  const storage = { getAccessToken: async () => access, getRefreshToken: async () => refresh, saveTokens: async (a,r) => { access=a; refresh=r; }, clearTokens: async () => { access=null; refresh=null; } };
  global.fetch = async (url, options) => {
    calls.push({url, options});
    if (url.endsWith('/auth/refresh')) return new Response(JSON.stringify({access_token:'new',refresh_token:'new-refresh'}));
    if (options.headers.get('Authorization') === 'Bearer expired') return new Response('{}',{status:401});
    return new Response(new Uint8Array([1,2,3]), {headers:{'Content-Type':'image/jpeg'}});
  };
  const api = load('lib/api.ts', {'@/lib/auth-storage': storage});
  let written;
  class File { constructor(...args) { this.uri = 'file:///private/cache/photo'; } write(bytes) { written = [...bytes]; } delete() {} }
  const scan = load('lib/scan-api.ts', {'react-native':{Platform:{OS:'android'}},'expo-crypto':{randomUUID:()=> 'uuid'},'expo-file-system':{File,Paths:{cache:'cache'}},'@/lib/auth-storage':storage,'@/lib/api':api});
  const photo = await scan.getScanPhoto('id');
  assert.equal(photo.uri, 'file:///private/cache/photo');
  assert.deepEqual(written,[1,2,3]);
  assert.equal(calls.length,3);
  assert.equal(calls[2].options.headers.get('Authorization'),'Bearer new');
  let attempts = 0, cleared = false;
  global.fetch = async (url) => {
    attempts++;
    return new Response('{}', {status: 401});
  };
  const rejectedStorage = { ...storage, getAccessToken: async () => 'expired', getRefreshToken: async () => 'invalid', clearTokens: async () => { cleared = true; } };
  const rejectedApi = load('lib/api.ts', {'@/lib/auth-storage': rejectedStorage});
  await assert.rejects(rejectedApi.requestResponse('/scans/id/photo'), error => error.status === 401);
  assert.equal(attempts, 2);
  assert.equal(cleared, true);
  attempts = 0;
  global.fetch = async () => { attempts++; return new Response('{}', {status: 404}); };
  const notFoundApi = load('lib/api.ts', {'@/lib/auth-storage': storage});
  const notFoundScan = load('lib/scan-api.ts', {'react-native':{Platform:{OS:'android'}},'expo-crypto':{randomUUID:()=> 'uuid'},'expo-file-system':{File,Paths:{cache:'cache'}},'@/lib/auth-storage':storage,'@/lib/api':notFoundApi});
  await assert.rejects(notFoundScan.getScanPhoto('missing'), error => error.status === 404);
  assert.equal(attempts, 1);
  console.log('photo authentication, refresh rejection, and 404: passed');
})().catch(e => { console.error(e); process.exitCode=1; });
