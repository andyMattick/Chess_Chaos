/**
 * Tiny relay for the Chess.com Published-Data API, used only if browsers
 * block calling Chess.com directly. Forwards documented read-only paths only.
 */
export const RELAY_PREFIX = '/chesscom';
const ALLOWED = /^\/(player\/[a-z0-9_-]{1,50}(\/stats|\/games\/archives|\/games\/\d{4}\/\d{2})?|puzzle|puzzle\/random)$/;

export function relayPath(pathname: string): string | null {
  if (!pathname.startsWith(RELAY_PREFIX + '/')) return null;
  const rest = pathname.slice(RELAY_PREFIX.length).toLowerCase();
  return ALLOWED.test(rest) ? rest : null;
}

export async function relay(rest: string): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(`https://api.chess.com/pub${rest}`, {
      headers: { 'User-Agent': 'ChessChaos/1.0 (kids chess app; room server relay)', Accept: 'application/json' },
    });
  } catch {
    // Chess.com unreachable: answer with CORS headers so the page sees a clean error.
    return new Response('{"message":"Chess.com unreachable"}', { status: 502, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
  }
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': upstream.ok ? 'public, max-age=3600' : 'no-store',
    },
  });
}
