const test = require('node:test');
const assert = require('node:assert/strict');
const { rankImportantEmails, scoreImportantEmail } = require('../dist/main/emailPriority.js');

const email = (overrides = {}) => ({ id: '1', subject: 'Hello', from: 'person@example.com', snippet: '', labelIds: [], date: '', ...overrides });

test('prioritizes Gmail importance and explicit action language', () => {
  const important = email({ subject: 'Action required: assignment due tomorrow', labelIds: ['IMPORTANT', 'UNREAD'] });
  const newsletter = email({ id: '2', subject: 'Weekly newsletter discount', from: 'no-reply@example.com', labelIds: ['UNREAD'] });
  assert.ok(scoreImportantEmail(important) > scoreImportantEmail(newsletter));
});

test('ranks starred and urgent messages first', () => {
  const ranked = rankImportantEmails([email({ id: 'low', subject: 'Newsletter' }), email({ id: 'high', subject: 'Urgent meeting today', labelIds: ['STARRED'] })]);
  assert.equal(ranked[0].id, 'high');
});
