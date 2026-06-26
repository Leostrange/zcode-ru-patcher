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

  // ============================================================
  // v6.3 — Новые патчи для hardcoded китайских строк (index.js)
  // ============================================================

  // --- Форматирование времени (fallback) ---
  ['`刚刚`', '`Только что`'],
  ['`分钟前`', '`мин. назад`'],
  ['`小时前`', '`ч. назад`'],
  ['`天前`', '`дн. назад`'],

  // --- Диалоги подтверждения / Уведомления ---
  ['`需要你的确认`', '`Требуется ваше подтверждение`'],
  ['`任务已完成`', '`Задача выполнена`'],
  ['`任务出错`', '`Ошибка в задаче`'],
  ['`任务已停止，未收到终态事件。`', '`Задача остановлена, событие финального состояния не получено.`'],
  ['`模型切换进行中，请稍后再发送消息。`', '`Выполняется переключение модели, подождите перед отправкой.`'],

  // --- Метки статуса агента (fallback) ---
  ['`启动失败`', '`Запуск не удался`'],
  ['`启动中`', '`Запуск`'],
  ['`已启动`', '`Запущено`'],
  ['`后台运行中，正在同步输出`', '`Выполняется в фоне, синхронизация вывода`'],
  ['`后台运行中，等待输出`', '`Выполняется в фоне, ожидание вывода`'],
  ['`已收到 SubAgent 回传`', '`Вывод субагента получен`'],
  ['`等待 SubAgent 回传`', '`Ожидание вывода субагента`'],
  ['`后台 Agent 过程`', '`Фоновый процесс агента`'],
  ['`输出文件`', '`Файл вывода`'],

  // --- Coding Plan / Биллинг (hardcoded inline) ---
  ['`体验套餐`', '`Пробный план`'],
  ['`GLM 模型每日 500万 tokens`', '`GLM: 5 млн токенов/день`'],
  ['`GLM-5.2 每日 300万 tokens`', '`GLM-5.2: 3 млн токенов/день`'],
  ['`GLM-5-Turbo 每日 200万 tokens`', '`GLM-5-Turbo: 2 млн токенов/день`'],
  ['`已过期`', '`Истёк`'],
  ['`已结束`', '`Завершён`'],
  ['`新套餐原价`', '`Первоначальная стоимость`'],
  ['`现有套餐剩余价值`', '`Остаток текущего плана`'],
  ['`实付金额`', '`К оплате`'],
  ['`抵扣费用`', '`Скидка`'],
  ['`月付`', '`Помесячно`'],
  ['`季付`', '`Поквартально`'],
  ['`年付`', '`Ежегодно`'],
  ['`续费政策`', '`Политика продления`'],
  ['`续订将按照「`', '`Продление по тарифу «`'],
  ['`」发起自动扣费。`', '`» с автосписанием.`'],
  ['`扣费优先级：优先扣除赠金，再扣余额，再采用支付宝扣费。`', '`Приоритет списания: бонусы → баланс → Alipay.`'],
  ['`将持续定期扣款，直至您根据我们的服务条款取消服务。`', '`Автосписание продолжается до отмены по условиям сервиса.`'],
  ['`人民币`', '`руб.`'],

  // --- UI обратной связи (feedback inline labels) ---
  ['`正在连接反馈服务`', '`Подключение к службе обратной связи`'],
  ['`创建成功后会继续上传截图和日志`', '`После создания продолжится загрузка скриншотов и логов`'],
  ['`正在上传截图`', '`Загрузка скриншотов`'],
  ['`反馈已提交`', '`Обратная связь отправлена`'],
  ['`我们会尽快处理。`', '`Мы обработаем вашу заявку.`'],
  ['`反馈提交失败`', '`Ошибка отправки обратной связи`'],
  ['`正在暂停日志上传`', '`Приостановка загрузки логов`'],
  ['`已收到取消请求，稍等一下。`', '`Запрос на отмену получен, подождите.`'],
  ['`正在导出完整日志`', '`Экспорт полных логов`'],
  ['`会根据本机日志大小耗时数秒`', '`Может занять несколько секунд`'],
  ['`正在上传完整日志`', '`Загрузка полных логов`'],
  ['`日志上传成功`', '`Логи успешно загружены`'],
  ['`已暂停日志上传`', '`Загрузка логов приостановлена`'],
  ['`日志是定位问题的必需材料，请继续上传。`', '`Логи необходимы для диагностики, продолжите загрузку.`'],
  ['`准备上传`', '`Подготовка к загрузке`'],

  // --- Ошибки (hardcoded) ---
  ['`读取附件失败`', '`Ошибка чтения вложения`'],
  ['`附件缺少可读取内容`', '`Вложение не содержит данных`'],
  ['`附件数据格式不正确`', '`Неверный формат данных вложения`'],
  ['`截图读取失败`', '`Ошибка чтения скриншота`'],
  ['`截图数据格式不正确`', '`Неверный формат скриншота`'],
  ['`重复提交`', '`Повторная отправка`'],
  ['`只允许提交一次`', '`Допускается только одна отправка`'],
  ['`模型调用报错`', '`Ошибка вызова модели`'],
  ['`ZCode 报错信息`', '`Информация об ошибке ZCode`'],
  ['`报错摘要`', '`Краткое описание ошибки`'],
  ['`报错详情`', '`Подробности ошибки`'],
  ['`我在使用过程中遇到了报错，请帮忙排查。`', '`Возникла ошибка, помогите разобраться.`'],
  ['`我当时正在做什么`', '`Что я делал в тот момент`'],
  ['`请补充：`', '`Дополните:`'],
  ['`期望结果`', '`Ожидаемый результат`'],
  ['`内容过长，已截断`', '`Слишком длинное содержимое, обрезано`'],

  // --- Прочий UI ---
  ['`其它`', '`Прочее`'],
  ['`P2-中`', '`P2-Средняя`'],
  ['`P3-低`', '`P3-Низкая`'],
  ['`原始反馈`', '`Исходный отзыв`'],
  ['`反馈类型: ${n}`', '`Тип отзыва: ${n}`'],
  ['`产品模块: ${r}`', '`Модуль продукта: ${r}`'],
  ['`严重程度: ${i}`', '`Серьёзность: ${i}`'],
  ['`用户反馈`', '`Отзывы пользователей`'],
  ['`当前设备`', '`Текущее устройство`'],
  ['`验证码校验失败`', '`Ошибка проверки Captcha`'],
  ['`远程连接失败`', '`Ошибка удалённого подключения`'],
  ['`SSH连接失败`', '`Ошибка SSH-подключения`'],
  ['`WSL连接失败`', '`Ошибка WSL-подключения`'],
  ['`Agent任务执行失败`', '`Ошибка задачи агента`'],
  ['`未提供`', '`Не указано`'],
  ['`连接日志（最近 30 条）`', '`Логи подключения (последние 30)`'],
  ['`未捕获到连接日志`', '`Логи подключения не найдены`'],
  ['`我当时正在连接的环境`', '`Какое окружение я подключал`'],

  // --- Coding Plan: описание планов (hardcoded) ---
  ['`适合个人开发者，独享 Coding Plan 额度。`', '`Для индивидуальных разработчиков, собственная квота.`'],
  ['`免费体验平台 GLM 旗舰模型额度。`', '`Бесплатный пробный доступ к флагманским моделям GLM.`'],
  ['`适合团队协作，支持席位和集中结算。`', '`Для команд, поддержка席атов и централизованной оплаты.`'],
  ['`5x Lite 额度 + Lite 权益`', '`5x квота Lite + возможности Lite`'],
  ['`20x Lite 额度 + Pro 权益`', '`20x квота Lite + возможности Pro`'],
  ['`每周最多：3亿 tokens`', '`До 300 млн токенов в неделю`'],
  ['`5小时最多：0.6亿 tokens`', '`До 60 млн токенов за 5 часов`'],
  ['`5小时最多：1.6亿 tokens`', '`До 160 млн токенов за 5 часов`'],

  // --- Временные единицы ---
  ['`小时`', '`ч`'],
  ['`分`', '`мин`'],
  ['`秒`', '`сек`'],

  // --- Параллельность / Модель ---
  ['`并发`', '`Параллельность`'],
  ['`模型`', '`Модель`'],

  // --- Уведомление о подтверждении задачи ---
  ['`任务等待你的确认`', '`Задача ожидает вашего подтверждения`'],

  // --- Git operations ---
  ['`切换分支`', '`Переключение ветки`'],
  ['`创建并切换分支`', '`Создать и переключить ветку`'],
  ['`提交后切换分支`', '`Переключить ветку после коммита`'],

  // --- Workspace plugin messages ---
  ['`请先打开一个工作区后再修改插件状态`', '`Откройте рабочую область перед изменением состояния плагина`'],
  ['`请先打开一个工作区后再卸载插件`', '`Откройте рабочую область перед удалением плагина`'],
  ['`请先打开一个工作区后再安装插件`', '`Откройте рабочую область перед установкой плагина`'],

  // --- Mermaid additional ---
  ['`[MermaidBlock] Mermaid 渲染失败`', '`[MermaidBlock] Ошибка рендеринга Mermaid`'],
  ['`[MessageResponse] markdown 渲染失败，已降级为纯 текст`', '`[MessageResponse] Ошибка рендеринга markdown, отображается как текст`'],

  // --- Agent background task ---
  ['`启动`', '`Запуск`'],
  ['`活动`', '`Активность`'],

  // --- Описание проблемы ---
  ['`我在这个任务里遇到了问题，请帮忙排查。`', '`Возникла проблема в этой задаче, помогите разобраться.`'],
];

