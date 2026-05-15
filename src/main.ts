import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fork, ChildProcess } from 'node:child_process';
import os from 'node:os';
import QRCode from 'qrcode';

let mainWindow: BrowserWindow | null = null;
let pairingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;
let currentPairingToken: string | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function startServer() {
  const serverPath = isDev
    ? path.join(process.cwd(), 'src', 'server', 'index.ts')
    : path.join(app.getAppPath(), 'dist', 'server', 'index.js');

  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: '3000' },
    execArgv: isDev ? ['--import', 'tsx'] : [],
    silent: false,
  });

  serverProcess.on('message', async (msg: any) => {
    if (msg.type === 'pairing-token-generated') {
      currentPairingToken = msg.token;
      try {
        const qrPayload = JSON.stringify(msg.payload);
        const qrOptions = {
          color: {
            dark: '#101419',
            light: '#ffffff',
          },
          margin: 0,
          width: 256,
        };
        const [qrDataUrl, qrSvg] = await Promise.all([
          QRCode.toDataURL(qrPayload, qrOptions),
          QRCode.toString(qrPayload, { ...qrOptions, type: 'svg' }),
        ]);

        console.log('Pairing QR generated');
        const pairingData = {
          payload: msg.payload,
          qrDataUrl,
          qrSvg,
          expiresAt: new Date(msg.payload.expires_at).getTime(),
        };
        pairingWindow?.webContents.send('pairing-data', pairingData);
        await pairingWindow?.webContents.executeJavaScript(
          `window.renderPairingData?.(${JSON.stringify(pairingData)})`
        );
      } catch (error) {
        console.error('Failed to generate pairing QR', error);
        pairingWindow?.webContents.send('pairing-error', {
          message: 'Failed to generate pairing QR',
        });
      }
    }
    if (msg.type === 'pairing-success') {
      currentPairingToken = null;
      pairingWindow?.close();
      // Show notification or update UI
    }
    if (msg.type === 'unlock-success') {
      // Show notification
    }
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
    if (code !== 0) {
      // Restart server if it crashed
      setTimeout(startServer, 1000);
    }
  });
}

function cancelCurrentPairingToken() {
  if (!currentPairingToken) {
    return;
  }

  serverProcess?.send({
    type: 'cancel-pairing-token',
    token: currentPairingToken,
  });
  currentPairingToken = null;
}

function createTray() {
  // Use a placeholder or a real icon if it exists
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Sessionux Agent', enabled: false },
    { type: 'separator' },
    { label: 'Parear novo dispositivo', click: () => createPairingWindow() },
    { label: 'Listar dispositivos', click: () => createMainWindow() },
    { type: 'separator' },
    { label: 'Fechar', click: () => app.quit() },
  ]);

  tray.setToolTip('Sessionux Agent');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    createMainWindow();
  });
}

function createMainWindow() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Sessionux - Dispositivos',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(process.cwd(), 'preload.js'),
    }
  });

  mainWindow.loadFile(path.join(process.cwd(), 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
    title: 'Parear Dispositivo',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(process.cwd(), 'preload.js'),
    }
  });

  pairingWindow.loadFile(path.join(process.cwd(), 'pairing.html'));

  pairingWindow.webContents.on('did-finish-load', () => {
    // Request server to generate pairing token
    const ip = getLocalIp();
    serverProcess?.send({ type: 'generate-pairing-token', ip });
  });

  pairingWindow.on('closed', () => {
    cancelCurrentPairingToken();
    pairingWindow = null;
  });
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

ipcMain.on('start-pairing', () => {
  createPairingWindow();
});

ipcMain.on('pairing-cancelled', () => {
  cancelCurrentPairingToken();
  pairingWindow?.close();
});

ipcMain.handle('devices:list', async () => {
  const response = await fetch('http://localhost:3000/devices');
  if (!response.ok) {
    throw new Error(`Failed to list devices: ${response.status}`);
  }
  return response.json();
});

ipcMain.handle('devices:remove', async (_event, deviceId: string) => {
  const response = await fetch(`http://localhost:3000/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove device: ${response.status}`);
  }
  return response.json();
});

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  startServer();
  createTray();
  // Don't show main window by default, just stay in tray
});

app.on('window-all-closed', () => {
  // Keep running in tray even if all windows are closed on Linux
  // if (process.platform !== 'darwin') {
  //   app.quit();
  // }
});

app.on('before-quit', () => {
  serverProcess?.kill();
});
