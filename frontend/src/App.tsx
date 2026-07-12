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
        <h1 className="brand">电商多 Agent</h1>
        <nav>
          <NavLink to="/operation-plans" className="nav-link">
            运营计划
          </NavLink>
          <NavLink to="/new-listing" className="nav-link">
            新品上架
          </NavLink>
          <NavLink to="/products" className="nav-link">
            商品
          </NavLink>
          <NavLink to="/inventories" className="nav-link">
            库存
          </NavLink>
          <NavLink to="/orders" className="nav-link">
            订单
          </NavLink>
          <NavLink to="/favorites" className="nav-link">
            收藏夹
          </NavLink>
          <NavLink to="/dashboard" className="nav-link">
            销售监控
          </NavLink>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<OperationPlans />} />
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
