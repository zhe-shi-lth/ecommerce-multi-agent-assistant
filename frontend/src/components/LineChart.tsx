import { useRef, useState } from "react";

interface ChartPoint {
  label: string;
  value: number;
}

// 把原始最大值向上取整到「好看」的刻度上限（1 / 2 / 2.5 / 5 / 10 × 10^n）。
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  let m: number;
  if (n <= 1) m = 1;
  else if (n <= 2) m = 2;
  else if (n <= 2.5) m = 2.5;
  else if (n <= 5) m = 5;
  else m = 10;
  return m * pow;
}

// 紧凑数字格式化（12000 -> 1.2万，1234 -> 1234），便于纵轴与 tooltip 显示。
function fmtNum(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(v % 10000 === 0 ? 0 : 1) + "万";
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  return String(Math.round(v));
}

// Catmull-Rom -> 三次贝塞尔，得到平滑曲线（比生硬折线更精致）。
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 3) return "M " + pts.map((p) => `${p.x},${p.y}`).join(" L ");
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

const W = 720;
const PAD_L = 46;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 42;

export default function LineChart({
  data,
  height = 240,
  unit,
}: {
  data: ChartPoint[];
  height?: number;
  unit?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return <p className="muted">无数据</p>;

  const H = height;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = data.length;
  const stepX = plotW / Math.max(n - 1, 1);
  const yMax = niceMax(Math.max(...data.map((d) => d.value), 1));

  const xOf = (i: number) => PAD_L + i * stepX;
  const yOf = (v: number) => PAD_T + plotH - (v / yMax) * plotH;

  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.value) }));
  const linePath = smoothPath(pts);
  const areaPath = `${linePath} L ${xOf(n - 1).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L ${PAD_L},${PAD_T + plotH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    v: Math.round(yMax * t),
    y: yOf(yMax * t),
  }));

  const labelEvery = n <= 14 ? 1 : Math.ceil(n / 14);
  const rotate = n > 14;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let i = Math.round((x - PAD_L) / stepX);
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  }

  const hd = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? (xOf(hover) / W) * 100 : 0;
  const tipTop = hover != null ? (yOf(data[hover].value) / H) * 100 : 0;

  return (
    <div className="line-chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="line-chart"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="销售趋势折线图"
      >
        <defs>
          <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff2442" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#ff2442" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* 横向网格线 + 纵轴刻度值 */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="lc-grid" x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} />
            <text className="lc-axis" x={PAD_L - 8} y={t.y + 4} textAnchor="end">
              {fmtNum(t.v)}
            </text>
          </g>
        ))}

        {/* 坐标轴 */}
        <line className="lc-axis-line" x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} />
        <line className="lc-axis-line" x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} />

        {/* 面积 + 折线 */}
        <path className="lc-area" d={areaPath} fill="url(#lc-area)" />
        <path className="lc-line" d={linePath} pathLength={1} />

        {/* 数据点（悬停高亮） */}
        {pts.map((p, i) => (
          <circle
            key={i}
            className={"lc-dot" + (hover === i ? " active" : "")}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 5 : 3}
          />
        ))}

        {/* 悬停指示线 */}
        {hover != null && (
          <line className="lc-hover" x1={xOf(hover)} y1={PAD_T} x2={xOf(hover)} y2={H - PAD_B} />
        )}

        {/* x 轴标签 */}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text
              key={i}
              className="lc-axis"
              x={xOf(i)}
              y={H - PAD_B + 16}
              textAnchor={rotate ? "end" : "middle"}
              transform={rotate ? `rotate(-38 ${xOf(i)} ${H - PAD_B + 16})` : undefined}
            >
              {d.label}
            </text>
          ) : null
        )}
      </svg>

      {hd && (
        <div className="lc-tip" style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}>
          <div className="lc-tip-date">{hd.label}</div>
          <div className="lc-tip-val">
            {fmtNum(hd.value)}
            {unit ? ` ${unit}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
