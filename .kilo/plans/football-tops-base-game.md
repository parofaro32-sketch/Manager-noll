# Football Tops — Base Game Plan

**Target:** `/workspace/app`
**Chosen stack (resolved):** Option A — React shell (Vite + React + Tailwind) for menus/UI + HTML5 Canvas for the 11v11 match loop. Keeps `npm run dev` / `npm run build` working.

## Goal
Deliver the smallest genuinely playable Football Tops: a working 11v11 football match with responsive controls, a moving ball, basic AI on both teams, goals, kickoff/restart, and a stable game loop. No advanced graphics until the core match works.

## Current state (inspected)
- Existing project is "Manager Nol" — a football *management* dashboard (React + Express + Vite), NOT a playable match.
- `src/App.tsx` manages landing/auth/servers/clubs/dashboard views.
- `src/components/TacticalPitchCanvas.tsx` is a dot-based tactical visualization, not gameplay.
- `server/data/clubSeed.ts` generates 22-player squads per club with positions (GK, CB, LB, RB, CDM, CM, CAM, LM, RM, LW, RW, ST) and attributes (pace, shooting, passing, dribbling, defending, physical) — reusable for player data.
- `index.html` currently shows only "Coming Soon".
- No game engine, no physics, no AI, no controls, no scoreboard, no ball physics exist.

## Design decisions (resolved)
1. **React shell + Canvas match.** `App.tsx` owns view states: `start` | `match` | `result` | `paused`. The match renders inside a Canvas component; React handles scoreboard/timer/menus only.
2. **No Express backend needed for gameplay.** `server.ts` can remain unused or be stripped later; the game is client-side. Keep `npm run dev` serving the Vite React app.
3. **Player data:** Generate two 11-player teams inline in the game module (reuse the position/attribute schema from `types.ts`/`clubSeed.ts` so AI can use pace/shooting/passing/defending). Do not depend on the management DB for the base match.
4. **Physics:** Simple Euler integration, circle-circle collisions (players/ball), pitch boundary clamping, goal-line detection. Delta time for movement.
5. **AI:** Same core logic for both teams, differentiated by `teamId`. States: `attacking`, `defending`, `supporting`, `pressing`, `marking`, `recovering`, `goalkeeper`. Possession-driven transitions.

## Files to create
| File | Purpose |
|------|---------|
| `src/game/types.ts` | Shared types: Player, Ball, Team, MatchState, Pitch, AIState, Input |
| `src/game/pitch.ts` | Pitch geometry: boundaries, halfway line, center circle, penalty areas, goals, goal nets, goal-line test |
| `src/game/ball.ts` | Ball entity: position, velocity, possession owner, kick/pass/shoot/collect, goal detection |
| `src/game/player.ts` | Player entity: position, velocity, team, role, acceleration/deceleration, sprint, tackle |
| `src/game/controls.ts` | Keyboard (arrows/WASD + action keys) + mobile touch D-pad + action buttons input state |
| `src/game/ai.ts` | AI update for all 22 players: possession/defending states, teammate runs, pressing, marking, goalkeeper |
| `src/game/engine.ts` | Main game loop: requestAnimationFrame, delta time, update order (input → AI → physics → collisions → referee → render), camera follow |
| `src/game/referee.ts` | Match rules: kickoff, goal restart, throw-in, corner, goal kick, goal detection, score, match timer, end-of-match |
| `src/components/MatchView.tsx` | React host: Canvas wrapper, scoreboard, match timer, start screen, "Play Against Bots", pause/resume, match result screen, mobile touch buttons |
| `src/App.tsx` | Replace management views with game view routing (start/match/result/paused) |

## Files to modify
| File | Change |
|------|--------|
| `src/App.tsx` | Replace management dashboard routing with Football Tops game routing; keep auth/imports minimal |
| `index.html` | Update `<title>` to "Football Tops" (keep Coming Soon body or replace with app root) |
| `src/index.css` | Add minimal game canvas styling (full-screen canvas, overlay UI) — keep Tailwind |

## Files to consider removing (out of scope for Phase 1)
- Management-specific components (`ManagerDashboard`, `ClubSelection`, `TransferMarketTab`, etc.) can stay on disk but unused; do not delete unless user confirms. Focus is adding the game, not deleting the management app.

## Implementation order (testable steps)
1. **Pitch + canvas shell:** Draw pitch with boundaries, halfway line, center circle, penalty areas, goals, nets. Camera follows ball.
2. **22 players + ball:** Spawn 11 vs 11 with positions, roles, team IDs. Ball with velocity. Possession: nearest player to ball "owns" it while close.
3. **Kickoff & restart:** Center-circle kickoff, reset positions after goal.
4. **Controls:** Movement (all directions, accel/decel), sprint, pass, shoot, tackle, player switching. Verify each independently.
5. **AI:** Possession team attacks (carrier moves forward, teammates spread, runs, pass/shoot decisions). Defending team pressures ball carrier, marks, recovers. Goalkeeper protects goal. All 22 players update every frame.
6. **Referee:** Goals → score + restart. Throw-in / corner / goal kick. Match timer (e.g. 4:00 per half for base test) → end screen.
7. **UI:** Start screen, scoreboard, timer, pause/resume, result screen, mobile touch buttons.
8. **Performance/stability:** Delta time, no per-frame object churn, no stuck players, console clean.
9. **Verification:** Run the 13 checks from the prompt.

## Validation plan (must be evidenced)
Run `npm run dev`, open `http://localhost:3000`, verify:
1. Match starts successfully.
2. Exactly 11 active players spawn for each team (22 total, 2 GKs).
3. Both teams move and participate (AI not frozen).
4. Controlled player responds to movement input.
5. Sprint makes player faster while held, normal on release.
6. Pass sends ball toward a teammate (ball leaves player).
7. Shoot sends ball toward opponent's goal; goal triggers score.
8. Tackle triggers real tackle attempt (proximity/timing based).
9. Opposing team defends when my team has possession.
10. Both teams attack when they have possession.
11. Goals update score and restart via kickoff correctly.
12. Match continues without players/ball permanently stuck.
13. Match runs without critical console errors.

## Open questions (none blocking)
- Match length: base test uses short halves (e.g. 2–4 minutes) so goals/restart can be verified quickly; configurable later.
- Mobile vs desktop: support both keyboard and touch from the start.

## Rollback / safety
- Do not delete `server.ts` or the management DB in Phase 1; they remain available if the user wants to reconnect club data later.
- If Canvas/React integration proves problematic, fall back to Option B (standalone HTML/JS) — decision captured, not yet needed.

Plan is implementation-ready. Next: create the plan file and hand off to a code-capable agent via `plan_exit`.