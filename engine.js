console.log("ChessSpy: Engine Module Loaded");

function getPieceName(char) {
    if(!char) return "Empty";
    const map = {p:"Pawn", n:"Knight", b:"Bishop", r:"Rook", q:"Queen", k:"King"};
    return map[char.toLowerCase()] || "Piece";
}

function getPieceValue(pieceChar) {
  if (!pieceChar) return 0;
  const lower = pieceChar.toLowerCase();
  if (lower === 'p') return 1;
  if (lower === 'n' || lower === 'b') return 3;
  if (lower === 'r') return 5;
  if (lower === 'q') return 9;
  return 0;
}

function getMaterialCount() {
    const state = window.chessSpyState;
    if (!state.boardState) return 20;
    let count = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (state.boardState[r][c]) count++;
        }
    }
    return count;
}

function checkSingularity(scores) {
    if (scores[1] === undefined || scores[2] === undefined) return false;
    const best = scores[1];
    const second = scores[2];
    const gap = best - second;
    const material = getMaterialCount();

    if (best > 0 && second < -250) return true;
    if (gap > 130 && material > 10) return true;
    if (gap > 200 && material <= 10) return true;

    if (scores[3] !== undefined && scores[4] !== undefined) {
        const avgOthers = (second + scores[3] + scores[4]) / 3;
        if ((best - avgOthers > 110 && material > 10) || (best - avgOthers > 180 && material <=10)) return true;
    }
    return false;
}

window.handleMainEngine = function(line) {
  const state = window.chessSpyState;
  const cfg = window.chessSpyConfig;

  let mpv = 1;
  if (line.includes('multipv')) {
    const match = line.match(/multipv (\d+)/);
    if(match) mpv = parseInt(match[1]);
  }

  // Separate the "Math" score from the "Display" score
  let mathScore = null;    // For Singularity calculations (e.g. 9995)
  let displayScore = null; // For Visual Bar (e.g. 5)
  let isMate = false;

  if (line.includes('score cp')) {
    const match = line.match(/score cp (-?\d+)/);
    if(match) {
        const val = parseInt(match[1]);
        mathScore = val;
        displayScore = val;
    }
  } else if (line.includes('score mate')) {
    const match = line.match(/score mate (-?\d+)/);
    if(match) {
        const moves = parseInt(match[1]);
        isMate = true;
        displayScore = moves; // Keep real move count for UI (M1, M5)

        // Convert to huge number for Math comparison
        if(moves > 0) mathScore = 10000 - moves;
        else mathScore = -10000 - moves;
    }
  }

  if (mathScore !== null) {
      state.multiPVRawScores[mpv] = mathScore;

      // Update Bar with the DISPLAY score
      if (mpv === 1 && typeof window.updateBar === "function") {
          let uiVal = displayScore;
          if (state.activeTurn === 'b') uiVal = displayScore * -1;
          window.updateBar(uiVal, isMate);
      }
  }

  const isForced = checkSingularity(state.multiPVRawScores);

  if (line.includes(' pv ')) {
    let maxLines = cfg.lines;
    if (mpv <= maxLines) {
      const parts = line.split(' pv ')[1].trim().split(' ');
      if (parts.length > 0) {
        const bestMove = parts[0];
        if (mpv === 1) state.lastBestMove = bestMove;

        let badge = null;
        if (mpv === 1 && isForced) badge = "!";
        else if (cfg.lines > 1) badge = mpv.toString();

        if (typeof window.shouldDrawArrow === "function") {
            window.shouldDrawArrow(bestMove, mpv, false, false, badge, 50, isForced);

            if (mpv === 1 && cfg.showResponse && parts.length > 1) {
               window.shouldDrawArrow(parts[1], mpv, true, false, null, 10, false);
            }
        }
      }
    }
  }
};

function isAggressiveMove(move, subsequentMove) {
    if (window.isSquareOccupied(move.substring(2, 4))) return true;
    if (subsequentMove && window.isSquareOccupied(subsequentMove.substring(2, 4))) return true;
    const piece = window.getPieceAt(move.substring(0, 2));
    if (getPieceValue(piece) === 1) { // Pawn push
        const toRank = parseInt(move[3]);
        if (piece === 'P' && toRank >= 5) return true;
        if (piece === 'p' && toRank <= 4) return true;
    }
    return false;
}

window.handleThreatEngine = function(line) {
  const cfg = window.chessSpyConfig;
  const state = window.chessSpyState;

  if (line.includes(' pv ') && (line.includes('multipv 1') || !line.includes('multipv'))) {

    let score = 0, isMate = false;
    if (line.includes('score mate')) { isMate = true; score = 10000; }
    else {
      const match = line.match(/score cp (-?\d+)/);
      if (match) score = parseInt(match[1]);
    }

    const baseline = state.multiPVRawScores[1] ? (state.multiPVRawScores[1] * -1) : 0;
    const impact = isMate ? 10000 : score - baseline;

    if (impact < 120) {
        if(window.removeThreatArrows) window.removeThreatArrows();
        return;
    }

    const parts = line.split(' pv ')[1].trim().split(' ');
    const firstMove = parts[0];

    if (cfg.onlyAggressiveThreats) {
       if (!isAggressiveMove(firstMove, parts[2])) {
           if(window.removeThreatArrows) window.removeThreatArrows();
           return;
       }
    }

    const limit = Math.min(parts.length, parseInt(cfg.tacticsDepth) + 1);
    const isUserWhite = (state.userColor === 'w');
    const dirtySquares = new Set();
    let lastMoveValue = 0;

    for (let i = 0; i < limit; i++) {
      if (i % 2 !== 0) continue;

      const move = parts[i];
      const fromSq = move.substring(0, 2);
      const toSq = move.substring(2, 4);
      const piece = window.getPieceAt(fromSq);
      if (!piece) continue;

      const isWhitePiece = (piece === piece.toUpperCase());
      if (isUserWhite === isWhitePiece) continue;

      if (i > 0) {
        const targetPiece = window.getPieceAt(toSq);
        const moveValue = getPieceValue(targetPiece);
        const isEscalation = moveValue > lastMoveValue;
        if (!isEscalation && !isMate && moveValue < 3) continue;
      }

      const targetPiece = window.getPieceAt(toSq);
      lastMoveValue = getPieceValue(targetPiece);

      dirtySquares.add(fromSq);
      dirtySquares.add(toSq);
      const stepNum = ((i / 2) + 1).toString();
      window.drawArrow(move, 99 + i, false, false, stepNum, 100);
    }
  }
};
