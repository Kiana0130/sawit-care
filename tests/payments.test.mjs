import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { safeCheckoutUrl, createPaymentClient } from '../lib/payments.ts';

test('only exact HTTPS sandbox checkout host is allowed', () => {
  assert.equal(safeCheckoutUrl('https://app.sandbox.midtrans.com/snap/v2/vtweb/abc'), true);
  for (const url of ['http://app.sandbox.midtrans.com/x', 'https://app.sandbox.midtrans.com.evil.test/x', 'https://app.sandbox.midtrans.com@evil.test/x', 'https://evil.test/', 'javascript:alert(1)', 'https://app.sandbox.midtrans.com:444/x', 'https://user@app.sandbox.midtrans.com/x', 'invalid']) assert.equal(safeCheckoutUrl(url), false, url);
});

test('payment client uses backend contract and encodes order IDs', async () => {
  const calls = [];
  const api = createPaymentClient(async (path, init) => { calls.push([path, init]); return path === '/payments' && !init ? { items: [] } : { order_id: 'x' }; });
  await api.create('client-1'); await api.history(); await api.status('a/b');
  assert.deepEqual(calls, [['/payments', { method: 'POST', body: JSON.stringify({client_id:'client-1'}) }], ['/payments', undefined], ['/payments/a%2Fb', undefined]]);
});


test('ambiguous payment attempt survives restart and is scoped to user', async () => {
  const { createAttemptManager } = await import('../lib/payments.ts');
  const data = new Map();
  const store = { get: async key => data.get(key) ?? null, set: async (key, value) => { data.set(key, value); }, remove: async key => { data.delete(key); } };
  const first = createAttemptManager(store, () => 'uuid-one');
  await assert.rejects(first.create('user-a', undefined, async () => { throw Error('timeout'); }));
  const second = createAttemptManager(store, () => 'uuid-two');
  assert.equal(await second.create('user-a', undefined, async id => id), 'uuid-one');
  assert.equal(await second.create('user-b', undefined, async id => id), 'uuid-two');
});

test('failed durable write blocks payment and another pending attempt cannot overwrite it', async () => {
  const { createAttemptManager } = await import('../lib/payments.ts');
  let called = false;
  const broken = createAttemptManager({ get: async () => null, set: async () => { throw Error('storage'); }, remove: async () => {} }, () => 'one');
  await assert.rejects(broken.create('user', undefined, async () => { called = true; }));
  assert.equal(called, false);
  const manager = createAttemptManager({ get: async () => 'old', set: async () => {}, remove: async () => {} }, () => 'new');
  await assert.rejects(manager.create('user', 'different', async () => { called = true; }));
  assert.equal(called, false);
});

test('payment statuses and errors are localized with safe unknown fallback', async () => {
  const { paymentStatusLabel, paymentErrorMessage } = await import('../lib/payments.ts');
  assert.equal(paymentStatusLabel('pending'), 'Menunggu pembayaran');
  assert.equal(paymentStatusLabel('settlement'), 'Pembayaran berhasil');
  assert.equal(paymentStatusLabel('unknown-secret'), 'Status belum diketahui');
  assert.equal(paymentErrorMessage('PAYMENT_SERVICE_UNAVAILABLE'), 'Layanan pembayaran belum tersedia. Silakan coba lagi.');
  assert.equal(paymentErrorMessage('unknown-secret'), 'Permintaan pembayaran belum berhasil. Silakan coba lagi.');
});

 test('uncertain checkout and historical grants are not presented as active access', async () => {
  const { paymentErrorMessage, paymentStatusLabel, paymentGrantLabel } = await import('../lib/payments.ts');
  assert.match(paymentErrorMessage('PAYMENT_CHECKOUT_UNCERTAIN'), /jangan.*baru/i);
  assert.match(paymentStatusLabel('checkout_uncertain'), /belum pasti/i);
  assert.match(paymentGrantLabel({status: 'refund', granted_until: '2027-01-01'}), /awal/i);
  assert.doesNotMatch(paymentGrantLabel({status: 'refund', granted_until: '2027-01-01'}), /akses diberikan sampai/i);
 });

test('recovery uses the durable attempt ID without creating a payment', async () => {

  const { createAttemptManager } = await import('../lib/payments.ts');

  const data = new Map([['payment_attempt_user-a', 'original-id']]);

  const store = { get: async key => data.get(key) ?? null, set: async (key, value) => data.set(key, value), remove: async key => data.delete(key) };

  const calls = [];

  const api = createPaymentClient(async (path, init) => { calls.push([path, init]); return { order_id: 'order', client_id: 'original-id' }; });

  const manager = createAttemptManager(store, () => 'new-id');

  assert.equal((await manager.recover('user-a', api.recover)).order_id, 'order');

  assert.deepEqual(calls, [['/payments/recover', { method: 'POST', body: JSON.stringify({client_id: 'original-id'}) }]]);

  assert.equal(data.size, 0);

  assert.equal(await manager.recover('user-a', api.recover), null);

});

test('failed recovery preserves the attempt for retry', async () => {

  const { createAttemptManager, paymentErrorMessage } = await import('../lib/payments.ts');

  const data = new Map([['payment_attempt_user-a', 'original-id']]);

  const store = { get: async key => data.get(key) ?? null, set: async (key, value) => data.set(key, value), remove: async key => data.delete(key) };

  const manager = createAttemptManager(store, () => 'new-id');

  await assert.rejects(manager.recover('user-a', async () => { throw Error('network'); }));

  assert.equal(data.get('payment_attempt_user-a'), 'original-id');

  assert.match(paymentErrorMessage('PAYMENT_CHECKOUT_UNRESOLVED'), /riwayat/i);

});
