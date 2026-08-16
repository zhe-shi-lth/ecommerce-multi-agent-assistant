import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getIdentity } from "../auth";
import PageHeader from "../components/PageHeader";
import { Icon } from "../components/icons";

export default function Profile() {
  const identity = getIdentity(); const [name, setName] = useState(""); const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { api.get<{displayName:string|null}>("/users/me").then((u) => setName(u.displayName ?? "")); }, []);
  async function save() { await api.put("/users/me", { displayName: name, currentPassword: current || undefined, newPassword: next || undefined }); setMessage("个人信息已保存"); setCurrent(""); setNext(""); }
  return <div><PageHeader title="个人资料" subtitle={identity?.email ?? ""} icon={<Icon name="settings" />} /><section className="settings-panel"><label className="field"><span>姓名/名称</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" /></label><label className="field"><span>当前密码（修改密码时填写）</span><input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label><label className="field"><span>新密码</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="至少 6 位" /></label><button className="btn btn-primary" onClick={() => void save()}>保存个人信息</button>{message && <div className="notice notice-success">{message}</div>}</section></div>;
}