function resolveAsarSource(input) {
  return path.normalize(String(input).trim().replace(/^"+|"+$/g, ''));
}

function patchLocaleInJs(assetsDir, push) {
  push('ok', 'Внутренние идентификаторы локали не менялись');
  return 0;
}

/**
 * Встраивает ключ "ru-RU" в словари, чтобы при lookup dict['ru-RU']
 * возвращался тот же объект, что и dict['zh-CN'].
 *
 * Поддерживает два формата:
 * 1. Переменные: "zh-CN": varName, "en-US": varName2
 * 2. Inline:     "zh-CN":{...},"en-US":{...}
 *
 * ВАЖНО: шаблонные литералы с ${...} внутри словарей НЕ экранируются —
 * они уже экранированы в оригинальном коде ZCode.
 */
function injectRuRULocaleKeys(assetsDir, push) {
  const localeFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  let patched = 0;

  for (const fn of localeFiles) {
    const fp = path.join(assetsDir, fn);
    let code = fs.readFileSync(fp, 'utf-8');
    const before = code;

    // ── Формат 1: "zh-CN": varName, "en-US": varName2 ──
    // Добавляем "ru-RU": varName, перед "zh-CN":
    code = code.replace(
      /("zh-CN"\s*:\s*)([a-zA-Z0-9_$]+)(\s*,\s*"en-US"\s*:)/g,
      '"ru-RU":$2,$1$2$3'
    );

    // ── Формат 2: "zh-CN":{...},"en-US":{...} (inline) ──
    // Находим "zh-CN":{ и копируем содержимое до matching "},  "en-US":
    // Решение: ищем начало "zh-CN":{ и ищем конец ,  "en-US":
    // Начинаем с "zh-CN":{ и считаем depth скобок до совпадения
    const inlinePattern = /"zh-CN"\s*:\s*\{/g;
    let match;
    let searchFrom = 0;
    let insertedInline = false;

    while ((match = inlinePattern.exec(code)) !== null) {
      // Не обрабатываем если уже был вставлен ru-RU рядом
      if (code.substring(Math.max(0, match.index - 10), match.index).includes('"ru-RU"')) {
        continue;
      }

      const startIdx = match.index + match[0].length - 1; // позиция {
      let depth = 1;
      let i = startIdx + 1;
      while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        i++;
      }
      // i теперь указывает на закрывающую } zh-CN объекта
      if (depth === 0) {
        const zhContent = code.substring(startIdx, i); // включая { и }
        const insertPos = match.index;
        // Проверяем что дальше идёт , "en-US":
        const afterZh = code.substring(i, i + 30);
        if (/,?\s*"en-US"\s*:/.test(afterZh)) {
          const ruLine = '"ru-RU":' + zhContent + ',';
          code = code.substring(0, insertPos) + ruLine + code.substring(insertPos);
          insertedInline = true;
          push('ok', 'ru-RU inline ключ: ' + fn);
          break; // вставляем только один раз на файл
        }
      }
    }

    if (code !== before) {
      fs.writeFileSync(fp, code, 'utf-8');
      patched++;
      if (!insertedInline) push('ok', 'ru-RU ключ добавлен: ' + fn);
    }
  }
  push(patched > 0 ? 'ok' : 'warn', 'JS-файлов с ru-RU ключом: ' + patched);
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

function applyVisibleUiPatches(code) {
  let count = 0;
  const replaceAll = (from, to) => {
    const before = code;
    code = code.split(from).join(to);
    if (code !== before) count++;
  };
  const replaceRe = (pattern, to) => {
    const before = code;
    code = code.replace(pattern, to);
    if (code !== before) count++;
  };

  // Usage page: keep the runtime locale id zh-CN, but format charts/numbers as Russian.
  replaceAll('new Intl.NumberFormat(e||void 0,{', 'new Intl.NumberFormat(e===`zh-CN`?`ru-RU`:e||void 0,{');
  replaceAll('new Intl.NumberFormat(e,{', 'new Intl.NumberFormat(e===`zh-CN`?`ru-RU`:e,{');
  replaceAll('new Intl.DateTimeFormat(e,{', 'new Intl.DateTimeFormat(e===`zh-CN`?`ru-RU`:e,{');
  replaceAll('new Intl.NumberFormat(t?`zh-CN`:`en-US`)', 'new Intl.NumberFormat(t?`ru-RU`:`en-US`)');

  // Coding Plan hardcoded zh-CN branches.
  replaceAll('return t===`zh-CN`?`${n}${a} ${r} ${i}`:`${n} · ${r} ${i}${a}`', 'return t===`zh-CN`?`${n} · ${r} ${i}${a}`:`${n} · ${r} ${i}${a}`');
  replaceAll('return t===`zh-CN`?`GLM 模型${i?`每日`:``} ${a} tokens`:`${a} GLM tokens${i?` daily`:``}`', 'return t===`zh-CN`?`${a} GLM tokens${i?` в день`:``}`:`${a} GLM tokens${i?` daily`:``}`');
  replaceAll('t===`zh-CN`?` 每日`:` daily`', 't===`zh-CN`?` в день`:` daily`');
  replaceAll('t===`zh-CN`?`每年`:`yearly`', 't===`zh-CN`?`год`:`yearly`');
  replaceAll('t===`zh-CN`?`每季`:`quarterly`', 't===`zh-CN`?`квартал`:`quarterly`');
  replaceAll('t===`zh-CN`?`每月`:`monthly`', 't===`zh-CN`?`месяц`:`monthly`');
  replaceAll('t===`zh-CN`?`/年`:`/year`', 't===`zh-CN`?`/год`:`/year`');
  replaceAll('t===`zh-CN`?`/季`:`/quarter`', 't===`zh-CN`?`/квартал`:`/quarter`');
  replaceAll('t===`zh-CN`?`/月`:`/month`', 't===`zh-CN`?`/мес.`:`/month`');

  const textPatches = [
    ['基础用量额度', 'Базовая квота'],
    ['适合小型 Repo 轻量级迭代', 'Для небольших репозиториев и легких итераций'],
    ['适合中型 Repo 日常开发', 'Для ежедневной разработки средних репозиториев'],
    ['适合高阶用户中大型 Repo 深度开发', 'Для опытных пользователей и крупных репозиториев'],
    ['标准版全部权益', 'Все возможности Standard'],
    ['每周最多：8亿 tokens', 'До 800 млн токенов в неделю'],
    ['每周最多：3亿 tokens', 'До 300 млн токенов в неделю'],
    ['每周最多：1亿 tokens', 'До 100 млн токенов в неделю'],
    ['5小时最多：0.6亿 tokens', 'До 60 млн токенов за 5 часов'],
    ['5小时最多：1.6亿 tokens', 'До 160 млн токенов за 5 часов'],
    ['5小时最多：4亿 tokens', 'До 400 млн токенов за 5 часов'],
    ['配额', 'квота'],
    ['额度', 'квота'],
    ['每日', 'в день'],
  ];
  for (const [from, to] of textPatches) replaceAll(from, to);

  replaceRe(/([0-9]+(?:\.[0-9]+)?)亿 tokens/g, (_, n) => `${Number(n) * 100} млн токенов`);
  replaceRe(/([0-9]+(?:\.[0-9]+)?)万 tokens/g, (_, n) => `${Number(n) * 10000} токенов`);

  return { code, count };
}

function patchTextFile(filePath, replacements, push) {
  if (!fs.existsSync(filePath)) return 0;
  let text = fs.readFileSync(filePath, 'utf-8');
  const before = text;
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf-8');
    push('ok', 'Переведен файл плагина: ' + path.relative(path.dirname(path.dirname(filePath)), filePath));
    return 1;
  }
  return 0;
}

