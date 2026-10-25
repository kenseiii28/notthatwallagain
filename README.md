# Not That Wall Again

A clean, minimalist browser board game where you race the computer to the opposite baseline while dropping well-timed barricades in each other's path.

## How to Play

- **Goal:** Move your pawn across the board to your opponent's baseline (row 9).
- **Each turn:** Either advance your pawn one square orthogonally, or drop one wall to obstruct your opponent.
- **Jumps:** When adjacent to the opponent, jump over them! If a wall or board edge blocks the straight jump, move diagonally around them instead.
- **Walls:** Each player starts with 10 walls. Walls span two squares and block pawn movement. You cannot place a wall that completely traps either player.
- **Win:** The first pawn to reach the opposite edge wins.

## Run Locally

This is a static HTML/CSS/JS app — no build step or dependencies required.

### Option 1: Python HTTP Server

```bash
cd quorido
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Option 2: Node.js HTTP Server

```bash
cd quorido
npx -y serve .
```

### Option 3: Open Directly

Open `index.html` directly in your browser (double-click the file or use `File → Open`).

## Deploy to GitHub Pages

1. Push your code to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Source**, select **Deploy from a branch**.
4. Choose the **main** branch and **/ (root)** folder.
5. Click **Save**. Your site will be live at `https://<username>.github.io/<repo-name>/`.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure and semantic HTML |
| `styles.css` | Theming (light/dark), layout, board styling |
| `app.js` | Game engine, AI, rendering, and interaction |
| `PROJECT.md` | Design spec and acceptance checklist |
| `README.md` | This file |

## Tech Stack

- Plain HTML, CSS, and JavaScript
- No frameworks, build tools, or external dependencies
- Automatic light/dark theme via `prefers-color-scheme`
- Responsive layout for mobile and desktop
