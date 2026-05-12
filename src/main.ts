import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { SetupTokenService } from './protocol/pairing.js';


let mainWindow: BrowserWindow | null = null;
let pairingWindow: BrowserWindow | null = null;
const setupTokenService = new SetupTokenService();

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.loadFile(path.join(process.cwd(), 'index.html'));
}

function createPairingWindow() {
  if (pairingWindow) {
    pairingWindow.focus();
    return;
  }

  pairingWindow = new BrowserWindow({
    width: 450,
    height: 600,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  pairingWindow.loadFile(path.join(process.cwd(), 'pairing.html'));

  const pcId = '123e4567-e89b-12d3-a456-426614174000'; // Placeholder - should be from config
  const { token, payload } = setupTokenService.generateQrPayload(pcId, '192.168.1.10', 3000);
  const expiresAt = Date.now() + 2 * 60 * 1000;

  pairingWindow.webContents.on('did-finish-load', () => {
    pairingWindow?.webContents.send('pairing-data', { payload, expiresAt });
  });

  pairingWindow.on('closed', () => {
    pairingWindow = null;
    setupTokenService.invalidate(token);
  });
}

ipcMain.on('start-pairing', () => {
  createPairingWindow();
});

ipcMain.on('pairing-cancelled', () => {
  if (pairingWindow) {
    pairingWindow.close();
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

