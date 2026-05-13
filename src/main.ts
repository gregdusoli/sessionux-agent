import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fork, ChildProcess } from 'node:child_process';
import os from 'node:os';

let mainWindow: BrowserWindow | null = null;
let pairingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;

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

  serverProcess.on('message', (msg: any) => {
    if (msg.type === 'pairing-token-generated') {
      pairingWindow?.webContents.send('pairing-data', { 
        payload: msg.payload, 
        expiresAt: Date.now() + 2 * 60 * 1000 
      });
    }
    if (msg.type === 'pairing-success') {
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
      nodeIntegration: true,
      contextIsolation: false,
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
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  pairingWindow.loadFile(path.join(process.cwd(), 'pairing.html'));

  pairingWindow.webContents.on('did-finish-load', () => {
    // Request server to generate pairing token
    const ip = getLocalIp();
    serverProcess?.send({ type: 'generate-pairing-token', ip });
  });

  pairingWindow.on('closed', () => {
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
  pairingWindow?.close();
});

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
