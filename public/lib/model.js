const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const reportId = /^[a-zA-Z0-9_-]{8,80}$/;
const nonempty = (value, max = 12000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function localDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran'
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return [part('year'), part('month'), part('day')].join('-');
}

export function addDays(date, days) {
  const day = new Date(date + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export function validateCurriculum(course) {
  assert(course?.schemaVersion === 1, 'نسخه ساختار دوره معتبر نیست.');
  const { policy, modules, lessons } = course;
  assert(policy?.minutes === 45 && Array.isArray(policy.agenda)
    && policy.agenda.every(slot => Number.isInteger(slot.minutes) && slot.minutes > 0 && nonempty(slot.label))
    && policy.agenda.reduce((sum, slot) => sum + slot.minutes, 0) === 45
    && Number.isInteger(policy.mastery) && policy.mastery > 0 && policy.mastery <= 100
    && Array.isArray(policy.reviewIntervals) && policy.reviewIntervals.length
    && policy.reviewIntervals.every((days, index, all) => Number.isInteger(days) && days > (all[index - 1] ?? 0)),
  'سیاست زمان، تسلط یا مرور نامعتبر است.');
  assert(Array.isArray(modules) && modules.length && Array.isArray(lessons) && lessons.length, 'فهرست دوره خالی است.');
  const modulesById = new Set();
  for (const module of modules) {
    assert(/^M\d{2}$/.test(module.id) && !modulesById.has(module.id)
      && [module.title, module.level, module.summary].every(value => nonempty(value)), 'مرحله نامعتبر یا تکراری است.');
    modulesById.add(module.id);
  }
  const previous = new Set();
  for (const lesson of lessons) {
    const validItems = items => Array.isArray(items) && items.length > 0
      && new Set(items.map(item => item.id)).size === items.length
      && items.every(item => /^[a-z][a-z0-9]*$/.test(item.id) && Number.isInteger(item.points) && item.points > 0)
      && items.reduce((sum, item) => sum + item.points, 0) === 100;
    assert(/^(?:L\d{2}|\d{2}\.\d{2})$/.test(lesson.id) && !previous.has(lesson.id) && modulesById.has(lesson.moduleId)
      && [lesson.title, lesson.material, lesson.example, lesson.practice?.task, lesson.reviewPrompt].every(value => nonempty(value)) && lesson.material.length >= 600
      && [lesson.terms, lesson.objectives].every(values => Array.isArray(values) && values.length > 0 && values.every(value => nonempty(value)))
      && Array.isArray(lesson.prerequisites) && new Set(lesson.prerequisites).size === lesson.prerequisites.length
      && lesson.prerequisites.every(id => previous.has(id))
      && validItems(lesson.quiz) && lesson.quiz.every(item => nonempty(item.question) && nonempty(item.key))
      && validItems(lesson.practice.rubric) && lesson.practice.rubric.every(item => nonempty(item.label))
      && Array.isArray(lesson.sources) && lesson.sources.length && lesson.sources.every(source => nonempty(source.title) && /^https:\/\//.test(source.url)),
    'ساختار درس معتبر نیست: ' + lesson.id);
    previous.add(lesson.id);
  }
  assert(modules.every(module => lessons.some(lesson => lesson.moduleId === module.id)), 'مرحلهٔ بدون درس.');
  return course;
}

function exactKeys(object, keys) {
  return object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === keys.length
    && keys.every(key => Object.hasOwn(object, key));
}

export function validateReport(report, course) {
  const lesson = course.lessons.find(item => item.id === report?.lessonId);
  const assessment = report?.kind === 'assessment';
  const fields = ['schemaVersion', 'id', 'lessonId', 'kind', 'date', 'feedback', 'nextStep'];
  const extra = assessment ? ['answers', 'artifact', 'practiceScores'] : ['recall', 'score'];
  assert(exactKeys(report, [...fields, ...extra]) && report.schemaVersion === 1 && typeof report.id === 'string'
    && reportId.test(report.id) && lesson && (assessment || report.kind === 'review'), 'نوع، شناسه یا ساختار گزارش معتبر نیست.');
  assert(typeof report.date === 'string' && isoDate.test(report.date)
    && Number.isFinite(Date.parse(report.date)) && addDays(report.date, 0) === report.date
    && report.date <= localDay(), 'تاریخ باید میلادی، معتبر و حداکثر امروز باشد (YYYY-MM-DD).');
  assert(nonempty(report.feedback, 3000) && nonempty(report.nextStep, 2000), 'بازخورد و گام بعدی را وارد کن.');
  const validScore = (score, max) => Number.isInteger(score) && score >= 0 && score <= max;
  if (assessment) {
    assert(exactKeys(report.answers, lesson.quiz.map(item => item.id))
      && lesson.quiz.every(item => {
        const answer = report.answers[item.id];
        return exactKeys(answer, ['response', 'score']) && nonempty(answer.response, 4000) && validScore(answer.score, item.points);
      }), 'برای هر سؤال پاسخ واقعی و امتیاز در محدوده همان سؤال لازم است.');
    assert(nonempty(report.artifact) && exactKeys(report.practiceScores, lesson.practice.rubric.map(item => item.id))
      && lesson.practice.rubric.every(item => validScore(report.practiceScores[item.id], item.points)),
    'خروجی تمرین و امتیاز همه معیارهای عملی لازم است.');
  } else {
    assert(nonempty(report.recall) && validScore(report.score, 100), 'پاسخ مرور و امتیاز ۰ تا ۱۰۰ لازم است.');
  }
  return report;
}

export function assessmentScores(report) {
  return {
    quiz: Object.values(report.answers).reduce((sum, answer) => sum + answer.score, 0),
    practice: Object.values(report.practiceScores).reduce((sum, score) => sum + score, 0)
  };
}

function initialState() {
  return { mastered: false, attempts: 0, due: null, reviews: 0, latest: null, assessment: null };
}

export function progress(course, records, today = localDay()) {
  const { mastery, reviewIntervals } = course.policy;
  const state = new Map(course.lessons.map(lesson => [lesson.id, initialState()]));
  const lessons = new Map(course.lessons.map(lesson => [lesson.id, lesson]));
  const ids = new Set();
  // Stable ordering preserves entry order for multiple reports on the same day.
  const ordered = [...records].sort((a, b) => a.date.localeCompare(b.date));
  for (const report of ordered) {
    validateReport(report, course);
    assert(!ids.has(report.id), 'شناسه گزارش تکراری است: ' + report.id);
    ids.add(report.id);
    const current = state.get(report.lessonId);
    const lesson = lessons.get(report.lessonId);
    if (report.kind === 'assessment') {
      assert(lesson.prerequisites.every(id => state.get(id).mastered), 'پیش‌نیاز این گزارش در تاریخ ثبت احراز نشده است: ' + report.lessonId);
      const scores = assessmentScores(report);
      current.mastered = scores.quiz >= mastery && scores.practice >= mastery;
      current.attempts++;
      current.assessment = report;
      current.reviews = 0;
      current.due = current.mastered ? addDays(report.date, reviewIntervals[0]) : null;
    } else {
      assert(current.mastered && current.due, 'ابتدا باید درس را با موفقیت بگذرانی و مرور باقی مانده باشد: ' + report.lessonId);
      assert(report.date >= current.due, 'تاریخ مرور پیش از سررسید است: ' + current.due);
      current.mastered = report.score >= mastery;
      if (current.mastered) current.reviews++;
      current.due = current.mastered && current.reviews < reviewIntervals.length
        ? addDays(report.date, reviewIntervals[current.reviews]) : null;
    }
    current.latest = report;
  }

  for (const lesson of course.lessons) {
    const current = state.get(lesson.id);
    current.ready = lesson.prerequisites.every(id => state.get(id).mastered);
    current.status = current.mastered ? 'mastered' : !current.ready ? 'locked' : current.attempts ? 'retry' : 'ready';
    current.overdue = current.due !== null && current.due <= today;
  }
  return state;
}

export function validateLedger(ledger, course) {
  assert(exactKeys(ledger, ['schemaVersion', 'records']) && ledger.schemaVersion === 1 && Array.isArray(ledger.records),
    'ساختار دفتر شواهد باید شامل schemaVersion و records باشد.');
  for (const report of ledger.records) validateReport(report, course);
  progress(course, ledger.records);
  return ledger;
}

function canonical(value) {
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function mergeReports(ledger, incoming, course) {
  const records = [...ledger.records];
  for (const report of incoming) {
    validateReport(report, course);
    const existing = records.find(item => item.id === report.id);
    if (existing) {
      // Report IDs are immutable. Identical reports can be imported again.
      assert(canonical(existing) === canonical(report), 'این شناسه قبلاً با محتوای متفاوت ثبت شده است: ' + report.id);
    } else records.push(report);
  }
  return validateLedger({ schemaVersion: 1, records }, course);
}

export function reportTemplate(lesson, kind, date = localDay()) {
  const id = lesson.id.toLowerCase().replaceAll('.', '-') + '-' + kind + '-' + globalThis.crypto.randomUUID();
  const base = { schemaVersion: 1, id, lessonId: lesson.id, kind, date, feedback: '', nextStep: '' };
  if (kind === 'review') return { ...base, recall: '', score: null };
  return { ...base,
    answers: Object.fromEntries(lesson.quiz.map(item => [item.id, { response: '', score: null }])),
    artifact: '', practiceScores: Object.fromEntries(lesson.practice.rubric.map(item => [item.id, null]))
  };
}

const rtlRules = [
  'قوانین اجباری نگارش فارسی و نمایش راست‌به‌چپ:',
  'هر عنوان، جمله، پاراگراف و بند فهرست را با یک واژه فارسی آغاز کن؛ اصطلاحات انگلیسی را داخل جمله و ترجیحاً داخل پرانتز بیاور.',
  'اگر ناچار هستی یک بخش را با عبارت انگلیسی شروع کنی، آن عبارت را در سطر مستقل بنویس و پس از یک خط خالی، توضیح فارسی را از سطر جدید آغاز کن.',
  'از جدول‌های فارسی و انگلیسی با خوانایی ضعیف استفاده نکن. شناسه‌ها، کد، فرمول و خروجی JSON را در بلوک‌های مستقل با جهت چپ‌به‌راست قرار بده.',
  'این قواعد را حتی وقتی چت جداگانه به Project Instructions دسترسی ندارد رعایت کن.'
].join('\n');

export function lessonPrompt(lesson, course, kind = 'assessment') {
  const template = JSON.stringify(reportTemplate(lesson, kind), null, 2);
  const privacy = 'فقط پاسخ‌های واقعی یادگیرنده و داده‌های فرضی آموزشی را ثبت کن. اطلاعات هویتی، موجودی واقعی، شماره حساب، تصویر حساب و کلید دسترسی را وارد دفتر عمومی نکن. هیچ پاسخ یا تمرینی را جعل نکن. تاریخ میلادی روز واقعی جلسه را بپرس یا تأیید کن.';
  const title = lesson.id === '00.01'
    ? 'چت آموزشی: Trading Learning — 00.01 — Financial Markets Introduction'
    : 'چت درس ' + lesson.id + ' | ' + lesson.title;
  const common = [
    title,
    rtlRules,
    'تدریس را تعاملی پیش ببر؛ در اولین پاسخ فقط هدف‌ها، اولین مفهوم و یک پرسش بررسی فهم را مطرح کن. برای ادامه هر مفهوم صبر کن تا من پاسخ بدهم.',
    'برنامه جلسه ۴۵ دقیقه است: ' + course.policy.agenda.map(slot => slot.minutes + ' دقیقه ' + slot.label).join('، ') + '.',
    privacy
  ];
  if (kind === 'review') return [
    ...common,
    'این جلسه مرور فعال است؛ ابتدا پرسش بازیابی را مطرح کن و تا پاسخ من منتظر بمان. استدلال و انتقال به یک مثال تازه را هرکدام از ۵۰ ارزیابی کن.',
    'پرسش مرور: ' + lesson.reviewPrompt,
    'پس از پاسخ واقعی من، امتیاز از ۱۰۰، ضعف و گام بعدی را با دلیل ثبت کن. اگر زیر ' + course.policy.mastery + ' است ارزیابی اصلاحی بده.',
    'گزارش تکمیل‌شده را فقط به‌صورت JSON معتبر در یک بلوک کد بده. مقدارهای خالی را تا دریافت شواهد واقعی نگه دار:\n' + template
  ].join('\n\n');
  return [
    ...common,
    'پیش‌نیاز: ' + (lesson.prerequisites.join('، ') || 'هیچ') + '. هدف‌ها: ' + lesson.objectives.join('؛ ') + '.',
    'محتوای آموزشی برای توضیح مرحله‌ای: ' + lesson.material,
    'مثال حل‌شده برای نمایش پس از توضیح مفهوم: ' + lesson.example,
    'تمرین عملی: ' + lesson.practice.task,
    'معیارهای ارزیابی: ' + lesson.practice.rubric.map(item => item.points + ' امتیاز برای ' + item.label).join('؛ '),
    'پرسش‌های آزمون را فقط پس از اتمام تدریس و تمرین، یکی‌یکی بپرس و برای هر پاسخ منتظر بمان:\n' + lesson.quiz.map(item => 'پرسش ' + item.id + ' (' + item.points + ' امتیاز): ' + item.question).join('\n'),
    'پیش از پاسخ من هیچ کلید تصحیح یا راه‌حل نهایی را ارائه نکن. پس از دریافت پاسخ‌ها، توضیح بده کدام بخش استدلال درست و کدام ناقص بوده است. آزمون مفهومی و تمرین عملی باید هرکدام مستقل حداقل ' + course.policy.mastery + ' از ۱۰۰ امتیاز بگیرند.',
    'پس از دریافت همه پاسخ‌ها و تمرین، گزارش JSON را با پاسخ‌ها و امتیازهای واقعی تکمیل کن. اگر داده کافی نیست، گزارش موفقیت نساز؛ درخواست تکمیل شواهد بده. این گزارش به‌صورت خودکار با GitHub همگام نمی‌شود.',
    'الگوی گزارش (پس از دریافت شواهد با داده واقعی تکمیل کن):\n' + template
  ].join('\n\n');
}
