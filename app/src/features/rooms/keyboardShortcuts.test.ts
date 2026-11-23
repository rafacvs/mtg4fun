import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customizedShortcutCommand, isValidShortcut, readShortcutBindings, shortcutDefaults } from './libraryGesture.ts';

test('personalized shortcuts map regular and shifted keys while rejecting browser modifiers', () => {
  const defaults = { ...shortcutDefaults };
  assert.equal(customizedShortcutCommand({ key: 'g', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent, defaults), 'library');
  assert.equal(customizedShortcutCommand({ key: 'N', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: true } as KeyboardEvent, defaults), 'observe-previous');
  assert.equal(customizedShortcutCommand({ key: 'd', repeat: false, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent, defaults), null);
  assert.equal(customizedShortcutCommand({ key: 'd', repeat: true, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent, defaults), null);
});

test('custom shortcut validation reserves native navigation keys', () => {
  assert.equal(isValidShortcut('Shift+Space'), true);
  assert.equal(isValidShortcut('Shift+N'), true);
  assert.equal(isValidShortcut('Shift+K'), false);
  assert.equal(isValidShortcut('K'), true);
  assert.equal(isValidShortcut('Tab'), false);
  assert.equal(isValidShortcut('Escape'), false);
  assert.equal(isValidShortcut('Enter'), false);
  assert.equal(isValidShortcut('Ctrl+K'), false);
});

test('missing or invalid storage falls back to defaults', () => {
  assert.deepEqual(readShortcutBindings(), shortcutDefaults);
});
