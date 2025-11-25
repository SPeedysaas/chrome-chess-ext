console.log("ChessSpy: State Loaded");

window.chessSpyConfig = window.chessSpyConfig || {
  depth: 15, lines: 1, arrowMode: 'both', orientation: 'auto',
  showResponse: false, showHintBtn: true, showHuman: false, showThreats: false,
  onlyAggressiveThreats: true, tacticsDepth: 3, hintDuration: 'infinite', 
  colBest: '#76b852', colAlt: '#4db8ff', colPred: '#ffa500',
  arrowSize: 8, barSide: 'left', barWidth: 20, barTextPos: 'inside', barPreset: 'standard'
};

window.chessSpyState = {
  mainEngine: null,
  threatEngine: null,
  boardObserver: null,
  currentScanId: 0,
  processingScanId: 0,
  lastBoardString: "",
  activeTurn: 'w',
  userColor: 'w',
  boardState: [],
  lastBestMove: "",
  tempHintActive: false,
  tempHintTimeout: null,
  activeArrows: new Map(),
  multiPVRawScores: {},
  threatPVRawScores: {}
};