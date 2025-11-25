console.log("ChessSpy: Visuals Module Loaded");

window.removeUI = function() {
  const ids = ['chess-spy-bar', 'chess-spy-label-box', 'chess-spy-hint-btn', 'chess-spy-arrows'];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });
};

window.clearArrows = function() {
  const svg = document.getElementById('chess-spy-arrows');
  if (svg) svg.innerHTML = "";
  if(window.chessSpyState) window.chessSpyState.activeArrows = new Map();
};

window.removeThreatArrows = function() {
  const svg = document.getElementById('chess-spy-arrows');
  if (!svg) return;
  const elements = Array.from(svg.children);
  elements.forEach(el => {
    if (el.id && (el.id.includes('rank-9') || el.id.includes('rank-10'))) el.remove();
    if (el.id && (el.id.startsWith('badge-arrow-rank-9') || el.id.startsWith('badge-arrow-rank-10'))) el.remove();
  });
};

window.updateBar = function(score, isMate) {
  const state = window.chessSpyState;
  const cfg = window.chessSpyConfig;
  
  const fill = document.getElementById('chess-spy-fill');
  const labelBox = document.getElementById('chess-spy-label-box');
  if (!fill || !labelBox) return;
  
  let pct = 50, text = "";
  if (isMate) {
    pct = score > 0 ? 100 : 0;
    text = "M" + Math.abs(score);
  } else {
    let cp = Math.max(-1000, Math.min(1000, score)); 
    pct = 50 + (cp / 20); 
    text = (score / 100).toFixed(1);
    if (score > 0) text = "+" + text;
  }
  
  fill.style.height = `${pct}%`;
  labelBox.innerText = text;
  
  const textPos = cfg.barTextPos;
  if (textPos === 'inside') {
    labelBox.style.color = (pct > 50) ? "#000" : "#fff";
    labelBox.style.background = "transparent";
  } else {
    if (isMate) { 
      labelBox.style.background = score > 0 ? "#fff" : "#000"; 
      labelBox.style.color = score > 0 ? "#000" : "#fff"; 
    } else {
      labelBox.style.background = "#222"; 
      if (score > 0) labelBox.style.color = (state.userColor === 'w') ? "#76b852" : "#ff6666";
      else if (score < 0) labelBox.style.color = (state.userColor === 'w') ? "#ff6666" : "#76b852";
      else labelBox.style.color = "#fff"; 
    }
  }
};

