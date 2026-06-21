// patch-core.js
// Универсальная (умная) версия: распаковывает текущий app.asar, внедряет словарь ru-RU.json, 
// правит локализацию и запаковывает обратно. Работает с любыми обновлениями ZCode.

const path = require('path');
const fs = require('fs');
const os = require('os');
const asar = require('@electron/asar');

// Виртуализацию ASAR будем отключать только локально в функциях!

function candidateRoots() {
  const env = process.env;
  const roots = [];
  const local = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const programs = path.join(local, 'Programs');
  const pf = env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  for (const base of [programs, pf, pf86, local]) {
    roots.push(path.join(base, 'ZCode'));
  }
  return roots;
}

function isZcodeRoot(dir) {
  const prev = process.noAsar;
  process.noAsar = true;
  try {
    return fs.existsSync(path.join(dir, 'resources', 'app.asar'));
  } catch {
    return false;
  } finally {
    process.noAsar = prev;
  }
}

function detectZcodeDir() {
  for (const root of candidateRoots()) {
    if (isZcodeRoot(root)) return root;
  }
  return null;
}

function resolveZcodeRoot(input) {
  if (!input) return null;
  let p = String(input).trim().replace(/^"+|"+$/g, '');
  if (!p) return null;
  p = path.normalize(p);

  if (/app\.asar$/i.test(p)) {
    const root = path.dirname(path.dirname(p));
    if (isZcodeRoot(root)) return root;
  }
  if (path.basename(p).toLowerCase() === 'resources' && isZcodeRoot(path.dirname(p))) {
    return path.dirname(p);
  }
  if (isZcodeRoot(p)) return p;
  return p;
}

function checkZcode(input) {
  const prev = process.noAsar;
  process.noAsar = true;
  try {
    const root = resolveZcodeRoot(input);
    const asarPath = root ? path.join(root, 'resources', 'app.asar') : null;
    const backupPath = asarPath ? asarPath + '.ru-backup' : null;
    return {
      root,
      path: asarPath,
      backupPath,
      exists: asarPath ? fs.existsSync(asarPath) : false,
      hasBackup: backupPath ? fs.existsSync(backupPath) : false,
    };
  } finally {
    process.noAsar = prev;
  }
}

