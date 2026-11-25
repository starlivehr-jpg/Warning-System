import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CheckCircle2, ChevronDown, ClipboardList, FileCheck2, FileText, LayoutDashboard,
  LogOut, Search, Settings, ShieldCheck, Users, XCircle,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Section = "overview" | "employees" | "warnings" | "approvals" | "reports" | "settings";

const navItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "ภาพรวมระบบ", icon: LayoutDashboard },
  { id: "employees", label: "ข้อมูลพนักงาน", icon: Users },
  { id: "warnings", label: "หนังสือเตือน", icon: FileText },
  { id: "approvals", label: "รออนุมัติ", icon: FileCheck2 },
  { id: "reports", label: "รายงาน", icon: ClipboardList },
  { id: "settings", label: "ตั้งค่าระบบ", icon: Settings },
];

function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน");
    else if (data.session) onSignedIn(data.session);
  }

  return <main className="login-wrap">
    <section className="login-card">
      <div className="brand-mark"><ShieldCheck size={30} /></div>
      <p className="eyebrow">STAR LIVE ONLINE</p>
      <h1>Warning System</h1>
      <p className="muted">ระบบบริหารจัดการหนังสือเตือนพนักงาน</p>
      <form onSubmit={submit} className="login-form">
        <label>อีเมลผู้ใช้งาน<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></label>
        <label>รหัสผ่าน<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="กรอกรหัสผ่าน" /></label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
      </form>
      <p className="login-foot">สำหรับผู้ได้รับสิทธิ์ใช้งานระบบเท่านั้น</p>
    </section>
  </main>;
}

