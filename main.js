const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const { start } = require('repl');
const axios = require('axios');
const { clear } = require('console');

let mainWindow;
let isuncoinProcess;
let isuncoinInterval;
let isMining = false;
let tryMining = false;
let etherbase;
const homeDir = app.getPath('home');
const isuncoinPath = path.join(__dirname, '/../extra/', 'isuncoin');
const datadir = path.join(homeDir, 'isuncoin-miner');

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    stopIsuncoin();
    mainWindow = null;
    app.quit();
  });  
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopIsuncoin();
  mainWindow = null;
  app.quit();
});

ipcMain.on('initialize', async (event) => {
  isuncoinProcess = await initialIsuncoin();
});

ipcMain.on('start-mining', async (event, address) => {
  // check if isuncoinProcess is running
  etherbase = address;
  await setEtherbase(etherbase);
  await startMining();
});


/** iSunCoin command */
const initialIsuncoin = async () => {
  // console.log('initialIsuncoin');
  const process = await startIsuncoin();
  const config = await loadConfig();
  mainWindow?.webContents.send('isuncoin-config', JSON.stringify(config));
  mainWindow?.webContents.send('message', '初始化完成，請設定錢包地址並點擊「開始挖礦」按鈕開始挖礦');

  await updateBalance();

  return process;
}

const startIsuncoin = async () => {
  // console.log('startIsuncoin');
  const command = `${isuncoinPath} --datadir ${datadir}`;
  if (!isuncoinProcess) {
    isuncoinProcess = spawn(command, [], { shell: true });
    
    isuncoinProcess.stdout.on('data', (data) => {
      const rawData = data.toString();
      mainWindow?.webContents.send('isuncoin-stdout', rawData);
    });
  
    isuncoinProcess.stderr.on('data', (data) => {
      const rawData = data.toString();
      mainWindow?.webContents.send('isuncoin-stderr', rawData);
    });
  
    isuncoinProcess.on('close', (code) => {
      // mainWindow?.webContents.send('isuncoin-close', code);
    });
    ensureSync();
  }
  // wait 2 seconds for isuncoin to start
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return isuncoinProcess;
}

const setEtherbase = async (address) => {
  // console.log('setEtherbase');
  const config = { address };
  await saveConfig(config);
  const command = `${isuncoinPath} --datadir ${datadir} attach --exec "miner.setEtherbase('${address}')"`;
  await promiseCommand(command);
}

const stopIsuncoin = async () => {
  // console.log('stopIsuncoin');
  try {
    clearInterval(isuncoinInterval);
  } catch (error) {}

  if (isuncoinProcess) {
    isuncoinProcess.kill();
    isuncoinProcess = null;
  }
}

const startMining = async () => {
  // console.log('startMining');
  tryMining = true;
  if (!isMining) {
    const command = `${isuncoinPath} --datadir ${datadir} attach --exec "miner.start()"`;
    await promiseCommand(command);
    isMining = true;
  }
  mainWindow?.webContents.send('message', '挖礦中');
}

const tryStartMining = async () => {
  // console.log('tryStartMining');
  if (tryMining) {
    const isSyncing = await getSyncing();
    if (!isSyncing && !isMining) {
      const command = `${isuncoinPath} --datadir ${datadir} attach --exec "miner.start()"`;
      await promiseCommand(command);
      isMining = true;
    }
  }
}

const stopMining = async () => {
  // console.log('stopMining');
  if (isMining) {
    const command = `${isuncoinPath} --datadir ${datadir} attach --exec "miner.stop()"`;
    await promiseCommand(command);
    isMining = false;
  }
  mainWindow?.webContents.send('message', '挖礦已終止，請點擊「開始挖礦」按鈕重新開始');
}

const ensureSync = async () => {
  // console.log('ensureSync');
  try {
    clearInterval(isuncoinInterval);
  } catch (error) {}

  isuncoinInterval = setInterval(coordinate, 10000);
  return isuncoinInterval;
}

