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
  getStatsHistory: () => ipcRenderer.invoke('get-stats-history')
});
