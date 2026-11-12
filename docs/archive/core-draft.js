export const DIMENSIONS = { understanding: 'فهم مفهوم', application: 'کاربرد و محاسبه', reasoning: 'استدلال', riskAwareness: 'آگاهی از ریسک' };
export const scoreOf = record => Object.values(record.scores || {}).reduce((sum, n) => sum + n, 0);
export function qualifies(record) {
  return record.status === 'mastered' && Object.keys(DIMENSIONS).every(k => Number.isInteger(record.scores?.[k]) && record.scores[k] >= 15 && record.scores[k] <= 25) && scoreOf(record) >= 80 && Boolean(record.reviewer?.name && record.reviewer?.feedback && record.reviewer?.reviewedAt);
}
export function masteryMap(curriculum, records) {
  const latest = new Map();
  for (const r of [...records].filter(r => r.status !== 'pending').sort((a,b) => a.reviewer.reviewedAt.localeCompare(b.reviewer.reviewedAt))) latest.set(r.lessonId, r);
  const mastered = new Map();
  // Repeat so ordering of the curriculum does not determine prerequisite eligibility.
  for (let pass = 0; pass < curriculum.lessons.length; pass++) {
    for (const lesson of curriculum.lessons) {
      const record = latest.get(lesson.id);
      if (record && qualifies(record) && lesson.prerequisites.every(id => mastered.has(id))) mastered.set(lesson.id, record);
    }
  }
  return mastered;
}
export function validateCurriculum(c) {
  const errors = [];
  if (c?.schemaVersion !== 1 || !Array.isArray(c?.lessons) || !Array.isArray(c?.modules)) return ['ساختار طرح درس نامعتبر است.'];
  const ids = new Set(c.lessons.map(l => l.id)), modules = new Set(c.modules.map(m => m.id));
  if (ids.size !== c.lessons.length) errors.push('شناسه درس تکراری است.');
  const sources = new Set((c.sources || []).map(s => s.id));
  for (const l of c.lessons) {
    if (!modules.has(l.moduleId) || !l.title || !l.body?.length || !l.exercise || l.assessment?.length !== 3) errors.push(`${l.id}: محتوای ناقص`);
    if (!Array.isArray(l.prerequisites) || l.prerequisites.some(id => !ids.has(id) || id === l.id)) errors.push(`${l.id}: پیش‌نیاز نامعتبر`);
    if (!l.quiz?.options?.[l.quiz.answer] || !l.quiz.explanation) errors.push(`${l.id}: آزمون نامعتبر`);
    if (!l.sources?.length || l.sources.some(id => !sources.has(id))) errors.push(`${l.id}: منبع نامعتبر`);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push('چرخه پیش‌نیازها'); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const p of c.lessons.find(l => l.id === id)?.prerequisites || []) visit(p);
    visiting.delete(id); visited.add(id);
  }
  ids.forEach(visit);
  return errors;
}
export function validateEvidence(data, c, { pendingOnly = false } = {}) {
  const errors = [];
  if (data?.schemaVersion !== 1 || !Array.isArray(data.records) || data.records.length > 10000) return ['ساختار فایل شواهد معتبر نیست.'];
  const ids = new Set();
  const text = value => typeof value === 'string' && value.trim().length >= 3 && value.length <= 30000;
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
  for (const r of data.records) {
    if (!r || typeof r !== 'object') { errors.push('رکورد نامعتبر'); continue; }
    const prefix = `${r.id || 'بدون شناسه'}: `;
    if (typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{6,100}$/.test(r.id) || ids.has(r.id)) errors.push(prefix + 'شناسه نامعتبر یا تکراری');
    ids.add(r.id);
    if (!c.lessons.some(l => l.id === r.lessonId)) errors.push(prefix + 'درس ناشناخته');
    if (!text(r.curriculumVersion) || !date(r.createdAt) || Date.parse(r.createdAt) > Date.now() + 300000) errors.push(prefix + 'نسخه یا تاریخ نامعتبر');
    if (!Array.isArray(r.responses) || r.responses.length !== 3 || !r.responses.every(text)) errors.push(prefix + 'سه پاسخ واقعی لازم است');
    if (!['pending','mastered','needs-practice'].includes(r.status) || (pendingOnly && r.status !== 'pending')) errors.push(prefix + 'وضعیت مجاز نیست');
    if (r.status === 'pending' && (r.reviewer !== null || r.scores !== null)) errors.push(prefix + 'پیش‌نویس نباید ارزیابی تأییدشده داشته باشد');
    if (r.status !== 'pending') {
      if (!text(r.reviewer?.name) || !text(r.reviewer?.feedback) || !date(r.reviewer?.reviewedAt) || Date.parse(r.reviewer?.reviewedAt) < Date.parse(r.createdAt) || Date.parse(r.reviewer?.reviewedAt) > Date.now() + 300000) errors.push(prefix + 'ارزیاب، بازخورد یا تاریخ ارزیابی نامعتبر');
      if (!r.scores || Object.keys(r.scores).length !== 4 || !Object.keys(DIMENSIONS).every(k => Number.isInteger(r.scores?.[k]) && r.scores[k] >= 0 && r.scores[k] <= 25)) errors.push(prefix + 'چهار نمره صحیح از صفر تا ۲۵ لازم است');
      if (r.status === 'mastered' && !qualifies(r)) errors.push(prefix + 'حدنصاب تسلط رعایت نشده');
    }
  }
  if (!errors.length && !pendingOnly) {
    const ordered = [...data.records].filter(r => r.status !== 'pending').sort((a,b) => a.reviewer.reviewedAt.localeCompare(b.reviewer.reviewedAt));
    const history = [];
    for (const r of ordered) {
      const lesson = c.lessons.find(l => l.id === r.lessonId);
      const prior = masteryMap(c, history);
      if (r.status === 'mastered' && !lesson.prerequisites.every(id => prior.has(id))) errors.push(`${r.id}: پیش‌نیاز در زمان ارزیابی تأیید نشده است`);
      history.push(r);
    }
  }
  return errors;
}
export function reviewQueue(c, records, now = new Date()) {
  const result = [];
  for (const [id, record] of masteryMap(c, records)) {
    const lesson = c.lessons.find(l => l.id === id);
    const days = Math.floor((now - new Date(record.reviewer.reviewedAt)) / 86400000);
    const due = lesson.reviewDays.filter(day => days >= day);
    if (due.length) result.push({ lesson, days, due: Math.max(...due) });
  }
  return result;
}
export function positionSize({ capital, riskPercent, entry, stop, cost }) {
  const values = [capital, riskPercent, entry, stop, cost];
  if (values.some(n => !Number.isFinite(n)) || capital <= 0 || riskPercent <= 0 || riskPercent > 100 || entry <= 0 || stop <= 0 || entry === stop || cost < 0) throw new Error('مقادیر مثبت، فاصله خروج غیرصفر و درصد بین صفر و صد وارد کنید.');
  const budget = capital * riskPercent / 100;
  const perUnit = Math.abs(entry - stop) + cost;
  return { budget, perUnit, units: Math.floor(budget / perUnit), affordableUnits: Math.floor(capital / (entry + cost)) };
}
export function lessonPrompt(c, lesson) {
  return `عنوان چت: ${lesson.id} | ${lesson.title} — مسیر سرمایه\n\nمن مبتدی مطلق هستم. این جلسه فقط برای درس «${lesson.title}» (${lesson.id}) از دوره فارسی مسیر سرمایه، نسخه ${c.version} است. فارسی و قدم‌به‌قدم آموزش بده؛ اصطلاح انگلیسی را فقط همراه معنی فارسی بیاور.\n\nمنبع طرح درس: https://github.com/arminghm/stock-learning/blob/main/public/data/curriculum.json\nشواهد ثبت‌شده: https://github.com/arminghm/stock-learning/blob/main/public/data/evidence.json\nدستورالعمل جلسه: https://github.com/arminghm/stock-learning/blob/main/docs/LEARNING_PROTOCOL.md\nاگر به فایل‌ها دسترسی نداری، صریح بگو و فایل یا متن آن‌ها را بخواه؛ درباره سابقه یادگیری من حدس نزن.\n\nپیش‌نیاز: ${lesson.prerequisites.join('، ') || 'ندارد'}\nاهداف: ${lesson.outcomes.join(' ')}\nمحتوای پایه:\n${lesson.body.join('\n\n')}\n\nتمرین: ${lesson.exercise}\nنکته ریسک: ${lesson.safety}\n\nابتدا یک سؤال تشخیصی بپرس. هر بار فقط یک مفهوم و یک سؤال مطرح کن و منتظر پاسخ من بمان. پاسخ تمرین را پیش از تلاش من نده. هیچ شواهد، نمره یا تسلطی را جعل نکن. همه اعداد مالی فرضی باشند.\n\nارزیابی مستقل:\n${lesson.assessment.map((q,i) => `${i+1}. ${q}`).join('\n')}\n\nچهار بُعد فهم، کاربرد، استدلال و آگاهی از ریسک را هرکدام از ۲۵ با دلیل ارزیابی کن. تسلط نیازمند حداقل ۸۰ از ۱۰۰، حداقل ۱۵ در هر بُعد و تأیید پیش‌نیازهاست. پاسخ تست به‌تنهایی کافی نیست. اگر پیش‌نیازها معلوم نیستند، وضعیت pending بماند.\n\nدر پایان پاسخ‌های واقعی من، نمره‌های مستدل، ایرادها، تمرین اصلاحی و برنامه مرور ۷ و ۳۰ روزه را در یک گزارش قابل انتقال به چت مرکزی بنویس. برای ساخت JSON از قالب docs/EVIDENCE.md استفاده کن؛ نام ارزیاب باید ارزیابی AI را صریح مشخص کند. ادعای ذخیره در GitHub نکن مگر ابزار واقعاً آن را ثبت کرده باشد. چت مرکزی باید گزارش را بررسی و به مخزن اضافه کند.`;
}
