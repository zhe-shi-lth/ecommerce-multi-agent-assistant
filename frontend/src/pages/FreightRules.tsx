import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";
import Select from "../components/Select";
import { getFreightRules, saveFreightRules, type FreightRule } from "../api/settings";

const PROVINCES = ["北京","天津","上海","重庆","河北","山西","辽宁","吉林","黑龙江","江苏","浙江","安徽","福建","江西","山东","河南","湖北","湖南","广东","海南","四川","贵州","云南","陕西","甘肃","青海","台湾","内蒙古","广西","西藏","宁夏","新疆","香港","澳门"];

export default function FreightRules({ readOnly = false }: { readOnly?: boolean }) {
  const [rules, setRules] = useState<FreightRule[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { getFreightRules().then(r => setRules(r.rules)).catch(e => setError(String(e))); }, []);
  async function save() {
    if (readOnly) return;
    if (rules.some(x => !x.province || !Number.isFinite(Number(x.fee)) || Number(x.fee) < 0)) { setError("请填写有效的省份和运费"); return; }
    if (new Set(rules.map(x => x.province)).size !== rules.length) { setError("同一个省份只能设置一条运费规则"); return; }
    try { const result = await saveFreightRules(rules.map(x => ({...x, fee: Number(x.fee)}))); setRules(result.rules); setMessage("运费模板已保存"); setError(""); } catch (e) { setError(String(e)); }
  }
  function addRule() { const province = PROVINCES.find(p => !rules.some(x => x.province === p)) || ""; if (province) setRules([...rules, {province, fee: 0}]); }
  return <main className="page-content"><PageHeader title="运费模板" subtitle="当前店铺的买家运费规则" icon={<Icon name="purchase" />} />
    {error && <div className="notice notice-error">{error}</div>}{message && <div className="notice notice-success">{message}</div>}
    <section className={`card listing-review${readOnly ? " settings-readonly" : ""}`}><div className="card-header"><div><h3>按省份设置买家运费</h3><p className="muted">这里是买家应付邮费；仓库发货时还要在订单中填写商家实际支付的快递费。</p></div>{!readOnly && <button className="btn btn-secondary btn-sm" onClick={addRule}>添加省份</button>}</div>{readOnly && <div className="notice notice-warn">超级管理员仅可查看，运费配置由企业老板维护。</div>}<div className="freight-rule-list">{rules.length === 0 ? <div className="empty-state"><strong>暂未配置省份运费</strong><span>点击“添加省份”开始设置。</span></div> : rules.map((rule, index) => <div className="freight-rule-row" key={`${rule.province}-${index}`}><Select value={rule.province} disabled={readOnly} ariaLabel="选择省份" onChange={e => setRules(rules.map((x, i) => i === index ? {...x, province: e.target.value} : x))}><option value="">选择省份</option>{PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</Select><label className="freight-fee"><span>运费（元）</span><input className="input" type="number" min="0" step="0.01" value={rule.fee} disabled={readOnly} onChange={e => setRules(rules.map((x, i) => i === index ? {...x, fee: Number(e.target.value)} : x))} /></label>{!readOnly && <button className="btn btn-danger btn-sm" onClick={() => setRules(rules.filter((_, i) => i !== index))}>删除</button>}</div>)}</div><div className="modal-actions" style={{marginTop:16}}>{!readOnly && <button className="btn btn-primary" onClick={() => void save()}>保存运费模板</button>}</div><small className="muted">当前已配置 {rules.length} 条，未配置省份默认 0 元。</small></section>
  </main>;
}
