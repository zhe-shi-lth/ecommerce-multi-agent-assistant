import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import OperationPlans from "./pages/OperationPlans";
import OperationPlanDetail from "./pages/OperationPlanDetail";
import Products from "./pages/Products";
import Inventories from "./pages/Inventories";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Dashboard from "./pages/Dashboard";
import PurchaseRestock from "./pages/PurchaseRestock";
import Suppliers from "./pages/Suppliers";
import NewListing from "./pages/NewListing";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Simulator from "./pages/Simulator";
import Login from "./pages/Login";
import Organization from "./pages/Organization";
import { applyAuth, canAccess, canManageOrganization, canManageSettings, clearToken, getIdentity, isAuthed, isSuperAdmin, type AuthResult } from "./auth";
import { api } from "./api/client";
import { onAppError } from "./api/errorBus";
import AlertModal from "./components/AlertModal";
import { Icon } from "./components/icons";
import Select from "./components/Select";

export default function App() {
  const [authed, setAuthed] = useState(isAuthed());
  const loc = useLocation();
  // 启动校验：本地有 token 时先向后端 /auth/me 验真，期间显示加载态，避免闪现主页；
  // 验真失败（过期/无效）清 token 回登录页。无 token 则无需校验，直接走登录路由。
  const [checking, setChecking] = useState(authed);
  // 全局错误弹窗：后端非 2xx（如 ConfigError 422 中文报错）由 client.ts 发出，此处订阅并居中弹窗。
  const [appError, setAppError] = useState<string | null>(null);
  const [identity, setCurrentIdentity] = useState(getIdentity());
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => onAppError((msg) => setAppError(msg)), []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    api
      .get<AuthResult>("/auth/me")
      .then((me) => {
        if (cancelled) return;
        applyAuth(me);
        setCurrentIdentity(getIdentity());
        setAuthed(true);
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        setAuthed(false);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  // 校验令牌有效性中：先不渲染任何页面，避免无效 token 闪现主页
  if (checking) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" />
        <p>正在校验登录状态…</p>
      </div>
    );
  }

  // 未登录：仅渲染登录页，其余一律跳转登录
  if (!authed) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  function handleLogout() {
    clearToken();
    window.location.href = "/login";
  }

  async function switchStore(value: string) {
    const [companyId, storeId] = value.split(":").map(Number);
    const result = await api.post<AuthResult>("/auth/context", { companyId, storeId });
    applyAuth(result);
    setCurrentIdentity(getIdentity());
    window.location.reload();
  }

  const needsStoreSelection = identity?.storeId == null &&
    (identity?.companies.find((company) => company.id === identity?.companyId)?.stores.length ?? 0) > 1;
  if (needsStoreSelection) {
    const stores = identity!.companies.find((company) => company.id === identity!.companyId)?.stores ?? [];
    return <div className="store-selection-page"><section className="store-selection-panel"><div className="brand-mark">电</div><h1>选择店铺</h1><p>{identity?.companyName} 有多家店铺，请选择要进入的店铺。</p><div className="store-selection-list">{stores.map((store) => <button key={store.id} onClick={() => void switchStore(`${identity!.companyId}:${store.id}`)}><span>{store.name}</span><small>进入店铺</small></button>)}</div>{canManageOrganization() && <NavLink className="store-selection-org" to="/organization">进入组织与成员管理</NavLink>}</section></div>;
  }

  // 超管专属路由守卫：非超管直输 URL 时重定向回首页

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">
          <span className="brand-mark">电</span>
          <span>电商多 Agent</span>
        </h1>
        <nav>
          {(canAccess("CONTENT_GENERATE") || canAccess("PRODUCT_VIEW")) && <div className="nav-group">核心流程</div>}
          {canAccess("CONTENT_GENERATE") && <NavLink to="/new-listing" className="nav-link">
            <Icon name="new" />
            新品上架
          </NavLink>}
          {canAccess("PRODUCT_VIEW") && <NavLink to="/operation-plans" className="nav-link">
            <Icon name="plans" />
            运营计划
          </NavLink>}
          {(canAccess("PRODUCT_VIEW") || canAccess("INVENTORY_VIEW") || canAccess("ORDER_VIEW") || canAccess("PURCHASE_CREATE") || canAccess("SUPPLIER_MANAGE")) && <div className="nav-group">经营数据</div>}
          {canAccess("PRODUCT_VIEW") && <NavLink to="/products" className="nav-link">
            <Icon name="products" />
            商品
          </NavLink>}
          {canAccess("INVENTORY_VIEW") && <NavLink to="/inventories" className="nav-link">
            <Icon name="inventory" />
            库存
          </NavLink>}
          {canAccess("ORDER_VIEW") && <NavLink to="/orders" className="nav-link">
            <Icon name="orders" />
            订单
          </NavLink>}
          {canAccess("ORDER_VIEW") && <NavLink to="/dashboard" className="nav-link">
            <Icon name="dashboard" />
            销售监控
          </NavLink>}
          {canAccess("PURCHASE_CREATE") && <NavLink to="/purchase-restock" className="nav-link">
            <Icon name="purchase" />
            采购补货
          </NavLink>}
          {canAccess("SUPPLIER_MANAGE") && <NavLink to="/suppliers" className="nav-link">
            <Icon name="supplier" />
            进货商家
          </NavLink>}
          {isSuperAdmin() && <>
            <div className="nav-group">工具</div>
            <NavLink to="/simulator" className="nav-link">
              <Icon name="simulator" />
              平台模拟
            </NavLink>
          </>}
          {canManageSettings() && <div className="nav-group">配置</div>}
          {canManageSettings() && <NavLink to="/settings" className="nav-link">
            <Icon name="settings" />
            设置中心
          </NavLink>}
          </nav>
        </aside>
      <div className="main-col">
        <header className="account-bar">
          <div className="account-context">
            <Icon name="store" className="account-context-icon" />
            {identity?.companies.some((company) => company.stores.length > 0) ? <Select className="account-store-select" ariaLabel="当前店铺" value={`${identity.companyId}:${identity.storeId}`} onChange={(e) => void switchStore(e.target.value)}>
              {identity.companies.flatMap((company) => company.stores.map((store) => <option key={`${company.id}:${store.id}`} value={`${company.id}:${store.id}`}>{company.name} / {store.name}</option>))}
            </Select> : <span className="account-company">{identity?.companyName ?? "平台管理"}</span>}
          </div>
          <div className="account-menu-wrap">
            <button className="account-trigger" onClick={() => setAccountOpen((v) => !v)} aria-expanded={accountOpen}>
              <span className="account-avatar">{(identity?.displayName || identity?.email || "U").slice(0, 1).toUpperCase()}</span>
              <span className="account-name">{identity?.displayName ? `${identity.displayName} · ${identity.email}` : identity?.email}</span><span className="account-chevron">⌄</span>
            </button>
            {accountOpen && <div className="account-menu">
              {canManageOrganization() && <NavLink to="/organization" onClick={() => setAccountOpen(false)}><Icon name="usermonitor" />组织与成员</NavLink>}
              <NavLink to="/profile" onClick={() => setAccountOpen(false)}><Icon name="settings" />个人资料</NavLink>
              <button onClick={handleLogout}><Icon name="logout" />退出登录</button>
            </div>}
          </div>
        </header>
        <AlertModal
          open={!!appError}
          title="操作失败"
          message={appError ?? ""}
          onClose={() => setAppError(null)}
        />
        <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/operation-plans" replace />} />
          <Route path="/operation-plans" element={<OperationPlans />} />
          <Route path="/operation-plans/:id" element={<OperationPlanDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventories" element={<Inventories />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/purchase-restock" element={<PurchaseRestock />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/simulator" element={isSuperAdmin() ? <Simulator /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={canManageSettings() ? <Settings /> : <Navigate to="/" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/organization" element={canManageOrganization() ? <Organization /> : <Navigate to="/" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
        </Routes>
        {/* 新品上架向导常驻挂载：切到其他 tab 时仅隐藏（display:none），不在进行的
           生成 / 视频轮询中被中断；回到该页继续显示「生成中」或「生成完成」，无需重来。 */}
        <div
          className="keep-alive"
          style={{ display: loc.pathname === "/" || loc.pathname === "/new-listing" ? "block" : "none" }}
          aria-hidden={loc.pathname !== "/" && loc.pathname !== "/new-listing"}
        >
          <NewListing />
        </div>
      </main>
      </div>
    </div>
  );
}
