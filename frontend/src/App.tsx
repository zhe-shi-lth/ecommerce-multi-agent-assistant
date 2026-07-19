import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import OperationPlans from "./pages/OperationPlans";
import OperationPlanDetail from "./pages/OperationPlanDetail";
import Products from "./pages/Products";
import Inventories from "./pages/Inventories";
import Orders from "./pages/Orders";
import Favorites from "./pages/Favorites";
import Dashboard from "./pages/Dashboard";
import NewListing from "./pages/NewListing";
import Settings from "./pages/Settings";
import Simulator from "./pages/Simulator";
import Login from "./pages/Login";
import { clearToken, isAuthed } from "./auth";

export default function App() {
  const authed = isAuthed();

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

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">
          <span className="brand-mark">电</span>
          <span>电商多 Agent</span>
        </h1>
        <nav>
          <div className="nav-group">流程</div>
          <NavLink to="/new-listing" className="nav-link">
            <span className="nav-dot" />
            新品上架
          </NavLink>
          <NavLink to="/operation-plans" className="nav-link">
            <span className="nav-dot" />
            运营计划
          </NavLink>
          <div className="nav-group">数据</div>
          <NavLink to="/products" className="nav-link">
            <span className="nav-dot" />
            商品
          </NavLink>
          <NavLink to="/inventories" className="nav-link">
            <span className="nav-dot" />
            库存
          </NavLink>
          <NavLink to="/orders" className="nav-link">
            <span className="nav-dot" />
            订单
          </NavLink>
          <NavLink to="/dashboard" className="nav-link">
            <span className="nav-dot" />
            销售监控
          </NavLink>
          <div className="nav-group">测试</div>
          <NavLink to="/simulator" className="nav-link">
            <span className="nav-dot" />
            平台模拟
          </NavLink>
          <div className="nav-group">结果</div>
          <NavLink to="/favorites" className="nav-link">
            <span className="nav-dot" />
            收藏夹
          </NavLink>
          <div className="nav-group">配置</div>
          <NavLink to="/settings" className="nav-link">
            <span className="nav-dot" />
            设置中心
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-link" onClick={handleLogout}>
            <span className="nav-dot" />
            退出登录
          </button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<NewListing />} />
          <Route path="/operation-plans" element={<OperationPlans />} />
          <Route path="/operation-plans/:id" element={<OperationPlanDetail />} />
          <Route path="/new-listing" element={<NewListing />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventories" element={<Inventories />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
