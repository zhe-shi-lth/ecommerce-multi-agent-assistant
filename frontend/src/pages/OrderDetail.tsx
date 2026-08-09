import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getOrder, completeAddress, markPaid, shipOrder, reviewOrder, recheckOrder } from "../api/orders";
import { getProducts } from "../api/products";
import type { Order, Product } from "../api/types";
import { platformLabel } from "../platforms";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

// 订单状态 → 中文标签 + 配色（与列表页一致）
const STATUS_META: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  READY_TO_SHIP: { label: "可发货", tone: "ok" },
  PENDING_ANALYSIS: { label: "待分析", tone: "warn" },
  NEEDS_REVIEW: { label: "需人工审核", tone: "bad" },
  INSUFFICIENT_STOCK: { label: "库存不足", tone: "bad" },
  SHIPPED: { label: "已发货", tone: "ok" },
  REJECTED: { label: "已驳回", tone: "bad" },
  SHIPPING_FAILED: { label: "发货失败", tone: "bad" },
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
  if (o.status === "REJECTED") return "审核已驳回，不履约（请于平台侧线下取消/退款）";
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

  useEffect(() => {
    Promise.all([getOrder(orderId), getProducts()])
      .then(([o, ps]) => {
        setOrder(o);
        setProducts(ps);
      })
      .catch((e) => setError(String(e)))
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
      setFeedback({ msg: okMsg(u), tone: "ok" });
    })
      .catch((e: Error) => setFeedback({ msg: e.message || "操作未成功，请重试", tone: "error" }))
      .finally(() => setBusy(false));
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => setFeedback({ msg: `${label}已复制到剪贴板`, tone: "ok" }))
      .catch(() => setFeedback({ msg: `复制失败，请手动复制：${text}`, tone: "error" }));
  };

  const handleConfirmAddress = () =>
    withFeedback(completeAddress(order!.id), (u) => `平台已确认地址完整，状态：${statusMeta(u.status).label}`);
  const handleConfirmPaid = () =>
    withFeedback(markPaid(order!.id), (u) => `平台已确认已付款，状态：${statusMeta(u.status).label}`);
  const handleShip = () => setShippingOpen(true);
  const submitShip = () => {
    setShippingOpen(false);
    const body = { logisticsCompany: shipLogistics, waybillNo: shipWaybill.trim() };
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

  if (loading)
    return (
      <div className="loading">
        <span className="spinner" />
        加载中…
      </div>
    );
  if (error) return <div className="notice notice-error">加载失败：{error}</div>;
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
            <Icon name="logout" /> 返回列表
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
            审核已驳回，订单不履约（请于平台侧线下取消/退款）。
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
            {item("邮费", money(order.postFee))}
            {item("物流公司", order.logisticsCompany || "尚未发货")}
            {item("运单号", order.waybillNo || "—")}
            {item("发货时间", order.shippedAt ? fmt(String(order.shippedAt)) : "—")}
            {item("创建时间", fmt(String(order.createdAt)))}
            {item("更新时间", fmt(String(order.updatedAt)))}
          </div>
        </div>
      </div>
    </section>
  );
}
