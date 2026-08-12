import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getOrder, completeAddress, markPaid, shipOrder, reviewOrder, recheckOrder,
  cancelOrder } from "../api/orders";
import { approveAfterSaleRefund, createAfterSale, getAfterSales, receiveAfterSaleReturn, rejectAfterSale } from "../api/afterSales";
import { getProducts } from "../api/products";
import { getInventories, getInventoryMovements } from "../api/inventories";
import type { AfterSalesOrder, InventoryMovement, Order, Product } from "../api/types";
import { platformLabel } from "../platforms";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";
import { errMsg } from "../utils/errMsg";
import { getAuditLogs, type BusinessAuditLog } from "../api/audit";

// 订单状态 → 中文标签 + 配色（与列表页一致）
const STATUS_META: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  READY_TO_SHIP: { label: "可发货", tone: "ok" },
  PENDING_ANALYSIS: { label: "待分析", tone: "warn" },
  NEEDS_REVIEW: { label: "需人工审核", tone: "bad" },
  INSUFFICIENT_STOCK: { label: "库存不足", tone: "bad" },
  SHIPPED: { label: "已发货", tone: "ok" },
  REJECTED: { label: "已驳回", tone: "bad" },
  SHIPPING_FAILED: { label: "发货失败", tone: "bad" },
  CANCELLED: { label: "已取消", tone: "neutral" },
  REFUNDED: { label: "已退款", tone: "warn" },
  RETURNED: { label: "已退货入库", tone: "neutral" },
};

// 可选物流公司（与后端 OrderCompletionService.LOGISTICS 保持一致）
const LOGISTICS_COMPANIES = ["顺丰速运", "中通快递", "圆通速递", "韵达快递", "京东物流"];
function statusMeta(s: string): { label: string; tone: "ok" | "warn" | "bad" | "neutral" } {
  return STATUS_META[s] ?? { label: s, tone: "neutral" };
}

// 待处理原因 → 中文标签（仅 status=PENDING_ANALYSIS 有值）
const PENDING_REASON_LABEL: Record<string, string> = {
  UNPAID: "待付款",
  ADDRESS_INCOMPLETE: "地址不全",
  UNPAID_AND_ADDRESS: "未付款且地址不全",
};

// 地址超时升级天数（与后端 order.address-sync.sla-days 默认值保持一致，仅用于提示文案）
const SLA_DAYS = 7;

// 下一步建议：由订单真实信号推导的一句话动作指引
function suggestionOf(o: Order): string {
  if (o.status === "SHIPPED") return "已发货，履约完成";
  if (o.status === "SHIPPING_FAILED") return "发货失败，可重试发货（见下方失败原因）";
  if (o.status === "REJECTED") return "审核已驳回，可登记退款";
  if (o.status === "CANCELLED") return "订单已取消，可登记退款";
  if (o.status === "REFUNDED") return o.shippedAt ? "已退款，等待退货入库" : "退款完成";
  if (o.status === "RETURNED") return "退货已入库，逆向流程完成";
  if (!o.paid) return "先催付，付款完成后再发货";
  if (!o.addressComplete) return "联系买家补全收货地址后再发货";
  if (o.status === "INSUFFICIENT_STOCK") return "库存不足，先补货再履约";
  if (o.manualReviewRequired) return "转人工审核，通过后再发货";
  return "可直接履约发货";
}

function fmt(iso?: string): string {
  return iso ? String(iso).replace("T", " ").slice(0, 19) : "—";
}
function money(v?: number | string | null): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return isNaN(n) ? "—" : `¥${n.toFixed(2)}`;
}

