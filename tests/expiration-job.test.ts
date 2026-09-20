import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sleep } from '../src/lib/async';
import { startExpirationJob } from '../src/lib/jobs/expiration';
import './helpers/fakes';

describe('startExpirationJob', () => {
  it('roda de imediato e depois repetidamente, sem sobreposição', async () => {
    let runs = 0;
    let running = 0;
    let overlapped = false;
    const job = startExpirationJob({
      intervalMs: 10,
      run: async () => { running++; if (running > 1) overlapped = true; runs++; await sleep(15); running--; },
    });
    await sleep(120);
    job.stop();
    assert.ok(runs >= 3, `esperava >= 3 execuções, houve ${runs}`);
    assert.equal(overlapped, false);
  });

  it('continua agendando mesmo se uma execução lançar erro', async () => {
    let runs = 0;
    const job = startExpirationJob({ intervalMs: 5, run: async () => { runs++; throw new Error('banco fora'); } });
    await sleep(60);
    job.stop();
    assert.ok(runs >= 3);
  });

  it('stop() interrompe novas execuções', async () => {
    let runs = 0;
    const job = startExpirationJob({ intervalMs: 5, run: async () => { runs++; } });
    await sleep(30);
    job.stop();
    const after = runs;
    await sleep(40);
    assert.equal(runs, after);
  });
});
