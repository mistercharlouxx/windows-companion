const test = require('node:test');
const assert = require('node:assert/strict');
const { toSendKeys } = require('../dist/main/windowsIntegration.js');

test('converts guarded keyboard chords to Windows SendKeys syntax', () => {
  assert.equal(toSendKeys('ctrl+shift+s'), '^+s');
  assert.equal(toSendKeys('alt+tab'), '%{TAB}');
  assert.equal(toSendKeys('enter'), '{ENTER}');
});

test('rejects unsupported or multi-key automation chords', () => {
  assert.throws(() => toSendKeys('ctrl+launch-missiles'), /Unsupported key/);
  assert.throws(() => toSendKeys('a+b'), /one non-modifier key/);
});
