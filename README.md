# Kitty Sudoku Co-op

Two-player co-op sudoku where the digits are cats. Server is authoritative; web is a Vite + React PWA.

## Play locally (same Wi-Fi)
```
npm install && (cd web && npm install)
npm run server              # ws server on :8787
cd web && npm run dev       # http://<pc-lan-ip>:5173 on both phones
```
Open the LAN URL on each phone (allow Node through the Windows firewall for ports 5173 and 8787). One player taps "Start a room" and shares the link; the other opens it. Tests: `npm test`.

## Deploy
**Web (Vercel):** project root dir `web`, build `npm run build`, env `VITE_WS_URL=wss://cats.example.com`.
(`web/src/shared.ts` is a committed copy of `shared/sudoku.ts`, refreshed by `predev`/`prebuild`.)

**Server:** `npm ci && pm2 start "npx tsx server/index.ts" --name kitty` (env `PORT`, `ALLOWED_ORIGIN=https://your-app.vercel.app`, comma-separated allowed).
Caddy:
```
cats.example.com {
    reverse_proxy localhost:8787
}
```
**No domain? Quick option:** `npx cloudflared tunnel --url http://localhost:8787` prints an https URL; set `VITE_WS_URL=wss://<that-host>` for the web build.
