const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGeminiPayload, extractGeminiText, normalizeGeminiModel } = require('../dist/main/geminiProtocol.js');

test('builds Gemini chat payload with system instructions and an inline screenshot', () => {
  const payload = buildGeminiPayload([
    { role: 'system', content: 'Be concise.' },
    { role: 'user', content: 'What is visible?' }
  ], 'data:image/png;base64,abc');
  assert.equal(payload.system_instruction.parts[0].text, 'Be concise.');
  assert.deepEqual(payload.contents[0], {
    role: 'user',
    parts: [{ text: 'What is visible?' }, { inline_data: { mime_type: 'image/png', data: 'abc' } }]
  });
});

test('normalizes unsupported Gemini models and extracts text', () => {
  assert.equal(normalizeGeminiModel('made-up-model'), 'gemini-3.8-flash');
  assert.equal(extractGeminiText({ candidates: [{ content: { parts: [{ text: 'Hello' }, { text: ' world' }] } }] }), 'Hello world');
});