const coordinate = async () => {
  // console.log('coordinate');
  let keepGo = true;
  let requireReset = false;

  try {
    await updateBalance();
  } catch (error) {}

  // if connect peer = 0
  if (keepGo) {
    try {
      const peerCount = await getPeerCount();
      if(peerCount > 0) {
        // node is syncing
        // console.log('node is syncing', peerCount);
      } else {
        requireReset = true;
        keepGo = false;
      }
    } catch (error) {
      keepGo = false;
    }
  }

  // if local target block hash is not equal to remote target block hash
  if (keepGo) {
    try {
      const result = await compareBlockHash();
      if (!result) {
        keepGo = false;
        requireReset = true;
      }
    } catch (error) {
      keepGo = false;
    }
  }

  if(requireReset) {
    await reset();
  } else {
    await tryStartMining();
  }
}

const reset = async () => {
  // console.log('reset');
  // delete all chain data
  const isMiningNow = isMining;
  await stopMining();
  await stopIsuncoin();
  await resetFolder();
  await startIsuncoin();
  await setEtherbase(etherbase);
  if (isMiningNow) {
    await startMining();
  }
}

const resetFolder = async () => {
  // console.log('resetFolder');
  mainWindow?.webContents.send('message', '重新同步區塊鏈');
  const chaindata = path.join(datadir, 'iSunCoin', 'chaindata');
  const ethash = path.join(datadir, 'iSunCoin', 'ethash');
  const jwtsecret = path.join(datadir, 'iSunCoin', 'jwtsecret');
  const LOCK = path.join(datadir, 'iSunCoin', 'LOCK');
  const transactions = path.join(datadir, 'iSunCoin', 'transactions.rlp');
  const triecache = path.join(datadir, 'iSunCoin', 'triecache');
  try {
    fs.rmSync(chaindata, {
      recursive: true,
    });
  } catch (error) {}
  try {
    fs.rmSync(ethash, {
      recursive: true,
    });
  } catch (error) {}
  try {
    fs.rmSync(jwtsecret, {
      recursive: true,
    });
  } catch (error) {}
  try {
    fs.unlinkSync(LOCK);
  } catch (error) {}
  try {
    fs.unlinkSync(transactions);
  } catch (error) {}
  try {
    fs.rmSync(triecache, {
      recursive: true,
    });
  } catch (error) {}
}

const getPeerCount = async () => {
  // console.log('getPeerCount');
  // return peer count
  const command = `${isuncoinPath} --datadir ${datadir} attach --exec "net.peerCount"`;
  const peerCountRaw = await promiseCommand(command);
  const peerCount = peerCountRaw ?
    parseInt(peerCountRaw) :
    peerCountRaw;
  return peerCount;
}

const getBlockNumber = async () => {
  // console.log('getBlockNumber');
  // return block number
  const command = `${isuncoinPath} --datadir ${datadir} attach --exec "eth.blockNumber"`;
  const blockNumberRaw = await promiseCommand(command);
  const blockNumber = parseInt(blockNumberRaw) || 0;
  return blockNumber;
}

const getSyncing = async () => {
  // console.log('getSyncing');
  // return syncing status
  const command = `${isuncoinPath} --datadir ${datadir} attach --exec "eth.syncing"`;
  const syncingRaw = await promiseCommand(command);
  // raw data example: {"currentBlock":"0x1","highestBlock":"0x1","knownStates":"0x0","pulledStates":"0x0"} or false
  const syncing = syncingRaw === 'false' ?
    false :
    true;
  return syncing;
}

