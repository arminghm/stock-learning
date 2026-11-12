import { rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mergeReports } from '../public/lib/model.js';
import { evidencePath, loadData, readJson } from './files.mjs';

async function run() {
  const [path, ...extra] = process.argv.slice(2);
  if (!path || extra.length) throw new Error('Usage: npm run evidence:import -- /path/to/report.json');
  const input = await readJson(path);
  const incoming = input?.schemaVersion === 1 && Array.isArray(input.records) && Object.keys(input).length === 2
    ? input.records : [input];
  if (!incoming.length) throw new Error('No reports to import.');
  const { course, ledger } = await loadData();
  const merged = mergeReports(ledger, incoming, course);
  const count = merged.records.length - ledger.records.length;
  if (count > 0) {
    const temporary = new URL('.evidence-' + randomUUID() + '.tmp', evidencePath);
    try {
      await writeFile(temporary, JSON.stringify(merged, null, 2) + '\n', { flag: 'wx' });
      await rename(temporary, evidencePath);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  console.log(`Added ${count} report(s). Review public/data/evidence.json before committing.`);
}

try { await run(); }
catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
