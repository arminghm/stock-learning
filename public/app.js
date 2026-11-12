import {
  assessmentScores, lessonPrompt, mergeReports, progress,
  validateCurriculum, validateLedger, validateReport
} from './lib/model.js';

const repo = 'https://github.com/arminghm/stock-learning';
const storageKey = 'stock-learning:reports:v1';
const main = document.querySelector('#main');
const search = document.querySelector('#search');
const pages = [
  ['dashboard', '▦', 'داشبورد'],
  ['path', '▤', 'مسیر درس‌ها'],
  ['reviews', '◷', 'مرورهای من'],
  ['evidence', '◇', 'دفتر شواهد'],
  ['guide', 'ⓘ', 'راهنمای کار']
];
const statuses = { mastered: 'مسلط', locked: 'پیش‌نیاز دارد', ready: 'آماده شروع', retry: 'نیاز به تمرین' };
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const num = value => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value);
const tag = text => '<bdi class="tag" dir="ltr">' + esc(text) + '</bdi>';
const dateLabel = date => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
const list = items => '<ul>' + items.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>';
const ordered = items => '<ol>' + items.map(item => '<li>' + esc(item) + '</li>').join('') + '</ol>';
const title = (eyebrow, heading, description) =>
  `<header class="page-heading"><span class="eyebrow">${eyebrow}</span><h1>${heading}</h1><p>${description}</p></header>`;
const link = (path, label, style = 'button') => `<a class="${style}" href="#${path}">${label}</a>`;
const badge = status => `<span class="pill ${status}">${statuses[status]}</span>`;
const getRoute = () => location.hash.slice(1).split('/');
const lessonUrl = lesson => 'lesson/' + lesson.id;

let course, published, ledger, state;
let pending = [];
let incoming = null;
let startupNotice = '';
let promptText = '';
let activePage = '';
let filter = 'all';

function message(text) {
  document.querySelector('#toast').textContent = text;
}

function updateState() {
  ledger = mergeReports(published, pending, course);
  state = progress(course, ledger.records);
}

function setPending(reports) {
  localStorage.setItem(storageKey, JSON.stringify(reports));
  pending = reports;
  updateState();
}

function sectionHeader(heading, action = '') {
  return `<div class="section-header"><h2>${heading}</h2>${action}</div>`;
}

function lessonCard(lesson) {
  const item = state.get(lesson.id);
  return `<li class="lesson-row"><span class="lesson-code" dir="ltr">${lesson.id}</span>
    <div class="lesson-name"><a href="#${lessonUrl(lesson)}">${esc(lesson.title)}</a><div class="tags">${lesson.terms.slice(0, 3).map(tag).join('')}</div></div>
    ${badge(item.status)}<a class="arrow" href="#${lessonUrl(lesson)}" aria-label="باز کردن ${esc(lesson.title)}">←</a></li>`;
}

function moduleCard(module, index) {
  const lessons = course.lessons.filter(lesson => lesson.moduleId === module.id);
  const count = lessons.filter(lesson => state.get(lesson.id).mastered).length;
  return `<a class="module-card" href="#path/${module.id}"><span class="module-icon" aria-hidden="true">${['◈', '▥', '≋', '◇'][index % 4]}</span>
    <span class="module-copy"><span class="eyebrow">مرحلهٔ ${num(index + 1)} · ${esc(module.level)}</span><strong>${esc(module.title)}</strong><small>${esc(module.summary)}</small></span>
    <span class="module-count" aria-label="${num(count)} درس مسلط از ${num(lessons.length)}">${num(count)} / ${num(lessons.length)}</span></a>`;
}

