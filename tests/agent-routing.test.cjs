const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldUseResearchAgent } = require('../dist/main/agentRouting.js');

test('recognizes multi-step price and shopping research', () => {
  assert.equal(shouldUseResearchAgent('Compare supermarket prices and make a 60 euro shopping list for the week'), true);
  assert.equal(shouldUseResearchAgent('Browse different websites and find the cheapest laptop options'), true);
});

test('keeps simple local commands out of research mode', () => {
  assert.equal(shouldUseResearchAgent('Open Notepad'), false);
  assert.equal(shouldUseResearchAgent('Pause my music'), false);
  assert.equal(shouldUseResearchAgent('When is my next exam?'), false);
  assert.equal(shouldUseResearchAgent('Open Notepad and write my shopping list'), false);
});
