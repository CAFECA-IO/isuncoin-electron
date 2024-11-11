const { ipcRenderer } = require('electron');

function startMining() {
  const messageElement = document.getElementById('message');
  const address = document.getElementById('address').value;
  if (!isValidEthereumAddress(address)) {
    messageElement.textContent = '請輸入有效的陽光幣地址 (如: 0xCAFECA05eB2686e2D7e78449F35d8F6D2Faee174)';
    return;
  }

  messageElement.textContent = ''; // 清空錯誤訊息

  ipcRenderer.send('start-mining', address);
}

function writeToLog(message) {
  const logTextarea = document.getElementById('log');
  logTextarea.value += message + '\n';
  logTextarea.scrollTop = logTextarea.scrollHeight; // 自動捲動到最後一行
}

function isValidEthereumAddress(address) {
  return /^(0x)?[0-9a-fA-F]{40}$/.test(address);
}


// main process
ipcRenderer.on('isuncoin-config', (event, config) => {
  const data = JSON.parse(config);
  const address = data.address;
  const version = data.version;

  document.getElementById('version').textContent = version;
  if(isValidEthereumAddress(address)) {
    document.getElementById('address').value = address;
  }
});

ipcRenderer.on('isuncoin-stdout', (event, data) => {
  writeToLog(data);
});

ipcRenderer.on('isuncoin-stderr', (event, data) => {
  writeToLog(data);
});

ipcRenderer.on('message', (event, data) => {
  document.getElementById('message').textContent = data;
});

ipcRenderer.on('balance', (event, data) => {
  document.getElementById('balance').textContent = data;
});

ipcRenderer.on('computing-power', (event, data) => {
  document.getElementById('computing-power').textContent = data;
});

ipcRenderer.on('isuncoin-close', (event, code) => {
  // writeToLog(`iSunCoin 意外關閉: ${code}`);
});

ipcRenderer.send('initialize');
