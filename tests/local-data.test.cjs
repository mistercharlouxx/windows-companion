const test = require('node:test');
const assert = require('node:assert/strict');
const { cosineSimilarity, mergeCompanionData } = require('../dist/main/localData.js');

test('cosine similarity ranks identical vectors above unrelated vectors', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test('migrates older settings with provider and screen defaults', () => {
  const data = mergeCompanionData({ settings: { autonomyMode: 'Confirm' } });
  assert.equal(data.settings.autonomyMode, 'Confirm');
  assert.equal(data.settings.modelProvider, 'auto');
  assert.equal(data.settings.screenAwarenessEnabled, false);
});
