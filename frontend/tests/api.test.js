import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForVerdict } from '../src/api.js';
test('polling awaits Pending and Running, then returns a terminal verdict without overlapping requests', async () => {
  const states = ['Pending', 'Running', 'Accepted'];
  const result = await waitForVerdict('id', {}, { request: async () => ({ verdict: states.shift() }), delay: async () => {} });
  assert.equal(result.verdict, 'Accepted'); assert.equal(states.length, 0);
});
test('network failure, navigation cancellation and polling deadline terminate the wait', async () => {
  await assert.rejects(waitForVerdict('id', {}, { request: async () => { throw new Error('offline'); } }), /offline/);
  await assert.rejects(waitForVerdict('id', { signal: AbortSignal.abort() }));
  await assert.rejects(waitForVerdict('id', {}, { request: async () => ({ verdict: 'Pending' }), delay: async () => {}, attempts: 2 }), /longer than expected/);
});
