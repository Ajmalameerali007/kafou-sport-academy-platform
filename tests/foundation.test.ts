import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuth } from '../lib/kafou/validation';
test('email-only login rejects mobile as an authentication identity', () => {
  assert.ok(validateAuth('login', {identifier:'+971501234567',password:'Secret123456'}).identifier);
});
