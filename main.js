console.log("ChessSpy: Main Controller Loaded");

if (!window.chessSpyListenerAdded) {
  window.chessSpyListenerAdded = true;
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "start") {
      window.chessSpyConfig = { ...window.chessSpyConfig, ...msg };
      startAutoScan();
    }
    if (msg.action === "stop") { stopAutoScan(); }
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function startAutoScan() {
  const state = window.chessSpyState;
  const cfg = window.chessSpyConfig;
  state.currentScanId = 0; 
  
  const board = window.findBoardElement();
  if (!board) { alert("Board not found!"); return; }

  const scriptUrl = chrome.runtime.getURL('stockfish.js');
  
  if (!state.mainEngine) {
    try {
      const resp = await fetch(scriptUrl);
      const txt = await resp.text();
      const blob = new Blob([txt], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      
      state.mainEngine = new Worker(url);
      state.mainEngine.onmessage = (e) => {
         // Instant Update: We process every message (depth 1, 2, 3...)
         if (state.processingScanId === state.currentScanId) window.handleMainEngine(e.data);
      };
      
      state.threatEngine = new Worker(url);
      state.threatEngine.onmessage = (e) => {
         if (state.processingScanId === state.currentScanId) window.handleThreatEngine(e.data);
      };
      
    } catch (e) { alert("Engine Error: " + e.message); return; }
  }

  window.removeUI();
  window.detectUserColor();
  window.ensureUI();

  const scanBoard = () => {
    if(!document.getElementById('chess-spy-bar')) window.ensureUI();
    
    // Interrupt previous calculation immediately
    state.currentScanId++;
    state.processingScanId = state.currentScanId;

    const currentData = window.getFen(); 
    state.boardState = currentData.grid;

    if (currentData.boardString !== state.lastBoardString) {
      state.lastBoardString = currentData.boardString;
      state.activeTurn = currentData.turn; 
      
      state.tempHintActive = false;
      if (state.tempHintTimeout) clearTimeout(state.tempHintTimeout);
      state.multiPVRawScores = {};

      window.detectUserColor(); 
      window.ensureUI();
      window.clearArrows(); 
      state.activeArrows.clear();

      let lines = Math.max(cfg.lines, 4); // MultiPV 4 for Singularity

      // Main Engine (Standard Analysis)
      state.mainEngine.postMessage("stop");
      state.mainEngine.postMessage(`setoption name MultiPV value ${lines}`);
      state.mainEngine.postMessage(`position fen ${currentData.fen}`);
      state.mainEngine.postMessage(`go depth ${cfg.depth}`);

      // Threat Engine (If enabled)
      if (cfg.showThreats && state.activeTurn === state.userColor) {
        state.threatEngine.postMessage("stop");
        state.threatEngine.postMessage(`setoption name MultiPV value 2`);
        const threatFen = window.flipTurn(currentData.fen);
        state.threatEngine.postMessage(`position fen ${threatFen}`);
        state.threatEngine.postMessage(`go depth 12`); 
      }
    }
  };

  const observer = new MutationObserver(debounce(() => {
    scanBoard();
  }, 50)); 

  observer.observe(board, { childList: true, subtree: true, attributes: true });
  state.boardObserver = observer;
  scanBoard(); 
  console.log("ChessSpy Started (Clean Mode)");
}

function stopAutoScan() {
  const state = window.chessSpyState;
  if (state.boardObserver) { state.boardObserver.disconnect(); state.boardObserver = null; }
  if (state.mainEngine) state.mainEngine.terminate();
  if (state.threatEngine) state.threatEngine.terminate();
  state.mainEngine = null; state.threatEngine = null;
  window.removeUI();
}