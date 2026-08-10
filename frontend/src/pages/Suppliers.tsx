import { useEffect, useMemo, useState } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../api/suppliers";
import type { Supplier, SupplierInput } from "../api/types";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { Icon } from "../components/icons";
import { errMsg } from "../utils/errMsg";

const SETTLEMENT_LABEL: Record<string, string> = {
  MONTHLY: "月结",
  CASH: "现结",
  PREPAID: "预付",
};

const EMPTY_FORM: SupplierInput = {
  name: "",
  contactName: "",
  contactPhone: "",
  address: "",
  settlementType: "CASH",
  leadTimeDays: 0,
  status: "ACTIVE",
  remark: "",
};

export default function Suppliers() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(EMPTY_FORM);
  const [confirmDel, setConfirmDel] = useState<Supplier | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await getSuppliers());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeCount = useMemo(() => rows.filter((r) => r.status === "ACTIVE").length, [rows]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contactName: s.contactName ?? "",
      contactPhone: s.contactPhone ?? "",
      address: s.address ?? "",
      settlementType: s.settlementType ?? "CASH",
      leadTimeDays: s.leadTimeDays,
      status: s.status,
      remark: s.remark ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFeedback({ msg: "请填写商家名称", tone: "error" });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const payload: SupplierInput = { ...form, name: form.name.trim() };
    try {
      if (editing) await updateSupplier(editing.id, payload);
      else await createSupplier(payload);
      setShowForm(false);
      setFeedback({ msg: editing ? "已保存商家信息" : "已新建商家", tone: "ok" });
      await refresh();
    } catch (e) {
      setFeedback({ msg: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    setBusy(true);
    try {
      await deleteSupplier(confirmDel.id);
      setConfirmDel(null);
      setFeedback({ msg: `已删除商家「${confirmDel.name}」`, tone: "ok" });
      await refresh();
    } catch (e) {
      setConfirmDel(null);
      setFeedback({ msg: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <PageHeader
        title="进货商家"
        subtitle="维护供应商主数据：补货建单时可自动带出商家与交期。"
        icon={<Icon name="supplier" />}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" /> 新建商家
          </button>
        }
      />

      {!loading && !error && (
        <div className="ov-strip" style={{ marginBottom: 16 }}>
          <div className="ov-tile ov-ok">
            <div className="ov-value">{rows.length}</div>
            <div className="ov-label">商家总数</div>
          </div>
          <div className="ov-tile">
            <div className="ov-value">{activeCount}</div>
            <div className="ov-label">合作中</div>
          </div>
          <div className="ov-tile">
            <div className="ov-value">{rows.length - activeCount}</div>
            <div className="ov-label">已停用</div>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`notice ${feedback.tone === "error" ? "notice-error" : "notice-ok"}`} style={{ marginBottom: 16 }}>
          {feedback.msg}
        </div>
      )}

      {loading && (
        <div className="loading">
          <span className="spinner" />
          加载中…
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <EmptyState text="还没有进货商家，点右上角「新建商家」添加。" icon="🏭" />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>商家名称</th>
                  <th>联系人</th>
                  <th>电话</th>
                  <th>结算方式</th>
                  <th>交期</th>
                  <th>状态</th>
                  <th style={{ textAlign: "right" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      {s.address && <div className="muted" style={{ fontSize: 12 }}>{s.address}</div>}
                    </td>
                    <td>{s.contactName || "—"}</td>
                    <td>{s.contactPhone || "—"}</td>
                    <td>{s.settlementType ? SETTLEMENT_LABEL[s.settlementType] ?? s.settlementType : "—"}</td>
                    <td>{s.leadTimeDays} 天</td>
                    <td>
                      <span className={`badge ${s.status === "ACTIVE" ? "badge-ok" : "badge-neutral"}`}>
                        {s.status === "ACTIVE" ? "合作中" : "停用"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>
                          <Icon name="edit" /> 编辑
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(s)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editing ? "编辑商家" : "新建商家"}</div>
            <div className="modal-body">
              <div className="listing-form" style={{ marginTop: 0 }}>
                <div className="field">
                  <span>商家名称 *</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="如：义乌小商品批发"
                    autoFocus
                  />
                </div>
                <div className="listing-form" style={{ flexDirection: "row", gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <span>联系人</span>
                    <input value={form.contactName ?? ""} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <span>电话</span>
                    <input value={form.contactPhone ?? ""} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <span>地址</span>
                  <input value={form.address ?? ""} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="listing-form" style={{ flexDirection: "row", gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <span>结算方式</span>
                    <select
                      value={form.settlementType ?? "CASH"}
                      onChange={(e) => setForm((p) => ({ ...p, settlementType: e.target.value as SupplierInput["settlementType"] }))}
                    >
                      <option value="CASH">现结</option>
                      <option value="MONTHLY">月结</option>
                      <option value="PREPAID">预付</option>
                    </select>
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <span>交期（天）</span>
                    <input
                      type="number"
                      min={0}
                      value={form.leadTimeDays ?? 0}
                      onChange={(e) => setForm((p) => ({ ...p, leadTimeDays: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <span>状态</span>
                    <select
                      value={form.status ?? "ACTIVE"}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as SupplierInput["status"] }))}
                    >
                      <option value="ACTIVE">合作中</option>
                      <option value="DISABLED">停用</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <span>备注</span>
                  <textarea rows={2} value={form.remark ?? ""} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={busy}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={busy || !form.name.trim()}>
                {busy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-title">删除商家</div>
            <div className="modal-body">
              <p style={{ margin: 0, color: "var(--text-2)" }}>
                确定删除商家「{confirmDel.name}」吗？已有采购单引用的商家无法删除（可改为「停用」）。
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)} disabled={busy}>
                取消
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>
                {busy ? "删除中…" : "删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
