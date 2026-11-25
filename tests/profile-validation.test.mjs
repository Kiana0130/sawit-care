import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validatePasswordChange, validateProfile } from '../lib/profile-validation.ts';

test('normalizes a valid profile before saving', () => {
  assert.deepEqual(validateProfile('  Budi Sawit  ', '  BUDI@example.com '), {
    value: { name: 'Budi Sawit', email: 'budi@example.com' }, error: null,
  });
});

test('rejects invalid names and email addresses', () => {
  assert.ok(validateProfile(' ', 'budi@example.com').error);
  assert.ok(validateProfile('A', 'budi@example.com').error);
  assert.ok(validateProfile('A'.repeat(101), 'budi@example.com').error);
  assert.ok(validateProfile('Budi', 'invalid-email').error);
});

test('validates password changes without trimming secrets', () => {
  assert.ok(validatePasswordChange('', 'longpassword123', 'longpassword123'));
  assert.ok(validatePasswordChange('current', 'short', 'short'));
  assert.ok(validatePasswordChange('current', 'x'.repeat(129), 'x'.repeat(129)));
  assert.ok(validatePasswordChange('current', 'longpassword123', 'different'));
  assert.equal(validatePasswordChange('current', ' longpass123 ', ' longpass123 '), null);
});

test('rejects reusing the current password', () => {
  assert.ok(validatePasswordChange('same-password-123', 'same-password-123', 'same-password-123'));
});
