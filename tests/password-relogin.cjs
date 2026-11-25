const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup(changePassword) {
  const events = [];
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useCallback: f => f,
    useContext: () => null,
    useEffect: () => {},
    useMemo: f => f(),
    useState: value => [value, value => events.push(['user', value])],
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (_type, props) => props },
    'expo-router': { router: { replace: route => events.push(['route', route]) } },
    '@/lib/api': { changePassword, logout: async () => { throw Error('revoked'); } },
    '@/lib/auth-storage': { clearTokens: async () => events.push(['clear']), getAccessToken: async () => null },
  };
  const code = ts.transpile(fs.readFileSync('providers/auth-provider.tsx', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX });
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})')(name => mocks[name], mod, mod.exports);
  return { auth: mod.exports.AuthProvider({ children: null }).value, events };
}

(async () => {
  const success = setup(async () => success.events.push(['changed']));
  await success.auth.changePassword('old', 'new');
  assert.deepEqual(success.events, [['changed'], ['clear'], ['user', null], ['route', { pathname: '/login', params: { passwordChanged: '1' } }]]);
  const failure = setup(async () => { throw Error('wrong password'); });
  await assert.rejects(failure.auth.changePassword('old', 'new'), /wrong password/);
  assert.deepEqual(failure.events, []);
  console.log('password change logout and failure: passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
