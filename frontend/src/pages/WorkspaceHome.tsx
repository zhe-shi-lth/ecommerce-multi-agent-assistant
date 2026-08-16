import { NavLink } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { Icon, type IconName } from "../components/icons";
import { canAccess, canManageOrganization, canManageSettings, getIdentity, isSuperAdmin } from "../auth";

type GuideLink = { path: string; label: string; description: string; icon: IconName; allowed: boolean };

export default function WorkspaceHome() {
  const identity = getIdentity();
  const role = isSuperAdmin() ? "超级管理员" : identity?.memberRole === "OWNER" ? "企业老板" : "普通员工";
  const roleDescription = isSuperAdmin()
    ? "负责企业、账号和平台能力管理，不参与具体店铺日常运营。"
    : identity?.memberRole === "OWNER"
      ? "负责店铺经营、员工权限、平台配置和业务流程管理。"
      : "根据企业分配的权限，处理商品、订单、库存或采购等具体工作。";

  const links: GuideLink[] = [
    { path: "/new-listing", label: "新品上架", description: "生成图片、视频和文案，完成发布前审核。", icon: "new", allowed: canAccess("CONTENT_GENERATE") },
    { path: "/orders", label: "订单处理", description: "查看订单、核对付款和地址，并推进发货。", icon: "orders", allowed: canAccess("ORDER_VIEW") },
    { path: "/inventories", label: "库存管理", description: "查看库存水位，处理入库和库存预警。", icon: "inventory", allowed: canAccess("INVENTORY_VIEW") },
    { path: "/purchase-restock", label: "采购补货", description: "创建采购申请，跟进审批、下单和入库。", icon: "purchase", allowed: canAccess("PURCHASE_CREATE") },
    { path: "/settings", label: "设置中心", description: "配置模型、平台凭证和企业经营参数。", icon: "settings", allowed: canManageSettings() },
    { path: "/organization", label: "组织与成员", description: "管理店铺、成员和成员权限。", icon: "usermonitor", allowed: canManageOrganization() },
  ];

  const visibleLinks = links.filter((link) => link.allowed);

  return (
    <main className="page-content workspace-home">
      <PageHeader title={`欢迎回来，${identity?.displayName || identity?.email || "用户"}`} subtitle="从这里开始处理今天的店铺工作。" icon={<Icon name="dashboard" />} />

      <section className="workspace-identity card">
        <div>
          <span className="eyebrow">当前身份</span>
          <h3>{role}</h3>
          <p className="muted">{roleDescription}</p>
        </div>
        <div className="workspace-context">
          <div><span>企业</span><strong>{identity?.companyName || (isSuperAdmin() ? "平台管理" : "尚未加入企业")}</strong></div>
          <div><span>当前店铺</span><strong>{identity?.storeName || (isSuperAdmin() ? "平台范围" : "尚未选择店铺")}</strong></div>
        </div>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-heading"><div><span className="eyebrow">快捷入口</span><h3>按权限开始工作</h3></div><span className="muted">已展示 {visibleLinks.length} 个可用模块</span></div>
        {visibleLinks.length > 0 ? <div className="workspace-link-grid">{visibleLinks.map((link) => <NavLink className="workspace-link" to={link.path} key={link.path}><span className="workspace-link-icon"><Icon name={link.icon} /></span><span><strong>{link.label}</strong><small>{link.description}</small></span><span className="workspace-link-arrow">→</span></NavLink>)}</div> : <div className="empty-state"><strong>暂未分配业务权限</strong><span>请联系企业老板为你分配可操作的业务模块。</span></div>}
      </section>

      <section className="workspace-section">
        <div className="workspace-section-heading"><div><span className="eyebrow">使用流程</span><h3>系统主要工作链路</h3></div></div>
        <div className="workspace-flow">
          <div><b>01</b><strong>新品上架</strong><span>生成内容 → 审核 → 发布</span></div>
          <div><b>02</b><strong>订单履约</strong><span>订单 → 付款 → 预留库存 → 发货</span></div>
          <div><b>03</b><strong>库存补货</strong><span>库存预警 → 采购申请 → 入库</span></div>
        </div>
      </section>

      {isSuperAdmin() && <section className="workspace-note"><Icon name="simulator" /><span>平台管理员可以从左侧“平台管理”进入平台模拟；企业经营数据需要进入具体企业和店铺查看。</span></section>}
    </main>
  );
}
