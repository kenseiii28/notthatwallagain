/**
 * Quoridor Web Game — Strategic AI & Full Game Engine
 * 
 * Features:
 * - 9x9 Quoridor board with 81 cells and 64 wall intersections (8x8)
 * - Legal pawn movement with orthogonal steps and straight/diagonal opponent jumps
 * - Wall collision detection (walls block pawn steps and jumps)
 * - Complete legal wall placement rules (no overlaps, no crossings, never traps either player)
 * - Intelligent Computer strategy:
 *   - Uses BFS shortest-path search to compare paths for both players
 *   - Moves toward its goal (Row 8)
 *   - Places legal walls when doing so meaningfully slows the player without making its own route too long
 * - Interactive player wall placement with real-time hover previews
 * - Real-time turn indicator, wall inventory counters/pips, and algebraic move history
 */

document.addEventListener('DOMContentLoaded', () => {
  const FILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const RANKS = ['9', '8', '7', '6', '5', '4', '3', '2', '1']; // Row 0 is Rank 9 (North), Row 8 is Rank 1 (South)

  // DOM Elements
  const boardGrid = document.getElementById('board-grid');
  const turnText = document.getElementById('turn-text');
  const turnDot = document.querySelector('.turn-dot');
  const roundIndicator = document.getElementById('round-indicator');
  const cardPlayer = document.getElementById('card-player');
  const cardComputer = document.getElementById('card-computer');
  const pillPlayer = document.getElementById('pill-player');
  const pillComputer = document.getElementById('pill-computer');
  const playerWallsCount = document.getElementById('player-walls-count');
  const computerWallsCount = document.getElementById('computer-walls-count');
  const playerWallBars = document.getElementById('player-wall-bars');
  const computerWallBars = document.getElementById('computer-wall-bars');
  const historyLog = document.getElementById('history-log');
  const historyCount = document.getElementById('history-count');
  const topNewGameBtn = document.getElementById('top-new-game-btn');
  const mainNewGameBtn = document.getElementById('main-new-game-btn');
  const themeBtns = document.querySelectorAll('.theme-btn');
  const orientationRadios = document.querySelectorAll('input[name="wall-orientation"]');
  const wallControlsPanel = document.getElementById('wall-controls-panel');
  const wallModeTag = document.getElementById('wall-mode-tag');

  // Game State
  const gameState = {
    // Player starts at E1 (Row 8, Col 4). Goal: Row 0 (Rank 9)
    playerPos: { row: 8, col: 4 },
    // Computer starts at E9 (Row 0, Col 4). Goal: Row 8 (Rank 1)
    computerPos: { row: 0, col: 4 },
    playerWalls: 10,
    computerWalls: 10,
    placedWalls: [], // Array of { type: 'horizontal'|'vertical', row: 0..7, col: 0..7 }
    currentTurn: 'player', // 'player' | 'computer' | 'gameover'
    turnNumber: 1,
    winner: null, // null | 'player' | 'computer'
    history: [],
    computerThinking: false,
    selectedWallOrientation: 'horizontal' // 'horizontal' | 'vertical'
  };

  let currentFocusedCell = { row: 8, col: 4 };

  // =========================================================================
  // WALL COLLISION & RULE VALIDATION
  // =========================================================================

  /**
   * Check if a direct orthogonal step between adjacent squares (r1, c1) and (r2, c2)
   * is blocked by any placed wall.
   */
  function isStepBlockedByWall(r1, c1, r2, c2, walls) {
    if (r1 === r2) {
      // Horizontal movement between columns c1 and c2
      const minC = Math.min(c1, c2); // crosses vertical boundary between minC and minC+1
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        if (w.type === 'vertical' && w.col === minC && (w.row === r1 || w.row === r1 - 1)) {
          return true;
        }
      }
    } else if (c1 === c2) {
      // Vertical movement between rows r1 and r2
      const minR = Math.min(r1, r2); // crosses horizontal boundary between minR and minR+1
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        if (w.type === 'horizontal' && w.row === minR && (w.col === c1 || w.col === c1 - 1)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if a new wall overlaps or crosses an existing wall.
   */
  function isWallOverlap(newWall, existingWalls) {
    const { type, row, col } = newWall;
    for (let i = 0; i < existingWalls.length; i++) {
      const w = existingWalls[i];
      if (w.type === type) {
        if (type === 'horizontal') {
          // Same row, and col overlaps: c, c-1, or c+1
          if (w.row === row && Math.abs(w.col - col) <= 1) return true;
        } else {
          // Same col, and row overlaps: r, r-1, or r+1
          if (w.col === col && Math.abs(w.row - row) <= 1) return true;
        }
      } else {
        // Different orientation: cannot cross at the exact same intersection
        if (w.row === row && w.col === col) return true;
      }
    }
    return false;
  }

  // =========================================================================
  // LEGAL PAWN MOVEMENT (WITH WALLS)
  // =========================================================================

  /**
   * Calculate all legal pawn moves for `fromPos` given `oppPos` and `walls`.
   */
  function getLegalPawnMoves(fromPos, oppPos, walls) {
    const moves = [];
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 }
    ];

    for (let i = 0; i < directions.length; i++) {
      const { dr, dc } = directions[i];
      const nr = fromPos.row + dr;
      const nc = fromPos.col + dc;

      if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;

      // Check if step to neighbor is blocked by a wall
      if (isStepBlockedByWall(fromPos.row, fromPos.col, nr, nc, walls)) {
        continue;
      }

      if (nr === oppPos.row && nc === oppPos.col) {
        // Opponent is adjacent! Try jump
        const jr = nr + dr;
        const jc = nc + dc;

        const straightOnBoard = jr >= 0 && jr <= 8 && jc >= 0 && jc <= 8;
        const straightBlockedByWall = straightOnBoard && isStepBlockedByWall(nr, nc, jr, jc, walls);

        if (straightOnBoard && !straightBlockedByWall) {
          // Straight jump is legal
          moves.push({ row: jr, col: jc, isJump: true });
        } else {
          // Straight jump is blocked by board boundary or a wall behind opponent!
          // Diagonal jumps to perpendicular sides of opponent become available:
          if (dr !== 0) {
            // Moving vertically: perpendiculars are west (-1) and east (+1)
            for (let j = 0; j < 2; j++) {
              const dCol = j === 0 ? -1 : 1;
              const diagC = nc + dCol;
              if (diagC >= 0 && diagC <= 8) {
                if (!isStepBlockedByWall(nr, nc, nr, diagC, walls)) {
                  moves.push({ row: nr, col: diagC, isJump: true });
                }
              }
            }
          } else {
            // Moving horizontally: perpendiculars are north (-1) and south (+1)
            for (let j = 0; j < 2; j++) {
              const dRow = j === 0 ? -1 : 1;
              const diagR = nr + dRow;
              if (diagR >= 0 && diagR <= 8) {
                if (!isStepBlockedByWall(nr, nc, diagR, nc, walls)) {
                  moves.push({ row: diagR, col: nc, isJump: true });
                }
              }
            }
          }
        }
      } else {
        // Unoccupied square
        moves.push({ row: nr, col: nc, isJump: false });
      }
    }

    return moves;
  }

  // =========================================================================
  // SHORTEST PATH SEARCH (BFS) & PATH VERIFICATION
  // =========================================================================

  /**
   * Fast BFS shortest-path distance to target row on the 9x9 board.
   * Returns shortest step count, or Infinity if no path exists.
   */
  function getShortestPathDistance(startPos, oppPos, targetRow, walls) {
    const visited = new Uint8Array(81);
    const queueR = new Int8Array(81);
    const queueC = new Int8Array(81);
    const queueD = new Int16Array(81);
    let head = 0;
    let tail = 0;

    queueR[tail] = startPos.row;
    queueC[tail] = startPos.col;
    queueD[tail] = 0;
    tail++;
    visited[startPos.row * 9 + startPos.col] = 1;

    while (head < tail) {
      const r = queueR[head];
      const c = queueC[head];
      const d = queueD[head];
      head++;

      if (r === targetRow) {
        return d;
      }

      const nextMoves = getLegalPawnMoves({ row: r, col: c }, oppPos, walls);
      for (let i = 0; i < nextMoves.length; i++) {
        const m = nextMoves[i];
        const idx = m.row * 9 + m.col;
        if (visited[idx] === 0) {
          visited[idx] = 1;
          queueR[tail] = m.row;
          queueC[tail] = m.col;
          queueD[tail] = d + 1;
          tail++;
        }
      }
    }

    return Infinity;
  }

  /**
   * Validate whether a candidate wall is completely legal according to Quoridor rules:
   * 1. Coordinates within 0..7
   * 2. No physical overlap or crossing with existing walls
   * 3. Never traps either player (both must retain a path to their respective goals)
   */
  function isLegalWallPlacement(wall, existingWalls, playerPos, computerPos) {
    if (wall.row < 0 || wall.row > 7 || wall.col < 0 || wall.col > 7) return false;
    if (isWallOverlap(wall, existingWalls)) return false;

    // Temporarily apply wall and verify path existence
    const tempWalls = existingWalls.concat(wall);

    const playerDist = getShortestPathDistance(playerPos, computerPos, 0, tempWalls);
    if (playerDist === Infinity) return false;

    const computerDist = getShortestPathDistance(computerPos, playerPos, 8, tempWalls);
    if (computerDist === Infinity) return false;

    return true;
  }

  // =========================================================================
  // COMPUTER STRATEGY (BFS PATH COMPARISON & STRATEGIC WALLS)
  // =========================================================================

  /**
   * Decide Computer's best action:
   * - Move toward its goal, OR
   * - Place a legal wall when doing so meaningfully slows the player without
   *   making its own route too long.
   */
  function chooseComputerAction() {
    const currentCompDist = getShortestPathDistance(
      gameState.computerPos,
      gameState.playerPos,
      8,
      gameState.placedWalls
    );
    const currentPlayerDist = getShortestPathDistance(
      gameState.playerPos,
      gameState.computerPos,
      0,
      gameState.placedWalls
    );

    // 1. Evaluate best pawn move
    const legalPawnMoves = getLegalPawnMoves(
      gameState.computerPos,
      gameState.playerPos,
      gameState.placedWalls
    );
    let bestPawnMove = null;
    let minCompMoveDist = Infinity;

    for (let i = 0; i < legalPawnMoves.length; i++) {
      const move = legalPawnMoves[i];
      // Immediate win takes absolute priority!
      if (move.row === 8) {
        return { type: 'move', move };
      }

      const dist = getShortestPathDistance(
        move,
        gameState.playerPos,
        8,
        gameState.placedWalls
      );
      if (
        dist < minCompMoveDist ||
        (dist === minCompMoveDist && bestPawnMove && move.row > bestPawnMove.row)
      ) {
        minCompMoveDist = dist;
        bestPawnMove = move;
      }
    }

    // 2. Evaluate strategic wall placement if Computer has walls remaining
    let bestWallAction = null;
    let bestWallScore = -Infinity;

    if (gameState.computerWalls > 0) {
      const orientations = ['horizontal', 'vertical'];

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          for (let o = 0; o < orientations.length; o++) {
            const candidate = { type: orientations[o], row: r, col: c };

            // Quick rejection of overlapping walls
            if (isWallOverlap(candidate, gameState.placedWalls)) continue;

            const testWalls = gameState.placedWalls.concat(candidate);

            // Compute new shortest paths with candidate wall
            const newCompDist = getShortestPathDistance(
              gameState.computerPos,
              gameState.playerPos,
              8,
              testWalls
            );
            if (newCompDist === Infinity) continue; // Traps computer

            const newPlayerDist = getShortestPathDistance(
              gameState.playerPos,
              gameState.computerPos,
              0,
              testWalls
            );
            if (newPlayerDist === Infinity) continue; // Traps player

            const playerSlow = newPlayerDist - currentPlayerDist;
            const compSlow = newCompDist - currentCompDist;
            const netGain = playerSlow - compSlow;

            // Strategy rule: A wall must meaningfully slow the player without
            // making its own route too long:
            // - Does not increase computer's path by more than 1 step (compSlow <= 1)
            // - Net gain in distance is positive (netGain >= 1)
            // - Slows the player by at least 2 steps (playerSlow >= 2) OR
            //   if player is threatening an immediate win (currentPlayerDist <= 2) and player is slowed by >= 1 with 0 self-slow
            const isMeaningfulSlow =
              compSlow <= 1 &&
              netGain >= 1 &&
              (playerSlow >= 2 || (currentPlayerDist <= 2 && playerSlow >= 1 && compSlow === 0));

            if (isMeaningfulSlow) {
              // Score based on maximizing player delay and relative lead
              const score = (playerSlow * 3) - (compSlow * 4) + (newPlayerDist - newCompDist) * 2;
              if (score > bestWallScore) {
                bestWallScore = score;
                bestWallAction = {
                  type: 'wall',
                  wall: candidate,
                  playerSlow,
                  compSlow,
                  newPlayerDist,
                  newCompDist
                };
              }
            }
          }
        }
      }
    }

    // 3. Decide: Place Wall or Move Pawn?
    // Place wall if:
    // - A meaningful wall is found AND
    // - Player is ahead in race (currentPlayerDist <= currentCompDist) OR
    // - Player is dangerously close to winning (currentPlayerDist <= 3) OR
    // - Wall slows player by a massive margin (playerSlow >= 3)
    if (bestWallAction) {
      if (
        currentPlayerDist <= currentCompDist ||
        currentPlayerDist <= 3 ||
        bestWallAction.playerSlow >= 3
      ) {
        return bestWallAction;
      }
    }

    // Otherwise, move pawn toward goal
    return { type: 'move', move: bestPawnMove || legalPawnMoves[0] };
  }

  // =========================================================================
  // BOARD RENDERING & INTERACTION
  // =========================================================================

  /**
   * Render the 9x9 board with cells, wall slots, pawns, and placed walls
   */
  function renderBoard() {
    boardGrid.innerHTML = '';

    const legalPlayerMoves =
      gameState.currentTurn === 'player'
        ? getLegalPawnMoves(gameState.playerPos, gameState.computerPos, gameState.placedWalls)
        : [];

    // 1. Render 81 Board Squares
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'board-cell';

        // 17-track grid mapping: square (r, c) at row 2*r + 1, col 2*c + 1
        cell.style.gridRow = `${2 * r + 1}`;
        cell.style.gridColumn = `${2 * c + 1}`;

        const squareName = `${FILES[c]}${RANKS[r]}`;
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.dataset.square = squareName;

        let cellDesc = `Square ${squareName}`;

        // Render Player Pawn
        if (r === gameState.playerPos.row && c === gameState.playerPos.col) {
          cell.classList.add('has-pawn', 'has-player-pawn');
          cellDesc += ', Player pawn (You)';
          const pawn = document.createElement('span');
          pawn.className = 'pawn pawn-player';
          pawn.setAttribute('aria-hidden', 'true');
          cell.appendChild(pawn);
        }

        // Render Computer Pawn
        if (r === gameState.computerPos.row && c === gameState.computerPos.col) {
          cell.classList.add('has-pawn', 'has-computer-pawn');
          cellDesc += ', Computer pawn';
          const pawn = document.createElement('span');
          pawn.className = 'pawn pawn-computer';
          pawn.setAttribute('aria-hidden', 'true');
          cell.appendChild(pawn);
        }

        // Check if this square is a legal destination for the Player
        const moveMatch = legalPlayerMoves.find(m => m.row === r && m.col === c);
        if (moveMatch) {
          cell.classList.add('is-valid-move');
          cellDesc += moveMatch.isJump
            ? ', Legal move (Jump over opponent)'
            : ', Legal move';
        }

        cell.setAttribute('aria-label', cellDesc);
        cell.setAttribute('role', 'gridcell');

        // Accessible roving tabindex
        if (r === currentFocusedCell.row && c === currentFocusedCell.col) {
          cell.tabIndex = 0;
        } else {
          cell.tabIndex = -1;
        }

        cell.addEventListener('click', () => {
          handleCellClick(r, c, moveMatch);
        });

        cell.addEventListener('keydown', handleCellKeyDown);

        boardGrid.appendChild(cell);
      }
    }

    // 2. Render Placed Walls
    gameState.placedWalls.forEach(wall => {
      const wallEl = document.createElement('div');
      wallEl.className = `placed-wall wall-${wall.type}`;

      if (wall.type === 'horizontal') {
        // Horizontal wall between row 'row' and 'row + 1'
        // Grid track row: 2*row + 2
        // Grid track cols: spans 2*col + 1 to 2*col + 4 (cell col, groove, cell col+1)
        wallEl.style.gridRow = `${2 * wall.row + 2}`;
        wallEl.style.gridColumn = `${2 * wall.col + 1} / ${2 * wall.col + 4}`;
      } else {
        // Vertical wall between col 'col' and 'col + 1'
        // Grid track col: 2*col + 2
        // Grid track rows: spans 2*row + 1 to 2*row + 4 (cell row, groove, cell row+1)
        wallEl.style.gridRow = `${2 * wall.row + 1} / ${2 * wall.row + 4}`;
        wallEl.style.gridColumn = `${2 * wall.col + 2}`;
      }

      wallEl.setAttribute('role', 'separator');
      wallEl.setAttribute(
        'aria-label',
        `${wall.type} wall at ${FILES[wall.col]}${8 - wall.row}`
      );
      boardGrid.appendChild(wallEl);
    });

    // 3. Render Interactive Wall Slots (8x8 intersection grooves)
    // Only active during Player's turn if Player has walls remaining
    if (gameState.currentTurn === 'player' && gameState.playerWalls > 0) {
      renderWallSlots();
    }
  }

  /**
   * Render interactive wall placement slots at the 64 groove intersections
   */
  function renderWallSlots() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'wall-slot';
        slot.style.gridRow = `${2 * r + 2}`;
        slot.style.gridColumn = `${2 * c + 2}`;
        slot.dataset.row = r;
        slot.dataset.col = c;
        slot.tabIndex = -1;

        const slotLabel = `Wall slot at ${FILES[c]}${8 - r}`;
        slot.setAttribute('aria-label', slotLabel);

        // Hover Preview Management
        slot.addEventListener('mouseenter', () => {
          showWallPreview(r, c);
        });

        slot.addEventListener('mouseleave', () => {
          clearWallPreview();
        });

        // Click to place wall
        slot.addEventListener('click', () => {
          handlePlayerPlaceWall(r, c);
        });

        boardGrid.appendChild(slot);
      }
    }
  }

  let activePreviewEl = null;

  function showWallPreview(row, col) {
    clearWallPreview();

    const orientation = gameState.selectedWallOrientation;
    const candidate = { type: orientation, row, col };
    const isValid = isLegalWallPlacement(
      candidate,
      gameState.placedWalls,
      gameState.playerPos,
      gameState.computerPos
    );

    activePreviewEl = document.createElement('div');
    activePreviewEl.className = `wall-preview wall-${orientation}${isValid ? '' : ' invalid'}`;

    if (orientation === 'horizontal') {
      activePreviewEl.style.gridRow = `${2 * row + 2}`;
      activePreviewEl.style.gridColumn = `${2 * col + 1} / ${2 * col + 4}`;
    } else {
      activePreviewEl.style.gridRow = `${2 * row + 1} / ${2 * row + 4}`;
      activePreviewEl.style.gridColumn = `${2 * col + 2}`;
    }

    boardGrid.appendChild(activePreviewEl);
  }

  function clearWallPreview() {
    if (activePreviewEl && activePreviewEl.parentNode) {
      activePreviewEl.parentNode.removeChild(activePreviewEl);
      activePreviewEl = null;
    }
  }

  // =========================================================================
  // PLAYER MOVE & WALL ACTIONS
  // =========================================================================

  function handleCellClick(row, col, moveMatch) {
    updateFocus(row, col);

    if (gameState.currentTurn !== 'player' || gameState.computerThinking) {
      return;
    }

    if (!moveMatch) {
      const squareName = `${FILES[col]}${RANKS[row]}`;
      if (turnText) {
        turnText.innerHTML = `<strong>Square ${squareName}</strong> is blocked or illegal. Click a highlighted square.`;
      }
      return;
    }

    executePlayerMove(moveMatch);
  }

  function executePlayerMove(move) {
    clearWallPreview();
    gameState.playerPos = { row: move.row, col: move.col };
    currentFocusedCell = { row: move.row, col: move.col };

    const moveNotation = `${FILES[move.col]}${RANKS[move.row]}${move.isJump ? ' (jump)' : ''}`;
    addPlayerHistoryEntry(gameState.turnNumber, moveNotation);

    // Check Victory Condition
    if (gameState.playerPos.row === 0) {
      gameState.currentTurn = 'gameover';
      gameState.winner = 'player';
      renderBoard();
      updateStatusUI('victory');
      return;
    }

    // Switch to Computer Turn
    gameState.currentTurn = 'computer';
    gameState.computerThinking = true;
    renderBoard();
    updateStatusUI('computer-thinking');

    setTimeout(() => {
      executeComputerTurn();
    }, 450);
  }

  function handlePlayerPlaceWall(row, col) {
    if (gameState.currentTurn !== 'player' || gameState.computerThinking) {
      return;
    }

    if (gameState.playerWalls <= 0) {
      if (turnText) {
        turnText.innerHTML = `<strong>No walls remaining!</strong> You must move your pawn.`;
      }
      return;
    }

    const orientation = gameState.selectedWallOrientation;
    const candidate = { type: orientation, row, col };

    // Validate legality
    if (!isLegalWallPlacement(candidate, gameState.placedWalls, gameState.playerPos, gameState.computerPos)) {
      if (isWallOverlap(candidate, gameState.placedWalls)) {
        if (turnText) {
          turnText.innerHTML = `<strong>Illegal wall:</strong> Overlaps or crosses an existing wall.`;
        }
      } else {
        if (turnText) {
          turnText.innerHTML = `<strong>Illegal wall:</strong> Cannot completely block either player's path to the goal!`;
        }
      }
      return;
    }

    clearWallPreview();

    // Place the wall
    gameState.placedWalls.push(candidate);
    gameState.playerWalls -= 1;

    const wallNotation = `Wall ${FILES[col]}${8 - row}-${orientation === 'horizontal' ? 'h' : 'v'}`;
    addPlayerHistoryEntry(gameState.turnNumber, wallNotation);

    updateWallInventoryUI();

    // Switch to Computer Turn
    gameState.currentTurn = 'computer';
    gameState.computerThinking = true;
    renderBoard();
    updateStatusUI('computer-thinking');

    setTimeout(() => {
      executeComputerTurn();
    }, 450);
  }

  // =========================================================================
  // COMPUTER TURN EXECUTION
  // =========================================================================

  function executeComputerTurn() {
    if (gameState.currentTurn !== 'computer') return;

    const action = chooseComputerAction();

    if (action.type === 'wall') {
      // Computer executes a strategic wall placement!
      const wall = action.wall;
      gameState.placedWalls.push(wall);
      gameState.computerWalls -= 1;
      gameState.computerThinking = false;

      const wallNotation = `Wall ${FILES[wall.col]}${8 - wall.row}-${wall.type === 'horizontal' ? 'h' : 'v'}`;
      addComputerHistoryEntry(gameState.turnNumber, wallNotation);
      updateWallInventoryUI();

      // Check if game is not over, proceed to player turn
      gameState.turnNumber += 1;
      gameState.currentTurn = 'player';
      renderBoard();
      updateStatusUI('player-turn');
    } else {
      // Computer executes pawn move
      const move = action.move;
      gameState.computerPos = { row: move.row, col: move.col };
      gameState.computerThinking = false;

      const moveNotation = `${FILES[move.col]}${RANKS[move.row]}${move.isJump ? ' (jump)' : ''}`;
      addComputerHistoryEntry(gameState.turnNumber, moveNotation);

      // Check Victory Condition
      if (gameState.computerPos.row === 8) {
        gameState.currentTurn = 'gameover';
        gameState.winner = 'computer';
        renderBoard();
        updateStatusUI('defeat');
        return;
      }

      gameState.turnNumber += 1;
      gameState.currentTurn = 'player';
      renderBoard();
      updateStatusUI('player-turn');
    }
  }

  // =========================================================================
  // UI STATUS & HISTORY LOGGING
  // =========================================================================

  function updateWallInventoryUI() {
    if (playerWallsCount) {
      playerWallsCount.textContent = `${gameState.playerWalls} / 10`;
    }
    if (computerWallsCount) {
      computerWallsCount.textContent = `${gameState.computerWalls} / 10`;
    }

    // Update Player Wall Pips
    if (playerWallBars) {
      const pips = playerWallBars.querySelectorAll('.wall-pip');
      pips.forEach((pip, idx) => {
        if (idx < gameState.playerWalls) {
          pip.className = 'wall-pip filled';
        } else {
          pip.className = 'wall-pip empty';
        }
      });
      playerWallBars.setAttribute('aria-label', `${gameState.playerWalls} of 10 walls remaining`);
    }

    // Update Computer Wall Pips
    if (computerWallBars) {
      const pips = computerWallBars.querySelectorAll('.wall-pip');
      pips.forEach((pip, idx) => {
        if (idx < gameState.computerWalls) {
          pip.className = 'wall-pip filled';
        } else {
          pip.className = 'wall-pip empty';
        }
      });
      computerWallBars.setAttribute('aria-label', `${gameState.computerWalls} of 10 walls remaining`);
    }

    // Update wall controls panel state
    updateWallControlsState();
  }

  function updateWallControlsState() {
    const canPlace = gameState.currentTurn === 'player' && gameState.playerWalls > 0 && gameState.winner === null;

    if (wallControlsPanel) {
      if (canPlace) {
        wallControlsPanel.classList.remove('is-disabled');
      } else {
        wallControlsPanel.classList.add('is-disabled');
      }
    }

    if (wallModeTag) {
      if (gameState.winner !== null) {
        wallModeTag.textContent = 'Game Over';
      } else if (gameState.currentTurn !== 'player') {
        wallModeTag.textContent = 'Waiting';
      } else if (gameState.playerWalls <= 0) {
        wallModeTag.textContent = 'No Walls';
      } else {
        wallModeTag.textContent = 'Active';
      }
    }

    orientationRadios.forEach(radio => {
      radio.disabled = !canPlace;
    });
  }

  function updateStatusUI(state) {
    if (roundIndicator) {
      roundIndicator.textContent = `Turn ${gameState.turnNumber}`;
    }

    // Update turn dot color
    if (turnDot) {
      turnDot.classList.remove('player-dot', 'computer-dot');
      if (state === 'computer-thinking') {
        turnDot.classList.add('computer-dot');
      } else {
        turnDot.classList.add('player-dot');
      }
    }

    if (state === 'player-turn') {
      if (turnText) {
        const wallHint =
          gameState.playerWalls > 0
            ? 'move pawn or click a groove to place a wall'
            : 'move your pawn';
        turnText.innerHTML = `<strong>Your turn</strong> — Click a highlighted square to ${wallHint}`;
      }
      cardPlayer?.classList.add('active-player');
      cardComputer?.classList.remove('active-player');
      if (pillPlayer) {
        pillPlayer.textContent = 'Active';
        pillPlayer.className = 'turn-pill';
      }
      if (pillComputer) {
        pillComputer.textContent = 'Waiting';
        pillComputer.className = 'turn-pill waiting';
      }
    } else if (state === 'computer-thinking') {
      if (turnText) {
        turnText.innerHTML = `<strong>Computer's turn</strong> — Thinking...`;
      }
      cardPlayer?.classList.remove('active-player');
      cardComputer?.classList.add('active-player');
      if (pillPlayer) {
        pillPlayer.textContent = 'Waiting';
        pillPlayer.className = 'turn-pill waiting';
      }
      if (pillComputer) {
        pillComputer.textContent = 'Active';
        pillComputer.className = 'turn-pill';
      }
    } else if (state === 'victory') {
      if (turnText) {
        turnText.innerHTML = `🏆 <strong>Victory!</strong> You reached the opposite baseline and won!`;
      }
      cardPlayer?.classList.add('active-player');
      cardComputer?.classList.remove('active-player');
      if (pillPlayer) {
        pillPlayer.textContent = 'Winner';
        pillPlayer.className = 'turn-pill';
      }
      if (pillComputer) {
        pillComputer.textContent = 'Defeated';
        pillComputer.className = 'turn-pill waiting';
      }
    } else if (state === 'defeat') {
      if (turnText) {
        turnText.innerHTML = `🏁 <strong>Game Over!</strong> Computer reached the baseline first.`;
      }
      cardPlayer?.classList.remove('active-player');
      cardComputer?.classList.add('active-player');
      if (pillPlayer) {
        pillPlayer.textContent = 'Defeated';
        pillPlayer.className = 'turn-pill waiting';
      }
      if (pillComputer) {
        pillComputer.textContent = 'Winner';
        pillComputer.className = 'turn-pill';
      }
    }

    // Update wall controls state whenever status changes
    updateWallControlsState();
  }

  function addPlayerHistoryEntry(turnNum, notation) {
    if (!historyLog) return;

    const prevRow = historyLog.querySelector('.current-row');
    if (prevRow) prevRow.classList.remove('current-row');

    const row = document.createElement('tr');
    row.id = `history-row-${turnNum}`;
    row.className = 'current-row';

    const tdTurn = document.createElement('td');
    tdTurn.className = 'td-turn';
    tdTurn.textContent = turnNum;

    const tdPlayer = document.createElement('td');
    tdPlayer.className = 'td-move current-step';
    tdPlayer.textContent = notation;

    const tdComputer = document.createElement('td');
    tdComputer.className = 'td-move pending';
    tdComputer.textContent = '...';

    row.appendChild(tdTurn);
    row.appendChild(tdPlayer);
    row.appendChild(tdComputer);
    historyLog.appendChild(row);

    if (historyCount) {
      historyCount.textContent = `${turnNum} ${turnNum === 1 ? 'turn' : 'turns'}`;
    }

    const wrapper = historyLog.closest('.history-table-wrapper');
    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
  }

  function addComputerHistoryEntry(turnNum, notation) {
    if (!historyLog) return;

    const row = document.getElementById(`history-row-${turnNum}`);
    if (row) {
      const tdComp = row.querySelector('.pending');
      if (tdComp) {
        tdComp.className = 'td-move';
        tdComp.textContent = notation;
      }
      const tdPlayer = row.querySelector('.current-step');
      if (tdPlayer) {
        tdPlayer.classList.remove('current-step');
      }
    }
  }

  // =========================================================================
  // KEYBOARD NAVIGATION & FOCUS
  // =========================================================================

  function updateFocus(row, col) {
    const prevCell = boardGrid.querySelector('.board-cell[tabindex="0"]');
    if (prevCell) {
      prevCell.tabIndex = -1;
      prevCell.classList.remove('has-focus-target');
    }

    currentFocusedCell = { row, col };
    const newCell = boardGrid.querySelector(`.board-cell[data-row="${row}"][data-col="${col}"]`);
    if (newCell) {
      newCell.tabIndex = 0;
      newCell.classList.add('has-focus-target');
      newCell.focus();
    }
  }

  function handleCellKeyDown(e) {
    const r = parseInt(e.currentTarget.dataset.row, 10);
    const c = parseInt(e.currentTarget.dataset.col, 10);

    let nextRow = r;
    let nextCol = c;

    switch (e.key) {
      case 'ArrowUp':
        nextRow = Math.max(0, r - 1);
        e.preventDefault();
        break;
      case 'ArrowDown':
        nextRow = Math.min(8, r + 1);
        e.preventDefault();
        break;
      case 'ArrowLeft':
        nextCol = Math.max(0, c - 1);
        e.preventDefault();
        break;
      case 'ArrowRight':
        nextCol = Math.min(8, c + 1);
        e.preventDefault();
        break;
      case 'Home':
        nextCol = 0;
        e.preventDefault();
        break;
      case 'End':
        nextCol = 8;
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.currentTarget.click();
        return;
      default:
        return;
    }

    if (nextRow !== r || nextCol !== c) {
      updateFocus(nextRow, nextCol);
    }
  }

  // =========================================================================
  // CONTROLS INITIALIZATION (RESET, THEMES, WALL ORIENTATION)
  // =========================================================================

  function resetGame() {
    clearWallPreview();
    gameState.playerPos = { row: 8, col: 4 }; // E1
    gameState.computerPos = { row: 0, col: 4 }; // E9
    gameState.playerWalls = 10;
    gameState.computerWalls = 10;
    gameState.placedWalls = [];
    gameState.currentTurn = 'player';
    gameState.turnNumber = 1;
    gameState.winner = null;
    gameState.history = [];
    gameState.computerThinking = false;

    currentFocusedCell = { row: 8, col: 4 };

    if (historyLog) historyLog.innerHTML = '';
    if (historyCount) historyCount.textContent = '0 turns';

    updateWallInventoryUI();
    renderBoard();
    updateStatusUI('player-turn');

    const firstCell = boardGrid.querySelector('.board-cell[data-row="8"][data-col="4"]');
    if (firstCell) {
      firstCell.focus();
    }
  }

  function initThemeSwitcher() {
    const root = document.documentElement;

    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;

        themeBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        root.classList.remove('theme-light', 'theme-dark');
        if (theme === 'light') {
          root.classList.add('theme-light');
        } else if (theme === 'dark') {
          root.classList.add('theme-dark');
        }
      });
    });
  }

  function initWallOrientationControls() {
    orientationRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        gameState.selectedWallOrientation = e.target.value;
      });
    });
  }

  // Initial Boot
  initWallOrientationControls();
  initThemeSwitcher();
  resetGame();

  if (topNewGameBtn) topNewGameBtn.addEventListener('click', resetGame);
  if (mainNewGameBtn) mainNewGameBtn.addEventListener('click', resetGame);
});
