export interface SystemStats {
  cpu: number;
  ram: number;
  gpu: number;
  disk: number;
  networkRx: number;
  networkTx: number;
  timestamp: number;
}

export interface DockerContainer {
  id: string;
  image: string;
  names: string;
  status: string;
  ports: string;
}

export interface ElectronAPI {
  getFlops: () => Promise<{ success: boolean; data?: string; error?: string }>;
  checkDocker: () => Promise<boolean>;
  getSystemStats: () => Promise<SystemStats | null>;
  getStatsHistory: () => Promise<SystemStats[]>;
  getDockerContainers: () => Promise<DockerContainer[]>;
  getDefinedServices: () => Promise<string[]>;
  dockerStart: (id: string) => Promise<boolean>;
  dockerStop: (id: string) => Promise<boolean>;
  dockerDeploy: (name: string) => Promise<{ success: boolean; error?: string }>;
  getIsuncoinVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