const getBlockHashByNumber = async (number) => {
  // console.log('getBlockHashByNumber');
  // return block hash
  const command = `${isuncoinPath} --datadir ${datadir} attach --exec "eth.getBlock(${number}).hash"`;
  const blockHashRaw = await promiseCommand(command);
  // raw data example: "0x2aea437b3bfec47c65fffac71428e23d7df5d22732dcea293ab9fb22db661ec8\n"
  const blockHash = blockHashRaw.replace(/\n/g, '').replace(/"/g, '');
  return blockHash;
}

const getRemoteBlockHashByNumber = async (number) => {
  // console.log('getRemoteBlockHashByNumber');
  // request geth json rpc https://isuncoin.baifa.io
  // return block hash
  const method = 'eth_getBlockByNumber';
  const hexNumber = '0x' + number.toString(16);
  const params = [hexNumber, false];
  const result = await requestIsunCoinAPI(method, params);
  /* result example
    {
      "jsonrpc": "2.0",
      "id": 1,
      "result": {
          "baseFeePerGas": "0x7",
          "difficulty": "0xce343",
          "extraData": "0xd883010b06846765746888676f312e32312e30856c696e7578",
          "gasLimit": "0x2521c4a",
          "gasUsed": "0x0",
          "hash": "0x2aea437b3bfec47c65fffac71428e23d7df5d22732dcea293ab9fb22db661ec8",
          "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
          "miner": "0xcafeca05eb2686e2d7e78449f35d8f6d2faee174",
          "mixHash": "0x2c3536bee464261db7dcbc523a853b87cdf6e44997ab5c32f52f8ce06a1e5694",
          "nonce": "0x1d04ae2f94d892eb",
          "number": "0x100",
          "parentHash": "0xe405f0e0a9a50ea783402c0c343d64b43dd36674f569b5f6c41aa418682b9628",
          "receiptsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
          "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
          "size": "0x21c",
          "stateRoot": "0xc2aac06615ee52ceb0e165a7498e8fdc8477c12e2f11343db4adeed81ce58e72",
          "timestamp": "0x668660fb",
          "totalDifficulty": "0xc767b74",
          "transactions": [],
          "transactionsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
          "uncles": []
      }
    }
   */
  const blockHash = result.result.hash;
  return blockHash;
}

const compareBlockHash = async () => {
  // console.log('compareBlockHash');
  // return local target block hash and remote target block hash
  let keepGo = true;
  let result = true;
  const localBlockNumber = await getBlockNumber();
  const targetBlockNumber = localBlockNumber - 10;
  keepGo = targetBlockNumber > 0;
  if (keepGo) {
    const localBlockHash = await getBlockHashByNumber(targetBlockNumber);
    const remoteBlockHash = await getRemoteBlockHashByNumber(targetBlockNumber);
    result = localBlockHash === remoteBlockHash;
    // console.log(targetBlockNumber, localBlockHash, remoteBlockHash, result);
  } else {
    // syncing, no need to compare
  }
  return result;
}

const updateBalance = async () => {
  // console.log('updateBalance');
  const balance = await getBalance();
  mainWindow?.webContents.send('balance', balance);
}

const getBalance = async () => {
  // console.log('getBalance from remote node');
  // request geth json rpc https://isuncoin.baifa.io
  // return balance
  const method = 'eth_getBalance';
  const params = [etherbase, 'latest'];
  const result = await requestIsunCoinAPI(method, params);
  const bn = BigInt(result.result);
  const bns = bn.toString(10);
  let balance = '0';
  if(bns.length > 18) {
    balance = bns.slice(0, bns.length - 18) + '.' + bns.slice(bns.length - 18);
  } else {
    balance = '0.' + '0'.repeat(18 - bns.length) + bns;
  }
  return balance;
}

const promiseCommand = async (command) => {
  // console.log('promiseCommand', command);
  const result = new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      // console.log(stdout);
      if (error) {
        // console.log(stderr);
      }
      resolve(stdout);
    });
  });
  return result;
}

const requestIsunCoinAPI = async (method, params) => {
  // console.log('requestIsunCoinAPI');
  // random id with number 10000000 to 99999999
  const url = 'https://isuncoin.baifa.io';
  const id = Math.floor(Math.random() * 90000000) + 10000000;

  const data = {
    jsonrpc: '2.0',
    method,
    params,
    id
  };

  const response = await axios.post(url, data);
  const result = response.data;
  return result;
}

const saveConfig = async (config) => {
  const configPath = path.join(datadir, 'iSunCoin', 'config.json');
  const rawConfig = JSON.stringify(config, null, 2);
  fs.writeFileSync(configPath, rawConfig);
}

const loadConfig = async () => {
  const configPath = path.join(datadir, 'iSunCoin', 'config.json');
  let result = {};
  try {
    const rawConfig = fs.readFileSync(configPath);
    result = JSON.parse(rawConfig);
    const { address } = result;
    if (address) {
      etherbase = address;
    }
  } catch (error) {}
  return result;
}