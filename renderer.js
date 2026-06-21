const pathInput = document.getElementById('pathInput');
const browseBtn = document.getElementById('browseBtn');
const detectBtn = document.getElementById('detectBtn');
const patchBtn = document.getElementById('patchBtn');
const restoreBtn = document.getElementById('restoreBtn');
const statusBadge = document.getElementById('statusBadge');
const logContainer = document.getElementById('logContainer');
const logEl = document.getElementById('log');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

let asarSource = '';
let checkTimer = null;

function currentPath() { return pathInput.value.trim(); }
function setStatus(t, c) { statusBadge.textContent = t; statusBadge.className = 'badge ' + (c || ''); }
function addLog(m, t) {
  logContainer.classList.remove('hidden');
  const l = document.createElement('div');
  l.className = 'log-line log-' + t;
  l.textContent = m;
  logEl.appendChild(l);
  logContainer.scrollTop = logEl.scrollHeight;
}
function clearLog() { logEl.innerHTML = ''; logContainer.classList.add('hidden'); }

// Индикатор прогресса
window.api.onProgress(d => {
  progressSection.classList.remove('hidden');
  const pct = Math.round((d.step / d.total) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = d.step + '/' + d.total + ' — ' + d.msg;
  if (d.type === 'success') progressFill.style.background = 'linear-gradient(90deg, #22c55e, #34d399)';
  if (d.type === 'error') progressFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
});

// Проверка указанной папки
async function checkPath() {
  const dir = currentPath();
  setStatus('Проверка...');
  patchBtn.disabled = true;
  restoreBtn.disabled = true;
  if (!dir) { setStatus('Путь не указан', 'err'); return; }
  try {
    const r = await window.api.checkZcode(dir);
    if (!r.exists) {
      setStatus('app.asar не найден: ' + r.path, 'err');
      return;
    }
    setStatus(r.hasBackup ? 'ZCode найден (есть бэкап)' : 'ZCode найден', r.hasBackup ? 'warn' : 'ok');
    patchBtn.disabled = false;
    restoreBtn.classList.remove('hidden');
    restoreBtn.disabled = !r.hasBackup;
  } catch (e) {
    setStatus('Ошибка: ' + e.message, 'err');
  }
}

// Ручной ввод пути — перепроверка с задержкой
pathInput.addEventListener('input', () => {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(checkPath, 400);
});

browseBtn.addEventListener('click', async () => {
  const d = await window.api.selectDirectory();
  if (d) { pathInput.value = d; clearLog(); checkPath(); }
});

detectBtn.addEventListener('click', async () => {
  setStatus('Поиск установки...');
  const d = await window.api.detectZcode();
  if (d) { pathInput.value = d; clearLog(); checkPath(); }
  else setStatus('ZCode не найден автоматически', 'err');
});

patchBtn.addEventListener('click', async () => {
  patchBtn.disabled = true;
  restoreBtn.disabled = true;
  clearLog();
  progressSection.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressFill.style.background = 'linear-gradient(90deg, #3b82f6, #8b5cf6)';
  progressText.textContent = '0/6 — Запуск...';
  addLog('Запуск патча...', 'info');
  try {
    const r = await window.api.patchZcode(currentPath(), asarSource || undefined);
    for (const e of r.log) addLog(e.msg, e.type);
    setStatus(r.success ? 'Готово! Перезапустите ZCode' : 'Ошибка', r.success ? 'ok' : 'err');
  } catch (e) {
    addLog('Критическая ошибка: ' + e.message, 'error');
    setStatus('Ошибка', 'err');
  }
  checkPath();
});

restoreBtn.addEventListener('click', async () => {
  restoreBtn.disabled = true;
  clearLog();
  progressSection.classList.add('hidden');
  addLog('Откат...', 'info');
  try {
    const r = await window.api.restoreZcode(currentPath());
    addLog(r.msg, r.success ? 'ok' : 'error');
    setStatus(r.success ? 'Откат выполнен' : 'Ошибка', r.success ? 'ok' : 'err');
  } catch (e) {
    addLog('Ошибка: ' + e.message, 'error');
    setStatus('Ошибка', 'err');
  }
  checkPath();
});

// Автоопределение папки при запуске
(async () => {
  const d = await window.api.detectZcode();
  if (d) { pathInput.value = d; checkPath(); }
  else setStatus('Укажите папку ZCode');
})();

// ============================================================
// Миниплеер: Tokyo Drift — Leostrange
// ============================================================
const bgAudio = document.getElementById('bgAudio');
const playBtn = document.getElementById('playBtn');
const muteBtn = document.getElementById('muteBtn');
const volSlider = document.getElementById('volSlider');

let isPlaying = false;
let isMuted = false;

bgAudio.volume = 0.5;

function setPlaying(v) {
  isPlaying = v;
  playBtn.classList.toggle('playing', v);
}

// Play / Pause
playBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // не всплывает к автозапуску
  if (isPlaying) {
    bgAudio.pause();
    setPlaying(false);
  } else {
    const p = bgAudio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      setPlaying(true);
    }
  }
});

// Mute
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  isMuted = !isMuted;
  bgAudio.muted = isMuted;
  muteBtn.classList.toggle('muted', isMuted);
});

// Громкость
volSlider.addEventListener('input', (e) => {
  e.stopPropagation();
  const v = e.target.value / 100;
  bgAudio.volume = v;
  if (v === 0) { isMuted = true; bgAudio.muted = true; muteBtn.classList.add('muted'); }
  else if (isMuted) { isMuted = false; bgAudio.muted = false; muteBtn.classList.remove('muted'); }
});

// Синхронизация состояния кнопки с реальным состоянием аудио
bgAudio.addEventListener('pause', () => setPlaying(false));
bgAudio.addEventListener('play', () => setPlaying(true));

// Автозапуск при первом взаимодействии вне плеера (обход autoplay-policy)
let autoplayDone = false;
function tryAutoplay() {
  if (autoplayDone || isPlaying) return;
  autoplayDone = true;
  const p = bgAudio.play();
  if (p && typeof p.then === 'function') {
    p.then(() => setPlaying(true)).catch(() => { autoplayDone = false; });
  }
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.player')) return; // клики внутри плеера не запускают автозапуск
  tryAutoplay();
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('.player')) return;
  tryAutoplay();
});
