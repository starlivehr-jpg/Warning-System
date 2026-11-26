import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ClipboardList,
  FileCheck2, FileText, LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck,
  Users, X, RefreshCw, LockKeyhole, Download,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Section = "overview" | "employees" | "warnings" | "approvals" | "reports" | "settings";
type Role = "system_admin" | "hr_officer" | "approver" | "viewer";
type Profile = { id: string; full_name: string; role: Role; is_active: boolean };
type Department = { id: string; name: string };
type Employee = {
  id: string; employee_code: string; first_name: string; last_name: string;
  department_id: string | null; job_title: string | null; status: string;
  employment_start_date: string | null; departments?: { name: string } | null;
};
type WarningCase = {
  id: string; case_number: string; employee_id: string; incident_date: string;
  category: string; incident_description: string; warning_level: string; status: string;
  created_at: string; employees?: { employee_code: string; first_name: string; last_name: string } | null;
};
type Approval = {
  id: string; warning_id: string; decision: string; comments: string | null;
  warning_cases?: WarningCase | null;
  profiles?: { full_name: string } | null;
};

const navItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "ภาพรวมระบบ", icon: LayoutDashboard },
  { id: "employees", label: "ข้อมูลพนักงาน", icon: Users },
  { id: "warnings", label: "หนังสือเตือน", icon: FileText },
  { id: "approvals", label: "รออนุมัติ", icon: FileCheck2 },
  { id: "reports", label: "รายงาน", icon: ClipboardList },
  { id: "settings", label: "ตั้งค่าระบบ", icon: Settings },
];
const roleLabels: Record<Role, string> = {
  system_admin: "ผู้ดูแลระบบ", hr_officer: "เจ้าหน้าที่ HR", approver: "ผู้อนุมัติ", viewer: "ผู้ดูข้อมูล",
};
const statusLabels: Record<string, string> = {
  active: "ปฏิบัติงาน", resigned: "ลาออก", terminated: "เลิกจ้าง", suspended: "พักงาน",
  draft: "ฉบับร่าง", pending_approval: "รออนุมัติ", approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ", issued: "ออกหนังสือแล้ว", acknowledged: "รับทราบแล้ว", cancelled: "ยกเลิก",
  pending: "รอดำเนินการ",
};
const levelLabels: Record<string, string> = {
  verbal: "ตักเตือนด้วยวาจา", written_1: "หนังสือเตือนครั้งที่ 1",
  written_2: "หนังสือเตือนครั้งที่ 2", final_written: "หนังสือเตือนขั้นสุดท้าย",
};

