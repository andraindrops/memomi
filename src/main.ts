import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import Database from 'better-sqlite3';
import started from 'electron-squirrel-startup';
import { createDb, setDb } from '@/main/db';
import { migrate } from '@/main/migrate';
import { registerIpc } from '@/main/ipc';
import { registerImageProtocol, registerImageScheme } from '@/main/protocol';
import { setUploadsDir } from '@/main/services/images';

if (started) {
  app.quit();
}

registerImageScheme();

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

async function bootstrap(): Promise<void> {
  const uploadsDir = path.join(app.getPath('userData'), 'uploads');
  setUploadsDir(uploadsDir);
  registerImageProtocol(uploadsDir);

  const database = new Database(path.join(app.getPath('userData'), 'app.db'));
  const db = createDb(database);
  setDb(db);
  await migrate(db);

  registerIpc();
  createWindow();
}

app.on('ready', () => {
  void bootstrap();
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
