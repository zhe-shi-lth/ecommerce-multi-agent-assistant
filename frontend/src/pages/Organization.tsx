import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { canManageOrganization, getIdentity, isSuperAdmin } from "../auth";
import { errMsg } from "../utils/errMsg";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Select from "../components/Select";

type Company = { id:number; name:string; status?:string; ownerUserId?:number|null };
type Store = { id:number; name:string; code?:string; status?:string };
type Member = { id:number; userId?:number; displayName?:string; email?:string; storeId?:number|null; storeName?:string; permissions?:string[] };
type Detail = { company:Company; stores:Store[]; members:Member[]; owners:Member[] };
type Audit = { id:number; domain?:string; action?:string; operatorName?:string; operatorEmail?:string; beforeValue?:string; afterValue?:string; detail?:string; createdAt?:string };

const permissionLabels:Record<string,string> = { PRODUCT_VIEW:"查看商品", PRODUCT_CREATE:"创建商品", PRODUCT_EDIT:"编辑商品", ORDER_VIEW:"查看订单", ORDER_CREATE:"创建订单", ORDER_REVIEW:"订单审核", ORDER_SHIP:"订单发货", INVENTORY_VIEW:"查看库存", INVENTORY_CREATE:"创建库存", INVENTORY_ADJUST:"库存调整", PURCHASE_CREATE:"创建采购", PURCHASE_APPROVE:"审批采购", PURCHASE_RECEIVE:"采购入库", SUPPLIER_MANAGE:"进货商家", MEMBER_MANAGE:"成员管理", CONTENT_GENERATE:"内容生成", CONTENT_EXECUTE:"执行生成任务", CONTENT_REVIEW:"内容审核", CONTENT_PUBLISH:"内容发布", PLATFORM_CONFIG:"平台设置", PLATFORM_ORDER_SYNC:"同步平台订单", PLATFORM_PUBLISH:"平台发布" };

