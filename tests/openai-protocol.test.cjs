const test = require('node:test');
const assert = require('node:assert/strict');
const { buildResponsesPayload, parseResponseEvent, shouldUseScreenAwareness } = require('../dist/main/openaiProtocol.js');

test('builds a subscription-sharing Responses payload', () => {
  const payload = buildResponsesPayload([
    { role: 'system', content: 'Be concise.' },
    { role: 'user', content: 'What is visible?' }
  ], 'model-slug', 'data:image/jpeg;base64,abc');
  assert.equal(payload.store, false);
  assert.equal(payload.stream, true);
  assert.equal(payload.instructions, 'Be concise.');
  assert.deepEqual(payload.input[0].content, [
    { type: 'input_text', text: 'What is visible?' },
    { type: 'input_image', image_url: 'data:image/jpeg;base64,abc', detail: 'auto' }
  ]);
});

test('parses streamed response events', () => {
  assert.deepEqual(parseResponseEvent('{"type":"response.output_text.delta","delta":"Hello"}'), { type: 'delta', text: 'Hello' });
  assert.deepEqual(parseResponseEvent('{"type":"response.completed"}'), { type: 'completed', text: '' });
});

test('recognizes explicit screen-awareness requests', () => {
  assert.equal(shouldUseScreenAwareness('Look at my screen and explain this error'), true);
  assert.equal(shouldUseScreenAwareness('What is my next exam?'), false);
});
