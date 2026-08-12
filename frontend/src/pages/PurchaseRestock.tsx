import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  markOrdered,
  markInbound,
  stockIn,
  getPurchaseReceipts,
  cancelPurchaseOrder,
  closeShortPurchaseOrder,
} from "../api/purchase";
import { getInsufficientSummary } from "../api/orders";
import { getProducts } from "../api/products";
import { getInventories } from "../api/inventories";
import { getSuppliers } from "../api/suppliers";
import type {
  InsufficientStockSummary,
  Inventory,
  Product,
  PurchaseOrder,
  PurchaseReceipt,
  RecheckAllResult,
  Supplier,
} from "../api/types";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";
import { errMsg } from "../utils/errMsg";
import { getAuditLogs, type BusinessAuditLog } from "../api/audit";

// 采购单生命周期 → 中文标签 + 配色
const PO_STATUS_META: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  PENDING_APPROVAL: { label: "待审批", tone: "warn" },
  REJECTED: { label: "已驳回", tone: "bad" },
  CREATED: { label: "待采购", tone: "warn" },
  ORDERED: { label: "已下单", tone: "neutral" },
  INBOUND: { label: "待入库", tone: "warn" },
  PARTIALLY_RECEIVED: { label: "部分到货", tone: "warn" },
  STOCKED: { label: "已入库", tone: "ok" },
  CANCELLED: { label: "已取消", tone: "neutral" },
  CLOSED_SHORT: { label: "短交关闭", tone: "neutral" },
};
function poStatusMeta(s: string): { label: string; tone: "ok" | "warn" | "bad" | "neutral" } {
  return PO_STATUS_META[s] ?? { label: s, tone: "neutral" };
}

type Tone = "ok" | "warn" | "bad" | "neutral";

function recheckMsg(r: RecheckAllResult): string {
  const parts: string[] = [];
  if (r.readyToShip > 0) parts.push(`翻回可发货 ${r.readyToShip} 笔`);
  if (r.stillInsufficient > 0) parts.push(`仍不足 ${r.stillInsufficient} 笔`);
  if (r.other > 0) parts.push(`转其他态 ${r.other} 笔`);
  return r.total === 0 ? "无缺货订单" : `共 ${r.total} 笔：${parts.join("，") || "无变化"}`;
}

function money(v?: number | string | null): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return isNaN(n) ? "—" : `¥${n.toFixed(2)}`;
}

interface CreateForm {
  productId: number | null;
  quantity: number;
  supplierId: number | null;
  unitCost: string;
  purchaseShippingFee: string;
  expectedArrivalAt: string;
  note: string;
}

