import { NavLink, Route, Routes } from "react-router-dom";
import OperationPlans from "./pages/OperationPlans";
import OperationPlanDetail from "./pages/OperationPlanDetail";
import Products from "./pages/Products";
import Inventories from "./pages/Inventories";
import Orders from "./pages/Orders";

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="brand">电商多 Agent</h1>
        <nav>
          <NavLink to="/operation-plans" className="nav-link">
            运营计划
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
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<OperationPlans />} />
          <Route path="/operation-plans" element={<OperationPlans />} />
          <Route path="/operation-plans/:id" element={<OperationPlanDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventories" element={<Inventories />} />
          <Route path="/orders" element={<Orders />} />
        </Routes>
      </main>
    </div>
  );
}
