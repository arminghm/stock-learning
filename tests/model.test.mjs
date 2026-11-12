import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, assessmentScores, lessonPrompt, localDay, mergeReports, progress,
  reportTemplate, validateCurriculum, validateLedger, validateReport
} from '../public/lib/model.js';
import { loadData } from '../scripts/files.mjs';

const { course } = await loadData();
const first = course.lessons[0];
const empty = { schemaVersion: 1, records: [] };

const assessment = (lessonId = '00.01', date = '2025-12-29') => {
  const lesson = course.lessons.find(item => item.id === lessonId);
  return {
    schemaVersion: 1,
    id: 'assessment-' + lessonId.replaceAll('.', '-') + '-' + date,
    lessonId, kind: 'assessment', date,
    answers: Object.fromEntries(lesson.quiz.map(item => [item.id, { response: 'استدلال مستقل فرضی در تست خودکار', score: item.points }])),
    artifact: 'جدول کامل فرضی همراه با دلیل، واحد و نتیجه.',
    practiceScores: Object.fromEntries(lesson.practice.rubric.map(item => [item.id, item.points])),
    feedback: 'هر معیار با موفقیت ارزیابی شده است.', nextStep: 'درس بعدی را شروع کن.'
  };
};

const review = (date, score = 85) => ({
  schemaVersion: 1, id: 'review-' + date, lessonId: '00.01', kind: 'review', date, score,
  recall: 'توضیح و مثال جدید با استدلال', feedback: 'بازیابی با استدلال درست انجام شد.', nextStep: 'مرور بعدی'
});

test('49 unique lessons in 13 stages and stable introductory ID', () => {
  assert.equal(course.lessons.length, 49);
  assert.equal(course.modules.length, 13);
  assert.equal(first.id, '00.01');
  assert.deepEqual(course.lessons.find(lesson => lesson.id === 'L01').prerequisites, ['00.01']);
  assert.equal(course.lessons.at(-1).id, 'L48');
  assert.equal(new Set(course.lessons.map(lesson => lesson.practice.task)).size, 49);
  assert.ok(course.lessons.every(lesson => lesson.material.length >= 600 && lesson.sources.length));
  assert.equal(new Set(course.lessons.map(lesson => lessonPrompt(lesson, course).split('\n')[0])).size, 49);
  const broken = structuredClone(course);
  broken.lessons[0].prerequisites = ['L02'];
  assert.throws(() => validateCurriculum(broken), /00\.01/);
});

test('all teaching and review prompts include explicit RTL guidance and never leak answer keys', () => {
  for (const lesson of course.lessons) {
    const prompt = lessonPrompt(lesson, course);
    const reviewPrompt = lessonPrompt(lesson, course, 'review');
    assert.match(prompt, /قوانین اجباری نگارش فارسی/);
    assert.match(prompt, /در اولین پاسخ فقط هدف‌ها/);
    assert.ok(!prompt.includes('کلید برای تصحیح'));
    assert.ok(!prompt.includes(lesson.quiz[0].key));
    assert.match(reviewPrompt, /راست‌به‌چپ/);
    assert.ok(prompt.startsWith('چت'));
  }
  assert.match(lessonPrompt(first, course), /Financial Markets Introduction/);
});

test('intro report template makes a valid ID and preserves lessonId', () => {
  const template = reportTemplate(first, 'assessment', '2025-12-29');
  assert.match(template.id, /^[a-zA-Z0-9_-]{8,80}$/);
  assert.equal(template.lessonId, '00.01');
  assert.throws(() => validateReport(template, course));
});

test('mastery separately requires 80 points for theory and practice and unlocks L01', () => {
  const pass = assessment();
  assert.deepEqual(assessmentScores(pass), { quiz: 100, practice: 100 });
  assert.equal(progress(course, [pass]).get('L01').status, 'ready');
  const failed = structuredClone(pass);
  failed.answers.q1.score = 10;
  assert.equal(progress(course, [failed]).get('00.01').status, 'retry');
  assert.equal(progress(course, [failed]).get('L01').status, 'locked');
  assert.throws(() => progress(course, [failed, assessment('L01')]), /پیش‌نیاز/);
  assert.equal(progress(course, [pass, assessment('L01')]).get('L02').status, 'ready');
});