function dashboard() {
  const mastered = [...state.values()].filter(item => item.mastered).length;
  const due = [...state.values()].filter(item => item.overdue).length;
  const next = course.lessons.find(lesson => ['ready', 'retry'].includes(state.get(lesson.id).status));
  const percent = mastered / course.lessons.length * 100;
  return `<section class="hero"><div class="hero-copy"><span class="eyebrow"><span class="live-dot"></span> دورهٔ خودآموز · فارسی</span>
    <h1>مسیر یادگیری<br><em>بازارهای مالی</em></h1>
    <p>از پول و قدرت خرید تا طراحی و آزمون سیستم معاملاتی. با تمرکز بر فارکس و طلا، هر روز یک جلسهٔ ۴۵ دقیقه‌ای.</p>
    <div class="actions">${next ? link(lessonUrl(next), 'باز کردن درس بعدی <span aria-hidden="true">←</span>') : link('reviews', 'دیدن مرورها')}${link('path', 'نقشهٔ دوره', 'button secondary')}</div></div>
    <div class="hero-visual" aria-hidden="true"><div class="visual-grid"></div><div class="visual-track"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span dir="ltr">FOREX <b>·</b> XAU/USD</span></div></section>
    <section class="stats" aria-label="نمای کلی پیشرفت">
      <div class="stat"><span class="stat-label">تسلط بر درس‌ها</span><strong>${num(mastered)}<small> از ${num(course.lessons.length)} درس</small></strong><progress value="${mastered}" max="${course.lessons.length}" aria-label="درس‌های دارای تسلط"></progress><small>${num(percent)}٪ از دوره</small></div>
      <div class="stat"><span class="stat-label">مرور سررسیدشده</span><strong>${num(due)}</strong>${link('reviews', 'برنامه مرور ←', 'text-link')}</div>
      <div class="stat"><span class="stat-label">گزارش ثبت‌شده</span><strong>${num(published.records.length)}<small> در GitHub</small></strong><small>${num(pending.length)} در انتظار ثبت</small></div>
    </section>
    <div class="overview-grid">
      <section class="panel">${sectionHeader('قدم بعدی')} ${next ? `<span class="eyebrow"><bdi>${next.id}</bdi> · ${num(course.policy.minutes)} دقیقه</span><h3 class="next-title">${esc(next.title)}</h3><p>${esc(next.objectives[0])} و ${esc(next.objectives[1])}.</p><div class="tags">${next.terms.map(tag).join('')}</div>${link(lessonUrl(next), 'مطالعه و دریافت پرامپت ←', 'text-link')}` : '<p>همهٔ درس‌ها ارزیابی شده‌اند. مرورها را دنبال کن.</p>'}</section>
      <section class="panel">${sectionHeader('روال هر جلسه')}<ol class="agenda">${course.policy.agenda.map(slot => `<li><span>${esc(slot.label)}</span><span>${num(slot.minutes)} دقیقه</span></li>`).join('')}</ol></section>
    </div>
    <section class="path-preview">${sectionHeader('نقشهٔ دوره', link('path', 'همهٔ مرحله‌ها ←', 'text-link'))}<div class="module-grid">${course.modules.slice(0, 4).map(moduleCard).join('')}</div></section>`;
}

function normalize(value) {
  return value.toLowerCase().replaceAll('ي', 'ی').replaceAll('ك', 'ک').replace(/[\s\u200c]+/g, ' ').trim();
}

function pathPage(moduleId) {
  const query = normalize(search.value);
  const modules = course.modules.filter(module => !moduleId || module.id === moduleId);
  const visible = lesson => {
    const module = course.modules.find(item => item.id === lesson.moduleId);
    const text = normalize([lesson.id, lesson.title, module.title, ...lesson.terms, lesson.material].join(' '));
    return text.includes(query) && (filter === 'all' || state.get(lesson.id).status === filter);
  };
  return title('مسیر دوره', 'درس‌ها و مرحله‌ها', 'هر درس با اهداف، مثال حل‌شده، آزمون و تمرین عملی همراه است.') +
    `<div class="toolbar"><label for="status-filter">وضعیت</label><select id="status-filter"><option value="all">همه</option>
      ${Object.entries(statuses).map(([key, label]) => `<option value="${key}" ${filter === key ? 'selected' : ''}>${label}</option>`).join('')}</select>
      ${moduleId ? link('path', 'همهٔ مرحله‌ها', 'text-link') : ''}<span role="status">${num(course.lessons.filter(lesson => visible(lesson) && (!moduleId || lesson.moduleId === moduleId)).length)} درس</span></div>` +
    (modules.map(module => {
      const lessons = course.lessons.filter(lesson => lesson.moduleId === module.id && visible(lesson));
      if (!lessons.length) return '';
      return `<section class="panel module-panel"><span class="eyebrow">${module.id} · ${esc(module.level)}</span><h2>${esc(module.title)}</h2><p>${esc(module.summary)}</p><ul class="lessons">${lessons.map(lessonCard).join('')}</ul></section>`;
    }).join('') || '<p class="empty">در این فیلتر درسی پیدا نشد.</p>');
}