function patchGlmPackageMetadata(root, push) {
  const glmDir = path.join(root, 'resources', 'glm', 'packages');
  if (!fs.existsSync(glmDir)) {
    push('warn', 'Папка bundled plugins не найдена, пропускаю');
    return 0;
  }

  const replacements = [
    ['为 ZCode 提供 Android 开发工作流和模拟器自动化能力。', 'Добавляет в ZCode рабочие процессы Android-разработки и автоматизацию эмулятора.'],
    ['为 ZCode 提供 iOS 开发工作流和模拟器自动化能力。', 'Добавляет в ZCode рабочие процессы iOS-разработки и автоматизацию симулятора.'],
    ['作为官方 ZCode 插件发布的内置 DOCX 与 PDF 文档生产技能。', 'Встроенные навыки для создания DOCX и PDF, опубликованные как официальный плагин ZCode.'],
    ['ZCode 内置 DOCX 与 PDF 文档生产技能。', 'Встроенные навыки ZCode для создания DOCX и PDF.'],
    ['ZCode 内置的 DOCX 与 PDF 文档生产навыков。', 'Встроенные навыки ZCode для создания DOCX и PDF.'],
    ['作为官方 ZCode 插件发布的旧版 ZCode session 恢复技能。', 'Навык восстановления старых сессий ZCode, опубликованный как официальный плагин ZCode.'],
    ['作为官方 ZCode 插件发布的内置 skill-creator 技能。', 'Встроенный навык skill-creator, опубликованный как официальный плагин ZCode.'],
    ['作为官方 ZCode 插件发布的 Superpowers 技能与启动 hooks。', 'Навыки Superpowers и startup hooks, опубликованные как официальный плагин ZCode.'],
    ['选择并恢复旧版 ACP-era ZCode session 到新 任务与会话库', 'Выбор и восстановление старых сессий ZCode эпохи ACP в новую библиотеку задач и сессий'],
    ['选择并恢复旧版 ACP-era ZCode session 到新 ZCode 任务与会话库。', 'Выбор и восстановление старых сессий ZCode эпохи ACP в новую библиотеку задач и сессий ZCode.'],
    ['选择并恢复旧版 ZCode session。', 'Выбрать и восстановить старую сессию ZCode.'],
    ['启动 Android 模拟器开发循环。', 'Запустить цикл разработки с Android-эмулятором.'],
    ['启动 iOS 模拟器开发循环。', 'Запустить цикл разработки с iOS-симулятором.'],
    ['"[目标或问题描述]"', '"[цель или описание проблемы]"'],
    ['"[agent/workspace/session 筛选条件]"', '"[фильтр agent/workspace/session]"'],
    ['可选的 Android SDK 根目录。为空时会回退到 ANDROID_HOME、ANDROID_SDK_ROOT 或常见系统路径。', 'Необязательный корневой каталог Android SDK. Если пусто, используется ANDROID_HOME, ANDROID_SDK_ROOT или стандартные системные пути.'],
    ['首选 AVD 或设备名称。', 'Предпочтительное имя AVD или устройства.'],
    ['生成项目、安装 SDK 包和默认系统镜像时使用的 Android API 级别。', 'Уровень Android API для создания проектов, установки SDK-пакетов и системного образа по умолчанию.'],
    ['安装指引使用的 Android SDK build-tools 版本。', 'Версия Android SDK build-tools для инструкций установки.'],
    ['Android 系统镜像类型：default、google_apis 或 google_apis_playstore。', 'Тип системного образа Android: default, google_apis или google_apis_playstore.'],
    ['可选的 Android 系统镜像 ABI 覆盖值。为空时 Apple Silicon/ARM64 主机使用 arm64-v8a，其它主机使用 x86_64。', 'Необязательное переопределение ABI системного образа Android. Если пусто, Apple Silicon/ARM64 использует arm64-v8a, остальные хосты x86_64.'],
    ['预检和安装指引使用的 JDK 主版本。', 'Основная версия JDK для предварительной проверки и инструкций установки.'],
    ['创建、编辑并迭代本地', 'Создание, редактирование и доработка локальных'],
    ['技能', 'навыков'],
    ['Planning, TDD, debugging, and delivery workflows for coding agents.', 'Планирование, TDD, отладка и процессы доставки для кодинговых агентов.'],
  ];

  const targets = [
    path.join(glmDir, 'android-emulator-plugin', '.zcode-plugin', 'plugin.json'),
    path.join(glmDir, 'android-emulator-plugin', 'package.json'),
    path.join(glmDir, 'android-emulator-plugin', 'commands', 'android-dev.md'),
    path.join(glmDir, 'ios-simulator-plugin', '.zcode-plugin', 'plugin.json'),
    path.join(glmDir, 'ios-simulator-plugin', 'package.json'),
    path.join(glmDir, 'ios-simulator-plugin', 'commands', 'ios-dev.md'),
    path.join(glmDir, 'document-skills-plugin', '.zcode-plugin', 'plugin.json'),
    path.join(glmDir, 'document-skills-plugin', 'package.json'),
    path.join(glmDir, 'restore-legacy-sessions-plugin', '.zcode-plugin', 'plugin.json'),
    path.join(glmDir, 'restore-legacy-sessions-plugin', 'package.json'),
    path.join(glmDir, 'restore-legacy-sessions-plugin', 'commands', 'restore-legacy-sessions.md'),
    path.join(glmDir, 'skill-creator-plugin', '.zcode-plugin', 'plugin.json'),
    path.join(glmDir, 'skill-creator-plugin', 'package.json'),
    path.join(glmDir, 'superpowers-plugin', '.zcode-plugin', 'plugin.json'),
    path.join(glmDir, 'superpowers-plugin', 'package.json'),
  ];

  let patched = 0;
  for (const filePath of targets) {
    patched += patchTextFile(filePath, replacements, push);
  }
  push(patched > 0 ? 'ok' : 'warn', 'Файлов bundled plugins переведено: ' + patched);
  return patched;
}

