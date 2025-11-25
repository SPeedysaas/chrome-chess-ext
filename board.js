console.log("ChessSpy: Board Module Loaded");

window.findBoardElement = function() {
  return document.querySelector('wc-chess-board') || 
         document.querySelector('chess-board') || 
         document.querySelector('#board-layout-chessboard') || 
         document.querySelector('.board') || 
         document.querySelector('div[class^="board-"]');
};

window.flipTurn = function(fen) {
  let parts = fen.split(' ');
  parts[1] = (parts[1] === 'w') ? 'b' : 'w';
  parts[3] = '-'; 
  return parts.join(' ');
};

window.getPieceAt = function(sq) {
  const state = window.chessSpyState;
  if (!state.boardState || state.boardState.length === 0) return null;
  const fileMap = { a:0, b:1, c:2, d:3, e:4, f:5, g:6, h:7 };
  const c = fileMap[sq[0]];
  const r = parseInt(sq[1]) - 1; 
  const boardRow = 7 - r;
  if (state.boardState[boardRow]) return state.boardState[boardRow][c];
  return null;
};
window.isSquareOccupied = function(sq) { return window.getPieceAt(sq) !== null; };
window.detectUserColor = function() {
  const cfg = window.chessSpyConfig;
  const state = window.chessSpyState;
  if (cfg.orientation === 'white') { state.userColor = 'w'; return; }
  if (cfg.orientation === 'black') { state.userColor = 'b'; return; }
  const board = window.findBoardElement();
  if (!board) return;
  if (board.classList.contains('flipped')) { state.userColor = 'b'; return; }
  const coords = Array.from(document.querySelectorAll('text, .coordinate-light, .coordinate-dark'));
  const rank1 = coords.find(el => el.textContent.trim() === '1');
  if (rank1) {
    const r1 = rank1.getBoundingClientRect();
    const rBoard = board.getBoundingClientRect();
    if (r1.top < rBoard.top + (rBoard.height / 2)) { state.userColor = 'b'; return; }
  }
  state.userColor = 'w';
};
window.getMathCoords = function(fromSq, toSq, boardEl) {
  const state = window.chessSpyState;
  const rect = boardEl.getBoundingClientRect();
  const sqW = rect.width / 8;
  const sqH = rect.height / 8;
  const fileMap = { a:0, b:1, c:2, d:3, e:4, f:5, g:6, h:7 };
  let f1 = fileMap[fromSq[0]]; let r1 = parseInt(fromSq[1]) - 1; 
  let f2 = fileMap[toSq[0]]; let r2 = parseInt(toSq[1]) - 1;
  if (state.userColor === 'b') { f1 = 7 - f1; f2 = 7 - f2; } else { r1 = 7 - r1; r2 = 7 - r2; }
  return { x1: (f1 * sqW) + (sqW / 2), y1: (r1 * sqH) + (sqH / 2), x2: (f2 * sqW) + (sqW / 2), y2: (r2 * sqH) + (sqH / 2) };
};

window.getFen = function() {
  const pieceMap = { 'wp': 'P', 'wr': 'R', 'wn': 'N', 'wb': 'B', 'wq': 'Q', 'wk': 'K', 'bp': 'p', 'br': 'r', 'bn': 'n', 'bb': 'b', 'bq': 'q', 'bk': 'k' };
  let board = Array(8).fill(null).map(() => Array(8).fill(null));
  const elements = document.querySelectorAll('.piece');
  elements.forEach(el => {
    const cls = el.className;
    const pos = cls.match(/square-(\d)(\d)/);
    const type = cls.match(/(w|b)(p|r|n|b|q|k)/);
    if (pos && type) board[7 - (parseInt(pos[2]) - 1)][parseInt(pos[1]) - 1] = pieceMap[type[0]];
  });
  let rows = [];
  for (let r = 0; r < 8; r++) {
    let s = "", e = 0;
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === null) e++; else { if (e) { s += e; e = 0; } s += board[r][c]; }
    }
    if (e) s += e; rows.push(s);
  }
  const boardString = rows.join('/');
  let turn = 'w';
  const highlights = document.querySelectorAll('.highlight');
  if (highlights.length > 0) {
    let whiteOnHighlight = false; let blackOnHighlight = false;
    highlights.forEach(h => {
       const m = h.className.match(/square-(\d)(\d)/);
       if(m) {
         const c = parseInt(m[1]) - 1; const r = 7 - (parseInt(m[2]) - 1);
         const piece = board[r][c]; 
         if(piece && piece === piece.toUpperCase()) whiteOnHighlight = true;
         if(piece && piece === piece.toLowerCase()) blackOnHighlight = true;
       }
    });
    if (whiteOnHighlight) turn = 'b'; else if (blackOnHighlight) turn = 'w';
  }
  let castling = "";
  if (board[7][4] === 'K') { if (board[7][7] === 'R') castling += "K"; if (board[7][0] === 'R') castling += "Q"; }
  if (board[0][4] === 'k') { if (board[0][7] === 'r') castling += "k"; if (board[0][0] === 'r') castling += "q"; }
  if (castling === "") castling = "-";
  return { fen: `${boardString} ${turn} ${castling} - 0 1`, turn: turn, boardString: boardString, grid: board };
};