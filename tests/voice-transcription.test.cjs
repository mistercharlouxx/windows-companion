const test = require('node:test');
const assert = require('node:assert/strict');
const { toWhisperLanguage } = require('../dist/main/voiceTranscription.js');

test('converts Windows locales to Whisper language codes', () => {
  assert.equal(toWhisperLanguage('fr-FR'), 'fr');
  assert.equal(toWhisperLanguage('en_GB'), 'en');
});

test('rejects invalid locale values', () => {
  assert.equal(toWhisperLanguage(''), undefined);
  assert.equal(toWhisperLanguage('english'), undefined);
});
