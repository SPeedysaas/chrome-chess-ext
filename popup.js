const themes = {
  classic: { best: "#76b852", alt: "#4db8ff", pred: "#ffa500" },
  electric: { best: "#00ffff", alt: "#bf00ff", pred: "#ffff00" },
  chesscom: { best: "#ff9f1c", alt: "#d9534f", pred: "#aaaaaa" },
  mono: { best: "#ffffff", alt: "#aaaaaa", pred: "#ffffff" }
};

document.addEventListener('DOMContentLoaded', () => {
  const defaults = { 
    barSide: 'left', arrowMode: 'both', depth: 15, 
    orientation: 'auto', showResponse: false, showHintBtn: true, showHuman: false, 
    showThreats: false, onlyAggressiveThreats: true,
    lines: 1, tacticsDepth: 3, hintDuration: 'infinite',
    colBest: '#76b852', colAlt: '#4db8ff', colPred: '#ffa500', arrowSize: 8,
    barWidth: 20, barTextPos: 'inside', barPreset: 'standard'
  };
  
  const savedRaw = JSON.parse(localStorage.getItem('chessSpySettings'));
  const saved = { ...defaults, ...savedRaw };

  document.getElementById('barSide').value = saved.barSide;
  document.getElementById('barTextPos').value = saved.barTextPos;
  document.getElementById('barWidth').value = saved.barWidth;
  document.getElementById('barPreset').value = saved.barPreset;
  document.getElementById('arrowMode').value = saved.arrowMode;
  document.getElementById('depthRange').value = saved.depth;
  document.getElementById('orientation').value = saved.orientation;
  document.getElementById('showResponse').checked = saved.showResponse;
  document.getElementById('showHintBtn').checked = saved.showHintBtn;
  document.getElementById('showHuman').checked = saved.showHuman;
  document.getElementById('showThreats').checked = saved.showThreats;
  document.getElementById('onlyAggressiveThreats').checked = saved.onlyAggressiveThreats;
  document.getElementById('hintDuration').value = saved.hintDuration;
  document.getElementById('linesCount').value = saved.lines;
  document.getElementById('tacticsDepth').value = saved.tacticsDepth;
  document.getElementById('colBest').value = saved.colBest;
  document.getElementById('colAlt').value = saved.colAlt;
  document.getElementById('colPred').value = saved.colPred;
  document.getElementById('arrowSize').value = saved.arrowSize;
  
  document.getElementById('depthVal').innerText = saved.depth;
  document.getElementById('linesVal').innerText = saved.lines;
  document.getElementById('sizeVal').innerText = saved.arrowSize + 'px';
  document.getElementById('widthVal').innerText = saved.barWidth + 'px';
  document.getElementById('tacticsVal').innerText = saved.tacticsDepth;

  const foundTheme = Object.keys(themes).find(key => 
    themes[key].best === saved.colBest && 
    themes[key].alt === saved.colAlt && 
    themes[key].pred === saved.colPred
  );
  document.getElementById('themePreset').value = foundTheme || 'custom';
});

function saveSettings() {
  const settings = {
    barSide: document.getElementById('barSide').value,
    barTextPos: document.getElementById('barTextPos').value,
    barWidth: parseInt(document.getElementById('barWidth').value),
    barPreset: document.getElementById('barPreset').value,
    arrowMode: document.getElementById('arrowMode').value,
    depth: parseInt(document.getElementById('depthRange').value),
    orientation: document.getElementById('orientation').value,
    showResponse: document.getElementById('showResponse').checked,
    showHintBtn: document.getElementById('showHintBtn').checked,
    showHuman: document.getElementById('showHuman').checked,
    showThreats: document.getElementById('showThreats').checked,
    onlyAggressiveThreats: document.getElementById('onlyAggressiveThreats').checked,
    hintDuration: document.getElementById('hintDuration').value,
    lines: parseInt(document.getElementById('linesCount').value),
    tacticsDepth: parseInt(document.getElementById('tacticsDepth').value),
    colBest: document.getElementById('colBest').value,
    colAlt: document.getElementById('colAlt').value,
    colPred: document.getElementById('colPred').value,
    arrowSize: parseInt(document.getElementById('arrowSize').value)
  };
  localStorage.setItem('chessSpySettings', JSON.stringify(settings));
  return settings;
}

document.getElementById('themePreset').addEventListener('change', function() {
  if(this.value !== 'custom') {
    const t = themes[this.value];
    document.getElementById('colBest').value = t.best;
    document.getElementById('colAlt').value = t.alt;
    document.getElementById('colPred').value = t.pred;
    saveSettings();
  }
});

const inputs = ['barSide', 'barTextPos', 'barWidth', 'barPreset', 'arrowMode', 'orientation', 'showResponse', 'showHintBtn', 'showHuman', 'showThreats', 'onlyAggressiveThreats', 'hintDuration', 'linesCount', 'tacticsDepth', 'depthRange', 'arrowSize', 'colBest', 'colAlt', 'colPred'];

inputs.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener((el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input', () => {
      if(id === 'depthRange') document.getElementById('depthVal').innerText = el.value;
      if(id === 'linesCount') document.getElementById('linesVal').innerText = el.value;
      if(id === 'arrowSize') document.getElementById('sizeVal').innerText = el.value + 'px';
      if(id === 'barWidth') document.getElementById('widthVal').innerText = el.value + 'px';
      if(id === 'tacticsDepth') document.getElementById('tacticsVal').innerText = el.value;
      if(id.startsWith('col')) document.getElementById('themePreset').value = 'custom';
      saveSettings();
    });
  }
});

document.getElementById('startBtn').addEventListener('click', async () => {
  const settings = saveSettings();
  settings.action = "start";

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({ 
    target: { tabId: tab.id }, 
    files: ['state.js', 'board.js', 'visuals.js', 'engine.js', 'main.js'] 
  }, () => {
    chrome.tabs.sendMessage(tab.id, settings);
    window.close();
  });
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "stop" });
});