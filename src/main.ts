import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpc } from '@/main/ipc';
import { buildApplicationMenu } from '@/main/menu';
import { openDefaultBundle } from '@/main/services/domain/bundle';
import {
  RENDERER_INDEX_URL,
  RENDERER_ORIGIN,
  startRendererServer,
} from '@/main/renderer-server';

if (started) {
  app.quit();
}

app.commandLine.appendSwitch('use-mock-keychain');

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const appOrigin = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
    : RENDERER_ORIGIN;

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== appOrigin) {
      event.preventDefault();
      console.warn(`[nav] blocked cross-origin navigation to ${url}`);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL == null) {
    mainWindow.loadURL(RENDERER_INDEX_URL);
  } else {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }

  buildApplicationMenu();
};

app.on('ready', async () => {
  registerIpc();
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL == null) {
    try {
      await startRendererServer({
        rendererDir: path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`),
      });
    } catch (error) {
      dialog.showErrorBox(
        'Failed to start',
        `Could not start the local renderer server (port may be in use).\n\n${String(error)}`,
      );
      app.quit();
      return;
    }
  }
  await openDefaultBundle();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