const SKILL_DESCRIPTION_RU = {
  'android-reader-qa': 'Используйте при разработке, тестировании, отладке или ревью Android-читалок: WebView, EPUB/TXT/FB2/DOCX/RTF/HTML/Markdown, CBZ/CBR/PDF/DJVU, пагинация, Webtoon-режим, эмулятор, logcat, скриншоты и регрессии.',
  'app-reverse-engineering': 'Используйте для разрешенного анализа приложений и артефактов: APK/AAB, IPA, desktop-бинарники, Electron/Flutter/React Native, web-бандлы, установщики, ресурсы, зависимости, строки и совместимость.',
  'ce-agent-native-architecture': 'Проектирование приложений, где агенты являются полноценной частью архитектуры: MCP-инструменты, автономные циклы, самонастраиваемые системы и agent-native функции.',
  'ce-agent-native-audit': 'Комплексный аудит agent-native архитектуры с оценкой по принципам.',
  'ce-brainstorm': 'Исследование требований и подходов через диалог, затем подготовка компактного документа требований.',
  'ce-clean-gone-branches': 'Очистка локальных веток, у которых пропала удаленная tracking-ветка, включая связанные worktree.',
  'ce-code-review': 'Структурированное ревью кода с несколькими ролями, фильтрацией находок по уверенности и объединением дубликатов.',
  'ce-commit': 'Создание git-коммита с понятным сообщением, которое отражает ценность изменения и следует стилю репозитория.',
  'ce-commit-push-pr': 'Коммит, push и создание PR с адаптивным описанием, масштаб которого соответствует размеру изменения.',
  'ce-compound': 'Документирование недавно решенной проблемы для накопления командных знаний или словаря проекта.',
  'ce-compound-refresh': 'Обновление устаревших документов с решениями под текущее состояние кодовой базы.',
  'ce-debug': 'Системный поиск первопричины и исправление багов, падений тестов, воспроизведений и ошибок.',
  'ce-demo-reel': 'Запись визуального демо: GIF, терминальная запись или скриншоты для PR и проверки поведения.',
  'ce-dhh-rails-style': 'Написание Ruby и Rails-кода в стиле DHH/37signals: REST, насыщенные модели, тонкие контроллеры и ясность вместо хитрости.',
  'ce-doc-review': 'Ревью требований или планов с параллельными ролями, которые находят проблемы с разных точек зрения.',
  'ce-dogfood-beta': '[BETA] Полное end-to-end тестирование активной ветки как QA: матрица сценариев, браузерная проверка, автоисправления и регрессии.',
  'ce-frontend-design': 'Создание качественных web-интерфейсов с вниманием к UX, визуальной системе, состояниям и адаптивности.',
  'ce-gemini-imagegen': 'Генерация и редактирование изображений через Gemini API: промпты, правки, стили, логотипы, стикеры и мокапы.',
  'ce-ideate': 'Генерация и критическая оценка идей по теме, поиск улучшений, неожиданных направлений и сильных вариантов.',
  'ce-optimize': 'Итерационная оптимизация по метрикам: цель, эксперименты, измерения, отбор улучшений и сходимость к лучшему решению.',
  'ce-plan': 'Создание структурированных планов для многошаговых задач: функции, исследования, события, учебные планы и декомпозиция.',
  'ce-polish': 'Запуск dev-сервера, открытие функции в браузере и совместная доводка интерфейса.',
  'ce-product-pulse': 'Сводка за период о пользовательском опыте и состоянии продукта: usage, качество, ошибки и сигналы для проверки.',
  'ce-promote': 'Черновики анонсов и маркетингового текста для уже выпущенной функции: пост, changelog, email, blog intro или demo script.',
  'ce-proof': 'Human-in-the-loop ревью Markdown через Proof: публикация, просмотр, комментарии, правки и синхронизация документов.',
  'ce-release-notes': 'Сводка последних релизов compound-engineering или ответ по конкретной версии с цитированием.',
  'ce-report-bug': 'Сообщение о баге в compound-engineering plugin.',
  'ce-resolve-pr-feedback': 'Разбор и исправление PR review feedback: оценка валидности, исправления и закрытие замечаний.',
  'ce-riffrec-feedback-analysis': 'Анализ product-feedback bundle Riffrec и подготовка структурированных выводов.',
  'ce-sessions': 'Поиск и вопросы по истории сессий coding agents в Claude Code, Codex и Cursor.',
  'ce-setup': 'Диагностика и настройка окружения compound-engineering: зависимости CLI, версия plugin и базовая конфигурация.',
  'ce-simplify-code': 'Упрощение и доводка недавно измененного кода для ясности, повторного использования, качества и эффективности.',
  'ce-slack-research': 'Поиск в Slack организационного контекста: решения, ограничения, обсуждения и выводы.',
  'ce-strategy': 'Создание или поддержка STRATEGY.md: целевая проблема, подход, пользователи, метрики и направления работы.',
  'ce-test-browser': 'Браузерные тесты страниц, затронутых текущим PR или веткой.',
  'ce-test-xcode': 'Сборка и тестирование iOS-приложений в симуляторе через XcodeBuildMCP.',
  'ce-update': 'Проверка актуальности compound-engineering plugin и рекомендация команды обновления.',
  'ce-work': 'Эффективное выполнение инженерной задачи с сохранением качества и доведением до результата.',
  'ce-work-beta': '[BETA] Выполнение работы с экспериментальной поддержкой внешних делегатов.',
  'ce-worktree': 'Создание изолированного git worktree для параллельной разработки или ревью.',
  'codegraph': 'Локальная семантическая навигация по коду через граф, когда нужно исследовать репозиторий как структуру связей.',
  'coding-tutor': 'Персональные уроки программирования на основе ваших знаний и реального кода проекта.',
  'doc': 'Работа с .docx и Word-документами: чтение, создание, редактирование и форматирование.',
  'imagegen': 'Генерация или редактирование растровых изображений: фото, иллюстрации, мокапы и визуальные материалы.',
  'lfg': 'Полный автономный инженерный pipeline: план, работа, ревью, тесты, коммит, push и PR.',
  'mr-comic-lead-architect': 'Архитектура, Android/Kotlin-разработка, планирование, ревью и реализация для проекта Mr.Comic.',
  'openai-docs': 'Официальная документация OpenAI для задач по продуктам, API и актуальным рекомендациям.',
  'pdf': 'Работа с PDF, где важны чтение, создание, проверка, рендеринг и визуальная раскладка.',
  'playwright': 'Автоматизация реального браузера из терминала: навигация, формы, скриншоты и проверки.',
  'plugin-creator': 'Создание структуры Codex plugin с plugin.json, папками plugin и опциональными возможностями.',
  'skill-creator': 'Создание эффективных навыков: новые SKILL.md, правка существующих и улучшение формулировок.',
  'skill-installer': 'Установка Codex skills из curated-списка или GitHub repo path в CODEX_HOME/skills.',
  'soul-grader': 'Оценка, ревью, переписывание или утверждение Hermes Agent SOUL.md.',
  'supergoal': 'Планирование и автономная сборка software-задачи end-to-end.',
  'synabun': 'Командный центр с памятью: brainstorm, audit, search и другие действия.',
  'android-dev': 'Сборка, запуск, проверка и легкая автоматизация Android-приложений через android-emulator MCP.',
  'ios-dev': 'Сборка, запуск, проверка и легкая автоматизация iOS-приложений через ios-simulator MCP.',
  'docx': 'Создание, редактирование и анализ DOCX-документов с поддержкой правок, комментариев, сохранения форматирования и извлечения текста.',
  'brainstorming': 'Обязательный предварительный шаг для творческой работы: функции, компоненты, поведение, требования и дизайн перед реализацией.',
  'dispatching-parallel-agents': 'Используйте, когда есть 2+ независимые задачи, которые можно выполнять параллельно без общего состояния или строгой последовательности.',
  'executing-plans': 'Выполнение готового плана реализации в отдельной сессии с контрольными точками ревью.',
  'finishing-a-development-branch': 'Завершение ветки разработки: выбор merge, PR или cleanup после реализации и прохождения тестов.',
  'receiving-code-review': 'Разбор code review feedback перед внедрением правок, особенно если замечание неясно или технически спорно.',
  'requesting-code-review': 'Проверка завершенных задач, крупных функций или изменений перед merge на соответствие требованиям.',
  'restore-legacy-sessions': 'Инспекция, планирование и восстановление старых ACP-era ZCode sessions в новые хранилища задач и сессий.',
  'subagent-driven-development': 'Выполнение implementation plans с независимыми задачами в текущей сессии.',
  'systematic-debugging': 'Используйте при баге, падении теста или неожиданном поведении перед предложением исправления.',
  'test-driven-development': 'Используйте при реализации функции или bugfix перед написанием кода реализации.',
  'using-git-worktrees': 'Создание изолированного workspace через native tools или git worktree перед выполнением планов.',
  'using-superpowers': 'Начало разговора с проверкой доступных skills и обязательным выбором подходящего навыка перед ответом.',
  'verification-before-completion': 'Проверка перед заявлением о готовности: запустить команды и подтвердить вывод до success-утверждений.',
  'writing-plans': 'Создание плана при наличии spec или требований перед изменением кода.',
  'writing-skills': 'Создание, редактирование и проверка skills перед развертыванием.'
};

