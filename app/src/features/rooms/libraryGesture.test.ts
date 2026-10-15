import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryGesture, shortcutCommand } from './libraryGesture.ts';

test('double click draws once, cancels single click and guards rapid repeats', async () => {
  let opened = 0, drawn = 0;
  const gesture = createLibraryGesture(() => opened++, () => drawn++, 10);
  gesture.click(1); gesture.click(2); gesture.doubleClick(1000);
  gesture.click(3); gesture.click(4); gesture.doubleClick(1050);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(drawn, 1); assert.equal(opened, 0);
  gesture.doubleClick(1500); assert.equal(drawn, 2);
  gesture.cancel();
});
test('single click and keyboard activation open without drawing', async () => {
  let opened = 0, drawn = 0;
  const gesture = createLibraryGesture(() => opened++, () => drawn++, 10);
  gesture.click(1);
  await new Promise(resolve => setTimeout(resolve, 30));
  gesture.click(0);
  assert.equal(opened, 2); assert.equal(drawn, 0);
  gesture.cancel();
});
test('shortcuts ignore typing, modifiers and held keys', () => {
  const event = { key: 'D', repeat: false, ctrlKey: false, metaKey: false, altKey: false };
  assert.equal(shortcutCommand(event, false), 'draw');
  assert.equal(shortcutCommand(event, true), null);
  assert.equal(shortcutCommand({ ...event, repeat: true }, false), null);
  assert.equal(shortcutCommand({ ...event, ctrlKey: true }, false), null);
});
