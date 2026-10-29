const test = require('node:test');
const assert = require('node:assert/strict');
const { routeContextualWindowsIntent, routeDeterministicWindowsIntent } = require('../dist/main/toolRouting.js');

test('routes a compound open-and-type command to Windows automation', () => {
  assert.deepEqual(routeDeterministicWindowsIntent('Open Notepad and type a shopping list'), {
    tool: 'windows_automation',
    args: { steps: [
      { action: 'launch', target: 'Notepad' },
      { action: 'type_text', text: 'a shopping list', application: 'Notepad' }
    ] },
    description: 'Open Notepad and type text'
  });
});

test('routes direct playback commands without asking the model', () => {
  assert.equal(routeDeterministicWindowsIntent('pause my music').args.steps[0].command, 'play_pause');
  assert.equal(routeDeterministicWindowsIntent('skip to the next song').args.steps[0].command, 'next');
});

test('does not claim questions or filesystem paths', () => {
  assert.equal(routeDeterministicWindowsIntent('What is Notepad?'), null);
  assert.equal(routeDeterministicWindowsIntent('Open C:\\Users\\charl\\notes.txt'), null);
  assert.equal(routeDeterministicWindowsIntent('Open Notepad and write my shopping list'), null);
});

test('resolves a Notepad follow-up from the previous assistant answer', () => {
  const previousAnswer = 'Shopping list\n- Apples — €3\n- Bread — €1.50';
  assert.deepEqual(routeContextualWindowsIntent([
    { role: 'user', content: 'Create a weekly shopping list for 60 euros' },
    { role: 'assistant', content: previousAnswer },
    { role: 'user', content: 'put them in my notepad' }
  ]), {
    tool: 'windows_automation',
    args: { steps: [
      { action: 'launch', target: 'Notepad' },
      { action: 'type_text', text: previousAnswer, application: 'Notepad' }
    ] },
    description: 'Open Notepad and paste the previous answer'
  });
});

test('does not invent content for an unresolved Notepad pronoun', () => {
  assert.equal(routeContextualWindowsIntent([{ role: 'user', content: 'put them in my notepad' }]), null);
});
