export interface ISystemStats {
  cpu: number;
  ram: number;
  gpu: number;
  disk: number;
  networkRx: number;
  networkTx: number;
  timestamp: number;
}

export interface IDockerContainer {
  id: string;
  image: string;
  names: string;
  status: string;
  ports: string;
}

export interface IElectronAPI {
  getFlops: () => Promise<{ success: boolean; data?: string; error?: string }>;
  checkDocker: () => Promise<boolean>;
  getSystemStats: () => Promise<ISystemStats | null>;
  getStatsHistory: () => Promise<ISystemStats[]>;
  getDockerContainers: () => Promise<IDockerContainer[]>;
  getDefinedServices: () => Promise<string[]>;
  dockerStart: (id: string) => Promise<boolean>;
  dockerStop: (id: string) => Promise<boolean>;
  dockerDeploy: (name: string) => Promise<{ success: boolean; error?: string }>;
  getIsuncoinVersion: () => Promise<string>;
  getServiceConfig: (serviceName: string) => Promise<Record<string, unknown>>;
  saveServiceConfig: (serviceName: string, config: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  getServiceBalance: () => Promise<string>;
  quitApp: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDebugLog: (callback: (data: any) => void) => void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    electronAPI: IElectronAPI;
  }
}