function AuthScreen({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    if (mode === "signup") {
      const { data, error: e } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: name } },
      });
      if (e) setError(e.message);
      else if (data.session) onSignedIn(data.session);
      else setNotice("สร้างบัญชีแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ");
    } else {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมล รหัสผ่าน หรือการยืนยันอีเมล");
      else if (data.session) onSignedIn(data.session);
    }
    setBusy(false);
  }

  return <main className="login-wrap"><section className="login-card">
    <div className="brand-mark"><ShieldCheck size={30} /></div>
    <p className="eyebrow">STAR LIVE ONLINE</p><h1>Warning System</h1>
    <p className="muted">ระบบบริหารจัดการหนังสือเตือนพนักงาน</p>
    <div className="auth-tabs"><button className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>เข้าสู่ระบบ</button><button className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>สร้างบัญชีผู้ใช้งาน</button></div>
    <form onSubmit={submit} className="login-form">
      {mode === "signup" && <label>ชื่อ-นามสกุล<input required value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อผู้ใช้งาน" /></label>}
      <label>อีเมลผู้ใช้งาน<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></label>
      <label>รหัสผ่าน<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" /></label>
      {error && <p className="error-text">{error}</p>}{notice && <p className="success-text">{notice}</p>}
      <button className="primary-btn" disabled={busy}>{busy ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}</button>
    </form>
    <p className="login-foot">การสร้างบัญชีใหม่จะได้รับสิทธิ์เริ่มต้นเป็นผู้ดูข้อมูลเท่านั้น</p>
  </section></main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [warnings, setWarnings] = useState<WarningCase[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true); setError("");
    const [p, e, w, a, d, users] = await Promise.all([
      supabase.from("profiles").select("id,full_name,role,is_active").eq("id", session.user.id).maybeSingle(),
      supabase.from("employees").select("id,employee_code,first_name,last_name,department_id,job_title,status,employment_start_date,departments(name)").order("created_at", { ascending: false }),
      supabase.from("warning_cases").select("id,case_number,employee_id,incident_date,category,incident_description,warning_level,status,created_at,employees(employee_code,first_name,last_name)").order("created_at", { ascending: false }),
      supabase.from("warning_approvals").select("id,warning_id,decision,comments,warning_cases(id,case_number,employee_id,incident_date,category,incident_description,warning_level,status,created_at,employees(employee_code,first_name,last_name))").order("created_at", { ascending: false }),
      supabase.from("departments").select("id,name").eq("is_active", true).order("name"),
      supabase.from("profiles").select("id,full_name,role,is_active").order("full_name"),
    ]);
    if (p.error) setError("ไม่สามารถอ่านโปรไฟล์ผู้ใช้งานได้: " + p.error.message);
    setProfile(p.data as Profile | null);
    setEmployees((e.data || []) as unknown as Employee[]);
    setWarnings((w.data || []) as unknown as WarningCase[]);
    setApprovals((a.data || []) as unknown as Approval[]);
    setDepartments((d.data || []) as Department[]);
    setProfiles((users.data || []) as Profile[]);
    const firstError = e.error || w.error || a.error || d.error;
    if (firstError) setError("โหลดข้อมูลบางส่วนไม่สำเร็จ: " + firstError.message);
    setLoading(false);
  }, [session]);

  useEffect(() => { if (session) void loadData(); else { setProfile(null); setEmployees([]); setWarnings([]); setApprovals([]); } }, [session, loadData]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3500); };
  async function signOut() { await supabase?.auth.signOut(); setSession(null); setProfile(null); }
  const active = navItems.find(item => item.id === section);
  const canManage = profile?.is_active && (profile.role === "system_admin" || profile.role === "hr_officer");
  const isAdmin = profile?.is_active && profile.role === "system_admin";

  if (!isSupabaseConfigured) return <main className="setup-wrap"><section className="setup-card"><div className="brand-mark"><ShieldCheck size={30} /></div><h1>Warning System</h1><p>ยังไม่ได้ตั้งค่า Supabase URL และ Publishable Key</p></section></main>;
  if (!session) return <AuthScreen onSignedIn={setSession} />;

  if (loading && !profile) return <main className="setup-wrap"><div className="loading-state"><RefreshCw className="spin" /> กำลังตรวจสอบสิทธิ์และโหลดข้อมูล...</div></main>;
  if (!profile || !profile.is_active) return <main className="setup-wrap"><section className="setup-card">
    <div className="brand-mark"><LockKeyhole size={28} /></div><p className="eyebrow">STAR LIVE ONLINE</p><h1>ยังไม่มีสิทธิ์เข้าใช้งาน</h1>
    <p>บัญชีนี้ยังไม่มีโปรไฟล์ หรือถูกระงับการใช้งาน หากเป็นผู้ดูแลระบบคนแรก ให้ใช้รหัสตั้งค่าครั้งแรกที่ได้รับจากผู้ดูแลโครงการ</p>
    <BootstrapAdmin onDone={loadData} />
    <button className="secondary-btn full" onClick={signOut}>ออกจากระบบ</button>
  </section></main>;

  async function updateEmployeeRole(userId: string, role: Role) {
    if (!supabase || !isAdmin) return;
    const { error: e } = await supabase.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", userId);
    if (e) notify("เปลี่ยนสิทธิ์ไม่สำเร็จ: " + e.message); else { notify("ปรับสิทธิ์ผู้ใช้งานแล้ว"); void loadData(); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small"><ShieldCheck size={22} /></div><div><strong>STAR LIVE</strong><span>WARNING SYSTEM</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{navItems.map(item => <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => setSection(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === "approvals" && approvals.some(a => a.decision === "pending") && <i className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17} /><span>ระบบรักษาความปลอดภัย</span></div><button className="nav-item" onClick={signOut}><LogOut size={18} /><span>ออกจากระบบ</span></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="mobile-brand">STAR LIVE <span>/ WARNING</span></div><div className="top-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาข้อมูลในระบบ..." /></div><button className="icon-btn" onClick={() => void loadData()} aria-label="รีเฟรช"><RefreshCw size={17} /></button><div className="user-chip"><div className="avatar">{profile.full_name.slice(0, 1)}</div><div><strong>{profile.full_name}</strong><span>{roleLabels[profile.role]}</span></div><ChevronDown size={15} /></div></header>
      <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">HUMAN RESOURCES / WARNING MANAGEMENT</p><h1>{active?.label}</h1><p className="muted">จัดการข้อมูลและติดตามกระบวนการด้านวินัยพนักงานอย่างเป็นระบบ</p></div><div className="date-chip">STAR LIVE ONLINE</div></div>
        {error && <div className="inline-error">{error}</div>}
        {section === "overview" && <Overview employees={employees} warnings={warnings} approvals={approvals} onGo={setSection} />}
        {section === "employees" && <EmployeesModule employees={employees} departments={departments} canManage={!!canManage} query={search} userId={session.user.id} onSaved={() => { notify("บันทึกข้อมูลพนักงานแล้ว"); void loadData(); }} />}
        {section === "warnings" && <WarningsModule warnings={warnings} employees={employees} profiles={profiles.filter(p => p.is_active && (p.role === "approver" || p.role === "system_admin"))} canManage={!!canManage} query={search} userId={session.user.id} onSaved={() => { notify("บันทึกข้อมูลหนังสือเตือนแล้ว"); void loadData(); }} />}
        {section === "approvals" && <ApprovalsModule approvals={approvals} canManage={!!canManage} onSaved={() => { notify("บันทึกผลการพิจารณาแล้ว"); void loadData(); }} />}
        {section === "reports" && <ReportsModule employees={employees} warnings={warnings} />}
        {section === "settings" && <SettingsModule profile={profile} profiles={profiles} onRoleChange={updateEmployeeRole} onBootstrap={loadData} />}
      </section>
    </main>
    {toast && <div className="toast-message"><CheckCircle2 size={17} />{toast}</div>}
  </div>;
}

function BootstrapAdmin({ onDone }: { onDone: () => Promise<void> }) {
  const [token, setToken] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setMessage("");
    const { error } = await supabase.rpc("bootstrap_first_warning_admin", { p_token: token.trim() });
    setBusy(false);
    if (error) setMessage("ตั้งค่าผู้ดูแลไม่สำเร็จ: " + error.message);
    else { setMessage("ตั้งค่าผู้ดูแลระบบสำเร็จ กำลังโหลดสิทธิ์..."); await onDone(); }
  }
  return <form className="bootstrap-form" onSubmit={submit}><label>รหัสตั้งค่าผู้ดูแลครั้งแรก<input value={token} onChange={e => setToken(e.target.value)} required autoComplete="off" placeholder="วางรหัสตั้งค่าครั้งแรก" /></label><button className="primary-btn" disabled={busy}>{busy ? "กำลังตั้งค่า..." : "กำหนดบัญชีนี้เป็นผู้ดูแลระบบ"}</button>{message && <p className={message.includes("สำเร็จ") ? "success-text" : "error-text"}>{message}</p>}</form>;
}

