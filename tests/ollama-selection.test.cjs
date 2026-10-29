const test = require('node:test');
const assert = require('node:assert/strict');
const { selectChatModel } = require('../dist/main/ollama.js');

test('skips embedding-only models when choosing the default chat model', () => {
  const selected = selectChatModel([
    { name: 'nomic-embed-text:latest', capabilities: ['embedding'] },
    { name: 'qwen2.5:7b', capabilities: ['completion', 'tools'] },
  ]);
  assert.equal(selected, 'qwen2.5:7b');
});

test('honors an installed chat-capable preferred model', () => {
  const selected = selectChatModel([
    { name: 'qwen2.5:7b', capabilities: ['completion'] },
    { name: 'gemma4:latest', capabilities: ['completion'] },
  ], 'gemma4:latest');
  assert.equal(selected, 'gemma4:latest');
});

test('rejects an embedding-only preferred model with a useful error', () => {
  assert.throws(() => selectChatModel([
    { name: 'nomic-embed-text:latest', capabilities: ['embedding'] },
  ], 'nomic-embed-text:latest'), /does not support chat/);
});
