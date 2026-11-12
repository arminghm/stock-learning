import { loadData } from './files.mjs';

const { course, ledger } = await loadData();
console.log(`Validated ${course.modules.length} modules, ${course.lessons.length} lessons, ${ledger.records.length} evidence records.`);
