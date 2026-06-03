import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntry, summarizeEntries } from '../src/app.js';

test('summarizeEntries counts current-month care categories and vomit mentions', () => {
  const now = new Date('2026-06-03T12:00:00Z');
  const entries = [
    { date: '2026-06-01', category: 'meal', title: 'Breakfast', notes: '' },
    { date: '2026-06-02', category: 'health', title: 'Yellow bile vomit', notes: 'Normal after' },
    { date: '2026-05-31', category: 'walk', title: 'Long walk', notes: '' },
  ];

  assert.deepEqual(summarizeEntries(entries, now), {
    total: 2,
    meals: 1,
    walks: 0,
    health: 1,
    training: 0,
    social: 0,
    vomitMentions: 1,
  });
});

test('createEntry normalizes blank optional fields', () => {
  const entry = createEntry({
    date: '2026-06-03',
    time: '11:35',
    category: 'health',
    title: '  Skipped breakfast  ',
    caregiver: ' ',
    mood: ' ',
    notes: '  Track anxiety trigger  ',
  });

  assert.equal(entry.title, 'Skipped breakfast');
  assert.equal(entry.caregiver, 'Unassigned');
  assert.equal(entry.mood, 'Not logged');
  assert.equal(entry.notes, 'Track anxiety trigger');
});
