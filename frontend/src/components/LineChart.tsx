interface ChartPoint {
  label: string;
  value: number;
}

// 轻量 SVG 折线图，无第三方依赖（避免 npm 安装受网络限制）。
export default function LineChart({ data, height = 180 }: { data: ChartPoint[]; height?: number }) {
  const width = 640;
  const pad = 32;
  if (data.length === 0) return <p className="muted">无数据</p>;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(data.length - 1, 1);
  const xy = (d: ChartPoint, i: number) => {
    const x = pad + i * stepX;
    const y = height - pad - ((d.value - min) / range) * (height - pad * 2);
    return { x, y };
  };
  const points = data.map((d, i) => `${xy(d, i).x},${xy(d, i).y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" preserveAspectRatio="xMidYMid meet">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#ccc" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#ccc" />
      <text x={pad} y={pad - 8} fontSize={10} fill="#666">
        {max}
      </text>
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={2} />
      {data.map((d, i) => {
        const { x, y } = xy(d, i);
        return <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" />;
      })}
      {data.map((d, i) =>
        i % 3 === 0 ? (
          <text key={i} x={pad + i * stepX} y={height - 10} fontSize={9} textAnchor="middle" fill="#666">
            {d.label.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}