window.ensureUI = function() {
  const board = window.findBoardElement();
  if (!board) return;
  const r = board.getBoundingClientRect();
  const cfg = window.chessSpyConfig;
  const state = window.chessSpyState;
  
  const barW = parseInt(cfg.barWidth);
  const side = cfg.barSide;
  const textPos = cfg.barTextPos;
  const preset = cfg.barPreset || 'standard';
  
  let barLeft, labelLeft;
  if (side === 'right') {
    barLeft = r.right + 5;
    labelLeft = (textPos === 'inside') ? barLeft : barLeft + barW + 5;
  } else {
    barLeft = r.left - 5 - barW;
    labelLeft = (textPos === 'inside') ? barLeft : barLeft - 55;
  }
  
  let bar = document.getElementById('chess-spy-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'chess-spy-bar';
    document.body.appendChild(bar);
    const fill = document.createElement('div');
    fill.id = 'chess-spy-fill';
    bar.appendChild(fill);
  }
  
  let border = '2px solid #fff', borderRadius = '0px', bg = '#404040', boxShadow = '0 0 5px rgba(0,0,0,0.5)';
  if (preset === 'chesscom') { border = 'none'; borderRadius = '4px'; bg = '#262421'; boxShadow = '0 2px 5px rgba(0,0,0,0.3)'; } 
  else if (preset === 'rounded') { borderRadius = '99px'; } 
  else if (preset === 'minimal') { border = 'none'; boxShadow = 'none'; }
  
  const flexDir = (state.userColor === 'b') ? 'column' : 'column-reverse';
  bar.style.cssText = `position: absolute; left: ${barLeft}px; top: ${r.top}px; width: ${barW}px; height: ${r.height}px; background: ${bg}; border: ${border}; border-radius: ${borderRadius}; z-index: 2147483647; display: flex; flex-direction: ${flexDir}; box-shadow: ${boxShadow}; overflow: hidden;`;
  
  const fill = document.getElementById('chess-spy-fill');
  fill.style.cssText = 'width: 100%; height: 50%; background: #fff; transition: height 0.5s ease;';
  
  let labelBox = document.getElementById('chess-spy-label-box');
  if (!labelBox) { labelBox = document.createElement('div'); labelBox.id = 'chess-spy-label-box'; document.body.appendChild(labelBox); }
  let labelStyle = `position: absolute; left: ${labelLeft}px; top: ${r.top + (r.height/2) - 15}px; height: 30px; font-family: sans-serif; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 10000; pointer-events: none;`;
  if (textPos === 'inside') labelStyle += `width: ${barW}px; background: transparent; text-shadow: 0 0 2px #000;`; 
  else labelStyle += `width: 50px; background: #222; color: #fff; border-radius: 4px; border: 1px solid #777;`; 
  labelBox.style.cssText = labelStyle;

  let hintBtn = document.getElementById('chess-spy-hint-btn');
  if (cfg.showHintBtn) {
    if (!hintBtn) {
      hintBtn = document.createElement('div');
      hintBtn.id = 'chess-spy-hint-btn';
      hintBtn.innerText = "💡";
      document.body.appendChild(hintBtn);
      
      hintBtn.onclick = (e) => {
        e.stopPropagation(); 
        const st = window.chessSpyState;
        if (st.lastBestMove) {
          st.tempHintActive = true;
          window.shouldDrawArrow(st.lastBestMove, 1, false, false, null, 200, false);
          if(st.tempHintTimeout) clearTimeout(st.tempHintTimeout);
          st.tempHintTimeout = setTimeout(() => { st.tempHintActive = false; window.clearArrows(); }, 3000);
        }
      };
    }
    const btnLeft = side === 'right' ? r.right + 35 : r.left - 65;
    hintBtn.style.cssText = `position: absolute; left: ${btnLeft}px; top: ${r.bottom - 40}px; width: 30px; height: 30px; background: #333; border: 1px solid #777; border-radius: 50%; color: yellow; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2147483647; box-shadow: 0 2px 5px rgba(0,0,0,0.5); pointer-events: auto;`;
  } else if (hintBtn) { hintBtn.remove(); }
};

window.shouldDrawArrow = function(moveStr, rankIndex, isResponse, isHumanMove, badgeText, priority, isForced = false) {
  const cfg = window.chessSpyConfig;
  const state = window.chessSpyState;

  if (state.tempHintActive && rankIndex === 1 && !isResponse) {
    window.drawArrow(moveStr, rankIndex, isResponse, isHumanMove, badgeText, 200, isForced);
    return;
  }
  if (cfg.arrowMode === 'none') return;

  let moveMaker = state.activeTurn;
  if (isResponse) moveMaker = (state.activeTurn === 'w' ? 'b' : 'w');
  const isMoveByMe = (moveMaker === state.userColor);

  let draw = false;
  let human = false;

  if (cfg.showHuman && isMoveByMe && rankIndex === 2 && !isResponse) { draw = true; human = true; } 
  if (!human) {
    if (cfg.arrowMode === 'both') draw = true;
    else if (cfg.arrowMode === 'me' && isMoveByMe) draw = true;
    else if (cfg.arrowMode === 'opponent' && !isMoveByMe) draw = true;
  }
  if (draw) window.drawArrow(moveStr, rankIndex, isResponse, human, badgeText, priority, isForced);
};

