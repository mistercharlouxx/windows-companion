const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCalendarEvent } = require('../dist/main/calendarTime.js');

test('normalizes tomorrow with time-only model output into complete timestamps', () => {
  const event = normalizeCalendarEvent({ title:'Maths study', start:'14:00', end:'16:00' }, 'Add this tomorrow', new Date(2026, 9, 28, 12));
  assert.equal(new Date(event.start).getDate(), 29);
  assert.equal(new Date(event.start).getHours(), 14);
  assert.equal(new Date(event.end).getHours(), 16);
});

test('rejects time-only output without a date hint', () => {
  assert.throws(() => normalizeCalendarEvent({ title:'Study', start:'14:00', end:'16:00' }, '', new Date(2026, 9, 28)), /specific date/);
});
