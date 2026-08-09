import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getOrder, completeAddress } from "../api/orders";
import { getProducts } from "../api/products";
import type { Order, Product } from "../api/types";
import { platformLabel, platformTone } from "../platforms";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

// 订单状态 → 中文标签 + 配色（与列表页一致）
const STATUS_META: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  READY_TO_SHIP: { label: "可发货", tone: "ok" },
  PENDING_ANALYSIS: { label: "待分析", tone: "warn" },
  NEEDS_REVIEW: { label: "需人工审核", tone: "bad" },
  INSUFFICIENT_STOCK: { label: "库存不足", tone: "bad" },
};
function statusMeta(s: string): { label: string; tone: "ok" | "warn" | "bad" | "neutral" } {
  return STATUS_META[s] ?? { label: s, tone: "neutral" };
}

function issuesOf(o: Order): string[] {
  const list: string[] = [];
  if (!o.paid) list.push("订单未付款");
  if (!o.addressComplete) list.push("收货地址不完整");
  if (o.status === "INSUFFICIENT_STOCK") list.push("库存不足，暂不可发货");
  if (o.manualReviewRequired) list.push("需人工审核履约");
  return list;
}

// 收件人字段中缺失的项（用于「地址异常」卡片提示买家补哪几项）。
function missingAddressFields(o: Order): string[] {
  const miss: string[] = [];
  if (!o.receiverName) miss.push("收件人姓名");
  if (!o.receiverPhone) miss.push("联系电话");
  if (!o.receiverProvince) miss.push("省份");
  if (!o.receiverCity) miss.push("城市");
  if (!o.receiverDistrict) miss.push("区/县");
  if (!o.receiverDetail) miss.push("详细地址");
  return miss;
}