// ============================================================
// Таблица захардкоженных английских строк → русский
// Каждая запись: [regex, замена]
// Регэкспы не имеют флага g — используются в .replace(regex, func)
// чтобы контролировать количество замен.
// ============================================================
const HARDCODED_PATCHES = [
  // --- Селектор языка ---
  [/`Simplified Chinese`/g, '`Русский`'],
  [/"Simplified Chinese"/g, '"Русский"'],
  [/`Chinese \(Simplified\)`/g, '`Русский`'],
  [/"Chinese \(Simplified\)"/g, '"Русский"'],
  [/`Китайский \(упрощённый\)`/g, '`Русский`'],
  [/"Китайский \(упрощённый\)"/g, '"Русский"'],
  [/`Китайский \(упрощенный\)`/g, '`Русский`'],
  [/"Китайский \(упрощенный\)"/g, '"Русский"'],
  [/`中文简体`/g, '`Русский`'],
  [/"中文简体"/g, '"Русский"'],

  // --- Модальное окно «Simplified Chinese» ---
  [/`简体中文`/g, '`Русский`'],
  [/"简体中文"/g, '"Русский"'],

  // --- Масштаб интерфейса: короткая подпись, чтобы кнопка не ломалась ---
  [/"settings\.zoomLevel\.option\.default"\s*:\s*"По умолчанию"/g, '"settings.zoomLevel.option.default":"Средний"'],
  [/"settings\.zoomLevel\.option\.default"\s*:\s*`По умолчанию`/g, '"settings.zoomLevel.option.default":`Средний`'],
  [/"Default"/g, '"Средний"'],
  [/`Default`/g, '`Средний`'],

  // --- Coding Plan промо, иногда приходит жёстко на китайском ---
  [/"限时 150% 配额活动"/g, '"Временно: +150% квоты"'],
  [/`限时 150% 配额活动`/g, '`Временно: +150% квоты`'],
  [/"升级 Coding Plan，可在活动期内获得 150% 配额"/g, '"Обновите Coding Plan и получите 150% квоты на время акции"'],
  [/`升级 Coding Plan，可在活动期内获得 150% 配额`/g, '`Обновите Coding Plan и получите 150% квоты на время акции`'],
  [/"升级 Coding Plan, 可在活动期内获得 150% 配额"/g, '"Обновите Coding Plan и получите 150% квоты на время акции"'],
  [/`升级 Coding Plan, 可在活动期内获得 150% 配额`/g, '`Обновите Coding Plan и получите 150% квоты на время акции`'],
  [/"150% 配额"/g, '"150% квоты"'],
  [/`150% 配额`/g, '`150% квоты`'],
  [/"3x higher Claude Pro usage limits"/g, '"В 3 раза выше лимиты использования Claude Pro"'],
  [/`3x higher Claude Pro usage limits`/g, '`В 3 раза выше лимиты использования Claude Pro`'],
  [/"Everything in Lite, plus 5x Lite usage"/g, '"Всё из Lite плюс в 5 раз больше лимитов Lite"'],
  [/`Everything in Lite, plus 5x Lite usage`/g, '`Всё из Lite плюс в 5 раз больше лимитов Lite`'],
  [/"Everything in Pro, plus 20x Lite usage"/g, '"Всё из Pro плюс в 20 раз больше лимитов Lite"'],
  [/`Everything in Pro, plus 20x Lite usage`/g, '`Всё из Pro плюс в 20 раз больше лимитов Lite`'],
  [/"查看 150% 配额活动说明"/g, '"Подробнее об акции +150% квоты"'],
  [/`查看 150% 配额活动说明`/g, '`Подробнее об акции +150% квоты`'],
  [/"权益规则说明："/g, '"Правила начисления квоты:"'],
  [/`权益规则说明：`/g, '`Правила начисления квоты:`'],
  [/"说明 ZCode 内 Coding Plan 使用 GLM-5\.2 时的 150% 配额权益折算规则。"/g, '"Как в ZCode пересчитывается акция +150% квоты для GLM-5.2 через Coding Plan."'],
  [/`说明 ZCode 内 Coding Plan 使用 GLM-5\.2 时的 150% 配额权益折算规则。`/g, '`Как в ZCode пересчитывается акция +150% квоты для GLM-5.2 через Coding Plan.`'],
  [/"用户在 ZCode 中通过 Coding Plan 使用 GLM-5\.2 模型时，额度消耗全周期按 0\.67 系数折算。"/g, '"При использовании GLM-5.2 через Coding Plan расход квоты считается с коэффициентом 0,67 в течение всего периода акции."'],
  [/`用户在 ZCode 中通过 Coding Plan 使用 GLM-5\.2 模型时，额度消耗全周期按 0\.67 系数折算。`/g, '`При использовании GLM-5.2 через Coding Plan расход квоты считается с коэффициентом 0,67 в течение всего периода акции.`'],
  [/"同样的模型调用量，在额度扣减侧仅按 67% 计算；等效来看，用户在活动周期内的可用额度约为原来的 1\.5 倍。"/g, '"Та же нагрузка списывает только 67% квоты; фактически доступная квота в период акции примерно в 1,5 раза выше."'],
  [/`同样的模型调用量，在额度扣减侧仅按 67% 计算；等效来看，用户在活动周期内的可用额度约为原来的 1\.5 倍。`/g, '`Та же нагрузка списывает только 67% квоты; фактически доступная квота в период акции примерно в 1,5 раза выше.`'],
  [/"具体折算规则如下："/g, '"Правила пересчёта:"'],
  [/`具体折算规则如下：`/g, '`Правила пересчёта:`'],
  [/"高峰期（每日 14:00～18:00）：由原先的 3x 调整为 2x 系数"/g, '"Пиковые часы (ежедневно 14:00-18:00): коэффициент снижен с 3x до 2x."'],
  [/`高峰期（每日 14:00～18:00）：由原先的 3x 调整为 2x 系数`/g, '`Пиковые часы (ежедневно 14:00-18:00): коэффициент снижен с 3x до 2x.`'],
  [/"非高峰期（除高峰期外的 20 个小时）：由原先的 1x 调整为 0\.67x 系数"/g, '"Вне пиковых часов (остальные 20 часов): коэффициент снижен с 1x до 0,67x."'],
  [/`非高峰期（除高峰期外的 20 个小时）：由原先的 1x 调整为 0\.67x 系数`/g, '`Вне пиковых часов (остальные 20 часов): коэффициент снижен с 1x до 0,67x.`'],
  [/"额度权益截止时间以官方公告为准。"/g, '"Срок действия преимущества по квоте определяется официальным объявлением."'],
  [/`额度权益截止时间以官方公告为准。`/g, '`Срок действия преимущества по квоте определяется официальным объявлением.`'],

  // --- Уровни Auto-approve (инструменты) ---
  [/"Ask before each file changes."/g, '"Спрашивать перед каждым изменением файла."'],
  [/`Ask before each file changes.`/g, '`Спрашивать перед каждым изменением файла.`'],
  [/"Edit selected files or relevant workspace files automatically."/g, '"Автоматически изменять выбранные или подходящие файлы."'],
  [/`Edit selected files or relevant workspace files automatically.`/g, '`Автоматически изменять выбранные или подходящие файлы.`'],
  [/"Inspect the code and present a plan before editing."/g, '"Изучить код и представить план перед редактированием."'],
  [/`Inspect the code and present a plan before editing.`/g, '`Изучить код и представить план перед редактированием.`'],
  [/"Edit and run commands with fewer confirmations."/g, '"Редактировать и выполнять команды с меньшим числом подтверждений."'],
  [/`Edit and run commands with fewer confirmations.`/g, '`Редактировать и выполнять команды с меньшим числом подтверждений.`'],

  // --- Уровень рассуждений (Reasoning / Thought) ---
  [/"Thought Level"/g, '"Уровень рассуждений"'],
  [/`Thought Level`/g, '`Уровень рассуждений`'],
  [/"Reasoning level for the selected model\."/g, '"Уровень рассуждений для выбранной модели."'],
  [/`Reasoning level for the selected model.`/g, '`Уровень рассуждений для выбранной модели.`'],
  [/"Available effort levels for this model"/g, '"Доступные уровни усилий для этой модели"'],
  [/`Available effort levels for this model`/g, '`Доступные уровни усилий для этой модели`'],
  [/"Determines the markup language of the output\."/g, '"Определяет язык разметки вывода."'],
  [/`Determines the markup language of the output.`/g, '`Определяет язык разметки вывода.`'],

  // --- Усилие (Effort) ---
  [/"Effort"/g, '"Усилие"'],
  [/`Effort`/g, '`Усилие`'],

  // --- Задачи сессии ---
  [/"Set, replace, pause, resume, or clear the long-running session goal"/g,
   '"Установить, заменить, приостановить, возобновить или очистить цель длительной сессии"'],

  // --- Coding Plan описания ---
  [/"Free Coding Plan entry for connected Z\.ai users\."/g, '"Бесплатный Coding Plan для подключённых пользователей Z.ai."'],
  [/"Free Coding Plan entry for signed-in Z\.ai users\."/g, '"Бесплатный Coding Plan для авторизованных пользователей Z.ai."'],

  // --- Mermaid / диаграммы ---
  [/"Loading diagram\.\.\."/g, '"Загрузка диаграммы..."'],
  [/`Loading diagram\.\.\.`/g, '`Загрузка диаграммы...`'],
  [/"Show Code"/g, '"Показать код"'],
  [/`Show Code`/g, '`Показать код`'],
  [/"Failed to render Mermaid chart"/g, '"Не удалось отобразить диаграмму Mermaid"'],
  [/`Failed to render Mermaid chart`/g, '`Не удалось отобразить диаграмму Mermaid`'],

  // --- Копирование кода ---
  [/"Copy code"/g, '"Копировать код"'],
  [/`Copy code`/g, '`Копировать код`'],

  // --- Process Monitor ---
  [/"Process Monitor"/g, '"Монитор процессов"'],
  [/`Process Monitor`/g, '`Монитор процессов`'],

  // --- Reset zoom ---
  [/"Reset zoom and pan"/g, '"Сбросить масштаб и прокрутку"'],
  [/`Reset zoom and pan`/g, '`Сбросить масштаб и прокрутку`'],

  // --- Blocked URL ---
  [/"Blocked URL: "/g, '"Заблокированный URL: "'],

  // --- Ошибки выполнения / лимиты модели ---
  [/"Turn execution failed"/g, '"Не удалось выполнить запрос"'],
  [/`Turn execution failed`/g, '`Не удалось выполнить запрос`'],
  [/"rate_limited"/g, '"превышен лимит"'],
  [/`rate_limited`/g, '`превышен лимит`'],
  [/"该模型当前访问量过大，请您稍后再试"/g, '"Сейчас высокая нагрузка на модель, попробуйте позже"'],
  [/`该模型当前访问量过大，请您稍后再试`/g, '`Сейчас высокая нагрузка на модель, попробуйте позже`'],
  [/"请您稍后再试"/g, '"Попробуйте позже"'],
  [/`请您稍后再试`/g, '`Попробуйте позже`'],
  [/function Gx\(e\)\{if\(typeof e!=`string`\)return null;let t=e\.trim\(\);return t\.length>0\?t:null\}/g,
   'function ZRUx(e){return typeof e==`string`?e.replaceAll(`Turn execution failed`,`Не удалось выполнить запрос`).replaceAll(`rate_limited`,`превышен лимит`).replaceAll(`该模型当前访问量过大`,`Сейчас высокая нагрузка на модель`).replaceAll(`请您稍后再试`,`попробуйте позже`).replace(/provider_code=/g,`код провайдера=`).replace(/provider=/g,`провайдер=`).replace(/model=/g,`модель=`).replace(/request=/g,`запрос=`).replace(/reason=/g,`причина=`).replace(/retryable=true/g,`можно повторить=да`).replace(/retryable=false/g,`можно повторить=нет`):e}function Gx(e){if(typeof e!=`string`)return null;let t=ZRUx(e.trim());return t.length>0?t:null}'],

  // --- Параметры ---
  [/"Parameters"/g, '"Параметры"'],
  [/`Parameters`/g, '`Параметры`'],

  // --- Issue # (обращения) ---
  [/"Issue #"/g, '"Обращение #"'],
  [/`Issue #`/g, '`Обращение #`'],

  // --- Этапы обратной связи (feedback progress) ---
  [/"Submitted"/g, '"Отправлено"'],
  [/"Reviewing"/g, '"На рассмотрении"'],
  [/"In Progress"/g, '"В работе"'],
  [/"Done"/g, '"Завершено"'],

  // --- Промо-баннер Coding Plan ---
  ['限时 150% 配额活动', 'Временно: +150% квоты'],
  ['升级 Coding Plan, 可在活动期内获得 150% 配额', 'Обновите Coding Plan и получите 150% квоты на время акции'],
  ['升级 Coding Plan，可在活动期内获得 150% 配额', 'Обновите Coding Plan и получите 150% квоты на время акции'],
  ['150% 配额', '150% квоты'],
  ['3x higher Claude Pro usage limits', 'В 3 раза выше лимиты использования Claude Pro'],
  ['Everything in Lite, plus 5x Lite usage', 'Всё из Lite плюс в 5 раз больше лимитов Lite'],
  ['Everything in Pro, plus 20x Lite usage', 'Всё из Pro плюс в 20 раз больше лимитов Lite'],

  // --- Валюта ---
  ['美元', 'долл.'],

  // --- Китайские ошибки API (из zh-CN словаря, могут проступить) ---
  ['该模型当前访问量过大，请您稍后再试', 'Сейчас высокая нагрузка на модель, попробуйте позже'],
  ['请您稍后再试', 'Попробуйте позже'],
  ['当前系统繁忙，请切换模型、升级账户，或稍后再试。', 'Система перегружена. Переключите модель, повысьте аккаунт или повторите попытку.'],
  ['当前系统繁忙，当前自动重试已达到最大次数，请稍后再试或升级账户。', 'Система перегружена, автоматические повторы достигли максимума. Повторите позже или повысьте аккаунт.'],
  ['切换模型', 'Переключить модель'],
  ['升级账户', 'Повысить аккаунт'],
  ['稍后再试', 'Повторить позже'],
  ['自动重试已达到最大次数', 'Автоповторы достигли максимума'],

  // --- Китайские подписи Coding Plan ---
  ['按「{price}/月」自动续费。', 'Автопродление по {price}/мес.'],
  ['每月自动扣款，取消后停止续费。', 'Ежемесячное списание, прекращается при отмене.'],
  ['连续包月计划', 'Ежемесячный план'],
  ['折合 {price}/月', 'Эквивалент {price}/мес.'],
  ['优惠活动', 'Акция'],

  // --- Китайские ошибки/сообщения в интерфейсе ---
  ['BigModel 账号未注册', 'Аккаунт BigModel не зарегистрирован'],

  // --- Китайские единицы (万 = 10000) ---
  // Патчим функцию форматирования контекстного окна
];