function lessonPage(id, kind) {
  const lesson = course.lessons.find(item => item.id === id);
  if (!lesson) return title('درس', 'درس پیدا نشد', '') + link('path', 'بازگشت به مسیر');
  const item = state.get(id);
  const module = course.modules.find(entry => entry.id === lesson.moduleId);
  const review = kind === 'review';
  promptText = lessonPrompt(lesson, course, review ? 'review' : 'assessment');
  const scores = item.assessment ? assessmentScores(item.assessment) : null;
  return `${link(review ? 'reviews' : 'path/' + module.id, '→ بازگشت', 'text-link back')}
    ${title(`<bdi>${id}</bdi> · ${esc(module.title)} · ${num(course.policy.minutes)} دقیقه`, (review ? 'مرور · ' : '') + esc(lesson.title), '')}
    <div class="lesson-meta">${badge(item.status)}${lesson.terms.map(tag).join('')}</div>
    <div class="lesson-layout"><article>
    ${review ? `<section class="panel content-panel"><h2>تمرین بازیابی</h2><p>${esc(lesson.reviewPrompt)}</p><p>مرور بعدی ${item.due ? dateLabel(item.due) : 'در برنامه نیست'}.</p></section>` : `
      <section class="panel content-panel"><h2>هدف‌های یادگیری</h2>${list(lesson.objectives)}
      <h3>پیش‌نیاز</h3><p>${lesson.prerequisites.length ? lesson.prerequisites.map(key => link('lesson/' + key, key, 'text-link')).join('، ') : 'از صفر شروع کن.'}</p>
      ${!item.ready && !item.mastered ? '<p class="notice">می‌توانی درس را بخوانی. ثبت ارزیابی پس از احراز پیش‌نیازها ممکن است.</p>' : ''}</section>
      <section class="panel content-panel"><h2>متن درس</h2><div class="lesson-reading" dir="rtl">${esc(lesson.material)}</div><div class="worked"><h3>مثال حل‌شده</h3><p>${esc(lesson.example)}</p></div>
      ${lesson.sources.length ? '<h3>مطالعهٔ تکمیلی</h3><ul>' + lesson.sources.map(source => `<li>منبع: <a class="text-link" href="${esc(source.url)}" dir="auto" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('') + '</ul>' : ''}</section>
      <section class="panel content-panel"><h2>تمرین عملی</h2><p>${esc(lesson.practice.task)}</p>
      <details><summary>معیارهای تصحیح</summary>${list(lesson.practice.rubric.map(entry => num(entry.points) + ' امتیاز · ' + entry.label))}</details></section>
      <section class="panel content-panel"><h2>آزمون مفهومی</h2>${ordered(lesson.quiz.map(question => question.question + ' (' + num(question.points) + ' امتیاز)'))}
      <details><summary>پاسخ‌نامه پس از تلاش</summary>${ordered(lesson.quiz.map(question => question.key))}</details></section>`}
    <section class="panel content-panel"><h2>پرامپت چت مستقل</h2><p>عنوان چت در ابتدای پرامپت قرار دارد و قوانین RTL درون آن گنجانده شده‌اند. پس از انجام تمرین، گزارش JSON را به دفتر شواهد بیاور؛ چت به‌صورت خودکار با GitHub همگام نمی‌شود.</p>
      <button class="button" data-action="copy">کپی پرامپت</button>
      <details id="prompt-details"><summary>نمایش متن برای کپی دستی</summary><textarea readonly aria-label="پرامپت چت" rows="12">${esc(promptText)}</textarea></details>
    </section></article>
    <aside class="lesson-aside"><section class="panel content-panel"><h2>ارزیابی و مرور</h2>
      <p>حد نصاب ${num(course.policy.mastery)} از ۱۰۰ در هر دو بخش، با پاسخ و تمرین قابل بازبینی.</p>
      ${scores ? `<p>آخرین آزمون ${num(scores.quiz)} از ۱۰۰<br>آخرین تمرین ${num(scores.practice)} از ۱۰۰</p><p>${esc(item.latest.feedback)}</p><p>گام بعدی · ${esc(item.latest.nextStep)}</p>` : '<p class="muted">هنوز گزارشی برای این درس وجود ندارد.</p>'}
      <p>مرورها با فاصلهٔ ${course.policy.reviewIntervals.map(num).join('، ')} روز از آخرین ارزیابی موفق برنامه‌ریزی می‌شوند.</p>
      ${link('evidence', 'وارد کردن گزارش ←', 'text-link')}</section></aside></div>`;
}

function reviewsPage() {
  const queue = course.lessons.filter(lesson => state.get(lesson.id).due)
    .sort((a, b) => state.get(a.id).due.localeCompare(state.get(b.id).due));
  const retry = course.lessons.filter(lesson => state.get(lesson.id).latest?.kind === 'review' && !state.get(lesson.id).mastered);
  return title('یادآوری و تمرین', 'مرورهای من', 'بازیابی را بدون نگاه به پاسخ انجام بده. پس از موفقیت، فاصلهٔ مرور بعدی بیشتر می‌شود.') +
    (queue.length ? `<ul class="review-list">${queue.map(lesson => {
      const item = state.get(lesson.id);
      return `<li class="panel review-item"><div><span class="eyebrow"><bdi>${lesson.id}</bdi> · ${item.overdue ? 'سررسید شده' : 'در راه'}</span><h2>${esc(lesson.title)}</h2>
        <p>${dateLabel(item.due)} · مرور ${num(item.reviews + 1)} از ${num(course.policy.reviewIntervals.length)}</p></div>
        ${link(lessonUrl(lesson) + '/review', item.overdue ? 'شروع مرور ←' : 'دیدن تمرین', 'button secondary')}</li>`;
    }).join('')}</ul>` : '<p class="empty">هنوز مرور زمان‌بندی‌شده‌ای نداری. با نخستین ارزیابی موفق، برنامهٔ مرور ساخته می‌شود.</p>') +
    (retry.length ? `<section class="panel content-panel"><h2>ارزیابی اصلاحی پس از مرور</h2><ul class="lessons">${retry.map(lessonCard).join('')}</ul></section>` : '');
}

function reportCard(report, staged) {
  const lesson = course.lessons.find(item => item.id === report.lessonId);
  const session = report.kind === 'session_assessment';
  const scores = report.kind !== 'review' ? assessmentScores(report) : null;
  const heading = session ? 'ارزیابی ثبت‌شده از چت پیشین' : report.kind === 'review' ? 'مرور' : 'ارزیابی';
  let details = '';
  if (session) {
    const ev = report.evidence;
    details = '<p>این گزارش از ارزیابی مربی جلسه پیشین نقل شده است. متن کامل پاسخ‌های خام در دسترس نبوده و خلاصه‌ها به‌جای پاسخ خام معرفی نمی‌شوند.</p>'
      + '<h3>موضوعات پوشش‌داده‌شده</h3>' + list(ev.topics)
      + '<h3>شواهد مفهومی</h3><ol>' + ev.conceptual.map(item => '<li>' + esc(item.topic) + ' · ' + num(item.score) + ' از ' + num(item.maxScore) + '<p class="verbatim" dir="auto">' + esc(item.summary) + '</p></li>').join('') + '</ol>'
      + '<h3>شواهد عملی</h3><ol>' + ev.practical.map(item => '<li>' + esc(item.topic) + '<p class="verbatim" dir="auto">' + esc(item.summary) + '</p></li>').join('') + '</ol>'
      + '<h3>نقاط نیازمند مرور</h3>' + list(ev.needsReview)
      + '<h3>جمع‌بندی گزارش</h3><p class="verbatim" dir="auto">' + esc(ev.summary) + '</p>';
  } else if (report.kind === 'assessment') {
    details = '<h3>پاسخ‌ها</h3><ol>' + lesson.quiz.map(item => '<li>' + esc(item.question) + ' (' + num(report.answers[item.id].score) + ' از ' + num(item.points) + ')<p class="verbatim" dir="auto">' + esc(report.answers[item.id].response) + '</p></li>').join('') + '</ol>'
      + '<h3>خروجی تمرین</h3><p class="verbatim" dir="auto">' + esc(report.artifact) + '</p>'
      + list(lesson.practice.rubric.map(item => item.label + ' · ' + num(report.practiceScores[item.id]) + ' از ' + num(item.points)));
  } else {
    details = '<p>امتیاز مرور ' + num(report.score) + ' از ۱۰۰</p><p class="verbatim" dir="auto">' + esc(report.recall) + '</p>';
  }
  return `<details class="panel report-card"><summary><bdi class="lesson-code">${lesson.id}</bdi> ${esc(lesson.title)} · ${heading} · ${dateLabel(report.date)}
    <span class="pill ${staged ? 'retry' : 'mastered'}">${staged ? 'روی این مرورگر' : 'ثبت در مخزن'}</span></summary>
    ${scores ? `<p>آزمون ${num(scores.quiz)} از ۱۰۰ · تمرین ${num(scores.practice)} از ۱۰۰</p>` : ''}
    ${details}
    <h3>بازخورد</h3><p class="verbatim" dir="auto">${esc(report.feedback)}</p>
    <h3>گام بعد</h3><p class="verbatim" dir="auto">${esc(report.nextStep)}</p></details>`;
}
function evidencePage() {
  const pendingIds = new Set(pending.map(report => report.id));
  return title('پاسخ، خروجی و بازخورد', 'دفتر شواهد', 'گزارش را از چت درس به این صفحه بیاور و پس از بررسی، نسخهٔ عمومی را در مخزن ثبت کن.') +
    `<div class="overview-grid evidence-grid"><section class="panel content-panel"><h2>۱. بررسی گزارش چت</h2>
      <label for="report-json">متن گزارش JSON</label><textarea id="report-json" dir="ltr" rows="8" spellcheck="false" placeholder='{ "schemaVersion": 1, ... }'></textarea>
      <div class="actions"><button class="button secondary" data-action="preview">بررسی گزارش</button></div>
      <div id="import-status" role="status"></div><div id="import-preview"></div></section>
    <section class="panel content-panel"><h2>۲. انتقال به GitHub</h2>
      <p>${num(pending.length)} گزارش روی این مرورگر در انتظار ثبت. ${num(published.records.length)} گزارش در نسخهٔ منتشرشدهٔ دفتر.</p>
      <p>فقط تمرین‌ها و داده‌های فرضی را منتشر کن. شناسهٔ حساب، اطلاعات مالی یا هویتی و لینک خصوصی را حذف کن.</p>
      <div class="actions"><button class="button secondary" data-action="download" ${pending.length ? '' : 'disabled'}>دریافت گزارش‌های آماده</button></div>
      <p>فایل دریافتی را به چت برنامه‌ریزی بده تا با آخرین نسخهٔ مخزن ادغام شود، یا دستور ثبت را از راهنما اجرا کن. ثبت روی GitHub پس از کامیت و انتشار در داشبورد دیده می‌شود.</p>
      ${link('guide', 'راهنمای ثبت ←', 'text-link')}</section></div>
    <section class="history">${sectionHeader('تاریخچهٔ شواهد')}${ledger.records.length
      ? [...ledger.records].sort((a, b) => a.date.localeCompare(b.date)).reverse().map(report => reportCard(report, pendingIds.has(report.id))).join('')
      : '<p class="empty">تاریخچه خالی است. گزارش نخست پس از حل تمرین و آزمون ایجاد می‌شود.</p>'}</section>`;
}

function guidePage() {
  return title('روش کار', 'راهنمای یادگیری و ثبت گزارش', 'از همین داشبورد درس بعدی را انتخاب کن و نتیجهٔ هر جلسه را به مسیر یادگیری برگردان.') +
    `<section class="panel content-panel guide"><h2>از چت برنامه‌ریزی تا چت درس</h2>
      ${ordered(['چت برنامه‌ریزی دوره را برای مرور پیشرفت، تغییر مسیر و ثبت شواهد نگه دار.',
        'پرامپت درس را از صفحه درس بردار و در یک چت تازه با شناسه و عنوان درس وارد کن.',
        'مثال را بررسی کن، تمرین را خودت حل کن و به آزمون جواب بده. از مربی بخواه گزارش JSON را طبق پرامپت تکمیل کند.',
        'JSON را در دفتر شواهد بچسبان، پیش‌نمایش را بخوان و ذخیره کن. پیشرفت محلی همان لحظه به‌روز می‌شود.',
        'گزارش‌های آماده را دانلود کن و برای ادغام در مخزن به چت برنامه‌ریزی برگردان. انتشار GitHub Pages دفتر عمومی را به‌روز می‌کند.'])}
      <p>انتقال گزارش دستی است. داشبورد به محتوای چت‌ها دسترسی ندارد.</p>
      <h2>ثبت مستقیم در مخزن</h2><p>با آخرین نسخهٔ شاخهٔ اصلی کار کن، فایل دریافتی را خارج از پوشهٔ عمومی نگه دار و از ریشهٔ مخزن اجرا کن.</p>
      <pre dir="ltr"><code>npm run evidence:import -- /path/to/reports.local.json
npm run validate
npm test
git add public/data/evidence.json
git commit -m "Record learning evidence"
git push</code></pre>
      <p>در یک مخزن عمومی، گزارش‌های کامیت‌شده در تاریخچهٔ Git هم عمومی‌اند. قبل از کامیت متن، خروجی و بازخورد را بررسی کن.</p>
      <h2>قواعد تسلط و مرور</h2><p>آزمون و تمرین هر کدام ۱۰۰ امتیاز دارند. حد نصاب مستقل هر بخش ${num(course.policy.mastery)} است. مرور با یک پاسخ مفهومی و یک مثال تازه از ۱۰۰ ارزیابی می‌شود. امتیاز کمتر از حد نصاب در مرور، ارزیابی اصلاحی درس را فعال می‌کند.</p>
      <p>اولین مرور روز بعد است. فاصله‌های بعدی ${course.policy.reviewIntervals.slice(1).map(num).join('، ')} روز پس از هر مرور موفق‌اند. برای مرورهای عقب‌افتاده از تاریخ انجام استفاده می‌شود.</p>
      <p>زمان دورهٔ اصلی ${num(course.lessons.length * course.policy.minutes / 60)} ساعت است. مرورها و تکرارهای دمو جلسه‌های جداگانه دارند.</p>
      <a class="text-link" href="${repo}/blob/main/docs/learning.md">راهنمای مخزن ↗</a></section>`;
}

function render(focus = false) {
  const [route, detail, kind] = getRoute();
  activePage = route === 'lesson' ? 'lesson' : pages.some(([id]) => route === id) ? route : 'dashboard';
  const current = activePage === 'lesson' ? (kind === 'review' ? 'reviews' : 'path') : activePage;
  document.querySelector('#navigation').innerHTML = pages.map(([id, icon, label]) =>
    `<a href="#${id}" ${current === id ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}</a>`).join('');
  const name = pages.find(([id]) => id === current)[2];
  document.querySelector('#page-name').textContent = name;
  document.title = name + ' | مسیر سرمایه';
  const views = { dashboard, path: () => pathPage(detail), lesson: () => lessonPage(detail, kind),
    reviews: reviewsPage, evidence: evidencePage, guide: guidePage };
  main.innerHTML = (startupNotice ? '<p class="notice" role="status">' + esc(startupNotice) + '</p>' : '') + views[activePage]();
  incoming = null;
  if (focus) {
    main.focus();
    window.scrollTo(0, 0);
  }
}

function parseInput(value) {
  const text = value.trim().replace(/^```(?:json)?\s*\n/i, '').replace(/\n```$/, '');
  const parsed = JSON.parse(text);
  if (parsed?.schemaVersion === 1 && Array.isArray(parsed.records) && Object.keys(parsed).length === 2) {
    return parsed.records.map(report => validateReport(report, course));
  }
  return [validateReport(parsed, course)];
}

function importStatus(text) {
  document.querySelector('#import-status').textContent = text;
}

main.addEventListener('click', async event => {
  const action = event.target.closest('button[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'copy') {
    try {
      await navigator.clipboard.writeText(promptText);
      message('پرامپت کپی شد.');
    } catch {
      document.querySelector('#prompt-details').open = true;
      const field = document.querySelector('#prompt-details textarea');
      field.focus();
      field.select();
      message('متن انتخاب شد. آن را دستی کپی کن.');
    }
  }
  if (action === 'preview') {
    const preview = document.querySelector('#import-preview');
    preview.innerHTML = '';
    incoming = null;
    try {
      const value = document.querySelector('#report-json').value;
      const reports = parseInput(value);
      if (!reports.length) throw new Error('این فایل گزارشی ندارد.');
      mergeReports(ledger, reports, course);
      incoming = reports;
      importStatus('گزارش معتبر است. متن و امتیازها را پیش از ذخیره بررسی کن.');
      preview.innerHTML = reports.map(report => reportCard(report, true)).join('') +
        '<label class="consent"><input id="privacy-check" type="checkbox"> برای ثبت عمومی، محتوای گزارش را بررسی کرده‌ام.</label>' +
        '<button class="button" data-action="stage">ذخیره در این مرورگر</button>';
    } catch (error) {
      importStatus(error instanceof SyntaxError ? 'متن JSON معتبر نیست. گزارش کامل را از چت کپی کن.' : error.message);
    }
  }
  if (action === 'stage' && incoming) {
    if (!document.querySelector('#privacy-check').checked) {
      importStatus('ابتدا بررسی محتوای گزارش را تأیید کن.');
      return;
    }
    try {
      const merged = mergeReports(ledger, incoming, course);
      const publishedIds = new Set(published.records.map(report => report.id));
      setPending(merged.records.filter(report => !publishedIds.has(report.id)));
      render(true);
      message('گزارش روی این مرورگر ذخیره شد. برای ثبت در مخزن، فایل را دریافت کن.');
    } catch (error) {
      importStatus('ذخیره نشد: ' + error.message);
    }
  }
  if (action === 'download') {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, records: pending }, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'reports.local.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

main.addEventListener('change', event => {
  if (event.target.id !== 'status-filter') return;
  filter = event.target.value;
  render();
  document.querySelector('#status-filter').focus();
});
main.addEventListener('input', event => {
  if (event.target.id !== 'report-json' || !incoming) return;
  incoming = null;
  document.querySelector('#import-preview').innerHTML = '';
  importStatus('متن تغییر کرد. دوباره بررسی کن.');
});

search.addEventListener('input', () => {
  if (!course || !state) return;
  if (location.hash !== '#path') location.hash = 'path';
  else render();
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey
    && !event.target.closest('input,textarea,select,[contenteditable]')) {
    event.preventDefault();
    search.focus();
  }
});
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView();
});
window.addEventListener('hashchange', () => {
  if (state) render(document.activeElement !== search);
});

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error('بارگذاری داده ناموفق بود (' + response.status + ').');
  return response.json();
}

try {
  const [data, records] = await Promise.all([loadJson('./data/curriculum.json'), loadJson('./data/evidence.json')]);
  course = validateCurriculum(data);
  published = validateLedger(records, course);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    const publishedIds = new Set(published.records.map(report => report.id));
    pending = saved.filter(report => !publishedIds.has(report.id));
    updateState();
  } catch {
    pending = [];
    startupNotice = 'گزارش‌های محلی قابل بازیابی نبودند. نسخهٔ GitHub نمایش داده می‌شود.';
    updateState();
  }
  render();
} catch (error) {
  main.innerHTML = `<p class="notice" role="alert">${esc(error.message)} صفحه را تازه‌سازی کن یا <a href="${repo}">مخزن را باز کن</a>.</p>`;
}