function Overview({ employees, warnings, approvals, onGo }: { employees: Employee[]; warnings: WarningCase[]; approvals: Approval[]; onGo: (s: Section) => void }) {
  const stats = [
    { label: "หนังสือเตือนทั้งหมด", value: warnings.length, icon: FileText, tone: "blue" },
    { label: "รอการอนุมัติ", value: warnings.filter(w => w.status === "pending_approval").length, icon: AlertTriangle, tone: "amber" },
    { label: "ออกหนังสือแล้ว", value: warnings.filter(w => w.status === "issued" || w.status === "acknowledged").length, icon: CheckCircle2, tone: "green" },
    { label: "พนักงานในระบบ", value: employees.filter(e => e.status === "active").length, icon: Users, tone: "violet" },
  ];
  return <>
    <div className="welcome-panel"><div><span className="welcome-tag">HR MANAGEMENT PLATFORM</span><h2>บริหารจัดการงานบุคคล<br />ด้วยข้อมูลที่ตรวจสอบได้</h2><p>รวมศูนย์ข้อมูลพนักงาน หนังสือเตือน การอนุมัติ และประวัติการดำเนินการ</p></div><div className="welcome-art"><ShieldCheck size={88} strokeWidth={1.2} /></div></div>
    <div className="section-title"><div><h2>ภาพรวมการดำเนินงาน</h2><p>ข้อมูลจากฐานข้อมูล Warning System</p></div><span className="period-label">อัปเดตตามข้อมูลล่าสุด</span></div>
    <div className="stats-grid">{stats.map(s => <article className="stat-card" key={s.label}><div className={"stat-icon " + s.tone}><s.icon size={20} /></div><p>{s.label}</p><strong>{s.value.toLocaleString("th-TH")}</strong><span>ข้อมูลปัจจุบัน</span></article>)}</div>
    <div className="bottom-grid"><article className="panel"><div className="panel-head"><div><h3>หนังสือเตือนล่าสุด</h3><p>รายการล่าสุดในระบบ</p></div><button className="text-btn" onClick={() => onGo("warnings")}>ดูทั้งหมด</button></div>{warnings.length ? <div className="compact-list">{warnings.slice(0, 5).map(w => <div className="compact-row" key={w.id}><div><strong>{w.case_number}</strong><small>{w.employees?.first_name} {w.employees?.last_name} · {w.category}</small></div><StatusPill status={w.status} /></div>)}</div> : <EmptyState title="ยังไม่มีรายการหนังสือเตือน" detail="เพิ่มรายการใหม่จากเมนูหนังสือเตือน" />}</article>
      <article className="panel"><div className="panel-head"><div><h3>งานรอพิจารณา</h3><p>รายการที่มอบหมายให้บัญชีนี้</p></div><button className="text-btn" onClick={() => onGo("approvals")}>เปิดรายการ</button></div>{approvals.filter(a => a.decision === "pending").length ? <div className="compact-list">{approvals.filter(a => a.decision === "pending").slice(0, 5).map(a => <div className="compact-row" key={a.id}><div><strong>{a.warning_cases?.case_number || "รายการอนุมัติ"}</strong><small>{a.warning_cases?.category || "รอพิจารณา"}</small></div><StatusPill status="pending" /></div>)}</div> : <EmptyState title="ไม่มีรายการรออนุมัติ" detail="รายการอนุมัติที่มอบหมายจะแสดงที่นี่" />}</article></div>
  </>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><div className="empty-icon"><ClipboardList size={25} /></div><strong>{title}</strong><span>{detail}</span></div>; }