window.drawArrow = function(moveStr, rankIndex, isResponse, isHumanMove, badgeText, priority = 1, isForced = false) {
  const state = window.chessSpyState;
  const cfg = window.chessSpyConfig;

  const key = moveStr;
  if (state.activeArrows.has(key)) {
    if (state.activeArrows.get(key) >= priority) return;
  }
  state.activeArrows.set(key, priority);

  const board = window.findBoardElement();
  if (!board) return;
  const coords = window.getMathCoords(moveStr.substring(0, 2), moveStr.substring(2, 4), board);
  
  let svg = document.getElementById('chess-spy-arrows');
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "chess-spy-arrows";
    svg.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:2147483646;";
    board.appendChild(svg);
  }

  const id = `arrow-rank-${rankIndex}-${isResponse ? 'response' : 'main'}`;
  let existing = document.getElementById(id);
  if (existing) existing.remove(); 
  
  const badgeId = `badge-${id}`;
  if(document.getElementById(badgeId)) document.getElementById(badgeId).remove();

  let color = cfg.colBest; 
  if (rankIndex >= 2) color = cfg.colAlt; 
  if (isResponse) color = cfg.colPred; 
  if (isHumanMove) color = "#9b59b6";
  if (isForced && rankIndex === 1 && !isResponse) color = "#FFD700"; 
  if (rankIndex >= 99) {
     color = ((rankIndex - 99) % 2 === 0) ? "#ff4444" : "#888888"; 
  }

  let baseSize = parseInt(cfg.arrowSize);
  let strokeWidth = (rankIndex > 1 && rankIndex < 99) ? Math.max(2, baseSize - 2) : baseSize;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", coords.x1); line.setAttribute("y1", coords.y1);
  line.setAttribute("x2", coords.x2); line.setAttribute("y2", coords.y2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", strokeWidth);
  if (rankIndex >= 99) line.setAttribute("stroke-dasharray", "6, 4");
  
  const markerId = `head-${rankIndex}-${isResponse?'r':'m'}-${color.replace(/[#\s]/g,'')}`;
  line.setAttribute("marker-end", `url(#${markerId})`);
  line.setAttribute("opacity", (rankIndex >= 2) ? "0.6" : "0.9");
  line.id = id;

  if (!document.getElementById(markerId)) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.id = markerId;
    const headSize = baseSize / 2.5; 
    marker.setAttribute("markerWidth", headSize);
    marker.setAttribute("markerHeight", headSize);
    marker.setAttribute("refX", headSize*0.8); 
    marker.setAttribute("refY", headSize/2);
    marker.setAttribute("orient", "auto");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", `0 0, ${headSize} ${headSize/2}, 0 ${headSize}`);
    poly.setAttribute("fill", color);
    marker.appendChild(poly);
    defs.appendChild(marker);
    svg.appendChild(defs);
  }
  svg.appendChild(line);

  if (badgeText) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.id = badgeId;
    const t = 0.25; 
    const mx = coords.x1 + (coords.x2 - coords.x1) * t;
    const my = coords.y1 + (coords.y2 - coords.y1) * t;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", mx); circle.setAttribute("cy", my);
    circle.setAttribute("r", (baseSize * 0.8).toString());
    circle.setAttribute("fill", color);
    
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", mx); text.setAttribute("y", my + (baseSize * 0.35)); 
    text.setAttribute("text-anchor", "middle"); text.setAttribute("fill", "#fff");
    text.setAttribute("font-size", (baseSize * 1.1).toString());
    text.setAttribute("font-weight", "bold"); text.textContent = badgeText;

    g.appendChild(circle); g.appendChild(text);
    svg.appendChild(g);
  }

  const duration = cfg.hintDuration;
  if (duration !== 'infinite' && !isResponse && rankIndex < 99 && rankIndex === 1 && !isHumanMove) {
    if (state.activeTurn === state.userColor) {
      const fadeTime = parseInt(duration)/1000;
      setTimeout(() => {
         if(line) { line.style.transition = "opacity 1s"; line.style.opacity = "0"; }
         const b = document.getElementById(badgeId);
         if(b) { b.style.transition = "opacity 1s"; b.style.opacity = "0"; }
      }, parseInt(duration));
    }
  }
};