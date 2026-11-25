const assert = require('node:assert/strict');
const fs = require('node:fs');
const screen = fs.readFileSync('app/payments.tsx', 'utf8');
assert.match(screen, /safeCheckoutUrl/);
assert.match(screen, /openBrowserAsync/);
assert.match(screen, /api\.status/);
assert.match(screen, /refreshProfile/);
assert.match(screen, /Rp25\.000/);
assert.match(screen, /30 hari/);
assert.match(screen, /tidak diperpanjang otomatis/i);
assert.doesNotMatch(screen, /setUser\s*\(/);
console.log('payment screen safety checks passed');

assert.match(screen, /jangan.*(?:rekening|bank).*dompet/i);
assert.match(screen, /paymentStatusLabel\(item.status\)/);
assert.match(screen, /paymentErrorMessage/);
assert.match(screen, /createAttemptManager/);
assert.match(screen, /history[\s\S]*refreshProfile/);

assert.match(screen, /hasUncertainCheckout/);
assert.match(screen, /disabled=\{busy \|\| !loaded \|\| hasUncertainCheckout\}/);

assert.match(screen, /attempts\.recover\(user\.id, api\.recover\)/);

assert.match(screen, /Pulihkan transaksi/);

assert.match(screen, /PAYMENT_CHECKOUT_UNRESOLVED/);
