const assert = require('node:assert/strict');
const test = require('node:test');
const examples = require('../data/communityContentExamples');

test('provides ten published examples and four private drafts for every resident content type', () => {
  for (const type of ['recycle', 'event', 'tip', 'blog']) {
    const typedExamples = examples.filter(example => example.type === type);
    assert.equal(typedExamples.filter(example => example.status === 'published').length, 10, `${type} published`);
    assert.equal(typedExamples.filter(example => example.status === 'draft').length, 4, `${type} drafts`);
    assert.equal(new Set(typedExamples.map(example => example.title)).size, 14, `${type} unique titles`);
  }
  assert.equal(examples.length, 56);
});

test('marks every published demo event as fictional and gives it valid event details', () => {
  const events = examples.filter(example => example.type === 'event' && example.status === 'published');
  assert.equal(events.length, 10);
  for (const event of events) {
    assert.match(event.title, /^DEMO ONLY/);
    assert.match(event.body, /DEMO ONLY/);
    assert.match(event.location, /^DEMO ONLY/);
    assert.ok(new Date(event.eventEndAt) >= new Date(event.eventStartAt));
  }
});