function StatusPill({ status }: { status: string }) { return <span className={"status-pill " + status}>{statusLabels[status] || status}</span>; }

function EmployeesModule({ employees, departments, canManage, query, userId, onSaved }: { employees: Employee[]; departments: Department[]; canManage: boolean; query: string; userId: string; onSaved: () => void }) {
  const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [form, setForm] = useState({ employee_code: "", first_name: "", last_name: "", department_id: "", job_title: "", employment_start_date: "", status: "active" });
  const filtered = employees.filter(e => [e.employee_code, e.first_name, e.last_name, e.job_title || "", e.departments?.name || ""].join(" ").toLowerCase().includes(query.toLowerCase()));
  async function save(e: FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setError("");
    const { error: err } = await supabase.from("employees").insert({ ...form, department_id: form.department_id || null, employment_start_date: form.employment_start_date || null, created_by: userId });
    setBusy(false); if (err) setError(err.message); else { setShowForm(false); setForm({ employee_code: "", first_name: "", last_name: "", department_id: "", job_title: "", employment_start_date: "", status: "active" }); onSaved(); }
  }
  return <><div className="toolbar"><div><strong>ทะเบียนพนักงาน</strong><span>{filtered.length} รายการ</span></div>{canManage && <button className="primary-small" onClick={() => setShowForm(!showForm)}><Plus size={16} /> เพิ่มพนักงาน</button>}</div>
    {showForm && <form className="form-panel" onSubmit={save}><div className="form-head"><strong>เพิ่มข้อมูลพนักงาน</strong><button type="button" className="close-btn" onClick={() => setShowForm(false)}><X size={17} /></button></div><div className="form-grid">
      <label>รหัสพนักงาน<input required value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} /></label><label>ชื่อ<input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label>นามสกุล<input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label><label>แผนก<select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}><option value="">ไม่ระบุ</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>ตำแหน่ง<input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></label><label>วันที่เริ่มงาน<input type="date" value={form.employment_start_date} onChange={e => setForm({ ...form, employment_start_date: e.target.value })} /></label></div>{error && <p className="error-text">{error}</p>}<button className="primary-btn" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกข้อมูลพนักงาน"}</button></form>}
    <div className="table-wrap"><table><thead><tr><th>รหัสพนักงาน</th><th>ชื่อ-นามสกุล</th><th>แผนก</th><th>ตำแหน่ง</th><th>สถานะ</th></tr></thead><tbody>{filtered.map(e => <tr key={e.id}><td className="mono">{e.employee_code}</td><td><strong>{e.first_name} {e.last_name}</strong></td><td>{e.departments?.name || "—"}</td><td>{e.job_title || "—"}</td><td><StatusPill status={e.status} /></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="ไม่พบข้อมูลพนักงาน" detail={canManage ? "กดเพิ่มพนักงานเพื่อเริ่มบันทึกข้อมูล" : "ยังไม่มีข้อมูลในทะเบียนพนักงาน"} />}</div>
  </>;
}

