import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, assessmentScores, lessonPrompt, mergeReports, progress,
  reportTemplate, validateCurriculum, validateLedger, validateReport
} from '../public/lib/model.js';
import { loadData } from '../scripts/files.mjs';

const { course } = await loadData();
const first = course.lessons[0];
const empty = { schemaVersion: 1, records: [] };
const assessment = (lessonId = 'L01', date = '2025-12-29') => ({
  schemaVersion: 1, id: lessonId + '-' + date, lessonId, kind: 'assessment', date,
  answers: { q1: { response: 'مقدار کالای قابل خرید', score: 50 }, q2: { response: '۰٫۸ سبد', score: 30 } },
  artifact: 'هزینه ۱۰۰ → ۱۲۰؛ قدرت خرید ۵/۶ سبد.',
  practiceScores: { result: 50, method: 20, artifact: 10 },
  feedback: 'کاهش درصدی را هم بنویس.', nextStep: 'با یک سبد تازه تمرین کن.'
});
const review = (date, score = 85) => ({
  schemaVersion: 1, id: 'review-' + date, lessonId: 'L01', kind: 'review', date, score,
  recall: 'محاسبه با مثال تازه', feedback: 'واحد را درست نوشتی.', nextStep: 'بازیابی مجدد'
});

test('48 unique lessons in 12 stages, with distinct prompts and valid lesson order', () => {
  assert.equal(course.lessons.length, 48);
  assert.equal(course.modules.length, 12);
  assert.equal(new Set(course.lessons.map(lesson => lesson.practice.task)).size, 48);
  assert.equal(new Set(course.lessons.map(lesson => lessonPrompt(lesson, course).split('\n')[0])).size, 48);
  const broken = structuredClone(course);
  broken.lessons[0].prerequisites = ['L02'];
  assert.throws(() => validateCurriculum(broken), /L01/);
});

test('mastery requires both sections to meet 80 and unlocks the next lesson', () => {
  const attempt = assessment();
  assert.deepEqual(assessmentScores(attempt), { quiz: 80, practice: 80 });
  assert.equal(progress(course, [attempt]).get('L02').status, 'ready');
  attempt.practiceScores.artifact--;
  const state = progress(course, [attempt]);
  assert.equal(state.get('L01').status, 'retry');
  assert.equal(state.get('L02').status, 'locked');
  assert.throws(() => progress(course, [attempt, assessment('L02')]), /پیش‌نیاز/);
});

test('review schedule rolls over months, rejects early reports, and resets after remediation', () => {
  const pass = assessment();
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
  const due = progress(course, [pass], '2025-12-30').get('L01');
  assert.equal(due.due, '2025-12-30');
  assert.equal(due.overdue, true);
  assert.throws(() => progress(course, [pass, review('2025-12-29')]), /سررسید/);
  const good = review('2025-12-31');
  assert.equal(progress(course, [pass, good]).get('L01').due, '2026-01-03');
  const failed = review('2026-01-03', 70);
  assert.equal(progress(course, [pass, good, failed]).get('L01').mastered, false);
  const restored = progress(course, [pass, good, failed, assessment('L01', '2026-01-04')]).get('L01');
  assert.equal(restored.due, '2026-01-05');
  assert.equal(restored.reviews, 0);
});

test('five successful reviews clear the queue', () => {
  const records = [assessment(), ...['2025-12-30', '2026-01-02', '2026-01-09', '2026-01-23', '2026-02-22'].map(date => review(date))];
  const item = progress(course, records).get('L01');
  assert.equal(item.reviews, 5);
  assert.equal(item.due, null);
  assert.equal(item.mastered, true);
});

test('incomplete templates, impossible dates and invalid scores cannot be saved', () => {
  assert.throws(() => validateReport(reportTemplate(first, 'assessment'), course));
  assert.throws(() => validateReport({ ...assessment(), date: '2025-02-30' }, course), /تاریخ/);
  const invalid = assessment();
  invalid.answers.q1.score = 51;
  assert.throws(() => validateReport(invalid, course), /امتیاز/);
  assert.throws(() => validateReport({ ...assessment(), artifact: ' ' }, course), /خروجی/);
});

test('duplicate imports are idempotent and conflicting IDs preserve the original', () => {
  const report = assessment();
  const ledger = mergeReports(empty, [report], course);
  const reordered = Object.fromEntries(Object.entries(report).reverse());
  assert.deepEqual(mergeReports(ledger, [reordered], course), ledger);
  assert.throws(() => mergeReports(ledger, [{ ...report, feedback: 'تغییر' }], course), /شناسه/);
  assert.throws(() => validateLedger({ ...ledger, records: [report, report] }, course), /شناسه/);
  assert.equal(ledger.records.length, 1);
});

test('an exported subset is applied against published prerequisites', () => {
  const published = mergeReports(empty, [assessment()], course);
  const staged = [assessment('L02')];
  assert.throws(() => mergeReports(empty, staged, course), /پیش‌نیاز/);
  assert.equal(mergeReports(published, staged, course).records.length, 2);
});
