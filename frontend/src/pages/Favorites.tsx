import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteFavoriteCopy, listFavoriteCopies } from "../api/operations";
import type { FavoriteCopy } from "../api/types";

export default function Favorites() {
  const [items, setItems] = useState<FavoriteCopy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function load() {
    listFavoriteCopies()
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function copy(text: string, id: number) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }

  async function remove(id: number) {
    await deleteFavoriteCopy(id);
    load();
  }

  return (
    <section>
      <h2>收藏夹（可复用文案）</h2>
      {loading && <p className="muted">加载中…</p>}
      {error && <p className="error">加载失败：{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="muted">
          暂无收藏。在运营计划详情页点「收藏文案」即可沉淀优秀文案，供日后复用。
        </p>
      )}
      {items.map((it) => (
        <div className="favorite-card" key={it.id}>
          <div className="favorite-head">
            <strong>{it.label}</strong>
            {it.sourcePlanId != null && (
              <Link to={`/operation-plans/${it.sourcePlanId}`} className="muted">
                来源 #{it.sourcePlanId}
              </Link>
            )}
            <span className="muted">{it.createdAt}</span>
          </div>
          {it.tags && <div className="favorite-tags">标签：{it.tags}</div>}
          <pre className="favorite-content">{it.content}</pre>
          <div className="favorite-actions">
            <button onClick={() => copy(it.content, it.id)}>
              {copiedId === it.id ? "已复制" : "复制"}
            </button>
            <button onClick={() => remove(it.id)}>删除</button>
          </div>
        </div>
      ))}
    </section>
  );
}