function WarningsModule({ warnings, employees, profiles, canManage, query, userId, onSaved }: { warnings: WarningCase[]; employees: Employee[]; profiles: Profile[]; canManage: boolean; query: string; userId: string; onSaved: () => void }) {
  const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [form, setForm] = useState({ employee_id: "", incident_date: new Date().toISOString().slice(0, 10), category: "", incident_description: "", warning_level: "written_1", approver_id: "" });
  const filtered = warnings.filter(w => [w.case_number, w.category, w.incident_description, w.employees?.first_name || "", w.employees?.last_name || ""].join(" ").toLowerCase().includes(query.toLowerCase()));
  async function save(e: FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setError("");
    const caseNumber = "WRN-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + Date.now().toString().slice(-6);
    const { data, error: err } = await supabase.from("warning_cases").insert({
      case_number: caseNumber, employee_id: form.employee_id, incident_date: form.incident_date,
      category: form.category, incident_description: form.incident_description,
      warning_level: form.warning_level, status: form.approver_id ? "pending_approval" : "draft", created_by: userId,
    }).select("id").single();
    if (err) { setError(err.message); setBusy(false); return; }
    if (form.approver_id) {
      const { error: approvalError } = await supabase.from("warning_approvals").insert({ warning_id: data.id, approver_id: form.approver_id });
      if (approvalError) { await supabase.from("warning_cases").update({ status: "draft" }).eq("id", data.id); setError("สร้างรายการแล้ว แต่ส่งอนุมัติไม่สำเร็จ: " + approvalError.message); setBusy(false); return; }
    }
    setBusy(false); setShowForm(false); setForm({ employee_id: "", incident_date: new Date().toISOString().slice(0, 10), category: "", incident_description: "", warning_level: "written_1", approver_id: "" }); onSaved();
  }
  async function issue(id: string) {
    if (!supabase) return; const { error: err } = await supabase.from("warning_cases").update({ status: "issued", issued_at: new Date().toISOString(), updated_by: userId }).eq("id", id);
    if (err) setError(err.message); else onSaved();
  }
  return <><div className="toolbar"><div><strong>ทะเบียนหนังสือเตือน</strong><span>{filtered.length} รายการ</span></div>{canManage && <button className="primary-small" onClick={() => setShowForm(!showForm)}><Plus size={16} /> สร้างหนังสือเตือน</button>}</div>
    {showForm && <form className="form-panel" onSubmit={save}><div className="form-head"><strong>บันทึกเหตุการณ์และเสนออนุมัติ</strong><button type="button" className="close-btn" onClick={() => setShowForm(false)}><X size={17} /></button></div><div className="form-grid">
      <label className="span-2">พนักงาน<select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}><option value="">เลือกพนักงาน</option>{employees.filter(x => x.status === "active").map(x => <option key={x.id} value={x.id}>{x.employee_code} · {x.first_name} {x.last_name}</option>)}</select></label>
      <label>วันที่เกิดเหตุ<input type="date" required value={form.incident_date} onChange={e => setForm({ ...form, incident_date: e.target.value })} /></label>
      <label>ประเภทเหตุการณ์<input required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="เช่น ขาดงาน / มาสาย / ฝ่าฝืนระเบียบ" /></label>
      <label>ระดับการเตือน<select value={form.warning_level} onChange={e => setForm({ ...form, warning_level: e.target.value })}>{Object.entries(levelLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>ผู้อนุมัติ<select value={form.approver_id} onChange={e => setForm({ ...form, approver_id: e.target.value })}><option value="">บันทึกเป็นฉบับร่าง</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name} ({roleLabels[p.role]})</option>)}</select></label>
      <label className="span-2">รายละเอียดเหตุการณ์<textarea required rows={4} value={form.incident_description} onChange={e => setForm({ ...form, incident_description: e.target.value })} /></label>
    </div>{error && <p className="error-text">{error}</p>}<button className="primary-btn" disabled={busy || !employees.length}>{busy ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>{!employees.length && <p className="small-note">กรุณาเพิ่มข้อมูลพนักงานก่อนสร้างหนังสือเตือน</p>}</form>}
    <div className="table-wrap"><table><thead><tr><th>เลขที่เอกสาร</th><th>พนักงาน</th><th>วันที่เกิดเหตุ</th><th>ประเภท / ระดับ</th><th>สถานะ</th><th>การดำเนินการ</th></tr></thead><tbody>{filtered.map(w => <tr key={w.id}><td className="mono">{w.case_number}</td><td>{w.employees?.first_name} {w.employees?.last_name}</td><td>{new Date(w.incident_date).toLocaleDateString("th-TH")}</td><td>{w.category}<small className="cell-sub">{levelLabels[w.warning_level]}</small></td><td><StatusPill status={w.status} /></td><td>{canManage && w.status === "approved" ? <button className="table-action" onClick={() => void issue(w.id)}>ออกหนังสือ</button> : "—"}</td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="ยังไม่มีหนังสือเตือน" detail="รายการที่สร้างจะแสดงในตารางนี้" />}</div>
  </>;
}

