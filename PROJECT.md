# Quoridor

## Project goal

Build a polished, playable browser version of Quoridor for one human player against a computer opponent. Keep it simple to run and deploy as a static website.

## Product experience

- Show a standard 9 × 9 Quoridor board.
- The human starts at the center of the bottom edge and aims for the top edge. The computer starts at the center of the top edge and aims for the bottom edge.
- Make the current turn and game status easy to understand.
- Show each player's remaining walls and a readable move history.
- Include a clear New Game action that resets the board, wall counts, turn, and history.
- Make the board and controls usable on mobile as well as desktop.

## Game rules

- On a turn, a player either moves their pawn or places one wall.
- Pawns normally move one square in an orthogonal direction.
- When pawns are adjacent, allow the jump over the opponent if the square beyond is open. If a wall or board edge blocks that jump, allow a legal diagonal move around the opponent.
- Each player begins with 10 walls.
- Walls block movement across the two board edges covered by the wall. Support horizontal and vertical placement.
- Reject walls that overlap or cross existing walls, extend beyond the board, or leave either player without any route to their goal.
- A player wins when their pawn reaches the opposite edge.

## Computer opponent

- Keep all game logic local in the browser; no server-side game service is needed.
- Use breadth-first search to find shortest paths and validate that walls preserve a route for both players.
- Choose a legal move toward the computer's goal. When useful, place a legal wall that lengthens the human's route while keeping the computer's own route reasonable.
- Never make an illegal pawn move or wall placement.

## Visual direction

- Minimal, calm, and practical. The board should be the focus.
- Follow the device's light/dark preference automatically, with an optional manual theme override if useful.
- Use muted colors, clear type, and restrained accents to distinguish the two pawns and walls.
- Avoid neon, gradients, glowing effects, excessive panels, decorative clutter, and unnecessary animation.
- Use semantic controls, keyboard focus styles, and labels that make board actions understandable to assistive technology.

## Technical direction

- Prefer plain HTML, CSS, and JavaScript unless the repository already has a useful framework setup.
- Keep dependencies to a minimum.
- Do not require a backend, accounts, API keys, or a build step for the static version.
- Ensure the app works when served locally and can be hosted with GitHub Pages.
- Document local run instructions and GitHub Pages deployment in `README.md`.

## Acceptance checklist

- A fresh game starts with pawns in the correct positions and 10 walls per player.
- Legal moves are selectable and illegal moves do nothing.
- Pawn jumps and diagonal bypass moves follow Quoridor rules.
- Legal walls affect pawn movement; overlapping, crossing, off-board, and path-blocking walls are rejected.
- The computer responds with a legal move or wall placement.
- Wall counts, turn status, and move history stay in sync.
- Reaching the goal ends the game, and New Game restores the initial state.
- Light/dark theme behavior works and the layout remains usable on a narrow screen.
- README explains how to run and deploy the app.
