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

function checkSingularity(scores) {
  if (scores[1] === undefined || scores[2] === undefined) return false;
  const best = scores[1];
  const second = scores[2];
  const gap = best - second;

  if (best > -100 && second < -300) return true; // Survival
  if (gap > 150) return true; // Forced

  if (scores[3] !== undefined && scores[4] !== undefined) {
      const avgOthers = (second + scores[3] + scores[4]) / 3;
      if (best - avgOthers > 120) return true; // Cluster
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

    let impact = score; 
    if (!isMate && state.multiPVRawScores[1] !== undefined) {
        const baseline = state.multiPVRawScores[1] * -1;
        impact = score - baseline;
    }

    // 1. IMPACT FILTER
    if (!isMate && impact < 100) {
        if(window.removeThreatArrows) window.removeThreatArrows();
        return;
    }

    const parts = line.split(' pv ')[1].trim().split(' ');
    
    // 2. AGGRESSIVE FILTER
    if (cfg.onlyAggressiveThreats) {
       let isAggressive = isMate; 
       let captureVal = 0;
       let isPawnPush = false;

       if (parts.length > 0) {
          const fromSq = parts[0].substring(0, 2);
          const toSq = parts[0].substring(2, 4);
          
          if(window.getPieceAt) {
             const p = window.getPieceAt(fromSq);
             if(getPieceValue(p) === 1) isPawnPush = true;
          }

          if (window.isSquareOccupied && window.isSquareOccupied(toSq)) {
             if(window.getPieceAt) {
                 const target = window.getPieceAt(toSq);
                 captureVal = getPieceValue(target);
             }
             isAggressive = true;
          }
       }
       
       if (isPawnPush && !isMate && impact < 300) isAggressive = false;
       if (!isMate && captureVal === 1 && impact < 250) isAggressive = false;

       if (!isAggressive && parts.length > 2 && typeof window.isSquareOccupied === 'function') {
          if (window.isSquareOccupied(parts[2].substring(2, 4))) isAggressive = true;
       }

       if (!isAggressive) {
           if(window.removeThreatArrows) window.removeThreatArrows();
           return; 
       }
    }

    const limit = parseInt(cfg.tacticsDepth) + 1; 
    const isUserWhite = (state.userColor === 'w');
    let firstMoveValue = 0;
    const dirtySquares = new Set();

    for (let i = 0; i < parts.length && i < limit; i++) {
      if (i % 2 !== 0) continue; 

      const move = parts[i];
      const fromSq = move.substring(0, 2);
      const toSq = move.substring(2, 4);

      if (i === 0) {
        if (typeof window.getPieceAt !== 'function') return;
        const piece = window.getPieceAt(fromSq);
        if (!piece) return; 
        const isWhitePiece = (piece === piece.toUpperCase());
        if (isUserWhite === isWhitePiece) return; 

        const targetPiece = window.getPieceAt(toSq);
        if (targetPiece) {
           const isTargetWhite = (targetPiece === targetPiece.toUpperCase());
           if (isTargetWhite === isUserWhite) firstMoveValue = getPieceValue(targetPiece);
        }
      }

      if (i > 0) {
        if (firstMoveValue >= 3 && !isMate) continue;

        let nextValue = 0;
        if (!dirtySquares.has(toSq) && typeof window.getPieceAt === 'function') {
           const target = window.getPieceAt(toSq);
           if (target) {
              const isTargetWhite = (target === target.toUpperCase());
              if (isTargetWhite === isUserWhite) nextValue = getPieceValue(target);
           }
        }
        
        const isMajor = nextValue >= 3;
        const isEscalation = nextValue > firstMoveValue;
        if (!isMate && !isMajor && !isEscalation) continue;
      }

      dirtySquares.add(fromSq);
      dirtySquares.add(toSq);

      const stepNum = ((i / 2) + 1).toString();
      if (typeof window.drawArrow === "function") {
          window.drawArrow(move, 99 + i, false, false, stepNum, 100); 
      }
    }
  }
};