const TONE_COLOR: Record<string, string> = {
  ok: "#2fa86a",
  warn: "#f5a623",
  bad: "#e5484d",
  neutral: "#c9ccd4",
};

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shipLogistics, setShipLogistics] = useState<string>(LOGISTICS_COMPANIES[0]);
  const [shipWaybill, setShipWaybill] = useState<string>("");
  const [shipFee, setShipFee] = useState<string>("");
  const [auditLogs, setAuditLogs] = useState<BusinessAuditLog[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [reverseAction, setReverseAction] = useState<"cancel" | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [afterSales, setAfterSales] = useState<AfterSalesOrder[]>([]);
  const [afterSaleOpen, setAfterSaleOpen] = useState(false);
  const [afterSaleAction, setAfterSaleAction] = useState<{ id: number; type: "reject" | "damaged" } | null>(null);
  const [afterSaleActionReason, setAfterSaleActionReason] = useState("");
  const [afterSaleForm, setAfterSaleForm] = useState({ type: "REFUND_ONLY" as "REFUND_ONLY" | "RETURN_REFUND", quantity: 1, refundAmount: "", reason: "" });

  useEffect(() => {
    Promise.all([getOrder(orderId), getProducts(), getAuditLogs("ORDER", orderId), getInventories(), getAfterSales(orderId)])
      .then(async ([o, ps, logs, inventories, afterSaleRows]) => {
        setOrder(o);
        setProducts(ps);
        setAuditLogs(logs);
        setAfterSales(afterSaleRows);
        const inventory = inventories.find((item) => item.productId === o.productId);
        if (inventory) setMovements(await getInventoryMovements(inventory.id));
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [orderId]);

  const contactScript = order
    ? `【店铺】温馨提示：您在本店的订单 #${order.id} 收货地址尚不完整，可能影响发货与签收。麻烦您在订单页补全「收件人姓名、联系电话、省/市/区、详细地址」，补全后我们将尽快为您安排发货。如有疑问可联系客服。`
    : "";

  const payScript = order
    ? `【店铺】温馨提示：您在本店的订单 #${order.id} 尚未付款，我们已为您保留库存。麻烦您在订单页完成付款，付款后我们将尽快为您安排发货。如有疑问可联系客服。`
    : "";

  // 当前订单的关键状态（驱动横幅与操作区）
  const addressIssue = !order?.addressComplete;
  const unpaid = !order?.paid;
  const escalatedAddress =
    order?.status === "NEEDS_REVIEW" &&
    (order?.pendingReason === "ADDRESS_INCOMPLETE" || order?.pendingReason === "UNPAID_AND_ADDRESS");
  const readyToShip = order?.status === "READY_TO_SHIP";
  const insufficientStock = order?.status === "INSUFFICIENT_STOCK";
  const reviewNeeded = order?.status === "NEEDS_REVIEW";
  const shipFailed = order?.status === "SHIPPING_FAILED";
  // 仅当单据真正完整（已付款 ∧ 地址完整 ∧ 库存充足）才允许"通过审核"，否则按钮禁用并提示先处理前置项。
  const canApprove =
    !!order && order.paid && order.addressComplete && order.status !== "INSUFFICIENT_STOCK";

  const withFeedback = (p: Promise<Order>, okMsg: (o: Order) => string) => {
    if (!order) return;
    setBusy(true);
    setFeedback(null);
    p.then((u) => {
      setOrder(u);
      getAuditLogs("ORDER", orderId).then(setAuditLogs).catch(() => undefined);
      getInventories().then((items) => {
        const inventory = items.find((item) => item.productId === u.productId);
        if (inventory) getInventoryMovements(inventory.id).then(setMovements).catch(() => undefined);
      });
      setFeedback({ msg: okMsg(u), tone: "ok" });
    })
      .catch((e: Error) => setFeedback({ msg: e.message || "操作未成功，请重试", tone: "error" }))
      .finally(() => setBusy(false));
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => setFeedback({ msg: `${label}已复制到剪贴板`, tone: "ok" }))
      .catch(() => setFeedback({ msg: `「${label}」复制失败，请长按文本手动复制`, tone: "error" }));
  };

  const handleConfirmAddress = () =>
    withFeedback(completeAddress(order!.id), (u) => `平台已确认地址完整，状态：${statusMeta(u.status).label}`);
  const handleConfirmPaid = () =>
    withFeedback(markPaid(order!.id), (u) => `平台已确认已付款，状态：${statusMeta(u.status).label}`);
  const handleShip = () => setShippingOpen(true);
  const submitShip = () => {
    // 发货运费必填（包邮填 0），避免利润出现空值。
    if (shipFee.trim() === "") {
      setShippingOpen(true);
      setFeedback({ msg: "请填写实际发货运费（包邮请填 0）", tone: "error" });
      return;
    }
    setShippingOpen(false);
    const fee = Number(shipFee);
    const body = {
      logisticsCompany: shipLogistics,
      waybillNo: shipWaybill.trim(),
      shippingFee: fee,
      shippingFeeType: "MANUAL",
    };
    withFeedback(shipOrder(order!.id, body), (u) =>
      u.status === "SHIPPING_FAILED"
        ? `发货失败：${u.pendingReason || "平台未受理，请重试"}`
        : `已发货，状态：${statusMeta(u.status).label}`
    );
  };
  const handleReview = (decision: "APPROVE" | "REJECT") =>
    withFeedback(
      reviewOrder(order!.id, decision),
      (u) =>
        decision === "APPROVE"
          ? `已通过审核，状态：${statusMeta(u.status).label}`
          : "已驳回，订单不履约（请于平台侧线下取消/退款）"
    );
  const handleRecheck = () =>
    withFeedback(
      recheckOrder(order!.id),
      (u) =>
        u.status === "READY_TO_SHIP"
          ? `库存已补足，状态翻回：${statusMeta(u.status).label}，可发货`
          : `已重新判定，状态：${statusMeta(u.status).label}`
    );

  const submitReverse = () => {
    if (!reverseAction || !reverseReason.trim()) {
      setFeedback({ msg: "请填写处理原因", tone: "error" });
      return;
    }
    const promise = cancelOrder(order!.id, reverseReason.trim());
    setReverseAction(null);
    setReverseReason("");
    withFeedback(promise, (u) => `操作完成，状态：${statusMeta(u.status).label}`);
  };

  const refreshAfterSales = () => getAfterSales(orderId).then(setAfterSales);
  const submitAfterSale = async () => {
    const amount = Number(afterSaleForm.refundAmount);
    if (afterSaleForm.quantity < 1 || !Number.isFinite(amount) || amount <= 0 || !afterSaleForm.reason.trim()) {
      setFeedback({ msg: "请填写有效的售后数量、退款金额和原因", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await createAfterSale({ orderId, type: afterSaleForm.type, quantity: afterSaleForm.quantity, refundAmount: amount, reason: afterSaleForm.reason.trim() });
      await refreshAfterSales();
      setAfterSaleOpen(false);
      setAfterSaleForm({ type: "REFUND_ONLY", quantity: 1, refundAmount: "", reason: "" });
      setFeedback({ msg: "售后申请已创建，等待处理", tone: "ok" });
    } catch (e) { setFeedback({ msg: errMsg(e), tone: "error" }); }
    finally { setBusy(false); }
  };

  const runAfterSale = async (action: Promise<AfterSalesOrder>, message: string) => {
    setBusy(true);
    try {
      await action;
      const [latestOrder] = await Promise.all([getOrder(orderId), refreshAfterSales()]);
      setOrder(latestOrder);
      setFeedback({ msg: message, tone: "ok" });
    } catch (e) { setFeedback({ msg: errMsg(e), tone: "error" }); }
    finally { setBusy(false); }
  };

  const submitAfterSaleAction = () => {
    if (!afterSaleAction || !afterSaleActionReason.trim()) {
      setFeedback({ msg: "请填写处理原因或验收备注", tone: "error" });
      return;
    }
    const action = afterSaleAction.type === "reject"
      ? rejectAfterSale(afterSaleAction.id, afterSaleActionReason.trim())
      : receiveAfterSaleReturn(afterSaleAction.id, "DAMAGED", afterSaleActionReason.trim());
    const message = afterSaleAction.type === "reject" ? "售后申请已驳回" : "退货已签收并记为不可入库";
    setAfterSaleAction(null);
    setAfterSaleActionReason("");
    runAfterSale(action, message);
  };

  if (loading)
    return (
      <div className="loading">
        <span className="spinner" />
        加载中…
      </div>
    );
  if (error) return <div className="notice notice-error">{error}</div>;
  if (!order) return <div className="notice">未找到订单 {orderId}</div>;

  const meta = statusMeta(order.status);
  const product = products.find((p) => p.id === order.productId);
  const productName = product ? product.name : `商品 #${order.productId}`;
  const encrypted = order.encrypted === true;
  const accent = TONE_COLOR[meta.tone];
  const address = [order.receiverProvince, order.receiverCity, order.receiverDistrict, order.receiverDetail]
    .filter(Boolean)
    .join(" ");

  const item = (k: string, v: ReactNode) => (
    <div className="review-item">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
  const Chip = ({ children }: { children: ReactNode }) => (
    <span
      style={{
        fontSize: 12,
        padding: "3px 10px",
        borderRadius: 999,
        background: "#f4f4f7",
        color: "#5b5f6b",
        border: "1px solid #ececf0",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );

  return (
    <section>
      <PageHeader
        title={`订单 #${order.id}`}
        subtitle="商家视角 · 订单履约处理"
        icon={<Icon name="orders" />}
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/orders")}>
            <Icon name="back" /> 返回列表
          </button>
        }
      />

      {/* 状态横幅：一眼看清当前状态 + 下一步动作 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "16px 18px",
          borderRadius: 12,
          border: `1px solid ${accent}`,
          background: `${accent}0f`,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className={`badge badge-${meta.tone}`}>{meta.label}</span>
          <span style={{ fontWeight: 600, color: "#2b2f38" }}>{suggestionOf(order)}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip>平台 · {platformLabel(order.platform)}</Chip>
          <Chip>付款 · {order.paid ? "已付款" : "未付款"}</Chip>
          <Chip>地址 · {order.addressComplete ? "完整" : "不完整"}</Chip>
          {order.manualReviewRequired && <Chip>需人工审核</Chip>}
          {order.pendingReason && PENDING_REASON_LABEL[order.pendingReason] && (
            <Chip>原因 · {PENDING_REASON_LABEL[order.pendingReason]}</Chip>
          )}
          <Chip>库存预留 · {order.reservedQuantity ?? 0}</Chip>
        </div>
      </div>

      {encrypted && (
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          该平台（{platformLabel(order.platform)}）对收件人信息做加密处理，下方姓名 / 电话 / 地址为平台返回的密文或隐私号。
        </div>
      )}

      {/* 操作区：当前状态唯一的处理入口 */}
      <div className="card">
        <div className="card-header">
          <h3>操作</h3>
        </div>

        {readyToShip && (
          <div className="notice notice-ok" style={{ marginBottom: 12 }}>
            付款与地址均已就绪，可安排发货。
          </div>
        )}
        {insufficientStock && (
          <div className="notice notice-error" style={{ marginBottom: 12 }}>
            当前库存不足以履约该订单，请到「销售监控」补足库存；补足后点「我已补货，重新判定」翻回可发货。
          </div>
        )}
        {reviewNeeded && (
          <div className="notice notice-warn" style={{ marginBottom: 12 }}>
            该订单需人工审核后决定是否履约。
            {escalatedAddress && ` 已超过 ${SLA_DAYS} 天未补全地址，已升级为人工审核。`}
          </div>
        )}
        {order.status === "SHIPPED" && (
          <div className="notice notice-ok" style={{ marginBottom: 12 }}>
            已发货，履约完成。物流：{order.logisticsCompany || "—"}，运单号：{order.waybillNo || "—"}
            {order.shippedAt ? `，发货时间：${fmt(String(order.shippedAt))}` : ""}。
          </div>
        )}
        {shipFailed && (
          <div className="notice notice-error" style={{ marginBottom: 12 }}>
            发货失败：{order.pendingReason || "平台未受理发货"}。可在下方「重新发货」重试。
          </div>
        )}
        {order.status === "REJECTED" && (
          <div className="notice notice-error" style={{ marginBottom: 12 }}>
            审核已驳回，订单不再履约，可在本系统登记退款。
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {addressIssue && (
            <button className="btn btn-primary" onClick={handleConfirmAddress} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="check" />}
              确认地址已补全
            </button>
          )}
          {unpaid && (
            <button className="btn btn-primary" onClick={handleConfirmPaid} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="check" />}
              确认已付款
            </button>
          )}
          {(readyToShip || shipFailed) && !shippingOpen && (
            <button className="btn btn-primary" onClick={handleShip} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="check" />}
              {shipFailed ? "重新发货" : "发货"}
            </button>
          )}
          {(readyToShip || shipFailed) && shippingOpen && (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #ececf0",
                borderRadius: 10,
                background: "#fafafb",
              }}
            >
              <span style={{ fontSize: 13, color: "#5b5f6b" }}>物流公司</span>
              <select
                className="header-select"
                value={shipLogistics}
                onChange={(e) => setShipLogistics(e.target.value)}
              >
                {LOGISTICS_COMPANIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="filter-input"
                style={{ width: 200 }}
                placeholder="运单号（可留空自动生成）"
                value={shipWaybill}
                onChange={(e) => setShipWaybill(e.target.value)}
              />
              <span style={{ fontSize: 13, color: "#5b5f6b" }}>实际发货运费（必填，包邮填 0）</span>
              <input
                className="filter-input"
                style={{ width: 130 }}
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={shipFee}
                onChange={(e) => setShipFee(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={submitShip} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" />}
                确认发货
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShippingOpen(false)} disabled={busy}>
                取消
              </button>
            </div>
          )}
          {insufficientStock && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(`/dashboard?focusProduct=${order!.productId}`)}
                disabled={busy}
              >
                <Icon name="dashboard" /> 前往销售监控补货
              </button>
              <button className="btn btn-primary" onClick={handleRecheck} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="check" />}
                我已补货，重新判定
              </button>
            </>
          )}
          {reviewNeeded && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => handleReview("APPROVE")}
                disabled={busy || !canApprove}
                title={canApprove ? undefined : "单据尚未完整，请先完成上方高亮的处理项（付款 / 地址 / 库存）再审核通过"}
              >
                <Icon name="check" /> 通过审核
              </button>
              <button className="btn btn-secondary" onClick={() => handleReview("REJECT")} disabled={busy}>
                <Icon name="close" /> 驳回
              </button>
            </>
          )}
          {!(["SHIPPED", "RETURNED", "CANCELLED", "REFUNDED", "REJECTED"].includes(order.status)) && (
            <button className="btn btn-secondary" onClick={() => setReverseAction("cancel")} disabled={busy}>
              <Icon name="close" /> 取消订单
            </button>
          )}
          {(["CANCELLED", "REJECTED", "SHIPPED", "REFUNDED"].includes(order.status)) && (
            <button className="btn btn-secondary" onClick={() => setAfterSaleOpen(true)} disabled={busy}>
              发起售后
            </button>
          )}
          {addressIssue && !encrypted && (
            <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(contactScript, "联系客户话术")} disabled={busy}>
              <Icon name="copy" /> 复制联系话术
            </button>
          )}
          {unpaid && (
            <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(payScript, "催付话术")} disabled={busy}>
              <Icon name="copy" /> 复制催付话术
            </button>
          )}
          {escalatedAddress && (
            <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(contactScript, "联系客户话术")} disabled={busy}>
              <Icon name="copy" /> 复制联系话术
            </button>
          )}
        </div>

        {feedback && (
          <div className={`notice ${feedback.tone === "error" ? "notice-error" : "notice-ok"}`} style={{ marginTop: 12 }}>
            {feedback.msg}
          </div>
        )}

        {reviewNeeded && !canApprove && (
          <div className="notice notice-warn" style={{ marginTop: 12 }}>
            单据尚未完整，无法直接审核通过。请先完成上方高亮的处理项（付款 / 地址补全 / 补货），再点击「通过审核」。
          </div>
        )}
      </div>

      {reverseAction && (
        <div className="modal-overlay" onClick={() => setReverseAction(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              取消订单
            </div>
            <div className="modal-body">
              <div className="field">
                <span>处理原因</span>
                <textarea rows={3} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setReverseAction(null)}>取消</button>
              <button className="btn btn-danger" onClick={submitReverse}>确认</button>
            </div>
          </div>
        </div>
      )}

      {afterSaleOpen && (
        <div className="modal-overlay" onClick={() => setAfterSaleOpen(false)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">发起售后</div>
            <div className="modal-body">
              <div className="listing-form" style={{ marginTop: 0 }}>
                <label className="field"><span>售后类型</span><select value={afterSaleForm.type} onChange={(e) => setAfterSaleForm((f) => ({ ...f, type: e.target.value as "REFUND_ONLY" | "RETURN_REFUND" }))}><option value="REFUND_ONLY">仅退款</option><option value="RETURN_REFUND">退货退款</option></select></label>
                <label className="field"><span>商品数量</span><input type="number" min={1} max={order.quantity} value={afterSaleForm.quantity} onChange={(e) => setAfterSaleForm((f) => ({ ...f, quantity: Number(e.target.value) }))} /></label>
                <label className="field"><span>退款金额</span><input type="number" min={0.01} step="0.01" value={afterSaleForm.refundAmount} onChange={(e) => setAfterSaleForm((f) => ({ ...f, refundAmount: e.target.value }))} /></label>
                <label className="field"><span>售后原因</span><textarea rows={3} value={afterSaleForm.reason} onChange={(e) => setAfterSaleForm((f) => ({ ...f, reason: e.target.value }))} /></label>
              </div>
            </div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setAfterSaleOpen(false)}>取消</button><button className="btn btn-primary" onClick={submitAfterSale} disabled={busy}>提交申请</button></div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>售后处理</h3><span className="card-sub">{afterSales.length} 单</span></div>
        {afterSales.length === 0 ? <div className="notice notice-info" style={{ margin: 14 }}>暂无售后申请。</div> : afterSales.map((item) => (
          <div className="pr-row" key={item.id}>
            <div className="pr-row-name">{item.afterSaleNo}</div>
            <div className="pr-row-tags">
              <span className="mini neutral">{item.type === "REFUND_ONLY" ? "仅退款" : "退货退款"}</span>
              <span className="mini neutral">{item.quantity} 件</span>
              <span className="mini neutral">{money(item.refundAmount)}</span>
              <span className="mini warn">{item.status}</span>
              <span className="mini neutral">{item.reason}</span>
            </div>
            <div className="pr-row-spacer" />
            {item.status === "PENDING" && <><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setAfterSaleAction({ id: item.id, type: "reject" }); setAfterSaleActionReason(""); }}>驳回</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => runAfterSale(approveAfterSaleRefund(item.id), "退款已确认")}>确认退款</button></>}
            {item.status === "WAITING_RETURN" && <><button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { setAfterSaleAction({ id: item.id, type: "damaged" }); setAfterSaleActionReason(""); }}>不可入库</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => runAfterSale(receiveAfterSaleReturn(item.id, "RESTOCK", "退货验收合格并入库"), "退货已验收入库")}>验收入库</button></>}
          </div>
        ))}
      </div>

      {afterSaleAction && (
        <div className="modal-overlay" onClick={() => setAfterSaleAction(null)}>
          <div className="modal" role="dialog" style={{ maxWidth: 460, width: "92%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{afterSaleAction.type === "reject" ? "驳回售后申请" : "退货不可入库"}</div>
            <div className="modal-body">
              <label className="field">
                <span>{afterSaleAction.type === "reject" ? "驳回原因" : "验收备注"}</span>
                <textarea rows={3} value={afterSaleActionReason} onChange={(e) => setAfterSaleActionReason(e.target.value)} autoFocus />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAfterSaleAction(null)} disabled={busy}>返回</button>
              <button className="btn btn-danger" onClick={submitAfterSaleAction} disabled={busy}>确认处理</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>操作记录</h3>
          <span className="card-sub">{auditLogs.length} 条</span>
        </div>
        {auditLogs.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>暂无操作记录。</div>
        ) : auditLogs.map((log) => (
          <div className="pr-row" key={log.id}>
            <div className="pr-row-name">{log.action}</div>
            <div className="pr-row-tags">
              {log.beforeStatus && <span className="mini neutral">{log.beforeStatus} → {log.afterStatus}</span>}
              <span className="mini neutral">操作人 {log.operator}</span>
              <span className="mini neutral">{fmt(log.createdAt)}</span>
              {log.detail && <span className="mini warn">{log.detail}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>库存流水</h3>
          <span className="card-sub">{movements.length} 条</span>
        </div>
        {movements.length === 0 ? (
          <div className="notice notice-info" style={{ margin: 14 }}>暂无库存流水。</div>
        ) : movements.map((movement) => (
          <div className="pr-row" key={movement.id}>
            <div className="pr-row-name">{movement.movementType}</div>
            <div className="pr-row-tags">
              <span className="mini neutral">实物 {movement.currentDelta >= 0 ? "+" : ""}{movement.currentDelta}</span>
              <span className="mini neutral">预留 {movement.reservedDelta >= 0 ? "+" : ""}{movement.reservedDelta}</span>
              <span className="mini neutral">结余 {movement.currentAfter} / 预留 {movement.reservedAfter}</span>
              <span className="mini neutral">{fmt(movement.createdAt)}</span>
              <span className="mini warn">{movement.reason}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 参考信息：买家与收件人 */}
      <div className="card">
        <div className="card-header">
          <h3>买家与收件人</h3>
        </div>
        <div className="review-highlight" style={{ marginBottom: 0, border: "none", boxShadow: "none", padding: 0 }}>
          <div className="review-grid">
            {item("买家标识", order.buyerNick || "—")}
            {item("收件人姓名", order.receiverName || "—")}
            {item("收件人电话", order.receiverPhone || "—")}
            {item(
              "收货地址",
              <span>
                {address || "—"}
                {encrypted && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>密文</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 参考信息：金额 / 物流 / 基础信息 */}
      <div className="card">
        <div className="card-header">
          <h3>金额与物流</h3>
        </div>
        <div className="review-highlight" style={{ marginBottom: 0, border: "none", boxShadow: "none", padding: 0 }}>
          <div className="review-grid">
            {item("商品", productName)}
            {item("数量", order.quantity)}
            {item("实付金额", money(order.payment))}
            {item("买家支付邮费", money(order.postFee))}
            {item("卖家发货运费", money(order.shippingFee))}
            {item("物流公司", order.logisticsCompany || "尚未发货")}
            {item("运单号", order.waybillNo || "—")}
            {item("发货时间", order.shippedAt ? fmt(String(order.shippedAt)) : "—")}
            {item("创建时间", fmt(String(order.createdAt)))}
            {item("更新时间", fmt(String(order.updatedAt)))}
          </div>
        </div>
      </div>

      {/* 预估毛利（成本闭环）：实付金额 - 商品成本 - 实际发货运费。
          口径：payment 为买家实付（与 postFee 分开计），故毛利 = payment - 成本 - 发货运费。 */}
      <div className="card">
        <div className="card-header">
          <h3>预估毛利</h3>
        </div>
        {(() => {
          const product = products.find((p) => p.id === order.productId);
          const qty = order.quantity || 0;
          const payment = order.payment != null ? Number(order.payment) : 0;
          const shippingFee = order.shippingFee != null ? Number(order.shippingFee) : 0;
          // 已发货订单优先用发货时快照（历史不漂）；未发货仍按当前成本实时算。
          const hasSnapshot =
            order.grossProfit != null && order.grossProfit !== "";
          const costPrice = hasSnapshot
            ? Number(order.costPriceSnapshot)
            : product?.costPrice != null
            ? Number(product.costPrice)
            : 0;
          const goodsCost = hasSnapshot
            ? Number(order.goodsCostSnapshot)
            : costPrice * qty;
          const grossProfit = hasSnapshot ? Number(order.grossProfit) : payment - goodsCost - shippingFee;
          const profitTone = grossProfit >= 0 ? "#2fa86a" : "#e5484d";
          return (
            <div className="review-highlight" style={{ marginBottom: 0, border: "none", boxShadow: "none", padding: 0 }}>
              <div className="review-grid">
                {item(hasSnapshot ? "发货时成本单价(快照)" : "商品成本单价", money(costPrice))}
                {item("数量", qty)}
                {item("商品成本合计", money(goodsCost))}
                {item("卖家发货运费", money(shippingFee))}
                {item("实付金额", money(payment))}
                {item("买家支付邮费", money(order.postFee))}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid #ececf0",
                }}
              >
                <span style={{ fontSize: 13, color: "#5b5f6b" }}>预估毛利</span>
                <strong style={{ fontSize: 22, color: profitTone }}>
                  {money(grossProfit)}
                </strong>
                <span className="mini neutral" style={{ marginLeft: "auto" }}>
                  {hasSnapshot ? "发货时快照（历史成本变动不影响）" : "公式：实付金额 − 商品成本 − 发货运费"}
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