function ApprovalsModule({ approvals, canManage, onSaved }: { approvals: Approval[]; canManage: boolean; onSaved: () => void }) {
  const [busyId, setBusyId] = useState("");
  async function decide(id: string, decision: "approved" | "rejected") {
    if (!supabase) return; setBusyId(id);
    const { error } = await supabase.from("warning_approvals").update({ decision, decided_at: new Date().toISOString() }).eq("id", id);
    setBusyId(""); if (error) window.alert("บันทึกผลไม่สำเร็จ: " + error.message); else onSaved();
  }
  const visible = approvals.filter(a => a.decision === "pending" || canManage || a.warning_cases?.status === "approved");
  return <><div className="toolbar"><div><strong>รายการอนุมัติ</strong><span>{visible.filter(a => a.decision === "pending").length} รายการรอพิจารณา</span></div></div>
    <div className="approval-list">{visible.map(a => <article className="approval-card" key={a.id}><div className="approval-icon"><FileCheck2 size={22} /></div><div className="approval-main"><div className="approval-title"><strong>{a.warning_cases?.case_number || "หนังสือเตือน"}</strong><StatusPill status={a.decision} /></div><p>{a.warning_cases?.employees?.first_name} {a.warning_cases?.employees?.last_name} · {a.warning_cases?.category}</p><small>{a.warning_cases?.incident_description}</small></div><div className="approval-actions">{a.decision === "pending" && <><button disabled={busyId === a.id} className="approve-btn" onClick={() => void decide(a.id, "approved")}>อนุมัติ</button><button disabled={busyId === a.id} className="reject-btn" onClick={() => void decide(a.id, "rejected")}>ไม่อนุมัติ</button></>}</div></article>)}{!visible.length && <EmptyState title="ไม่มีรายการอนุมัติ" detail="รายการที่ได้รับมอบหมายจะแสดงที่นี่" />}</div>
  </>;
}

