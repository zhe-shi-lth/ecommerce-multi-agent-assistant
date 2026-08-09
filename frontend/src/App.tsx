import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import OperationPlans from "./pages/OperationPlans";
import OperationPlanDetail from "./pages/OperationPlanDetail";
import Products from "./pages/Products";
import Inventories from "./pages/Inventories";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Dashboard from "./pages/Dashboard";
import NewListing from "./pages/NewListing";
import Settings from "./pages/Settings";
import Simulator from "./pages/Simulator";
import Login from "./pages/Login";
import UserMonitoring from "./pages/UserMonitoring";
import { clearToken, isAuthed, isSuperAdmin, setRole } from "./auth";
import { api } from "./api/client";
import { onAppError } from "./api/errorBus";
import AlertModal from "./components/AlertModal";
import { Icon } from "./components/icons";

export default function App() {
  const authed = isAuthed();
  const loc = useLocation();
  // 启动校验：本地有 token 时先向后端 /auth/me 验真，期间显示加载态，避免闪现主页；
  // 验真失败（过期/无效）清 token 回登录页。无 token 则无需校验，直接走登录路由。
  const [checking, setChecking] = useState(authed);
  // 全局错误弹窗：后端非 2xx（如 ConfigError 422 中文报错）由 client.ts 发出，此处订阅并居中弹窗。
  const [appError, setAppError] = useState<string | null>(null);
  useEffect(() => onAppError((msg) => setAppError(msg)), []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    api
      .get<{ email: string; role: string }>("/auth/me")
      .then((me) => {
        if (cancelled) return;
        if (me.role) setRole(me.role); // 同步最新角色（防本地 role 与令牌不一致）
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
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

  // 超管专属路由守卫：非超管直输 URL 时重定向回首页
  function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
    return isSuperAdmin() ? <>{children}</> : <Navigate to="/" replace />;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">
          <span className="brand-mark">电</span>
          <span>电商多 Agent</span>
        </h1>
        <nav>
          <div className="nav-group">核心流程</div>
          <NavLink to="/new-listing" className="nav-link">
            <Icon name="new" />
            新品上架
          </NavLink>
          <NavLink to="/operation-plans" className="nav-link">
            <Icon name="plans" />
            运营计划
          </NavLink>
          <div className="nav-group">经营数据</div>
          <NavLink to="/products" className="nav-link">
            <Icon name="products" />
            商品
          </NavLink>
          <NavLink to="/inventories" className="nav-link">
            <Icon name="inventory" />
            库存
          </NavLink>
          <NavLink to="/orders" className="nav-link">
            <Icon name="orders" />
            订单
          </NavLink>
          <NavLink to="/dashboard" className="nav-link">
            <Icon name="dashboard" />
            销售监控
          </NavLink>
          <div className="nav-group">工具</div>
          <NavLink to="/simulator" className="nav-link">
            <Icon name="simulator" />
            平台模拟
          </NavLink>
          <div className="nav-group">配置</div>
          <NavLink to="/settings" className="nav-link">
            <Icon name="settings" />
            设置中心
          </NavLink>
          {isSuperAdmin() && (
            <div className="nav-group">系统</div>
          )}
          {isSuperAdmin() && (
            <NavLink to="/user-monitoring" className="nav-link">
              <Icon name="usermonitor" />
              用户监控
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-link" onClick={handleLogout}>
            <Icon name="logout" />
            退出登录
          </button>
        </div>
      </aside>
      <AlertModal
        open={!!appError}
        title="操作失败"
        message={appError ?? ""}
        onClose={() => setAppError(null)}
      />
      <main className="content">
        <Routes>
          <Route path="/operation-plans" element={<OperationPlans />} />
          <Route path="/operation-plans/:id" element={<OperationPlanDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventories" element={<Inventories />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/user-monitoring"
            element={
              <RequireSuperAdmin>
                <UserMonitoring />
              </RequireSuperAdmin>
            }
          />
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
  );
}
