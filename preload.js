import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sessionux', {
  startPairing: () => ipcRenderer.send('start-pairing'),
  cancelPairing: () => ipcRenderer.send('pairing-cancelled'),
  getDevices: () => ipcRenderer.invoke('devices:list'),
  removeDevice: (deviceId) => ipcRenderer.invoke('devices:remove', deviceId),
  onPairingData: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('pairing-data', listener);
    return () => ipcRenderer.removeListener('pairing-data', listener);
  },
});
