
import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const SERVICE_NAME = 'iSunCoin';
const DOCKER_IMAGE_NAME = 'isuncoin'; // Lowercase for docker tag
const CONTAINER_NAME = 'iSunCoin'; // Name of container matches service name usually

export const registerIsuncoinHandlers = (ipc: typeof ipcMain, servicesPath: string) => {

  ipc.handle('get-isuncoin-balance', async () => {
    try {
      // 1. Get Config for Address
      const configPath = path.join(servicesPath, SERVICE_NAME, 'config.json');
      let address = '';
      try {
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
        address = config.address;
      } catch (e) {
        return '0.00 ISC'; // No config or invalid
      }

      if (!address || !address.startsWith('0x')) {
        return '0.00 ISC';
      }

      // 2. Query Docker using iSunCoin attach
      return new Promise((resolve) => {
        // Info: (20251214 - AI) Check block height > 3M before showing balance
        const cmd = `if (eth.blockNumber > 3000000) { web3.fromWei(eth.getBalance('${address}'), 'ether') } else { "Syncing" }`;
        const process = spawn('docker', ['exec', CONTAINER_NAME, 'isuncoin', 'attach', '--exec', cmd]);
        let output = '';

        process.stdout.on('data', (data) => output += data.toString());

        process.on('close', (code) => {
          if (code !== 0) {
            resolve('0.00 ISC'); // Failed or service stopped
            return;
          }
          try {
            // Output parsing
            let res = output.trim();
            // Remove quotes if present
            if (res.startsWith('"') && res.endsWith('"')) {
              res = res.slice(1, -1);
            }

            if (res === 'Syncing') {
              resolve('Syncing...');
              return;
            }

            if (res.includes('Error')) {
              resolve('0.00 ISC');
              return;
            }

            // Simple validation/formatting
            if (isNaN(parseFloat(res))) {
              resolve('0.00 ISC');
              return;
            }

            // Format to 2 decimals for display
            const num = parseFloat(res);
            resolve(`${num.toFixed(2)} ISC`);

          } catch (e) {
            resolve('0.00 ISC');
          }
        });
      });

    } catch (e) {
      console.error('Balance check error:', e);
      return '0.00 ISC';
    }
  });

  ipc.handle('get-isuncoin-version', async () => {
    try {
      // Info: Exec into docker container 'iSunCoin'
      return new Promise((resolve) => {
        const process = spawn('docker', ['exec', CONTAINER_NAME, 'isuncoin', 'version']);
        let output = '';
        let error = '';

        process.stdout.on('data', (data) => output += data.toString());
        process.stderr.on('data', (data) => error += data.toString());

        process.on('close', (code) => {
          if (code !== 0) {
            console.error('Failed to get version from docker:', error);
            resolve('Unknown (Service Stopped)');
            return;
          }
          // Info: Extract "Version: 1.12.3-stable" -> "v1.12.3-stable"
          const stdout = output.trim();
          const versionLine = stdout.split('\n').find(line => line.startsWith('Version:'));
          if (versionLine) {
            const version = versionLine.split(':')[1]?.trim();
            if (version) {
              resolve(`v${version}`);
              return;
            }
          }
          resolve(stdout || 'Unknown');
        });

        process.on('error', (err) => {
          console.error('Docker exec error:', err);
          resolve('Unknown (Error)');
        });
      });
    } catch (e) {
      console.error('Version check error:', e);
      return 'Error';
    }
  });
};

export const getIsuncoinRunArgs = async (servicesPath: string): Promise<string[]> => {
  try {
    const configPath = path.join(servicesPath, SERVICE_NAME, 'config.json');
    const content = await fs.promises.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);

    const args = ['isuncoin']; // Entrypoint replacement

    if (config.address && config.address.startsWith('0x')) {
      args.push(`--miner.etherbase=${config.address}`);
      args.push('--exec', 'miner.start()');
    }

    if (config.performance) {
      let threads = 5; // Default medium
      if (config.performance === 'low') threads = 1;
      else if (config.performance === 'high') threads = 10;

      args.push(`--miner.threads=${threads}`);
      args.push('--mine');
    }

    console.log(`[iSunCoin Handler] Run args: ${args.join(' ')}`);
    return args;
  } catch (e) {
    console.warn('Failed to read config for run args, using default CMD');
    return [];
  }
};

export const configureIsuncoinPostStart = async (servicesPath: string) => {
  try {
    const configPath = path.join(servicesPath, SERVICE_NAME, 'config.json');
    const content = await fs.promises.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);

    if (config.address && config.address.startsWith('0x')) {
      console.log(`[iSunCoin Handler] Setting miner etherbase to ${config.address}...`);
      spawn('docker', ['exec', CONTAINER_NAME, 'isuncoin', 'attach', '--exec', `miner.setEtherbase('${config.address}')`]);
    }
  } catch (e) {
    console.error('Failed to apply post-start config:', e);
  }
};