function yamlQuote(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function patchSkillDescriptionFile(filePath, push) {
  const skillName = path.basename(path.dirname(filePath));
  const replacement = SKILL_DESCRIPTION_RU[skillName];
  if (!replacement) return 0;
  let text = fs.readFileSync(filePath, 'utf-8');
  const before = text;
  text = text.replace(
    /^description:\s*[\s\S]*?(?=\n(?:[A-Za-z0-9_-]+:|---))/m,
    'description: ' + yamlQuote(replacement)
  );
  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf-8');
    push('ok', 'Описание навыка переведено: ' + skillName);
    return 1;
  }
  return 0;
}

function walkSkillFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSkillFiles(full, out);
    else if (entry.isFile() && entry.name === 'SKILL.md') out.push(full);
  }
  return out;
}

function patchSkillMetadata(root, push) {
  const home = os.homedir();
  const candidateRootsForSkills = [
    path.join(home, '.codex', 'skills'),
    path.join(home, '.codex', 'plugins', 'cache'),
    path.join(root, 'resources', 'glm', 'packages')
  ];
  let patched = 0;
  const seen = new Set();
  for (const dir of candidateRootsForSkills) {
    for (const filePath of walkSkillFiles(dir)) {
      const key = path.normalize(filePath).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      patched += patchSkillDescriptionFile(filePath, push);
    }
  }
  push(patched > 0 ? 'ok' : 'warn', 'Описаний навыков переведено: ' + patched);
  return patched;
}

