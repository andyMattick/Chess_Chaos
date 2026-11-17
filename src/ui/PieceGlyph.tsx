/**
 * Original, simple piece glyphs drawn in a 100x100 box. Kept behind this one
 * component so an artist's set can replace them later (CLAUDE.md, Art and sound).
 */
interface Props {
  type: string;
  light: boolean;
  /** Tint for seats beyond White and Black (three and four player games). */
  tint?: string;
}

const PATHS: Record<string, string> = {
  pawn: 'M50 18a13 13 0 1 1 0 26a13 13 0 1 1 0-26z M40 46h20l6 26H34z M26 74h48a4 4 0 0 1 4 4v6H22v-6a4 4 0 0 1 4-4z',
  rook: 'M28 18h10v8h7v-8h10v8h7v-8h10v20l-8 6v26h-28V44l-8-6z M24 74h52a4 4 0 0 1 4 4v6H20v-6a4 4 0 0 1 4-4z',
  knight:
    'M34 72c2-14 12-20 14-30c-6 4-12 6-18 4l-6-8c4-10 12-16 20-22l2-8l6 8c14 2 24 14 24 30c0 10-4 18-6 26z M24 74h52a4 4 0 0 1 4 4v6H20v-6a4 4 0 0 1 4-4z',
  bishop:
    'M50 10a6 6 0 1 1 0 12a6 6 0 1 1 0-12z M50 22c12 8 18 18 18 28c0 10-8 16-18 16s-18-6-18-16c0-10 6-20 18-28z M38 64h24l4 10H34z M24 74h52a4 4 0 0 1 4 4v6H20v-6a4 4 0 0 1 4-4z',
  queen:
    'M18 30l12 34h40l12-34l-14 14l-8-24l-10 22l-10-22l-8 24z M32 64h36l2 10H30z M24 74h52a4 4 0 0 1 4 4v6H20v-6a4 4 0 0 1 4-4z',
  king:
    'M46 6h8v8h8v8h-8v8h-8v-8h-8v-8h8z M50 30c16 0 26 8 26 18c0 8-6 14-8 18H32c-2-4-8-10-8-18c0-10 10-18 26-18z M32 66h36l2 8H30z M24 74h52a4 4 0 0 1 4 4v6H20v-6a4 4 0 0 1 4-4z',
};

const DOTS: Record<string, [number, number, number][]> = {
  queen: [[18, 28, 5], [38, 18, 5], [50, 14, 5], [62, 18, 5], [82, 28, 5]],
  knight: [[56, 28, 3.5]],
};

export function PieceGlyph({ type, light, tint }: Props) {
  const fill = tint ?? (light ? '#fffaf0' : '#2d2a3e');
  const stroke = light && !tint ? '#2d2a3e' : '#0f0d1a';
  const detail = light && !tint ? '#2d2a3e' : '#fffaf0';
  const d = PATHS[type] ?? PATHS.pawn;
  return (
    <g>
      <path d={d} fill={fill} stroke={stroke} strokeWidth={3.5} strokeLinejoin="round" fillRule="evenodd" />
      {(DOTS[type] ?? []).map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={type === 'knight' ? detail : fill} stroke={type === 'knight' ? 'none' : stroke} strokeWidth={3} />
      ))}
      {type === 'bishop' && <path d="M54 34l-8 14" stroke={detail} strokeWidth={4} strokeLinecap="round" />}
      {!PATHS[type] && (
        <text x={50} y={60} textAnchor="middle" fontSize={26} fontWeight={800} fill={detail}>
          {type.slice(0, 2).toUpperCase()}
        </text>
      )}
    </g>
  );
}