function resolveAsarSource(input) {
  return path.normalize(String(input).trim().replace(/^"+|"+$/g, ''));
}

/**
 * Патчит локаль zh-CN → ru-RU в JS-файлах.
 * Это нужно, чтобы Intl.NumberFormat и Intl.DateTimeFormat использовали
 * русский формат (без "万", без "月/日").
 *
 * ВАЖНО: не трогаем ключи словаря ("zh-CN": {...}), только locale identifiers.
 */
function patchLocaleInJs(assetsDir, push) {
  const localeFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  let patched = 0;
  let totalReplacements = 0;

  for (const fn of localeFiles) {
    const fp = path.join(assetsDir, fn);
    let code = fs.readFileSync(fp, 'utf-8');
    const before = code;
    let fileReplacements = 0;

    // Паттерны для замены locale identifiers (безопасные контексты):
    // 1. Template literal: `zh-CN` → `ru-RU`
    //    Но НЕ в Object.assign ключах и НЕ в dictRegex совпадениях.
    //    Безопасно: в любом контексте, кроме : "zh-CN" и : `zh-CN` (ключи словаря).

    // 2. Intl.NumberFormat/DateTimeFormat locale parameter
    code = code.replace(/Intl\.NumberFormat\(([^)]*?)`zh-CN`/g, 'Intl.NumberFormat($1`ru-RU`');
    code = code.replace(/Intl\.DateTimeFormat\(([^)]*?)`zh-CN`/g, 'Intl.DateTimeFormat($1`ru-RU`');

    // 3. toLocaleString с `zh-CN`
    code = code.replace(/toLocaleString\(([^)]*?)`zh-CN`/g, 'toLocaleString($1`ru-RU`');

    // 4. Условные операторы с locale: t?`zh-CN`:`en-US` → t?`ru-RU`:`en-US`
    code = code.replace(/\?`zh-CN`:/g, '?`ru-RU`:');

    // 5. Строка "zh-CN" вIntl-контексте (без двоеточия перед ней — это ключ словаря)
    // Безопасно: Intl.NumberFormat("zh-CN" → Intl.NumberFormat("ru-RU"
    code = code.replace(/Intl\.NumberFormat\(([^)]*?)"zh-CN"/g, 'Intl.NumberFormat($1"ru-RU"');
    code = code.replace(/Intl\.DateTimeFormat\(([^)]*?)"zh-CN"/g, 'Intl.DateTimeFormat($1"ru-RU"');

    // 6. Все оставшиеся zh-CN как значения locale, но не ключи словаря.
    // Ключи вида "zh-CN": оставляем, иначе ломается подмена словаря.
    code = code.replace(/(["'`])zh-CN\1(?!\s*:)/g, '$1ru-RU$1');

    // 7. Русский словарь в ZCode подключается через ключ zh-CN, поэтому
    // runtime locale иногда всё ещё приходит как zh-CN. Заменяем только
    // конкретные Intl-вызовы с `zh-CN` аргументом (безопасно).
    // НЕ трогаем Intl.X(localeVariable) — это сломает приложение!

    if (code !== before) {
      fs.writeFileSync(fp, code, 'utf-8');
      patched++;
      push('ok', 'Локаль в JS: ' + fn);
    }
  }
  push(patched > 0 ? 'ok' : 'warn', 'JS-файлов с исправленной локалью: ' + patched);
  return patched;
}

function applyHardcodedPatches(code) {
  let count = 0;
  for (const [pattern, replacement] of HARDCODED_PATCHES) {
    const before = code;
    code = typeof pattern === 'string'
      ? code.split(pattern).join(replacement)
      : code.replace(pattern, replacement);
    if (code !== before) count++;
  }
  return { code, count };
}

async function patch(input, opts = {}) {
  const prevAsar = process.noAsar;
  process.noAsar = true;
  try {
    const onProgress = opts.onProgress || (() => {});
    const asarSource = opts.asarSource;
    const log = [];
    const push = (type, msg) => log.push({ type, msg });
    const TOTAL = 7;

    const info = checkZcode(input);
    let tempExtract = null;

    try {
      if (!info.root || !info.path) {
        throw new Error('Не указан путь к ZCode');
      }
      const asarPath = info.path;
      const backupPath = info.backupPath;
      tempExtract = path.join(path.dirname(asarPath), '_temp_ru_patch');

      onProgress(1, TOTAL, 'Шаг 1/6: Бэкап...', 'info');
      const src = asarSource ? resolveAsarSource(asarSource) : asarPath;
      if (!fs.existsSync(src)) {
        throw new Error('app.asar не найден: ' + src);
      }
      if (!fs.existsSync(asarPath)) {
        throw new Error('Целевой app.asar не найден: ' + asarPath);
      }
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(asarPath, backupPath);
        push('ok', 'Бэкап создан: ' + path.basename(backupPath));
      } else {
        push('warn', 'Бэкап уже существует, пропускаю');
      }

      onProgress(2, TOTAL, 'Шаг 2/6: Распаковка...', 'info');
      try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}
      asar.extractAll(src, tempExtract);
      push('ok', 'Распаковано из ' + path.basename(src));

      onProgress(3, TOTAL, 'Шаг 3/6: Поиск файлов...', 'info');
      const assetsDir = path.join(tempExtract, 'out', 'renderer', 'assets');
      if (!fs.existsSync(assetsDir)) {
        throw new Error('Не найдена папка assets — возможно, другая версия ZCode');
      }
      const allJs = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
      if (allJs.length === 0) {
        throw new Error('Не найдены .js файлы в assets');
      }

      onProgress(4, TOTAL, 'Шаг 4/6: Переводы...', 'info');
      let translated = 0;
      let dictPatchedCount = 0;
      const localePatchedCount = patchLocaleInJs(assetsDir, push);

      for (const fn of allJs) {
        const fp = path.join(assetsDir, fn);
        let code = fs.readFileSync(fp, 'utf-8');
        let patched = false;
        
        // Заменяем любую надпись для языка zh-CN на "Русский" (в меню)
        const re1 = /"settings\.locale\.zh-CN"\s*:\s*(['"`])[^'"`]+\1/g;
        const re2 = /"sidebar\.settings\.locale\.zh-CN"\s*:\s*(['"`])[^'"`]+\1/g;
        
        if (re1.test(code) || re2.test(code)) {
            code = code.replace(re1, '"settings.locale.zh-CN":$1Русский$1');
            code = code.replace(re2, '"sidebar.settings.locale.zh-CN":$1Русский$1');
            patched = true;
            translated++;
        }

        // Подмена словаря zh-CN на русский
        // Простой подход: читаем ru-RU.json, парсим, и формируем JS-объект
        // с теми же переменными что и оригинальный словарь.
        const dictRegex = /"zh-CN":\s*([a-zA-Z0-9_$]+)\s*,\s*("en-US":\s*[a-zA-Z0-9_$]+)/g;
        if (dictRegex.test(code)) {
            let ruDict = {};
            try {
              const ruJsonPath = path.join(__dirname, 'ru-RU.json');
              process.noAsar = false;
              if (fs.existsSync(ruJsonPath)) {
                ruDict = JSON.parse(fs.readFileSync(ruJsonPath, 'utf-8'));
              }
              process.noAsar = true;
            } catch(e) { process.noAsar = true; }

            // Формируем JS-объект как строку, экранируя обратные кавычки
            const ruParts = Object.entries(ruDict).map(([k, v]) => {
              const ek = k.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              const ev = String(v).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
              return '"' + ek + '":`' + ev + '`';
            });
            const ruObjStr = '{' + ruParts.join(',') + '}';

            code = code.replace(dictRegex, (match, zhVar, enPart) => {
                if (match.includes('Object.assign')) return match;
                dictPatchedCount++;
                return `"zh-CN":Object.assign({},${zhVar},${ruObjStr}),${enPart}`;
            });
            patched = true;
        }

        if (patched) {
          fs.writeFileSync(fp, code, 'utf-8');
          push('ok', 'Пропатчен файл: ' + fn);
        }
      }

      onProgress(5, TOTAL, 'Шаг 5/7: Хардкод-патч...', 'info');
      let hardcodedCount = 0;
      for (const fn of allJs) {
        const fp = path.join(assetsDir, fn);
        let code = fs.readFileSync(fp, 'utf-8');
        const { code: patchedCode, count } = applyHardcodedPatches(code);
        if (count > 0) {
          fs.writeFileSync(fp, patchedCode, 'utf-8');
          hardcodedCount += count;
          push('ok', 'Хардкод-патч: ' + fn + ' (' + count + ')');
        }
      }
      push(hardcodedCount > 0 ? 'ok' : 'warn', 'Захардкоженных строк пропатчено: ' + hardcodedCount);

      onProgress(6, TOTAL, 'Шаг 6/7: Проверка внедрений...', 'info');

      push(dictPatchedCount > 0 ? 'ok' : 'warn', 'Словарей пропатчено: ' + dictPatchedCount);

      if (translated === 0 && dictPatchedCount === 0 && localePatchedCount === 0) {
        throw new Error('Ни одна замена не сработала — версия ZCode не поддерживается этим патчем');
      }

      onProgress(7, TOTAL, 'Шаг 7/7: Пересборка...', 'info');
      try { fs.rmSync(asarPath, { force: true }); } catch {}
      await asar.createPackage(tempExtract, asarPath);
      try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}
      push('ok', 'Пересобрано: ' + asarPath);

      onProgress(TOTAL, TOTAL, 'Патч применён!', 'success');
      return { success: true, log, root: info.root, asarPath };
    } catch (e) {
      push('error', e.message);
      if (tempExtract) {
        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}
      }
      onProgress(TOTAL, TOTAL, 'Ошибка: ' + e.message, 'error');
      return { success: false, log };
    }
  } finally {
    process.noAsar = prevAsar;
  }
}

function restore(input) {
  const prevAsar = process.noAsar;
  process.noAsar = true;
  try {
    const info = checkZcode(input);
    if (!info.path) return { success: false, msg: 'Не указан путь к ZCode' };
    if (!info.hasBackup) {
      return { success: false, msg: 'Бэкап не найден: ' + info.backupPath };
    }
    try {
      fs.rmSync(info.path, { force: true });
      fs.copyFileSync(info.backupPath, info.path);
      fs.rmSync(info.backupPath, { force: true });
      return { success: true, msg: 'Откат выполнен' };
    } catch (e) {
      return { success: false, msg: e.message };
    }
  } finally {
    process.noAsar = prevAsar;
  }
}

module.exports = {
  detectZcodeDir,
  resolveZcodeRoot,
  checkZcode,
  patch,
  restore,
  candidateRoots,
  isZcodeRoot,
};