export default function Organization() {
  const superAdmin = isSuperAdmin();
  const manager = canManageOrganization() && !superAdmin;
  const canDeleteStore = superAdmin || getIdentity()?.memberRole === "OWNER";
  const [companies,setCompanies] = useState<Company[]>([]);
  const [detail,setDetail] = useState<Detail>(null as unknown as Detail);
  const [audits,setAudits] = useState<Audit[]>([]);
  const [tab,setTab] = useState<"overview"|"audit">("overview");
  const [storeId,setStoreId] = useState<number|null>(null);
  const [memberId,setMemberId] = useState<number|null>(null);
  const [companyForm,setCompanyForm] = useState({name:"",ownerDisplayName:"",ownerEmail:"",ownerPassword:"123457"});
  const [storeName,setStoreName] = useState("");
  const [showCompany,setShowCompany] = useState(false);
  const [showStore,setShowStore] = useState(false);
  const [showMember,setShowMember] = useState(false);
  const [memberForm,setMemberForm] = useState({email:"",displayName:"",password:"123457"});
  const [memberStoreIds,setMemberStoreIds] = useState<number[]>([]);
  const [memberPermissions,setMemberPermissions] = useState<string[]>([]);

  const loadCompanies = async () => {
    if (!superAdmin) return;
    const rows = await api.get<Company[]>("/organization/companies"); setCompanies(rows);
  };
  const openCompany = async (id:number) => {
    const [d,a] = await Promise.all([api.get<Detail>(`/organization/companies/${id}/detail`), api.get<Audit[]>(`/audit-logs/company/${id}`)]);
    setDetail(d); setAudits(a); setTab("overview"); setStoreId(d.stores[0]?.id ?? null); setMemberId(null);
  };
  useEffect(() => { loadCompanies(); const i=getIdentity(); if (!superAdmin && i?.companyId) openCompany(i.companyId); }, []);
  const selectedStore = detail?.stores.find(s=>s.id===storeId);
  const members = useMemo(() => detail?.members.filter(m => !storeId || m.storeId===storeId) ?? [], [detail,storeId]);
  const selectedMember = members.find(m=>m.id===memberId) ?? null;

  const createCompany = async () => { if (!companyForm.name.trim()) return; const c=await api.post<Company>("/organization/companies",companyForm); setShowCompany(false); setCompanyForm({name:"",ownerDisplayName:"",ownerEmail:"",ownerPassword:"123457"}); await loadCompanies(); openCompany(c.id); };
  const createStore = async () => { if (!detail || !storeName.trim()) { window.alert("请填写店铺名称"); return; } try { await api.post("/organization/stores",{name:storeName.trim()}); setStoreName(""); setShowStore(false); await openCompany(detail.company.id); } catch (e) { window.alert(`创建店铺失败：${errMsg(e)}`); } };
  const createMember = async () => { if (!detail || !memberStoreIds.length || !memberForm.email.trim() || !memberForm.displayName.trim()) { window.alert("至少选择一个店铺，并填写员工姓名、邮箱"); return; } try { await api.post("/organization/members",{...memberForm,email:memberForm.email.trim(),displayName:memberForm.displayName.trim(),storeIds:memberStoreIds,permissions:memberPermissions}); setMemberForm({email:"",displayName:"",password:"123457"}); setMemberStoreIds([]); setMemberPermissions([]); setShowMember(false); await openCompany(detail.company.id); } catch (e) { window.alert(`创建员工失败：${errMsg(e)}`); } };
  const toggleCompany = async (c:Company) => { await api.put(`/organization/companies/${c.id}/status`,{status:c.status==="DISABLED"?"ACTIVE":"DISABLED"}); await loadCompanies(); };
  const deleteCompany = async (c:Company) => { if (window.confirm(`确定删除企业“${c.name}”吗？`)) { await api.delete(`/organization/companies/${c.id}`); setDetail(null as unknown as Detail); await loadCompanies(); } };
  const deleteStore = async (s:Store) => {
    if (!window.confirm(`确定删除店铺“${s.name}”吗？删除后该店铺下的成员关系将一并移除，且无法恢复。`)) return;
    try { await api.delete(`/organization/stores/${s.id}`); await openCompany(detail!.company.id); }
    catch (e) { window.alert(`删除失败：${errMsg(e)}`); }
  };
  const togglePermission = async (m:Member,p:string) => { const ps=m.permissions??[]; try { await api.put(`/organization/members/${m.id}/permissions`,{permissions:ps.includes(p)?ps.filter(x=>x!==p):[...ps,p]},{silent:true,redirectOnUnauthorized:false}); await openCompany(detail!.company.id); setMemberId(m.id); } catch (e) { window.alert(`权限保存失败：${errMsg(e)}，请确认当前登录账号仍是企业老板。`); } };

  if (showMember && !detail) return null;
  return <main className="page-content">
    <PageHeader title="组织与成员" subtitle="企业、店铺与成员权限统一管理" actions={superAdmin && !detail ? <button className="btn btn-primary" onClick={()=>setShowCompany(true)}>创建企业</button> : undefined}/>
    {superAdmin && !detail && <section className="card"><div className="card-header"><h3>企业列表</h3><span className="card-sub">{companies.length} 家</span></div>{companies.length===0?<EmptyState title="暂无企业" description="先创建一个企业"/>:<div className="table-wrap"><table><thead><tr><th>企业</th><th>状态</th><th>操作</th></tr></thead><tbody>{companies.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.status==="DISABLED"?"已停用":"正常"}</td><td><button className="btn btn-secondary btn-sm" onClick={()=>openCompany(c.id)}>进入详情</button> <button className="btn btn-secondary btn-sm" onClick={()=>toggleCompany(c)}>{c.status==="DISABLED"?"启用":"停用"}</button> {c.status==="DISABLED"&&<button className="btn btn-danger btn-sm" onClick={()=>deleteCompany(c)}>删除</button>}</td></tr>)}</tbody></table></div>}</section>}
    {detail && <>
      {superAdmin && <button className="btn btn-secondary btn-sm" onClick={()=>setDetail(null as unknown as Detail)}>返回企业列表</button>}
      <section className="card org-detail-head"><div><h2>{detail.company.name}</h2><span className="muted">企业详情与成员权限</span></div>{manager&&<button className="btn btn-primary" onClick={()=>setShowStore(true)}>创建店铺</button>}</section>
      <div className="org-detail-tabs"><button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>企业概览</button><button className={tab==="audit"?"active":""} onClick={()=>setTab("audit")}>审计日志 <span>{audits.length}</span></button></div>
      {tab==="overview" && <div className="org-detail-grid"><section className="card"><div className="card-header"><h3>企业老板</h3></div>{detail.owners.length?detail.owners.map(o=><div className="org-owner" key={o.id}><strong>{o.displayName||"未命名"}</strong><span>{o.email}</span></div>):<EmptyState title="暂无企业老板"/>}<div className="org-kpis"><div><strong>{detail.stores.length}</strong><span>店铺</span></div><div><strong>{detail.members.length}</strong><span>成员关系</span></div></div><div className="card-header"><h3>店铺</h3></div>{detail.stores.map(s=>(
    <div className={s.id===storeId?"org-store active":"org-store"} key={s.id} onClick={()=>{setStoreId(s.id);setMemberId(null)}}>
      <span className="org-store-main">
        <span className="org-store-avatar">{(s.name||"?").slice(0,1)}</span>
      <span className="org-store-name"><strong>{s.name}</strong></span>
      </span>
      {canDeleteStore && <button type="button" className="org-store-del" title="删除店铺" onClick={(e)=>{e.stopPropagation(); void deleteStore(s);}}>删除</button>}
    </div>
  ))}</section><section className="card"><div className="card-header"><h3>{selectedStore?`${selectedStore.name} · 成员权限`:"选择店铺"}</h3>{manager&&selectedStore&&<button className="btn btn-primary btn-sm" onClick={()=>setShowMember(true)}>创建员工</button>}</div>{selectedStore&&<><div className="org-member-select"><Select value={memberId??""} onChange={e=>setMemberId(Number(e.target.value)||null)} ariaLabel="选择成员"><option value="">选择成员后查看权限</option>{members.map(m=><option key={m.id} value={m.id}>{m.displayName||m.email}</option>)}</Select></div>{selectedMember&&<div className="permission-grid">{Object.entries(permissionLabels).map(([p,label])=><label className="checkbox-row" key={p}><input type="checkbox" checked={(selectedMember.permissions??[]).includes(p)} disabled={!manager} onChange={()=>togglePermission(selectedMember,p)}/>{label}</label>)}</div>}</>}</section></div>}
      {tab==="audit" && <section className="card org-audit-list"><div className="card-header"><h3>企业审计日志</h3><span className="card-sub">真实操作记录</span></div>{audits.length===0?<EmptyState title="暂无审计记录" description="企业创建、成员和店铺操作会记录在这里"/>:audits.map(a=><div className="org-audit-row" key={a.id}><div><strong>{a.action||a.domain||"操作"}</strong><p>{a.detail||""}</p></div><div className="org-audit-meta"><span>{a.operatorName||a.operatorEmail||"系统"}</span><time>{a.createdAt?new Date(a.createdAt).toLocaleString():""}</time></div></div>)}</section>}
    </>}
    {showCompany&&<div className="modal-backdrop"><div className="modal"><h3>创建企业</h3>{([['name','企业名称'],['ownerDisplayName','老板姓名'],['ownerEmail','老板邮箱'],['ownerPassword','初始密码']] as const).map(([k,l])=><label key={k}>{l}<input className="input" type={k==='ownerPassword'?'password':'text'} value={companyForm[k]} onChange={e=>setCompanyForm({...companyForm,[k]:e.target.value})}/></label>)}<div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setShowCompany(false)}>取消</button><button className="btn btn-primary" onClick={createCompany}>创建</button></div></div></div>}
    {showStore&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowStore(false)}}><div className="modal"><h3>创建店铺</h3><label>店铺名称<input className="input" autoFocus value={storeName} onChange={e=>setStoreName(e.target.value)} /></label><div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setShowStore(false)}>取消</button><button className="btn btn-primary" onClick={createStore}>创建</button></div></div></div>}
    {showMember&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowMember(false)}}><div className="modal"><h3>创建员工</h3><label>员工姓名<input className="input" autoFocus value={memberForm.displayName} onChange={e=>setMemberForm({...memberForm,displayName:e.target.value})}/></label><label>邮箱<input className="input" type="email" value={memberForm.email} onChange={e=>setMemberForm({...memberForm,email:e.target.value})}/></label><label>初始密码<input className="input" value={memberForm.password} onChange={e=>setMemberForm({...memberForm,password:e.target.value})}/></label><div className="field"><span>加入店铺</span><div className="permission-grid">{detail.stores.map(s=><label className="checkbox-row" key={s.id}><input type="checkbox" checked={memberStoreIds.includes(s.id)} onChange={()=>setMemberStoreIds(memberStoreIds.includes(s.id)?memberStoreIds.filter(id=>id!==s.id):[...memberStoreIds,s.id])}/>{s.name}</label>)}</div></div><div className="field"><span>初始权限（各店铺相同，可在店铺详情单独调整）</span><div className="permission-grid">{Object.entries(permissionLabels).map(([p,label])=><label className="checkbox-row" key={p}><input type="checkbox" checked={memberPermissions.includes(p)} onChange={()=>setMemberPermissions(memberPermissions.includes(p)?memberPermissions.filter(x=>x!==p):[...memberPermissions,p])}/>{label}</label>)}</div></div><div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setShowMember(false)}>取消</button><button className="btn btn-primary" onClick={createMember}>创建员工</button></div></div></div>}
  </main>;
}
