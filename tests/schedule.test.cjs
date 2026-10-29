const test = require('node:test');
const assert = require('node:assert/strict');
const { detectConflicts } = require('../dist/main/schedule.js');

test('detects overlapping timed events but ignores adjacent events', () => {
  const conflicts = detectConflicts([
    { title:'A', start:'2026-10-29T10:00:00+01:00', end:'2026-10-29T11:00:00+01:00' },
    { title:'B', start:'2026-10-29T10:30:00+01:00', end:'2026-10-29T11:30:00+01:00' },
    { title:'C', start:'2026-10-29T11:30:00+01:00', end:'2026-10-29T12:00:00+01:00' },
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].second.title, 'B');
});
