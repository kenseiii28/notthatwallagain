/**
 * Not That Wall Again — Strategic AI & Full Game Engine
 * 
 * Features:
 * - 9x9 board with 81 cells and 64 wall intersections (8x8)
 * - Legal pawn movement with orthogonal steps and straight/diagonal opponent jumps
 * - Wall collision detection (walls block pawn steps and jumps)
 * - Complete legal wall placement rules (no overlaps, no crossings, never traps either player)
 * - Three difficulty levels:
 *   - Easy: moves along shortest path, rarely places walls
 *   - Medium: compares shortest paths and places useful walls when appropriate
 *   - Hard: evaluates walls more carefully, chooses position-improving moves with bounded search
 * - Web Audio API sound effects (pawn move, wall place, win, lose)
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
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');
  const aiDifficultyBadge = document.getElementById('ai-difficulty-badge');
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const topRulesBtn = document.getElementById('top-rules-btn');
  const rulesDialog = document.getElementById('rules-dialog');
  const rulesDialogCloseBtn = document.getElementById('rules-dialog-close-btn');
  const startGameBtn = document.getElementById('start-game-btn');
  const winnerDialog = document.getElementById('winner-dialog');
  const winnerCelebrationImg = document.getElementById('winner-celebration-img');
  const winnerDialogTitle = document.getElementById('winner-dialog-title');
  const winnerDialogSubtitle = document.getElementById('winner-dialog-subtitle');
  const winnerNewGameBtn = document.getElementById('winner-new-game-btn');
  const winnerCloseBtn = document.getElementById('winner-close-btn');

  // =========================================================================
  // WEB AUDIO API — SOUND EFFECTS ENGINE
  // =========================================================================

  const soundEngine = {
    ctx: null,
    enabled: true,
    initialized: false,

    /** Lazily create AudioContext on first user gesture to comply with autoplay policy */
    init() {
      if (this.initialized) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.initialized = true;
      } catch (e) {
        // Web Audio not available — sounds silently disabled
        this.enabled = false;
      }
    },

    /** Resume context if suspended (browsers suspend until gesture) */
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    /** Play a short tone. freq in Hz, duration in seconds, type = oscillator waveform */
    _tone(freq, duration, type, volume, startDelay) {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime + (startDelay || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    },

    /** Pawn move: quick, soft click/tap */
    playMove() {
      this._tone(660, 0.08, 'sine', 0.12, 0);
      this._tone(880, 0.06, 'sine', 0.06, 0.03);
    },

    /** Wall placement: deeper thud with resonance */
    playWall() {
      this._tone(180, 0.15, 'triangle', 0.15, 0);
      this._tone(120, 0.12, 'sine', 0.08, 0.04);
    },

    /** Win: ascending major arpeggio */
    playWin() {
      this._tone(523, 0.18, 'sine', 0.12, 0);     // C5
      this._tone(659, 0.18, 'sine', 0.12, 0.12);   // E5
      this._tone(784, 0.18, 'sine', 0.12, 0.24);   // G5
      this._tone(1047, 0.30, 'sine', 0.14, 0.36);  // C6
    },

    /** Lose: descending minor sequence */
    playLose() {
      this._tone(440, 0.20, 'sine', 0.10, 0);      // A4
      this._tone(392, 0.20, 'sine', 0.10, 0.15);   // G4
      this._tone(330, 0.20, 'sine', 0.08, 0.30);   // E4
      this._tone(262, 0.35, 'sine', 0.06, 0.45);   // C4
    },

    toggle() {
      this.enabled = !this.enabled;
    }
  };

  // =========================================================================
  // GAME STATE
  // =========================================================================

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
    selectedWallOrientation: 'horizontal', // 'horizontal' | 'vertical'
    difficulty: 'medium', // 'easy' | 'medium' | 'hard'
    gameStarted: false, // Paused until "Start Game" is clicked
    winnerModalShown: false // Show winner popup only once per game
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
   * Validate whether a candidate wall is completely legal:
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
  // COMPUTER STRATEGY — DIFFICULTY LEVELS
  // =========================================================================

  /**
   * EASY AI: Move along shortest path. Rarely and simply place walls.
   * - 90% of the time just moves toward goal
   * - 10% chance to place a wall, but only if it slows player by ≥2 and doesn't slow self at all
   * - Limited search: only checks walls near the player's current position
   */
  function chooseComputerActionEasy() {
    const legalPawnMoves = getLegalPawnMoves(
      gameState.computerPos,
      gameState.playerPos,
      gameState.placedWalls
    );

    // Immediate win takes absolute priority
    for (let i = 0; i < legalPawnMoves.length; i++) {
      if (legalPawnMoves[i].row === 8) {
        return { type: 'move', move: legalPawnMoves[i] };
      }
    }

    // 10% wall chance if walls available
    if (gameState.computerWalls > 0 && Math.random() < 0.10) {
      const currentPlayerDist = getShortestPathDistance(
        gameState.playerPos, gameState.computerPos, 0, gameState.placedWalls
      );
      const currentCompDist = getShortestPathDistance(
        gameState.computerPos, gameState.playerPos, 8, gameState.placedWalls
      );

      // Only search near the player's position (±2 rows/cols) to keep it simple
      const pr = gameState.playerPos.row;
      const pc = gameState.playerPos.col;
      const orientations = ['horizontal', 'vertical'];
      let bestWall = null;
      let bestSlow = 0;

      for (let r = Math.max(0, pr - 2); r <= Math.min(7, pr + 1); r++) {
        for (let c = Math.max(0, pc - 2); c <= Math.min(7, pc + 1); c++) {
          for (let o = 0; o < 2; o++) {
            const candidate = { type: orientations[o], row: r, col: c };
            if (isWallOverlap(candidate, gameState.placedWalls)) continue;

            const testWalls = gameState.placedWalls.concat(candidate);
            const newCompDist = getShortestPathDistance(
              gameState.computerPos, gameState.playerPos, 8, testWalls
            );
            if (newCompDist === Infinity || newCompDist > currentCompDist) continue; // Don't slow self at all

            const newPlayerDist = getShortestPathDistance(
              gameState.playerPos, gameState.computerPos, 0, testWalls
            );
            if (newPlayerDist === Infinity) continue;

            const playerSlow = newPlayerDist - currentPlayerDist;
            if (playerSlow >= 2 && playerSlow > bestSlow) {
              bestSlow = playerSlow;
              bestWall = candidate;
            }
          }
        }
      }

      if (bestWall) {
        return { type: 'wall', wall: bestWall };
      }
    }

    // Move pawn toward goal via shortest path
    let bestMove = legalPawnMoves[0];
    let bestDist = Infinity;

    for (let i = 0; i < legalPawnMoves.length; i++) {
      const move = legalPawnMoves[i];
      const dist = getShortestPathDistance(move, gameState.playerPos, 8, gameState.placedWalls);
      if (dist < bestDist || (dist === bestDist && move.row > bestMove.row)) {
        bestDist = dist;
        bestMove = move;
      }
    }

    return { type: 'move', move: bestMove };
  }

  /**
   * MEDIUM AI: Compare shortest paths and place useful walls when appropriate.
   * This is the original strategy from the existing codebase.
   */
  function chooseComputerActionMedium() {
    const currentCompDist = getShortestPathDistance(
      gameState.computerPos, gameState.playerPos, 8, gameState.placedWalls
    );
    const currentPlayerDist = getShortestPathDistance(
      gameState.playerPos, gameState.computerPos, 0, gameState.placedWalls
    );

    // 1. Evaluate best pawn move
    const legalPawnMoves = getLegalPawnMoves(
      gameState.computerPos, gameState.playerPos, gameState.placedWalls
    );
    let bestPawnMove = null;
    let minCompMoveDist = Infinity;

    for (let i = 0; i < legalPawnMoves.length; i++) {
      const move = legalPawnMoves[i];
      if (move.row === 8) {
        return { type: 'move', move };
      }
      const dist = getShortestPathDistance(move, gameState.playerPos, 8, gameState.placedWalls);
      if (dist < minCompMoveDist || (dist === minCompMoveDist && bestPawnMove && move.row > bestPawnMove.row)) {
        minCompMoveDist = dist;
        bestPawnMove = move;
      }
    }

    // 2. Evaluate strategic wall placement
    let bestWallAction = null;
    let bestWallScore = -Infinity;

    if (gameState.computerWalls > 0) {
      const orientations = ['horizontal', 'vertical'];

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          for (let o = 0; o < orientations.length; o++) {
            const candidate = { type: orientations[o], row: r, col: c };
            if (isWallOverlap(candidate, gameState.placedWalls)) continue;

            const testWalls = gameState.placedWalls.concat(candidate);

            const newCompDist = getShortestPathDistance(
              gameState.computerPos, gameState.playerPos, 8, testWalls
            );
            if (newCompDist === Infinity) continue;

            const newPlayerDist = getShortestPathDistance(
              gameState.playerPos, gameState.computerPos, 0, testWalls
            );
            if (newPlayerDist === Infinity) continue;

            const playerSlow = newPlayerDist - currentPlayerDist;
            const compSlow = newCompDist - currentCompDist;
            const netGain = playerSlow - compSlow;

            const isMeaningfulSlow =
              compSlow <= 1 &&
              netGain >= 1 &&
              (playerSlow >= 2 || (currentPlayerDist <= 2 && playerSlow >= 1 && compSlow === 0));

            if (isMeaningfulSlow) {
              const score = (playerSlow * 3) - (compSlow * 4) + (newPlayerDist - newCompDist) * 2;
              if (score > bestWallScore) {
                bestWallScore = score;
                bestWallAction = { type: 'wall', wall: candidate, playerSlow, compSlow };
              }
            }
          }
        }
      }
    }

    // 3. Decide
    if (bestWallAction) {
      if (currentPlayerDist <= currentCompDist || currentPlayerDist <= 3 || bestWallAction.playerSlow >= 3) {
        return bestWallAction;
      }
    }

    return { type: 'move', move: bestPawnMove || legalPawnMoves[0] };
  }

  /**
   * HARD AI: More careful wall evaluation with position scoring.
   * - Evaluates every legal wall with a richer scoring function
   * - Considers positional advantage (distance lead), wall economy, and defensive urgency
   * - For pawn moves, picks the move that maximizes its positional advantage
   * - Bounded search: still O(128 * BFS) per turn, keeps turns responsive
   */
  function chooseComputerActionHard() {
    const currentCompDist = getShortestPathDistance(
      gameState.computerPos, gameState.playerPos, 8, gameState.placedWalls
    );
    const currentPlayerDist = getShortestPathDistance(
      gameState.playerPos, gameState.computerPos, 0, gameState.placedWalls
    );

    const legalPawnMoves = getLegalPawnMoves(
      gameState.computerPos, gameState.playerPos, gameState.placedWalls
    );

    // Immediate win
    for (let i = 0; i < legalPawnMoves.length; i++) {
      if (legalPawnMoves[i].row === 8) {
        return { type: 'move', move: legalPawnMoves[i] };
      }
    }

    // Evaluate best pawn move by positional advantage (minimize own dist, maximize opponent's)
    let bestPawnMove = null;
    let bestPawnScore = -Infinity;

    for (let i = 0; i < legalPawnMoves.length; i++) {
      const move = legalPawnMoves[i];
      const newCompDist = getShortestPathDistance(move, gameState.playerPos, 8, gameState.placedWalls);
      // Score: how far ahead we are after this move
      const score = currentPlayerDist - newCompDist;
      if (score > bestPawnScore || (score === bestPawnScore && move.row > (bestPawnMove ? bestPawnMove.row : -1))) {
        bestPawnScore = score;
        bestPawnMove = move;
      }
    }

    // Evaluate walls with richer scoring
    let bestWallAction = null;
    let bestWallScore = -Infinity;

    if (gameState.computerWalls > 0) {
      const orientations = ['horizontal', 'vertical'];
      const wallBudgetFactor = gameState.computerWalls / 10; // Preserve walls when running low

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          for (let o = 0; o < 2; o++) {
            const candidate = { type: orientations[o], row: r, col: c };
            if (isWallOverlap(candidate, gameState.placedWalls)) continue;

            const testWalls = gameState.placedWalls.concat(candidate);

            const newCompDist = getShortestPathDistance(
              gameState.computerPos, gameState.playerPos, 8, testWalls
            );
            if (newCompDist === Infinity) continue;

            const newPlayerDist = getShortestPathDistance(
              gameState.playerPos, gameState.computerPos, 0, testWalls
            );
            if (newPlayerDist === Infinity) continue;

            const playerSlow = newPlayerDist - currentPlayerDist;
            const compSlow = newCompDist - currentCompDist;

            // Hard AI accepts walls that slow self by up to 2, but requires larger net gain
            if (compSlow > 2) continue;
            if (playerSlow < 1) continue;

            // Richer scoring:
            // - Heavy weight on net path advantage
            // - Bonus for creating a large distance lead
            // - Penalty for self-slow, scaled by how many walls remain
            const netAdvantage = (newPlayerDist - newCompDist);
            const netGain = playerSlow - compSlow;
            const score =
              (playerSlow * 4) -           // Reward slowing player
              (compSlow * 5) +             // Penalize self-slow
              (netAdvantage * 3) +         // Reward overall positional lead
              (netGain * 2) +              // Reward net gain
              (wallBudgetFactor * 1) -     // Slight bonus when walls are plentiful
              (compSlow > 0 ? 2 : 0);     // Extra penalty for any self-slow

            if (score > bestWallScore) {
              bestWallScore = score;
              bestWallAction = {
                type: 'wall',
                wall: candidate,
                playerSlow,
                compSlow,
                score
              };
            }
          }
        }
      }
    }

    // Decision logic — harder AI is more aggressive with walls
    if (bestWallAction) {
      const distLead = currentPlayerDist - currentCompDist; // positive = we're behind (player is closer)

      // Place wall if:
      // 1. Player is close to winning (urgent defense)
      // 2. Player is ahead or tied in the race
      // 3. Wall provides exceptional value (score >= 8)
      // 4. We're behind and the wall helps substantially
      if (
        currentPlayerDist <= 2 ||                          // Urgent: block imminent win
        (distLead >= 0 && bestWallAction.playerSlow >= 1) ||  // Player ahead or tied
        bestWallScore >= 8 ||                               // Exceptional wall
        (distLead >= -1 && bestWallAction.playerSlow >= 2)  // Close race, good wall
      ) {
        return bestWallAction;
      }
    }

    return { type: 'move', move: bestPawnMove || legalPawnMoves[0] };
  }

  /**
   * Route to the appropriate AI strategy based on current difficulty.
   */
  function chooseComputerAction() {
    switch (gameState.difficulty) {
      case 'easy':
        return chooseComputerActionEasy();
      case 'hard':
        return chooseComputerActionHard();
      case 'medium':
      default:
        return chooseComputerActionMedium();
    }
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
      (gameState.gameStarted && gameState.currentTurn === 'player' && !gameState.computerThinking)
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
        wallEl.style.gridRow = `${2 * wall.row + 2}`;
        wallEl.style.gridColumn = `${2 * wall.col + 1} / ${2 * wall.col + 4}`;
      } else {
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
    if (gameState.gameStarted && gameState.currentTurn === 'player' && gameState.playerWalls > 0 && gameState.winner === null) {
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
    if (!gameState.gameStarted) {
      openRulesDialog(true);
      return;
    }
    updateFocus(row, col);

    if (gameState.currentTurn !== 'player' || gameState.computerThinking) {
      return;
    }

    if (!moveMatch) {
      // Invalid move — no sound
      const squareName = `${FILES[col]}${RANKS[row]}`;
      if (turnText) {
        turnText.innerHTML = `<strong>Square ${squareName}</strong> is blocked or illegal. Click a highlighted green square.`;
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

    // Sound: pawn move
    soundEngine.playMove();

    // Check Victory Condition
    if (gameState.playerPos.row === 0) {
      gameState.currentTurn = 'gameover';
      gameState.winner = 'player';
      renderBoard();
      updateStatusUI('victory');
      soundEngine.playWin();

      if (!gameState.winnerModalShown) {
        gameState.winnerModalShown = true;
        setTimeout(() => {
          showWinnerDialog('You win the game!', 'You crossed the board! Not even their pettiest walls could stop you.');
        }, 350);
      }
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
    if (!gameState.gameStarted) {
      openRulesDialog(true);
      return;
    }
    if (gameState.currentTurn !== 'player' || gameState.computerThinking) {
      return;
    }

    if (gameState.playerWalls <= 0) {
      // No sound for invalid action
      if (turnText) {
        turnText.innerHTML = `<strong>Out of walls!</strong> 10 is the limit — you must walk now.`;
      }
      return;
    }

    const orientation = gameState.selectedWallOrientation;
    const candidate = { type: orientation, row, col };

    // Validate legality
    if (!isLegalWallPlacement(candidate, gameState.placedWalls, gameState.playerPos, gameState.computerPos)) {
      // No sound for invalid action
      if (isWallOverlap(candidate, gameState.placedWalls)) {
        if (turnText) {
          turnText.innerHTML = `<strong>Illegal wall:</strong> That groove is occupied. No stacking walls!`;
        }
      } else {
        if (turnText) {
          turnText.innerHTML = `<strong>Illegal wall:</strong> You can't trap a player completely — fairness demands an open detour!`;
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

    // Sound: wall placement
    soundEngine.playWall();

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
      // Computer executes a strategic wall placement
      const wall = action.wall;
      gameState.placedWalls.push(wall);
      gameState.computerWalls -= 1;
      gameState.computerThinking = false;

      const wallNotation = `Wall ${FILES[wall.col]}${8 - wall.row}-${wall.type === 'horizontal' ? 'h' : 'v'}`;
      addComputerHistoryEntry(gameState.turnNumber, wallNotation);
      updateWallInventoryUI();

      // Sound: wall placement
      soundEngine.playWall();

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

      // Sound: pawn move
      soundEngine.playMove();

      // Check Victory Condition
      if (gameState.computerPos.row === 8) {
        gameState.currentTurn = 'gameover';
        gameState.winner = 'computer';
        renderBoard();
        updateStatusUI('defeat');
        soundEngine.playLose();

        if (!gameState.winnerModalShown) {
          gameState.winnerModalShown = true;
          setTimeout(() => {
            showWinnerDialog('Computer wins the game!', 'The computer reached the baseline first. Not that wall again...');
          }, 350);
        }
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
    const canPlace = gameState.gameStarted && gameState.currentTurn === 'player' && gameState.playerWalls > 0 && gameState.winner === null;

    if (wallControlsPanel) {
      if (canPlace) {
        wallControlsPanel.classList.remove('is-disabled');
      } else {
        wallControlsPanel.classList.add('is-disabled');
      }
    }

    if (wallModeTag) {
      if (!gameState.gameStarted) {
        wallModeTag.textContent = 'Paused';
      } else if (gameState.winner !== null) {
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
    if (!gameState.gameStarted) {
      if (roundIndicator) {
        roundIndicator.textContent = 'Welcome';
      }
      if (turnDot) {
        turnDot.classList.remove('computer-dot');
        turnDot.classList.add('player-dot');
      }
      if (turnText) {
        turnText.innerHTML = `<strong>Welcome!</strong> Review the rules and click <strong>Start Game</strong> to begin.`;
      }
      cardPlayer?.classList.remove('active-player');
      cardComputer?.classList.remove('active-player');
      if (pillPlayer) {
        pillPlayer.textContent = 'Ready';
        pillPlayer.className = 'turn-pill';
      }
      if (pillComputer) {
        pillComputer.textContent = 'Waiting';
        pillComputer.className = 'turn-pill waiting';
      }
      updateWallControlsState();
      return;
    }

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
            ? 'advance your pawn or place an inconvenient wall'
            : 'advance your pawn (out of walls!)';
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
        turnText.innerHTML = `<strong>Computer's turn</strong> — Calculating the most inconvenient wall...`;
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
        turnText.innerHTML = `🏆 <strong>Victory!</strong> You crossed the board! Not even their pettiest walls could stop you.`;
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
        turnText.innerHTML = `🧱 <strong>Game Over!</strong> Computer reached the baseline first. Not that wall again...`;
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
  // CONTROLS INITIALIZATION (RESET, THEMES, DIFFICULTY, SOUND, WALL ORIENT.)
  // =========================================================================

  function resetGame(autoStart = true) {
    clearWallPreview();
    closeWinnerDialog();
    closeRulesDialog();

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
    gameState.winnerModalShown = false;
    gameState.gameStarted = autoStart;

    currentFocusedCell = { row: 8, col: 4 };

    if (historyLog) historyLog.innerHTML = '';
    if (historyCount) historyCount.textContent = '0 turns';

    updateWallInventoryUI();
    renderBoard();
    updateStatusUI(autoStart ? 'player-turn' : 'paused');

    if (autoStart) {
      const firstCell = boardGrid.querySelector('.board-cell[data-row="8"][data-col="4"]');
      if (firstCell) {
        firstCell.focus();
      }
    }
  }

  // =========================================================================
  // DIALOG / MODAL CONTROLLERS (RULES & WINNER)
  // =========================================================================

  function openRulesDialog(isInitialOpen = false) {
    if (!rulesDialog) return;

    if (startGameBtn) {
      if (!gameState.gameStarted || isInitialOpen) {
        startGameBtn.textContent = 'Start Game';
      } else {
        startGameBtn.textContent = 'Resume Game';
      }
    }

    try {
      if (typeof rulesDialog.showModal === 'function') {
        if (!rulesDialog.open) {
          rulesDialog.showModal();
        }
      } else {
        rulesDialog.setAttribute('open', '');
      }
    } catch (err) {
      rulesDialog.setAttribute('open', '');
    }

    if (startGameBtn) startGameBtn.focus();
  }

  function closeRulesDialog() {
    if (!rulesDialog) return;
    try {
      if (typeof rulesDialog.close === 'function') {
        if (rulesDialog.open) {
          rulesDialog.close();
        }
      } else {
        rulesDialog.removeAttribute('open');
      }
    } catch (err) {
      rulesDialog.removeAttribute('open');
    }
  }

  function showWinnerDialog(exactTitle, subtitle) {
    if (!winnerDialog) return;

    if (winnerDialogTitle) {
      winnerDialogTitle.textContent = exactTitle;
    }
    if (winnerDialogSubtitle) {
      winnerDialogSubtitle.textContent = subtitle || '';
    }

    if (winnerCelebrationImg) {
      winnerCelebrationImg.onerror = () => {
        winnerCelebrationImg.classList.add('is-hidden');
      };
      winnerCelebrationImg.onload = () => {
        winnerCelebrationImg.classList.remove('is-hidden');
      };
      winnerCelebrationImg.src = 'celebration.png';
    }

    try {
      if (typeof winnerDialog.showModal === 'function') {
        if (!winnerDialog.open) {
          winnerDialog.showModal();
        }
      } else {
        winnerDialog.setAttribute('open', '');
      }
    } catch (err) {
      winnerDialog.setAttribute('open', '');
    }

    if (winnerNewGameBtn) winnerNewGameBtn.focus();
  }

  function closeWinnerDialog() {
    if (!winnerDialog) return;
    try {
      if (typeof winnerDialog.close === 'function') {
        if (winnerDialog.open) {
          winnerDialog.close();
        }
      } else {
        winnerDialog.removeAttribute('open');
      }
    } catch (err) {
      winnerDialog.removeAttribute('open');
    }
  }

  function initDialogs() {
    // Top-left rules button
    if (topRulesBtn) {
      topRulesBtn.addEventListener('click', () => {
        openRulesDialog(false);
      });
    }

    // Start / Resume Game button
    if (startGameBtn) {
      startGameBtn.addEventListener('click', () => {
        soundEngine.init();
        if (!gameState.gameStarted) {
          gameState.gameStarted = true;
          closeRulesDialog();
          renderBoard();
          updateStatusUI('player-turn');
          const firstCell = boardGrid.querySelector('.board-cell[data-row="8"][data-col="4"]');
          if (firstCell) firstCell.focus();
        } else {
          closeRulesDialog();
        }
      });
    }

    // Rules close button ('X')
    if (rulesDialogCloseBtn) {
      rulesDialogCloseBtn.addEventListener('click', () => {
        if (!gameState.gameStarted) {
          gameState.gameStarted = true;
          closeRulesDialog();
          renderBoard();
          updateStatusUI('player-turn');
        } else {
          closeRulesDialog();
        }
      });
    }

    // Rules dialog native escape/cancel
    if (rulesDialog) {
      rulesDialog.addEventListener('cancel', () => {
        if (!gameState.gameStarted) {
          gameState.gameStarted = true;
          renderBoard();
          updateStatusUI('player-turn');
        }
      });
    }

    // Winner Dialog buttons
    if (winnerNewGameBtn) {
      winnerNewGameBtn.addEventListener('click', () => {
        closeWinnerDialog();
        resetGame(true);
      });
    }

    if (winnerCloseBtn) {
      winnerCloseBtn.addEventListener('click', () => {
        closeWinnerDialog();
        if (mainNewGameBtn) mainNewGameBtn.focus();
      });
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

  function initDifficultySwitcher() {
    difficultyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Initialize audio on first user interaction
        soundEngine.init();

        const newDifficulty = btn.dataset.difficulty;

        difficultyBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        gameState.difficulty = newDifficulty;

        // Update the badge on the Computer card
        if (aiDifficultyBadge) {
          aiDifficultyBadge.textContent = newDifficulty.charAt(0).toUpperCase() + newDifficulty.slice(1);
        }

        // Changing difficulty mid-game: apply immediately, don't reset
        // The next computer turn will use the new difficulty
      });
    });
  }

  function initSoundToggle() {
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        // Initialize audio on first interaction
        soundEngine.init();
        soundEngine.toggle();

        const isOn = soundEngine.enabled;
        soundToggleBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        soundToggleBtn.title = isOn ? 'Sound effects on' : 'Sound effects off';

        if (soundIconOn) soundIconOn.style.display = isOn ? '' : 'none';
        if (soundIconOff) soundIconOff.style.display = isOn ? 'none' : '';
      });
    }
  }

  function initWallOrientationControls() {
    orientationRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        gameState.selectedWallOrientation = e.target.value;
      });
    });
  }

  // Initialize audio context on any first user interaction with the page
  function initAudioOnInteraction() {
    const handler = () => {
      soundEngine.init();
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
  }

  // Initial Boot
  initWallOrientationControls();
  initThemeSwitcher();
  initDifficultySwitcher();
  initSoundToggle();
  initDialogs();
  initAudioOnInteraction();

  // Reset to initial clean state (paused) and present Rules on first open
  resetGame(false);
  openRulesDialog(true);

  if (topNewGameBtn) topNewGameBtn.addEventListener('click', () => resetGame(true));
  if (mainNewGameBtn) mainNewGameBtn.addEventListener('click', () => resetGame(true));
});
