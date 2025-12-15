import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getFlops: () => ipcRenderer.invoke('get-flops'),
  checkDocker: () => ipcRenderer.invoke('check-docker'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  getDockerContainers: () => ipcRenderer.invoke('get-docker-containers'),
  getDefinedServices: () => ipcRenderer.invoke('get-defined-services'),
  dockerStart: (id: string) => ipcRenderer.invoke('docker-start', id),
  dockerStop: (id: string) => ipcRenderer.invoke('docker-stop', id),
  dockerDeploy: (name: string) => ipcRenderer.invoke('docker-deploy', name),
  getIsuncoinVersion: () => ipcRenderer.invoke('get-isuncoin-version'),
  getStatsHistory: () => ipcRenderer.invoke('get-stats-history'),
  getServiceConfig: (name: string) => ipcRenderer.invoke('get-service-config', name),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveServiceConfig: (name: string, config: any) => ipcRenderer.invoke('save-service-config', name, config),
  getServiceBalance: () => ipcRenderer.invoke('get-isuncoin-balance'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDebugLog: (callback: (data: any) => void) => ipcRenderer.on('debug-log-message', (_event, value) => callback(value))
});
