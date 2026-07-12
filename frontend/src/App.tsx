import { NavLink, Route, Routes } from "react-router-dom";
import OperationPlans from "./pages/OperationPlans";
import OperationPlanDetail from "./pages/OperationPlanDetail";
import Products from "./pages/Products";
import Inventories from "./pages/Inventories";
import Orders from "./pages/Orders";
import Favorites from "./pages/Favorites";
import Dashboard from "./pages/Dashboard";
import NewListing from "./pages/NewListing";

export default function App() {
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
          <div className="nav-group">结果</div>
          <NavLink to="/favorites" className="nav-link">
            <span className="nav-dot" />
            收藏夹
          </NavLink>
        </nav>
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
        </Routes>
      </main>
    </div>
  );
}