test('review schedule rolls over months, rejects early reports and resets after remediation', () => {
  const pass = assessment();
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
  const due = progress(course, [pass], '2025-12-30').get('00.01');
  assert.equal(due.due, '2025-12-30');
  assert.equal(due.overdue, true);
  assert.throws(() => progress(course, [pass, review('2025-12-29')]), /سررسید/);
  const good = review('2025-12-31');
  assert.equal(progress(course, [pass, good]).get('00.01').due, '2026-01-03');
  const failed = review('2026-01-03', 70);
  assert.equal(progress(course, [pass, good, failed]).get('00.01').mastered, false);
  const restored = progress(course, [pass, good, failed, assessment('00.01', '2026-01-04')]).get('00.01');
  assert.equal(restored.due, '2026-01-05');
});

test('review dates use Tehran midnight and all five successful reviews clear the queue', () => {
  assert.equal(localDay(new Date('2026-11-12T20:29:59Z')), '2026-11-12');
  assert.equal(localDay(new Date('2026-11-12T20:30:00Z')), '2026-11-13');
  const records = [assessment(), ...['2025-12-30', '2026-01-02', '2026-01-09', '2026-01-23', '2026-02-22'].map(date => review(date))];
  const item = progress(course, records).get('00.01');
  assert.equal(item.reviews, 5);
  assert.equal(item.due, null);
  assert.equal(item.mastered, true);
});

test('incomplete evidence, invalid dates, impossible scores and conflicting IDs are rejected', () => {
  assert.throws(() => validateReport(reportTemplate(first, 'assessment'), course));
  assert.throws(() => validateReport({ ...assessment(), date: '2025-02-30' }, course), /تاریخ/);
  const invalid = assessment();
  invalid.answers.q1.score = 51;
  assert.throws(() => validateReport(invalid, course), /امتیاز/);
  assert.throws(() => validateReport({ ...assessment(), artifact: ' ' }, course), /خروجی/);
  const pass = assessment();
  const ledger = mergeReports(empty, [pass], course);
  assert.deepEqual(mergeReports(ledger, [Object.fromEntries(Object.entries(pass).reverse())], course), ledger);
  assert.throws(() => mergeReports(ledger, [{ ...pass, feedback: 'تغییر نادرست' }], course), /شناسه/);
  assert.throws(() => validateLedger({ ...ledger, records: [pass, pass] }, course), /شناسه/);
});

test('staged evidence must be merged against published prerequisites', () => {
  const published = mergeReports(empty, [assessment()], course);
  const second = [assessment('L01')];
  assert.throws(() => mergeReports(empty, second, course), /پیش‌نیاز/);
  assert.equal(mergeReports(published, second, course).records.length, 2);
});

test('historical tutor report is valid, retains exact scores, and unlocks the next lesson without invented raw answers', async () => {
  const { ledger } = await loadData();
  const report = ledger.records.find(record => record.id === 'intro-20261112-tutor-summary-01');
  assert.ok(report);
  assert.equal(report.kind, 'session_assessment');
  assert.equal(report.source, 'tutor_session_summary');
  assert.deepEqual(assessmentScores(report), { quiz: 95, practice: 90 });
  assert.equal(report.evidence.conceptual.length, 5);
  assert.equal(report.evidence.practical.length, 5);
  assert.equal(report.evidence.conceptual.reduce((sum, item) => sum + item.score, 0), 9.5);
  assert.equal(report.evidence.conceptual.reduce((sum, item) => sum + item.maxScore, 0), 10);
  assert.equal(progress(course, ledger.records, '2026-11-13').get('00.01').due, '2026-11-13');
  assert.equal(progress(course, ledger.records, '2026-11-13').get('L01').status, 'ready');
  assert.equal(validateLedger(ledger, course), ledger);
  assert.equal(Object.hasOwn(report, 'answers'), false);
  const invalid = structuredClone(report);
  invalid.quizScore = 100;
  assert.throws(() => validateReport(invalid, course), /مفهومی/);
  const invalidSource = structuredClone(report);
  invalidSource.source = 'unverified';
  assert.throws(() => validateReport(invalidSource, course), /گزارش پیشین/);
});