function SetupNotice() {
  return <main className="setup-wrap"><section className="setup-card">
    <div className="brand-mark"><ShieldCheck size={30} /></div>
    <p className="eyebrow">STAR LIVE ONLINE</p><h1>Warning System</h1>
    <h2>เตรียมการเชื่อมต่อฐานข้อมูล</h2>
    <p>Source Code เริ่มต้นพร้อมแล้ว ขั้นตอนถัดไปคือสร้าง Supabase Project สำหรับ Warning System โดยเฉพาะ และกำหนดค่าการเชื่อมต่อผ่าน Environment Variables</p>
    <div className="setup-code"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></div>
    <p className="small-note">ขณะนี้ระบบยังไม่เชื่อมต่อฐานข้อมูล และยังไม่มีข้อมูลพนักงานหรือหนังสือเตือนจริง</p>
  </section></main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const active = useMemo(() => navItems.find(item => item.id === section), [section]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (!session) return <Login onSignedIn={setSession} />;

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small"><ShieldCheck size={22} /></div><div><strong>STAR LIVE</strong><span>WARNING SYSTEM</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{navItems.map(item => <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => setSection(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === "approvals" && <i className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17} /><span>ระบบรักษาความปลอดภัย</span></div><button className="nav-item" onClick={signOut}><LogOut size={18} /><span>ออกจากระบบ</span></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="mobile-brand">STAR LIVE <span>/ WARNING</span></div><div className="top-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาข้อมูลในระบบ..." /></div><button className="icon-btn" aria-label="การแจ้งเตือน"><Bell size={19} /></button><div className="user-chip"><div className="avatar">{session.user.email?.slice(0, 1).toUpperCase()}</div><div><strong>{session.user.email}</strong><span>ผู้ใช้งานระบบ</span></div><ChevronDown size={15} /></div></header>
      <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">HUMAN RESOURCES / WARNING MANAGEMENT</p><h1>{active?.label}</h1><p className="muted">จัดการข้อมูลและติดตามกระบวนการด้านวินัยพนักงานอย่างเป็นระบบ</p></div><div className="date-chip">STAR LIVE ONLINE</div></div>
        {section === "overview" ? <Overview /> : <ModulePlaceholder section={section} query={search} />}
      </section>
    </main>
  </div>;
}

function Overview() {
  const stats = [
    { label: "หนังสือเตือนทั้งหมด", value: "—", note: "รอเชื่อมต่อฐานข้อมูล", icon: FileText, tone: "blue" },
    { label: "รอการอนุมัติ", value: "—", note: "รอเชื่อมต่อฐานข้อมูล", icon: AlertTriangle, tone: "amber" },
    { label: "ดำเนินการแล้ว", value: "—", note: "รอเชื่อมต่อฐานข้อมูล", icon: CheckCircle2, tone: "green" },
    { label: "พนักงานในระบบ", value: "—", note: "รอเชื่อมต่อฐานข้อมูล", icon: Users, tone: "violet" },
  ];
  return <>
    <div className="welcome-panel"><div><span className="welcome-tag">HR MANAGEMENT PLATFORM</span><h2>บริหารจัดการงานบุคคล<br />ด้วยข้อมูลที่ตรวจสอบได้</h2><p>รวมศูนย์ข้อมูลพนักงาน หนังสือเตือน การอนุมัติ และประวัติการดำเนินการ</p></div><div className="welcome-art"><ShieldCheck size={88} strokeWidth={1.2} /></div></div>
    <div className="section-title"><div><h2>ภาพรวมการดำเนินงาน</h2><p>สรุปสถานะจากฐานข้อมูลจริงเมื่อเชื่อมต่อระบบแล้ว</p></div><span className="period-label">ภาพรวมทั้งหมด</span></div>
    <div className="stats-grid">{stats.map(s => <article className="stat-card" key={s.label}><div className={"stat-icon " + s.tone}><s.icon size={20} /></div><p>{s.label}</p><strong>{s.value}</strong><span>{s.note}</span></article>)}</div>
    <div className="bottom-grid"><article className="panel"><div className="panel-head"><div><h3>รายการล่าสุด</h3><p>กิจกรรมและหนังสือเตือนล่าสุด</p></div><FileText size={19} /></div><div className="empty-state"><div className="empty-icon"><ClipboardList size={25} /></div><strong>ยังไม่มีรายการ</strong><span>รายการจะแสดงเมื่อมีข้อมูลในฐานข้อมูล</span></div></article><article className="panel"><div className="panel-head"><div><h3>ขั้นตอนการทำงาน</h3><p>กระบวนการมาตรฐาน</p></div><BriefcaseBusiness size={19} /></div><ol className="workflow"><li><span>01</span><div><strong>บันทึกข้อมูลเหตุการณ์</strong><small>ระบุพนักงาน รายละเอียด และหลักฐาน</small></div></li><li><span>02</span><div><strong>ตรวจสอบและเสนออนุมัติ</strong><small>ผู้มีสิทธิ์ตรวจสอบข้อมูล</small></div></li><li><span>03</span><div><strong>ออกหนังสือเตือน</strong><small>จัดทำเอกสารและบันทึกผล</small></div></li><li><span>04</span><div><strong>ติดตามและจัดเก็บ</strong><small>เก็บประวัติและตรวจสอบย้อนหลัง</small></div></li></ol></article></div>
  </>;
}

function ModulePlaceholder({ section, query }: { section: Section; query: string }) {
  const descriptions: Record<Section, string> = {
    overview: "", employees: "จัดเก็บประวัติพนักงาน แผนก ตำแหน่ง และสถานะการทำงาน",
    warnings: "บันทึกเหตุการณ์ ประเภทความผิด ระดับหนังสือเตือน และเอกสารประกอบ",
    approvals: "ตรวจสอบรายการที่เสนออนุมัติ พร้อมบันทึกผู้อนุมัติและเหตุผล",
    reports: "สรุปข้อมูลตามช่วงเวลา แผนก ประเภทเหตุการณ์ และสถานะ",
    settings: "กำหนดผู้ใช้งาน บทบาท สิทธิ์ และค่ากำหนดของระบบ",
  };
  return <article className="module-panel"><div className="module-icon"><ClipboardList size={28} /></div><h2>{navItems.find(i => i.id === section)?.label}</h2><p>{descriptions[section]}</p><div className="module-status"><span className="status-dot" /> โครงสร้างหน้าจอพร้อมพัฒนา — รอเชื่อมต่อฐานข้อมูล</div>{query && <small>คำค้น: {query}</small>}</article>;
}

export default App;