// 履约建议：由订单真实信号推导的下一步动作（后端 fulfillmentSuggestionStatus 当前冗余复制了 status，
// 这里改为前端据 paid/address/manualReview/status 推导，避免与「订单状态」重复）。
function suggestionOf(o: Order): string {
  if (!o.paid) return "建议先催付，付款完成后再发货";
  if (!o.addressComplete) return "建议联系买家补全收货地址后再发货";
  if (o.status === "INSUFFICIENT_STOCK") return "库存不足，建议先补货再履约";
  if (o.manualReviewRequired) return "建议转人工审核，通过后再发货";
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

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [addrMsg, setAddrMsg] = useState<string | null>(null);
  const [addrTone, setAddrTone] = useState<"ok" | "error" | null>(null);

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

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(contactScript);
      setAddrMsg("联系客户话术已复制到剪贴板");
    } catch {
      setAddrMsg("复制失败，请手动复制：" + contactScript);
    }
  };

  const handleConfirmAddress = () => {
    if (!order) return;
    setCompleting(true);
    setAddrMsg(null);
    setAddrTone(null);
    completeAddress(order.id)
      .then((updated) => {
        setOrder(updated);
        setAddrMsg(`平台已确认地址完整，订单状态已更新：${statusMeta(updated.status).label}`);
        setAddrTone("ok");
      })
      .catch((e: Error) => {
        // 后端复核未通过（演示态随机拦截）会返回 409 + 可读原因，直接透传给用户。
        setAddrMsg(e.message || "地址补全确认未成功，请重试");
        setAddrTone("error");
      })
      .finally(() => setCompleting(false));
  };

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
  const issues = issuesOf(order);
  const product = products.find((p) => p.id === order.productId);
  const productName = product ? product.name : `商品 #${order.productId}`;
  const encrypted = order.encrypted === true;

  const address = [order.receiverProvince, order.receiverCity, order.receiverDistrict, order.receiverDetail]
    .filter(Boolean)
    .join(" ");

  const item = (k: string, v: ReactNode) => (
    <div className="review-item">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );

  return (
    <section>
      <PageHeader
        title={`订单 #${order.id}`}
        subtitle="商家视角 · 订单 API 返回字段（按平台对齐淘宝 / 抖音 / 小红书）"
        icon={<Icon name="orders" />}
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/orders")}>
            <Icon name="logout" /> 返回列表
          </button>
        }
      />

      <div className="meta">
        <span>
          状态: <span className={`badge badge-${meta.tone}`}>{meta.label}</span>
        </span>
        <span>
          平台:{" "}
          <span className={`badge badge-${platformTone(order.platform)}`}>
            {platformLabel(order.platform)}
          </span>
        </span>
        <span>人工审核: {order.manualReviewRequired ? "需审核" : "系统自动"}</span>
      </div>

      {encrypted && (
        <div className="notice notice-info">
          该平台（{platformLabel(order.platform)}）对收件人信息做加密处理，下方姓名 / 电话 / 地址为平台返回的密文或隐私号。
        </div>
      )}

      {!order.addressComplete && (
        <div className="card" style={{ borderColor: "var(--bad, #e5484d)" }}>
          <div className="card-header">
            <h3 style={{ color: "var(--bad, #e5484d)" }}>地址异常</h3>
          </div>
          <div className="notice notice-error" style={{ marginBottom: 12 }}>
            <strong>收货地址不完整，存在退回风险。</strong>
            {encrypted
              ? " 该平台对收件人加密，请通过平台后台联系买家补全地址后再确认。"
              : missingAddressFields(order).length > 0
                ? ` 缺失项：${missingAddressFields(order).join("、")}。`
                : " 请核对收件人信息是否完整。"}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={handleCopyScript} disabled={completing}>
              <Icon name="copy" /> 复制联系客户话术
            </button>
            <button className="btn btn-primary" onClick={handleConfirmAddress} disabled={completing}>
              {completing ? <span className="spinner" /> : <Icon name="check" />}
              确认地址已补全
            </button>
          </div>
          {addrMsg && (
            <div className={`notice ${addrTone === "error" ? "notice-error" : "notice-ok"}`} style={{ marginTop: 12 }}>
              {addrMsg}
            </div>
          )}
        </div>
      )}

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

      <div className="card">
        <div className="card-header">
          <h3>金额与物流</h3>
        </div>
        <div className="review-highlight" style={{ marginBottom: 0, border: "none", boxShadow: "none", padding: 0 }}>
          <div className="review-grid">
            {item("实付金额", money(order.payment))}
            {item("邮费", money(order.postFee))}
            {item("物流公司", order.logisticsCompany || "尚未发货")}
            {item("运单号", order.waybillNo || "—")}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>订单信息</h3>
        </div>
        <div className="review-highlight" style={{ marginBottom: 0, border: "none", boxShadow: "none", padding: 0 }}>
          <div className="review-grid">
            {item("订单 ID", `#${order.id}`)}
            {item("平台", platformLabel(order.platform))}
            {item("商品", productName)}
            {item("数量", order.quantity)}
            {item("订单状态", <span className={`badge badge-${meta.tone}`}>{meta.label}</span>)}
            {item(
              "付款状态",
              <span className={`badge badge-${order.paid ? "ok" : "neutral"}`}>
                {order.paid ? "已付款" : "未付款"}
              </span>
            )}
            {item(
              "收货地址",
              <span className={`badge badge-${order.addressComplete ? "ok" : "bad"}`}>
                {order.addressComplete ? "完整" : "不完整"}
              </span>
            )}
            {item(
              "人工审核",
              <span className={`badge badge-${order.manualReviewRequired ? "warn" : "neutral"}`}>
                {order.manualReviewRequired ? "需审核" : "系统自动"}
              </span>
            )}
            {item("履约建议", suggestionOf(order))}
            {item("创建时间", fmt(String(order.createdAt)))}
            {item("更新时间", fmt(String(order.updatedAt)))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>待处理事项</h3>
        </div>
        {issues.length === 0 ? (
          <div className="notice notice-ok">无待处理，可直接履约发货。</div>
        ) : (
          <div className="notice notice-warn">
            <strong>需关注：</strong>
            {issues.join(" · ")}
          </div>
        )}
      </div>
    </section>
  );
}
