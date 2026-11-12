import { readFile } from 'node:fs/promises';
import { validateCurriculum, validateLedger } from '../public/lib/model.js';

export const publicDir = new URL('../public/', import.meta.url);
export const evidencePath = new URL('data/evidence.json', publicDir);
export const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

export async function loadData() {
  const course = validateCurriculum(await readJson(new URL('data/curriculum.json', publicDir)));
  return { course, ledger: validateLedger(await readJson(evidencePath), course) };
}
