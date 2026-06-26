const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const core = require('./patch-core');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 380,
    resizable: false,
    maximizable: false,
    minimizable: false,
    title: 'ZCode Русификатор v6.3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

function sendProgress(step, total, msg, type) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('progress', { step, total, msg, type });
  }
}

// Auto-detect the install folder so the user usually does not have to browse.
ipcMain.handle('detect-dir', async () => core.detectZcodeDir());

ipcMain.handle('select-directory', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите папку с ZCode (корень установки)',
    properties: ['openDirectory'],
    defaultPath: core.detectZcodeDir() || app.getPath('home'),
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('select-asar', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите app.asar (необязательно)',
    properties: ['openFile'],
    filters: [{ name: 'ASAR', extensions: ['asar'] }],
  });
  return res.canceled ? null : res.filePaths[0];
});

// Accepts any folder the user typed OR selected; core normalizes it.
ipcMain.handle('check-zcode', async (e, dir) => core.checkZcode(dir));

ipcMain.handle('patch-zcode', async (e, dir, asarSource) => {
  return core.patch(dir, {
    asarSource: asarSource || undefined,
    onProgress: sendProgress,
  });
});

ipcMain.handle('restore-zcode', async (e, dir) => core.restore(dir));
