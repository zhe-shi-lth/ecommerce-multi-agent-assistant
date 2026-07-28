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

// 轻量 SVG 折线图，无第三方依赖（避免 npm 安装受网络限制）。
export default function LineChart({ data, height = 220 }: { data: ChartPoint[]; height?: number }) {
  const width = 660;
  const padL = 46;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  if (data.length === 0) return <p className="muted">无数据</p>;

  const values = data.map((d) => d.value);
  const yMax = niceMax(Math.max(...values, 0));
  const yMin = 0;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const n = data.length;
  const stepX = plotW / Math.max(n - 1, 1);

  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const points = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(" ");

  // y 轴刻度（0 / 0.25 / 0.5 / 0.75 / 1 倍上限）+ 横向网格线。
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const v = yMin + (yMax - yMin) * t;
    return { v: Math.round(v), y: yOf(v) };
  });

  // x 轴标签：天数少时每天都标；天数多时按 ~12 个等间隔抽稀（仍对齐到真实日期）。
  const labelEvery = n <= 14 ? 1 : Math.ceil(n / 14);
  const rotate = n > 14;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" preserveAspectRatio="xMidYMid meet">
      {/* 横向网格线 + y 轴刻度值 */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={t.y} x2={width - padR} y2={t.y} stroke="#eceef2" />
          <text x={padL - 6} y={t.y + 3} fontSize={9} textAnchor="end" fill="#8a8f98">
            {t.v}
          </text>
        </g>
      ))}

      {/* 坐标轴 */}
      <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="#c9ced6" />
      <line x1={padL} y1={height - padB} x2={width - padR} y2={height - padB} stroke="#c9ced6" />

      {/* 折线与数据点 */}
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={2} />
      {data.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.value)} r={3} fill="#3b82f6" />
      ))}

      {/* x 轴标签（每天/抽稀，对齐真实日期） */}
      {data.map((d, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text
            key={i}
            x={xOf(i)}
            y={height - padB + 14}
            fontSize={9}
            textAnchor={rotate ? "end" : "middle"}
            fill="#8a8f98"
            transform={rotate ? `rotate(-38 ${xOf(i)} ${height - padB + 14})` : undefined}
          >
            {d.label.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}
