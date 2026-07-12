import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteFavoriteCopy, listFavoriteCopies } from "../api/operations";
import type { FavoriteCopy } from "../api/types";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";

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
      <PageHeader title="收藏夹" subtitle="沉淀优秀文案，供日后一键复用。" />
      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && <div className="notice notice-error">加载失败：{error}</div>}
      {!loading && !error && items.length === 0 && (
        <EmptyState text="暂无收藏。在运营计划详情页点「收藏文案」即可沉淀优秀文案。" icon="⭐" />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="favorite-grid">
          {items.map((it) => (
            <div className="favorite-card" key={it.id}>
              <div className="favorite-head">
                <strong>{it.label}</strong>
                {it.sourcePlanId != null && (
                  <Link to={`/operation-plans/${it.sourcePlanId}`} className="muted">
                    来源 #{it.sourcePlanId}
                  </Link>
                )}
              </div>
              <div className="favorite-tags">
                {it.tags ? `标签：${it.tags}` : it.createdAt}
              </div>
              <pre className="favorite-content">{it.content}</pre>
              <div className="favorite-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => copy(it.content, it.id)}>
                  {copiedId === it.id ? "已复制" : "复制"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => remove(it.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
