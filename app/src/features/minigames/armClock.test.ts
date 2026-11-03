import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArmClock } from './armClock.ts';

test('clock estimates server time and the arrival position using a monotonic round trip', () => {
  let monotonic = 100;
  const clock = new ArmClock(() => monotonic);
  assert.equal(clock.now(), null);
  clock.begin('probe');
  monotonic = 340;
  clock.observe('probe', 10_000);
  assert.equal(clock.now(), 10_120);
  assert.equal(clock.inputTime(), 10_240);
  monotonic = 840;
  assert.equal(clock.now(), 10_620);
  assert.equal(clock.inputTime(), 10_740);
});

test('clock rejects unrelated and cancelled replies, and resets on reconnect', () => {
  let monotonic = 0;
  const clock = new ArmClock(() => monotonic);
  clock.observe('unknown', 10_000);
  assert.equal(clock.now(), null);
  clock.begin('cancelled');
  clock.cancel('cancelled');
  monotonic = 100;
  clock.observe('cancelled', 10_000);
  assert.equal(clock.now(), null);
  clock.begin('valid');
  monotonic = 120;
  clock.observe('valid', 10_000);
  assert.equal(clock.now(), 10_010);
  clock.reset();
  assert.equal(clock.now(), null);
  assert.equal(clock.inputTime(), null);
});

test('clock avoids a delayed sample shifting the pointer but refreshes an old route', () => {
  let monotonic = 0;
  const clock = new ArmClock(() => monotonic);
  clock.begin('quick'); monotonic = 20; clock.observe('quick', 1000);
  monotonic = 100; clock.begin('slow'); monotonic = 1000; clock.observe('slow', 5000);
  assert.equal(clock.now(), 1990);
  monotonic = 11_000; clock.begin('new-route'); monotonic = 11_100; clock.observe('new-route', 12_000);
  assert.equal(clock.now(), 12_050);
  assert.equal(clock.inputTime(), 12_100);
});