function ReportsModule({ employees, warnings }: { employees: Employee[]; warnings: WarningCase[] }) {
  const byStatus = Object.entries(statusLabels).map(([status, label]) => ({ status, label, count: warnings.filter(w => w.status === status).length })).filter(x => x.count);
  const downloadCsv = () => {
    const rows = [["เลขที่เอกสาร","รหัสพนักงาน","วันที่เกิดเหตุ","ประเภท","ระดับ","สถานะ"], ...warnings.map(w => [w.case_number, w.employees?.employee_code || "", w.incident_date, w.category, levelLabels[w.warning_level] || w.warning_level, statusLabels[w.status] || w.status])];
    const csv = "\uFEFF" + rows.map(r => r.map(v => '"' + String(v).replaceAll('"','""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "warning-report.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return <><div className="report-summary"><div><span>พนักงานทั้งหมด</span><strong>{employees.length}</strong></div><div><span>หนังสือเตือนทั้งหมด</span><strong>{warnings.length}</strong></div><div><span>รออนุมัติ</span><strong>{warnings.filter(w => w.status === "pending_approval").length}</strong></div><div><span>ออกหนังสือแล้ว</span><strong>{warnings.filter(w => ["issued","acknowledged"].includes(w.status)).length}</strong></div></div>
    <article className="panel report-panel"><div className="panel-head"><div><h3>สรุปสถานะหนังสือเตือน</h3><p>จำนวนรายการแยกตามสถานะ</p></div><button className="primary-small" onClick={downloadCsv}><Download size={15} /> ส่งออก CSV</button></div>{byStatus.length ? byStatus.map(x => <div className="report-row" key={x.status}><span>{x.label}</span><div className="report-track"><i style={{ width: (x.count / Math.max(warnings.length, 1) * 100) + "%" }} /></div><strong>{x.count}</strong></div>) : <EmptyState title="ยังไม่มีข้อมูลรายงาน" detail="รายงานจะอัปเดตเมื่อมีข้อมูลจริง" />}</article>
  </>;
}

function SettingsModule({ profile, profiles, onRoleChange, onBootstrap }: { profile: Profile; profiles: Profile[]; onRoleChange: (id: string, role: Role) => void; onBootstrap: () => Promise<void> }) {
  return <><article className="panel settings-profile"><div className="avatar large">{profile.full_name.slice(0, 1)}</div><div><h3>{profile.full_name}</h3><p>{roleLabels[profile.role]} · {profile.is_active ? "ใช้งานอยู่" : "ระงับ"}</p></div></article>
    {profile.role === "system_admin" ? <article className="panel settings-users"><div className="panel-head"><div><h3>จัดการสิทธิ์ผู้ใช้งาน</h3><p>บัญชีใหม่จะเริ่มต้นเป็นผู้ดูข้อมูล ผู้ดูแลสามารถปรับบทบาทได้</p></div><Users size={19} /></div><div className="table-wrap"><table><thead><tr><th>ชื่อผู้ใช้งาน</th><th>สิทธิ์ปัจจุบัน</th><th>กำหนดสิทธิ์</th></tr></thead><tbody>{profiles.map(p => <tr key={p.id}><td>{p.full_name}{p.id === profile.id ? " (บัญชีนี้)" : ""}</td><td>{roleLabels[p.role]}</td><td><select value={p.role} disabled={p.id === profile.id} onChange={e => onRoleChange(p.id, e.target.value as Role)}>{Object.entries(roleLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></td></tr>)}</tbody></table></div></article> : <article className="panel"><h3>สิทธิ์และความปลอดภัย</h3><p className="muted">การเปลี่ยนบทบาทผู้ใช้งานดำเนินการได้โดยผู้ดูแลระบบเท่านั้น</p></article>}
    <article className="panel"><div className="panel-head"><div><h3>การเริ่มต้นผู้ดูแลระบบ</h3><p>ใช้ได้ครั้งเดียวในช่วงติดตั้งระบบเท่านั้น</p></div><ShieldCheck size={19} /></div><p className="small-note">การตั้งค่าผู้ดูแลครั้งแรกจะปิดถาวรเมื่อมีบัญชีผู้ดูแลระบบแล้ว</p><BootstrapAdmin onDone={onBootstrap} /></article>
  </>;
}

export default App;
