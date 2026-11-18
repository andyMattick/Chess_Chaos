/**
 * Local room server for development: `bun server/dev-bun.ts` (port 8787).
 * Production uses server/cloudflare.ts; both drive the same RoomServer.
 */
import { RoomServer, parseClientMsg, type Conn } from '../src/net/room';
import { relay, relayPath } from '../src/net/chesscomRelay';
import { handleBox, handleVault, memoryBoxes, playerExists, verifyPlayer, vaultRoute } from '../src/net/vault';
import { handleWorld, memoryWorld, WORLD_PREFIX } from '../src/net/world';

const boxes = memoryBoxes();
const world = memoryWorld();
const openBox = async (number: string, r: Request) => handleBox(r, boxes(number));

const rooms = new RoomServer();
setInterval(() => rooms.tick(), 500);

type Data = { conn: Conn };
let n = 0;

const server = Bun.serve<Data, never>({
  port: Number(process.env.PORT ?? 8787),
  fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const id = `c${++n}`;
      const ok = srv.upgrade(req, { data: { conn: { id, send: () => {} } } });
      return ok ? undefined : new Response('Upgrade failed', { status: 400 });
    }
    const vault = vaultRoute(url.pathname);
    if (vault) return handleVault(req, vault, openBox);
    if (url.pathname.startsWith(`${WORLD_PREFIX}/`)) {
      return (async () => {
        const n = req.headers.get('x-player') ?? '';
        const who = req.method !== 'OPTIONS' && (await verifyPlayer(req, n, openBox)) ? n : null;
        return handleWorld(req, world, who, (x) => playerExists(url.origin, x, openBox));
      })();
    }
    const rest = relayPath(url.pathname);
    if (rest) return relay(rest);
    return new Response('Chess Chaos room server', { headers: { 'access-control-allow-origin': '*' } });
  },
  websocket: {
    open(ws) {
      ws.data.conn.send = (m) => ws.send(JSON.stringify(m));
    },
    message(ws, raw) {
      const msg = parseClientMsg(String(raw));
      if (msg) rooms.handle(ws.data.conn, msg);
    },
    close(ws) {
      rooms.close(ws.data.conn);
    },
  },
});
console.log(`Room server on ws://localhost:${server.port}/ws`);
