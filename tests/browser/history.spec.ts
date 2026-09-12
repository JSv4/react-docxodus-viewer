import { expect, test } from '@playwright/test';

test('history retries an uncertain checkpoint and preserves archives and timelines', async ({ page }) => {
  await page.goto('/api-test.html');
  await page.waitForFunction(() => !!window.rdv);
  const result = await page.evaluate(async () => {
    const api = window.rdv;
    const controller = new api.DocxSessionController();
    const session = await controller.open('blank', {}, '/wasm/');
    const anchor = Object.keys(session.project().anchorIndex)[0];
    session.replaceText(anchor, 'Checkpoint one.');
    const store = api.createMemoryHistoryStorage();
    let uncertain = true;
    const client = api.openDocxHistory({ ...store, advanceHead: async (...args) => {
      const result = await store.advanceHead(...args);
      if (uncertain) { uncertain = false; throw new Error('Simulated acknowledgement lost after commit'); }
      return result;
    } });
    const history = client.document('test-history');
    const journal = api.createMemoryCheckpointJournal();
    let checkpoints = await api.HistoryCheckpoints.open(history, journal);
    let failed = false;
    try { await checkpoints.save(controller.save(), { author: 'Test', createdAt: '2026-09-11T12:00:00Z', label: 'One' }); }
    catch { failed = true; }
    const pending = checkpoints.pendingRequest?.id;
    checkpoints = await api.HistoryCheckpoints.open(history, journal);
    const reopenedPending = checkpoints.pendingRequest?.id;
    const first = await checkpoints.retry();
    session.replaceText(anchor, 'Checkpoint two.');
    const second = await checkpoints.save(controller.save(), { author: 'Test', createdAt: '2026-09-11T13:00:00Z', label: 'Two' });
    const versions = await history.listVersions(null, 1);
    const older = await history.listVersions(versions.next, 1);
    const time = await history.resolveSequenceAtTime('2026-09-11T12:30:00Z');
    const materialized = await history.materialize(first.state.sequence);
    const replayed = await history.replay(first.state.sequence);
    const compared = await history.compareVersions(first.version.id, second.version.id);
    const changes = await history.readChangesSince(first.head);
    const operations = await history.readOperationsSince(null);
    const restored = await checkpoints.restore(first.version.id, { author: 'Test', createdAt: '2026-09-11T14:00:00Z', label: 'Restored' });
    const archiveBytes = await history.exportHistoryArchive();
    const archive = await api.openDocxHistoryArchive(archiveBytes);
    const archived = await archive.read();
    const importer = api.openDocxHistory(api.createMemoryHistoryStorage());
    const imported = await importer.importHistoryArchive(archiveBytes);
    const again = await importer.importHistoryArchive(archiveBytes);
    const output = { failed, pending, reopenedPending, cleared: checkpoints.pendingRequest === null, firstSequence: first.state.sequence, time,
      currentLabel: archived?.version.record.metadata.label, restoredSequence: restored.state.sequence,
      versions: versions.versions.length + older.versions.length, materialized: materialized.length, replayed: replayed.length, compared: compared.length,
      changeCount: changes.entries.length, operations: Array.isArray(operations.operations), imported: imported.archive.documentId, duplicate: again.alreadyPresent };
    archive.close(); importer.close(); client.close(); controller.close();
    return output;
  });
  expect(result.failed).toBe(true);
  expect(result.pending).toBeTruthy();
  expect(result.reopenedPending).toBe(result.pending);
  expect(result.cleared).toBe(true);
  expect(result.versions).toBe(2);
  expect(result.time).toBe(result.firstSequence);
  expect(result.currentLabel).toBe('Restored');
  expect(result.materialized && result.replayed && result.compared).toBeGreaterThan(0);
  expect(result.changeCount).toBeGreaterThan(0);
  expect(result.operations).toBe(true);
  expect(result.imported).toBe('test-history');
  expect(result.duplicate).toBe(true);
});