function addRuRUAliasForPatchedZhDicts(code) {
  let out = code;
  let count = 0;
  let searchFrom = 0;
  const marker = '"zh-CN":Object.assign(';

  while (true) {
    const markerIndex = out.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;

    const before = out.slice(Math.max(0, markerIndex - 80), markerIndex);
    if (before.includes('"ru-RU"')) {
      searchFrom = markerIndex + marker.length;
      continue;
    }

    const exprStart = markerIndex + '"zh-CN":'.length;
    const parenStart = out.indexOf('(', exprStart);
    if (parenStart === -1) break;

    let depth = 0;
    let quote = null;
    let escaped = false;
    let exprEnd = -1;

    for (let i = parenStart; i < out.length; i++) {
      const ch = out[i];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === quote) {
          quote = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          exprEnd = i + 1;
          break;
        }
      }
    }

    if (exprEnd === -1) break;
    const afterExpr = out.slice(exprEnd, exprEnd + 120);
    if (!/^\s*,\s*"en-US"\s*:/.test(afterExpr)) {
      searchFrom = exprEnd;
      continue;
    }

    const expr = out.slice(exprStart, exprEnd);
    out = out.slice(0, exprEnd) + `,"ru-RU":${expr}` + out.slice(exprEnd);
    count++;
    searchFrom = exprEnd + expr.length + 12;
  }

  return { code: out, count };
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
                const ruLocaleObj = `Object.assign({},${zhVar},${ruObjStr})`;
                return `"zh-CN":${ruLocaleObj},"ru-RU":${ruLocaleObj},${enPart}`;
            });
            patched = true;
        }

        const repair = addRuRUAliasForPatchedZhDicts(code);
        if (repair.count > 0) {
          code = repair.code;
          dictPatchedCount += repair.count;
          patched = true;
          push('ok', 'ru-RU алиас добавлен: ' + fn + ' (' + repair.count + ')');
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
        const hardcoded = applyHardcodedPatches(code);
        const visible = applyVisibleUiPatches(hardcoded.code);
        if (hardcoded.count > 0 || visible.count > 0) {
          fs.writeFileSync(fp, visible.code, 'utf-8');
          hardcodedCount += hardcoded.count + visible.count;
          push('ok', 'Хардкод-патч: ' + fn + ' (' + (hardcoded.count + visible.count) + ')');
        }
      }
      push(hardcodedCount > 0 ? 'ok' : 'warn', 'Захардкоженных строк пропатчено: ' + hardcodedCount);

      onProgress(6, TOTAL, 'Шаг 6/7: Проверка внедрений...', 'info');

      push(dictPatchedCount > 0 ? 'ok' : 'warn', 'Словарей пропатчено: ' + dictPatchedCount);
      const pluginPatchedCount = patchGlmPackageMetadata(info.root, push);
      const skillPatchedCount = patchSkillMetadata(info.root, push);

      if (translated === 0 && dictPatchedCount === 0 && localePatchedCount === 0 && hardcodedCount === 0 && pluginPatchedCount === 0 && skillPatchedCount === 0) {
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
