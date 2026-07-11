import assert from 'node:assert/strict';
import test from 'node:test';
import { getGuardianConsolePasswordValidationError } from '../src/config/guardian-password-policy';

test('Guardian Console requires 16 characters by default', () => {
  assert.match(
    getGuardianConsolePasswordValidationError('12345678', false) ?? '',
    /at least 16 characters/
  );
  assert.equal(getGuardianConsolePasswordValidationError('1234567890123456', false), null);
});

test('Guardian Console legacy opt-in accepts 8-15 character passwords', () => {
  assert.equal(getGuardianConsolePasswordValidationError('12345678', true), null);
  assert.match(
    getGuardianConsolePasswordValidationError('1234567', true) ?? '',
    /at least 8 characters/
  );
});
