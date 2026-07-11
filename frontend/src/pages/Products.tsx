import { useEffect, useState } from "react";
import { getProducts } from "../api/products";
import type { Product } from "../api/types";
import StatusBadge from "../components/StatusBadge";

export default function Products() {
  const [rows, setRows] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h2>商品</h2>
      {loading && <p className="muted">加载中…</p>}
      {error && <p className="error">加载失败：{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>类目</th>
              <th>成本</th>
              <th>售价</th>
              <th>目标用户</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{p.costPrice}</td>
                <td>{p.salePrice}</td>
                <td className="muted">{p.targetAudience ?? "—"}</td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
