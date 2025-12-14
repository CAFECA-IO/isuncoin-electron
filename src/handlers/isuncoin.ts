
import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const SERVICE_NAME = 'iSunCoin';

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
      } catch {
        return '--- ISC'; // No config or invalid
      }

      if (!address || !address.startsWith('0x')) {
        return '--- ISC';
      }

      // 2. Query Docker using iSunCoin attach
      return new Promise((resolve) => {
        // Info: (20251214 - AI) Custom logic: >3M blocks show balance, else show sync %
        const cmd = `var bn=eth.blockNumber;if(bn>3000000){web3.fromWei(eth.getBalance('${address}'),'ether')+' ISC'}else{var s=eth.syncing;var c=bn;var t=s?s.highestBlock:3000000;if(s)c=s.currentBlock;var p=Math.floor((c/t)*100);'Syncing: '+p+'%'}`;
        const process = spawn('docker', ['exec', CONTAINER_NAME, 'isuncoin', 'attach', '--exec', cmd]);
        let output = '';

        process.stdout.on('data', (data) => output += data.toString());

        process.on('close', (code) => {
          if (code !== 0) {
            resolve('--- ISC'); // Failed or service stopped
            return;
          }
          try {
            // Output parsing
            let res = output.trim();

            // Remove quotes if present
            if (res.startsWith('"') && res.endsWith('"')) {
              res = res.slice(1, -1);
            }

            if (res.startsWith('Syncing:')) {
              resolve(res);
              return;
            }

            if (res.includes('Error')) {
              resolve('--- ISC');
              return;
            }

            // Simple validation/formatting
            if (isNaN(parseFloat(res))) {
              resolve('--- ISC');
              return;
            }

            // Format to 2 decimals for display
            const num = parseFloat(res);
            resolve(`${num.toFixed(2)} ISC`);

          } catch {
            resolve('--- ISC');
          }
        });
      });

    } catch (e) {
      console.error('Balance check error:', e);
      return '--- ISC';
    }
  });

  ipc.handle('get-isuncoin-version', async () => {
    try {
      // Info: (20251214 - AI) Use local binary version check instead of docker
      const binPath = path.resolve('extra/isuncoin');

      return new Promise((resolve) => {
        // Ensure binary is executable (best effort on mac/linux)
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(binPath, '755');
          } catch { }
        }

        const proc = spawn(binPath, ['version']);
        let output = '';
        let error = '';

        proc.stdout.on('data', (data) => output += data.toString());
        proc.stderr.on('data', (data) => error += data.toString());

        proc.on('close', (code) => {
          if (code !== 0) {
            console.error('Failed to get version from local binary:', error);
            resolve('Unknown (Binary Error)');
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

        proc.on('error', (err) => {
          console.error('Local binary exec error:', err);
          resolve('Unknown (Exec Error)');
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
  } catch {
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
