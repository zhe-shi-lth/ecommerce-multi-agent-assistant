import { useState } from "react";
import type { Json } from "../api/types";

// 轻量递归 JSON 渲染，对象/数组可折叠，避免引入重型 JSON 树组件。
function Node({ name, value, depth }: { name?: string; value: Json; depth: number }) {
  const [open, setOpen] = useState(depth < 1);

  if (value === null) return <span className="json-null">null</span>;
  if (typeof value !== "object") {
    const cls =
      typeof value === "string"
        ? "json-string"
        : typeof value === "number"
        ? "json-number"
        : "json-bool";
    return (
      <div className="json-row" style={{ paddingLeft: depth * 14 }}>
        {name !== undefined && <span className="json-key">{name}: </span>}
        <span className={cls}>{typeof value === "string" ? `"${value}"` : String(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value);
  const bracket = Array.isArray(value) ? ["[", "]"] : ["{", "}"];

  return (
    <div className="json-row" style={{ paddingLeft: depth * 14 }}>
      <span className="json-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"}
      </span>
      {name !== undefined && <span className="json-key">{name}: </span>}
      <span className="json-bracket">{bracket[0]}</span>
      {!open && <span className="json-collapsed">…</span>}
      {open && (
        <>
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <div style={{ paddingLeft: depth * 14 }}>
            <span className="json-bracket">{bracket[1]}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function JsonView({ data }: { data: Json | null }) {
  if (data === null) return <span className="muted">null</span>;
  return (
    <div className="json-view">
      <Node value={data} depth={0} />
    </div>
  );
}
