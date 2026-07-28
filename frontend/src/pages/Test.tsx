import { useEffect, useState } from "react";
import { api, agentApi } from "../api/client";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

interface MeInfo {
  email: string;
  role: string;
}

// 复用后端集成测试的样例，验证「浏览器(Bearer) → Python(鉴权) → Java(写回/服务密钥)」完整链路。
const SAMPLE_PLAN_REQUEST = {
  product: {
    product_id: 1001,
    name: "便携式榨汁杯",
    category: "小家电",
    description: "适合办公室和健身房使用的小型榨汁杯",
    cost_price: 39.0,
    sale_price: 89.0,
    target_audience: "上班族、健身人群、学生",
    usage_scenario: "办公室、健身房、宿舍、旅行",
    status: "DRAFT",
  },
  inventory: {
    product_id: 1001,
    current_stock: 18,
    reserved_stock: 5,
    safe_stock_threshold: 20,
    purchase_cycle_days: 5,
    sales_last_7_days: 32,
    inventory_status: "LOW",
  },
  order: {
    order_id: 2001,
    product_id: 1001,
    quantity: 2,
    status: "PENDING_ANALYSIS",
    address_complete: true,
    paid: true,
    manual_review_required: false,
    fulfillment_suggestion_status: "PENDING_ANALYSIS",
  },
  trigger_type: "GENERATE_OPERATION_PLAN",
};

export default function Test() {
  const [me, setMe] = useState<MeInfo | null>(null);
  const [javaOk, setJavaOk] = useState<boolean | null>(null);
  const [pyOk, setPyOk] = useState<boolean | null>(null);
  const [linkResult, setLinkResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<MeInfo>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function checkJava() {
    try {
      await api.get("/health");
      setJavaOk(true);
    } catch {
      setJavaOk(false);
    }
  }

  async function checkPython() {
    try {
      await agentApi.get("/health");
      setPyOk(true);
    } catch {
      setPyOk(false);
    }
  }

  async function runLinkTest() {
    setBusy(true);
    setLinkResult("");
    try {
      const r = await agentApi.post("/ecommerce/operation-plan", SAMPLE_PLAN_REQUEST);
      setLinkResult(JSON.stringify(r, null, 2));
    } catch {
      /* error surfaced via global modal */
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = (s: boolean | null) =>
    s === null ? "未检测" : s ? "连通" : "失败";

  return (
    <div>
      <PageHeader
        title="测试"
        subtitle="系统连通性与链路验证（仅超级管理员可见）"
        icon={<Icon name="test" />}
      />

      <div className="card">
        <div className="card-header">当前登录</div>
        <div className="">
          {me ? (
            <p>
              账号：<code>{me.email}</code> ｜ 角色：
              <span className={`badge badge-${me.role === "SUPER_ADMIN" ? "ok" : "neutral"}`}>
                {me.role}
              </span>
            </p>
          ) : (
            <p className="notice notice-warn">无法获取当前登录信息（令牌可能已失效）</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">服务连通性</div>
        <div className="">
          <p>
            Java（业务服务）：<strong>{statusLabel(javaOk)}</strong>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={checkJava}>
              检测 Java
            </button>
          </p>
          <p>
            Python（Agent 服务）：<strong>{statusLabel(pyOk)}</strong>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={checkPython}>
              检测 Python
            </button>
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">链路验证</div>
        <div className="">
          <p className="page-subtitle">
            以当前登录令牌调用 Python 编排接口，验证「浏览器 → Python(鉴权) → Java(写回)」完整闭环。
          </p>
          <button className="btn btn-primary" onClick={runLinkTest} disabled={busy}>
            {busy ? "运行中…" : "运行一次计划生成"}
          </button>
          {linkResult && (
            <div className="json-view" style={{ marginTop: 12, maxHeight: 420 }}>
              {linkResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
