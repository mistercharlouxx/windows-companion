const test = require('node:test');
const assert = require('node:assert/strict');
const { runResearchAgent } = require('../dist/main/researchAgent.js');

test('research agent iterates through browser evidence and returns cited synthesis', async () => {
  const commands = [
    { action: 'search_web', query: 'weekly groceries prices', status: 'Searching stores' },
    { action: 'open_url', url: 'https://store.example/rice', status: 'Checking rice' },
    { action: 'finish', status: 'Done', answer: 'Rice is €2. Sources: https://store.example/rice' }
  ];
  const askModel = async () => ({ text: JSON.stringify(commands.shift()), model: 'test-model' });
  const browser = {
    search: async () => ({ title: 'Search', url: 'https://search.example', text: 'Rice result', links: [{ title: 'Rice', url: 'https://store.example/rice' }] }),
    open: async url => ({ title: 'Rice', url, text: 'Rice 1kg €2', links: [] }),
    read: async () => { throw new Error('not expected'); }
  };
  const progress = [];
  const result = await runResearchAgent('Build a grocery list', askModel, browser, (status, step) => progress.push({ status, step }));
  assert.equal(result.text, 'Rice is €2. Sources: https://store.example/rice');
  assert.deepEqual(result.sources, ['https://search.example', 'https://store.example/rice']);
  assert.equal(result.steps, 3);
  assert.equal(progress.length, 3);
});