export default function PurchaseRestock() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [insufficient, setInsufficient] = useState<InsufficientStockSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [auditOrder, setAuditOrder] = useState<PurchaseOrder | null>(null);
  const [auditLogs, setAuditLogs] = useState<BusinessAuditLog[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [closeAction, setCloseAction] = useState<{ order: PurchaseOrder; type: "cancel" | "short" } | null>(null);
  const [closeReason, setCloseReason] = useState("");

  // 创建采购单弹窗（成本闭环：手动填写商家 / 单价 / 进货运费）
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>({
    productId: null,
    quantity: 1,
    supplierId: null,
    unitCost: "",
    purchaseShippingFee: "",
    expectedArrivalAt: "",
    note: "",
  });

  // 确认入库弹窗（支持实际到货数量：买 100 到 98，也支持买 100 到 105 多到货）
  const [stockModalOpen, setStockModalOpen] = useState(false);
  // 实际入库多于采购时的二次确认弹窗（供应商多发 / 赠品）
  const [overConfirmOpen, setOverConfirmOpen] = useState(false);
  const [stockForm, setStockForm] = useState<{
    id: number;
    productId: number;
    quantity: number;
    totalCost: number;
    receivedQuantity: number;
    remainingQuantity: number;
    receiptNo: string;
    actualQuantity: number;
    note: string;
  }>({ id: 0, productId: 0, quantity: 0, totalCost: 0, receivedQuantity: 0, remainingQuantity: 0, receiptNo: "", actualQuantity: 0, note: "" });

  async function loadAll() {
    setLoading(true);
    try {
      const [pos, ins, ps, invs, ss] = await Promise.all([
        getPurchaseOrders(),
        getInsufficientSummary(),
        getProducts(),
        getInventories(),
        getSuppliers(),
      ]);
      setOrders(pos);
      setInsufficient(ins);
      setProducts(ps);
      setInventories(invs);
      setSuppliers(ss);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function productName(id: number): string {
    const p = products.find((x) => x.id === id);
    return p ? p.name : `商品 #${id}`;
  }

  const created = useMemo(
    () => orders.filter((o) => o.status === "CREATED" || o.status === "ORDERED"),
    [orders]
  );
  const inbound = useMemo(() => orders.filter((o) => o.status === "INBOUND" || o.status === "PARTIALLY_RECEIVED"), [orders]);
  const stocked = useMemo(() => orders.filter((o) => ["STOCKED", "CLOSED_SHORT", "CANCELLED", "REJECTED"].includes(o.status)), [orders]);
  const pendingApproval = useMemo(() => orders.filter((o) => o.status === "PENDING_APPROVAL"), [orders]);

  const insufficientOrderCount = insufficient.reduce((sum, s) => sum + s.orderCount, 0);
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.status === "ACTIVE"), [suppliers]);
  const purchaseOrderByProductId = useMemo(() => {
    const m = new Map<number, PurchaseOrder>();
    for (const o of orders) {
      if (["STOCKED", "CLOSED_SHORT", "CANCELLED", "REJECTED"].includes(o.status)) continue;
      if (!m.has(o.productId)) m.set(o.productId, o);
    }
    return m;
  }, [orders]);

  // 全部在售（上架）商品，供运营主动选择补多少
  const publishedProducts = useMemo(
    () => products.filter((p) => p.status === "PUBLISHED"),
    [products]
  );
  // 商品 id → 库存不足摘要（用于行内展示缺口 / 积压）
  const insufficientMap = useMemo(() => {
    const m = new Map<number, InsufficientStockSummary>();
    for (const s of insufficient) m.set(s.productId, s);
    return m;
  }, [insufficient]);
  // 商品 id → 当前库存（来自库存表）
  const stockMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const inv of inventories) m.set(inv.productId, inv.currentStock);
    return m;
  }, [inventories]);
  // 商品 id → 库存记录（含安全阈值，用于水位排序）
  const invMap = useMemo(() => {
    const m = new Map<number, Inventory>();
    for (const inv of inventories) m.set(inv.productId, inv);
    return m;
  }, [inventories]);
  // 商家 id → 商家（用于展示交期等）
  const supplierById = useMemo(() => {
    const m = new Map<number, Supplier>();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);

  // 板块 1：在售商品按名称搜索 + 按库存水位排序（缺货优先，再按 当前/安全阈值 比值升序）
  const filteredPublished = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = publishedProducts.filter(
      (p) => !q || p.name.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      const aIns = insufficientMap.get(a.id);
      const bIns = insufficientMap.get(b.id);
      if (!!aIns !== !!bIns) return aIns ? -1 : 1;
      const ratio = (id: number) => {
        const inv = invMap.get(id);
        if (!inv || inv.safeStockThreshold <= 0) return Number.MAX_SAFE_INTEGER;
        return inv.currentStock / inv.safeStockThreshold;
      };
      return ratio(a.id) - ratio(b.id);
    });
  }, [publishedProducts, search, insufficientMap, invMap]);

  async function run<T>(p: Promise<T>, okMsg: (r: T) => string, refresh = false) {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await p;
      if (r && typeof r === "object" && "id" in r && "status" in r) {
        const updatedOrder = r as unknown as PurchaseOrder;
        setOrders((current) => current.map((item) => item.id === updatedOrder.id ? updatedOrder : item));
      }
      setFeedback({ msg: okMsg(r), tone: "ok" });
      if (refresh) await loadAll();
    } catch (e: unknown) {
      setFeedback({ msg: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  // 打开发起采购申请弹窗：带出商品默认补货量、主供货商、当前成本价作为默认进货单价。
  function openCreate(productId: number) {
    if (activeSuppliers.length === 0) {
      setFeedback({ msg: "请先建立并启用进货商家，再发起采购申请。", tone: "error" });
      return;
    }
    const product = products.find((p) => p.id === productId);
    const ins = insufficientMap.get(productId);
    setForm({
      productId,
      quantity: ins ? ins.shortQuantity : 1,
      supplierId: product?.supplierId ?? null,
      unitCost: product?.costPrice != null ? String(product.costPrice) : "",
      purchaseShippingFee: "",
      expectedArrivalAt: "",
      note: "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  // 弹窗内成本自动算
  const num = (v: string) => {
    const n = Number(v);
    return isNaN(n) || n < 0 ? 0 : n;
  };
  const modalProductAmount = num(form.unitCost) * (form.quantity || 0);
  const modalTotalCost = modalProductAmount + num(form.purchaseShippingFee);
  const modalLandedUnitCost = form.quantity > 0 ? modalTotalCost / form.quantity : 0;

  function submitCreate() {
    if (!form.quantity || form.quantity < 1) {
      setFormError("请填写补货数量，至少 1 件。");
      return;
    }
    if (form.supplierId == null) {
      setFormError("请选择已有的进货商家后再提交采购申请。");
      return;
    }
    setFormError(null);
    const pid = form.productId;
    if (pid == null) return;
    if (!form.quantity || form.quantity < 1) {
      setFeedback({ msg: "请填写补货数量（至少 1 件）", tone: "error" });
      return;
    }
    if (form.supplierId == null) {
      setFeedback({ msg: "请选择已有的进货商家。", tone: "error" });
      return;
    }
    // 日期仅含 YYYY-MM-DD，补成完整 ISO 时刻供后端 Instant 解析。
    // 用 +08:00 表示中国时区当天零点，避免 UTC(Z) 导致的日期偏移隐患。
    const arrival = form.expectedArrivalAt ? `${form.expectedArrivalAt}T00:00:00+08:00` : null;
    run(
      createPurchaseOrder({
        productId: pid,
        quantity: form.quantity,
        supplierId: form.supplierId,
        unitCost: num(form.unitCost),
        purchaseShippingFee: num(form.purchaseShippingFee),
        expectedArrivalAt: arrival,
        note: form.note || undefined,
      }),
      (createdOrder) => {
        setOrders((current) => [createdOrder, ...current]);
        closeModal();
        return `已提交「${productName(pid)}」采购申请（${form.quantity} 件${
          form.supplierId && supplierById.get(form.supplierId) ? `，商家：${supplierById.get(form.supplierId)!.name}` : ""
        }，总成本 ${money(modalTotalCost)}，待审批）`;
      }
    );
  }

  // 打开确认入库弹窗：实际入库数量默认等于本单剩余未到货数量。
  function openStockIn(o: PurchaseOrder) {
    const receivedQuantity = o.receivedQuantity ?? o.actualQuantity ?? 0;
    const remainingQuantity = o.remainingQuantity ?? Math.max(0, o.quantity - receivedQuantity);
    setStockForm({
      id: o.id,
      productId: o.productId,
      quantity: o.quantity,
      totalCost: o.totalCost != null ? Number(o.totalCost) : 0,
      receivedQuantity,
      remainingQuantity,
      receiptNo: `PR-${o.id}-${Date.now()}`,
      actualQuantity: remainingQuantity,
      note: "",
    });
    setStockModalOpen(true);
  }

  async function openAudit(o: PurchaseOrder) {
    setAuditOrder(o);
    try {
      const [logs, receiptRows] = await Promise.all([
        getAuditLogs("PURCHASE_ORDER", o.id),
        getPurchaseReceipts(o.id),
      ]);
      setAuditLogs(logs);
      setReceipts(receiptRows);
    } catch (e) {
      setFeedback({ msg: errMsg(e), tone: "error" });
    }
  }

  function submitStockIn() {
    if (stockForm.actualQuantity == null || stockForm.actualQuantity < 1) {
      setFeedback({ msg: "实际入库数量至少为 1 件", tone: "error" });
      return;
    }
    // 实际入库多于采购：不静默拦截，弹窗二次确认（供应商多发 / 赠品场景）。
    if (!stockForm.receiptNo.trim()) {
      setFeedback({ msg: "请填写到货批次号", tone: "error" });
      return;
    }
    if (stockForm.actualQuantity > stockForm.remainingQuantity) {
      setOverConfirmOpen(true);
      return;
    }
    doStockIn();
  }

  async function doStockIn() {
    await run(
      stockIn(stockForm.id, { receiptNo: stockForm.receiptNo.trim(), actualQuantity: stockForm.actualQuantity, note: stockForm.note || undefined }),
      (r) => {
        setOrders((current) => current.map((item) => item.id === stockForm.id
          ? r.purchaseOrder
          : item));
        setStockModalOpen(false);
        setOverConfirmOpen(false);
        const diff = stockForm.remainingQuantity - stockForm.actualQuantity;
        let tail = "";
        if (diff > 0) tail = `（本批到货后仍有 ${diff} 件待到货）`;
        else if (diff < 0) tail = `（实际到货多 ${-diff} 件，按赠品/多发入库，单件成本已重算）`;
        return `已入库，库存已增加；${recheckMsg(r.recheck)}${tail}`;
      }
    );
  }

  function submitCloseAction() {
    if (!closeAction || !closeReason.trim()) {
      setFeedback({ msg: "请填写处理原因", tone: "error" });
      return;
    }
    const { order, type } = closeAction;
    run(
      type === "cancel"
        ? cancelPurchaseOrder(order.id, closeReason.trim())
        : closeShortPurchaseOrder(order.id, closeReason.trim()),
      () => type === "cancel" ? "采购单已取消" : "采购单已按实际到货数量短交关闭",
    );
    setCloseAction(null);
    setCloseReason("");
  }

  if (loading)
    return (
      <div className="loading">
        <span className="spinner" />
        加载中…
      </div>
    );
  if (error) return <div className="notice notice-error">{error}</div>;

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="pr-row">{children}</div>
  );
  const Badge = ({ label, tone }: { label: string; tone: Tone }) => (
    <span className={`badge badge-${tone}`}>{label}</span>
  );

  // 进行中采购单 = 待审批 + 待采购 + 待入库
  const inProgress = pendingApproval.length + created.length + inbound.length;

  // 采购单行内成本明细（成本闭环可视化）
  const costTags = (o: PurchaseOrder) => (
    <>
      <span className="mini neutral">申请 #{o.id}</span>
      {o.createdAt && <span className="mini neutral">创建于 {new Date(o.createdAt).toLocaleString("zh-CN")}</span>}
      <span className="mini neutral">{o.quantity} 件</span>
      {(o.receivedQuantity ?? 0) > 0 && <span className="mini neutral">已到 {o.receivedQuantity} / 待到 {o.remainingQuantity}</span>}
      <span className="mini neutral">{o.supplierName || "供应商未填"}</span>
      {o.totalCost != null && o.totalCost !== "" && (
        <span className="mini warn">{money(o.totalCost)}</span>
      )}
      {o.landedUnitCost != null && o.landedUnitCost !== "" && (
        <span className="mini neutral">单件 {money(o.landedUnitCost)}</span>
      )}
      {o.inboundNote ? <span className="mini warn">入库备注：{o.inboundNote}</span> : null}
    </>
  );

  const auditButton = (o: PurchaseOrder) => (
    <button className="btn btn-secondary btn-sm" onClick={() => openAudit(o)} disabled={busy}>
      操作记录
    </button>
  );

  return (
    <section>
      <PageHeader
        title="采购补货"
        subtitle="库存处理工作台：先提交采购申请，审批通过后下单入库，入库后自动刷新缺货订单。"
        icon={<Icon name="purchase" />}
      />

      <div className="kpi-strip">
        <div
          className={`kpi-tile ${insufficientOrderCount > 0 ? "kpi-bad" : ""}`}
          onClick={
            insufficientOrderCount > 0
              ? () => navigate("/orders?status=INSUFFICIENT_STOCK")
              : undefined
          }
          style={insufficientOrderCount > 0 ? { cursor: "pointer" } : undefined}
          title={insufficientOrderCount > 0 ? "查看缺货订单" : undefined}
        >
          <div className="kpi-value">{insufficientOrderCount}</div>
          <div className="kpi-label">关联缺货订单（笔）</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-value">{insufficient.length}</div>
          <div className="kpi-label">缺货商品（个）</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-value">{publishedProducts.length}</div>
          <div className="kpi-label">在售商品（个）</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-value">{inProgress}</div>
          <div className="kpi-label">进行中采购单（单）</div>
        </div>
      </div>

      {feedback && (
        <div className={`notice ${feedback.tone === "error" ? "notice-error" : "notice-ok"}`} style={{ marginBottom: 16 }}>
          {feedback.msg}
        </div>
      )}
      {activeSuppliers.length === 0 && (
        <div className="notice notice-error" style={{ marginBottom: 16 }}>
          还没有可用的进货商家。请先在「供应商」中建立并启用商家，采购单必须选择真实商家。
        </div>
      )}

      {/* 板块 1：发起采购申请（全部在售商品） */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>发起采购申请（全部在售商品）</h3>
          <span className="card-sub">
            {filteredPublished.length}
            {filteredPublished.length !== publishedProducts.length
              ? ` / ${publishedProducts.length}`
              : ""} 个在售商品
          </span>
        </div>
        <div className="pr-toolbar">
          <input
            className="filter-input pr-search"
            placeholder="搜索商品名称…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="mini neutral">排序：缺货优先 → 库存水位由低到高</span>
        </div>
        {filteredPublished.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>
            {publishedProducts.length === 0
              ? "暂无在售商品，请先在「库存」中上架商品。"
              : `没有匹配「${search}」的在售商品。`}
          </div>
        ) : (
          filteredPublished.map((p) => {
            const ins = insufficientMap.get(p.id);
            const po = purchaseOrderByProductId.get(p.id);
            const canCreate = activeSuppliers.length > 0 && !busy;
            return (
              <Row key={p.id}>
                <div className="pr-row-name">{p.name}</div>
                <div className="pr-row-tags">
                  <span className="mini neutral">库存 {stockMap.get(p.id) ?? 0}</span>
                  {ins ? (
                    <>
                      <span className="mini bad">积压 {ins.orderCount} 笔</span>
                      <span className="mini bad">缺 {ins.shortQuantity} 件</span>
                    </>
                  ) : (
                    <span className="mini ok">库存充足</span>
                  )}
                  {p.supplierName && <span className="mini neutral">商家 {p.supplierName}</span>}
                  {p.supplierId && supplierById.get(p.supplierId)?.leadTimeDays ? (
                    <span className="mini warn">
                      交期 {supplierById.get(p.supplierId)!.leadTimeDays} 天
                    </span>
                  ) : null}
                  {po ? (
                    <span className="mini neutral">采购申请：{poStatusMeta(po.status).label}</span>
                  ) : (
                    <span className="mini neutral">未发起采购申请</span>
                  )}
                </div>
                <div className="pr-row-spacer" />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canCreate}
                  onClick={() => openCreate(p.id)}
                  title={activeSuppliers.length === 0 ? "请先建立进货商家" : "发起采购申请"}
                >
                  <Icon name="plus" /> 发起采购申请
                </button>
              </Row>
            );
          })
        )}
      </div>

      {pendingApproval.length > 0 && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          有 {pendingApproval.length} 单采购申请等待运营计划审批，通过后会进入下方已审批采购单。
        </div>
      )}

      {/* 板块 2：已审批采购单（待采购 / 已下单） */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>已审批采购单</h3>
          <span className="card-sub">{created.length} 单</span>
        </div>
        {created.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>
            暂无已审批采购单。
          </div>
        ) : (
          created.map((o) => (
            <Row key={o.id}>
              <div className="pr-row-name">{productName(o.productId)}</div>
              <Badge label={poStatusMeta(o.status).label} tone={poStatusMeta(o.status).tone} />
              <div className="pr-row-tags">{costTags(o)}</div>
              <div className="pr-row-spacer" />
              {auditButton(o)}
              {o.status === "CREATED" && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(markOrdered(o.id), () => "已标记为已下单")}>
                  标记已下单
                </button>
              )}
              {o.status === "ORDERED" && (
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(markInbound(o.id), () => "已标记为待入库")}>
                  标记待入库
                </button>
              )}
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setCloseAction({ order: o, type: "cancel" }); setCloseReason(""); }}>
                取消采购
              </button>
            </Row>
          ))
        )}
      </div>

      {/* 板块 3：待入库 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>待入库</h3>
          <span className="card-sub">{inbound.length} 单</span>
        </div>
        {inbound.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>
            没有待入库的采购单。
          </div>
        ) : (
          inbound.map((o) => (
            <Row key={o.id}>
              <div className="pr-row-name">{productName(o.productId)}</div>
              <Badge label={poStatusMeta(o.status).label} tone={poStatusMeta(o.status).tone} />
              <div className="pr-row-tags">{costTags(o)}</div>
              <div className="pr-row-spacer" />
              {auditButton(o)}
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => openStockIn(o)}>
                <Icon name="check" /> 确认入库
              </button>
              {o.status === "INBOUND" && (o.receivedQuantity ?? 0) === 0 && (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setCloseAction({ order: o, type: "cancel" }); setCloseReason(""); }}>
                  取消采购
                </button>
              )}
              {o.status === "PARTIALLY_RECEIVED" && (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setCloseAction({ order: o, type: "short" }); setCloseReason(""); }}>
                  短交关闭
                </button>
              )}
            </Row>
          ))
        )}
      </div>

      {/* 板块 4：已入库记录 */}
      <div className="card">
        <div className="card-header">
          <h3>已完成与关闭记录</h3>
          <span className="card-sub">{stocked.length} 单</span>
        </div>
        {stocked.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>
            还没有已完成或已关闭的采购单。
          </div>
        ) : (
          stocked.map((o) => (
            <Row key={o.id}>
              <div className="pr-row-name">{productName(o.productId)}</div>
              <Badge label={poStatusMeta(o.status).label} tone={poStatusMeta(o.status).tone} />
              <div className="pr-row-tags">{costTags(o)}</div>
              <div className="pr-row-spacer" />
              {auditButton(o)}
              <span className="mini neutral">入库时已自动重查缺货订单</span>
            </Row>
          ))
        )}
      </div>

      {auditOrder && (
        <div className="modal-overlay" onClick={() => setAuditOrder(null)}>
          <div className="modal" style={{ maxWidth: 620, width: "92%" }} role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">采购申请 #{auditOrder.id} 操作记录</div>
            <div className="modal-body">
              {auditLogs.length === 0 ? (
                <div className="notice notice-info">暂无操作记录。</div>
              ) : auditLogs.map((log) => (
                <div className="pr-row" key={log.id}>
                  <div className="pr-row-name">{log.action}</div>
                  <div className="pr-row-tags">
                    {log.beforeStatus && <span className="mini neutral">{log.beforeStatus} → {log.afterStatus}</span>}
                    <span className="mini neutral">操作人 {log.operator}</span>
                    <span className="mini neutral">{new Date(log.createdAt).toLocaleString("zh-CN")}</span>
                    {log.detail && <span className="mini warn">{log.detail}</span>}
                  </div>
                </div>
              ))}
              <div className="card-header" style={{ marginTop: 18, padding: 0 }}>
                <h3>到货批次</h3>
                <span className="card-sub">{receipts.length} 批</span>
              </div>
              {receipts.length === 0 ? (
                <div className="notice notice-info" style={{ marginTop: 10 }}>暂无到货批次。</div>
              ) : receipts.map((receipt) => (
                <div className="pr-row" key={receipt.id}>
                  <div className="pr-row-name">{receipt.receiptNo}</div>
                  <div className="pr-row-tags">
                    <span className="mini neutral">{receipt.quantity} 件</span>
                    <span className="mini neutral">{new Date(receipt.receivedAt).toLocaleString("zh-CN")}</span>
                    <span className="mini neutral">{receipt.operator}</span>
                    {receipt.note && <span className="mini warn">{receipt.note}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAuditOrder(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 发起采购申请弹窗（成本闭环表单） */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            style={{ maxWidth: 560, width: "92%" }}
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">发起采购申请</div>
            {formError && (
              <div className="notice notice-error" style={{ margin: "0 18px 12px" }} role="alert">
                {formError}
              </div>
            )}
            <div className="modal-body" style={{ paddingTop: 4 }}>
              <div style={{ marginBottom: 14 }}>
                <div className="mini neutral">商品</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>
                  {form.productId != null ? productName(form.productId) : "—"}
                </div>
              </div>

              <div className="pr-form-grid">
                <label className="field">
                  <span>进货商家</span>
                  <select
                    className="header-select"
                    value={form.supplierId ?? ""}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, supplierId: e.target.value ? Number(e.target.value) : null }));
                      setFormError(null);
                    }}
                  >
                    <option value="">请选择已有进货商家</option>
                    {activeSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.leadTimeDays ? `（交期 ${s.leadTimeDays} 天）` : ""}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="field">
                  <span>补货数量（件）</span>
                  <input
                    className="filter-input"
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                  />
                </label>

                <label className="field">
                  <span>进货单价（元）</span>
                  <input
                    className="filter-input"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={form.unitCost}
                    onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                  />
                </label>

                <label className="field">
                  <span>进货运费（元）</span>
                  <input
                    className="filter-input"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={form.purchaseShippingFee}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseShippingFee: e.target.value }))}
                  />
                </label>

                <label className="field">
                  <span>预计到货时间</span>
                  <input
                    className="filter-input"
                    type="date"
                    value={form.expectedArrivalAt}
                    onChange={(e) => setForm((f) => ({ ...f, expectedArrivalAt: e.target.value }))}
                  />
                </label>

                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>备注</span>
                  <input
                    className="filter-input"
                    placeholder="选填"
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </label>
              </div>

              <div className="pr-cost-summary">
                <div>
                  <span className="mini neutral">商品金额</span>
                  <strong>{money(modalProductAmount)}</strong>
                </div>
                <div>
                  <span className="mini neutral">采购总成本</span>
                  <strong>{money(modalTotalCost)}</strong>
                </div>
                <div>
                  <span className="mini neutral">单件综合成本</span>
                  <strong>{money(modalLandedUnitCost)}</strong>
                </div>
              </div>
              <div className="mini neutral" style={{ marginTop: 6 }}>
                总成本 = 商品金额 + 进货运费；单件综合成本 = 总成本 ÷ 补货数量。入库后单件综合成本写回商品成本价。
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeModal} disabled={busy}>
                取消
              </button>
              <button className="btn btn-primary" onClick={submitCreate} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" />}
                提交采购申请
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认入库弹窗：支持实际到货数量（买 100 到 98）与破损/少发备注 */}
      {stockModalOpen && (
        <div className="modal-overlay" onClick={() => setStockModalOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: 480, width: "92%" }}
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">确认入库</div>
            <div className="modal-body" style={{ paddingTop: 4 }}>
              <div style={{ marginBottom: 14 }}>
                <div className="mini neutral">商品</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>
                  {stockForm.productId != null ? productName(stockForm.productId) : "—"}
                </div>
              </div>
              <div className="pr-form-grid">
                <label className="field">
                  <span>采购数量（件）</span>
                  <input className="filter-input" type="number" value={stockForm.quantity} disabled />
                </label>
                <label className="field">
                  <span>累计已到 / 剩余</span>
                  <input className="filter-input" value={`${stockForm.receivedQuantity} / ${stockForm.remainingQuantity}`} disabled />
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>到货批次号</span>
                  <input className="filter-input" value={stockForm.receiptNo} onChange={(e) => setStockForm((f) => ({ ...f, receiptNo: e.target.value }))} />
                </label>
                <label className="field">
                  <span>实际入库数量（件）</span>
                  <input
                    className="filter-input"
                    type="number"
                    min={1}
                    value={stockForm.actualQuantity}
                    onChange={(e) => setStockForm((f) => ({ ...f, actualQuantity: Number(e.target.value) }))}
                  />
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span>破损 / 少发备注</span>
                  <input
                    className="filter-input"
                    placeholder="选填，如：运输破损 2 件"
                    value={stockForm.note}
                    onChange={(e) => setStockForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </label>
              </div>
              <div className="pr-cost-summary">
                <div>
                  <span className="mini neutral">采购总成本</span>
                  <strong>{money(stockForm.totalCost)}</strong>
                </div>
                <div>
                  <span className="mini neutral">最终单件综合成本</span>
                  <strong>
                    {money(stockForm.actualQuantity > 0 ? stockForm.totalCost / stockForm.actualQuantity : 0)}
                  </strong>
                </div>
              </div>
              <div className="mini neutral" style={{ marginTop: 6 }}>
                单件综合成本 = 采购总成本 ÷ 实际入库数量；少发会摊高单件成本并写回商品成本价。
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setStockModalOpen(false)} disabled={busy}>
                取消
              </button>
              <button className="btn btn-primary" onClick={submitStockIn} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" />}
                确认入库
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 实际入库多于采购的二次确认（供应商多发 / 赠品） */}
      {overConfirmOpen && (
        <div className="modal-overlay" onClick={() => setOverConfirmOpen(false)}>
          <div
            className="modal"
            role="dialog"
            style={{ maxWidth: 460, width: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">实际入库多于采购</div>
            <div className="modal-body" style={{ paddingTop: 4 }}>
              <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.7 }}>
                本次采购 <strong>{stockForm.quantity}</strong> 件，实际入库{" "}
                <strong>{stockForm.actualQuantity}</strong> 件，多到货{" "}
                <strong>{stockForm.actualQuantity - stockForm.quantity}</strong> 件。
                <br />
                多到的部分将按「赠品 / 供应商多发」一并入库，单件综合成本会相应摊低并写回商品成本价。是否确认入库？
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOverConfirmOpen(false)} disabled={busy}>
                取消
              </button>
              <button className="btn btn-primary" onClick={doStockIn} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" />}
                确认入库（多到货）
              </button>
            </div>
          </div>
        </div>
      )}

      {closeAction && (
        <div className="modal-overlay" onClick={() => setCloseAction(null)}>
          <div className="modal" role="dialog" style={{ maxWidth: 460, width: "92%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{closeAction.type === "cancel" ? "取消采购单" : "短交关闭采购单"}</div>
            <div className="modal-body">
              <p className="muted">
                {closeAction.type === "cancel"
                  ? "取消后该采购单终止，不能继续下单或入库。"
                  : `将按已到货 ${closeAction.order.receivedQuantity} 件结算并关闭剩余 ${closeAction.order.remainingQuantity} 件。`}
              </p>
              <label className="field">
                <span>处理原因</span>
                <textarea rows={3} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} autoFocus />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCloseAction(null)} disabled={busy}>返回</button>
              <button className="btn btn-danger" onClick={submitCloseAction} disabled={busy}>确认处理</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
