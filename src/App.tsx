import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ClipboardList,
  FileCheck2, FileText, LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck,
  Users, X, RefreshCw, LockKeyhole, Download, BookOpen, Eye, EyeOff,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import WarningLetterFields, { type WarningLetterFormValue } from "./WarningLetterFields";

type Section = "overview" | "employees" | "warnings" | "approvals" | "reports" | "regulations" | "settings";
type Role = "system_admin" | "hr_officer" | "approver" | "viewer" | "supervisor" | "hr_manager" | "executive" | "employee";
type Profile = { id: string; full_name: string; role: Role; is_active: boolean; employee_id?: string | null; default_company_id?: string | null };
type Company = { id: string; company_code: string; company_name: string };
type CompanyAccess = { profile_id: string; company_id: string };
type AdminUserInput = { full_name: string; email: string; password: string; role: Role; employee_id: string | null; company_ids: string[]; default_company_id: string };
type RegulationCategory = { category_code: string; category_name_th: string; sort_order: number };
type RegulationDocument = { id: string; company_id: string; title: string; document_code: string | null; revision: string | null; effective_date: string | null; original_file_name: string | null; storage_path: string | null; source_status: string; created_at: string };
type RegulationSection = { id: string; document_id: string; company_id: string; category_code: string; section_number: string | null; heading: string; content_text: string; source_page: number | null; sort_order: number };
type Department = { id: string; name: string; company_id?: string };
type Employee = {
  id: string; employee_code: string; first_name: string; last_name: string; company_id: string;
  department_id: string | null; job_title: string | null; status: string;
  employment_start_date: string | null; departments?: { name: string } | null;
};
type WarningCase = {
  id: string; case_number: string; employee_id: string; company_id: string; incident_date: string;
  category: string; incident_description: string; warning_level: string; status: string; executive_ack_required?: boolean;
  incident_time?: string | null; incident_location?: string | null; employee_explanation?: string | null; proposed_action?: string | null;
  created_at: string; created_by: string; employees?: { employee_code: string; first_name: string; last_name: string } | null;
  warning_attachments?: { id: string; storage_path: string; original_file_name: string }[];
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
  { id: "regulations", label: "ระเบียบข้อบังคับ", icon: BookOpen },
  { id: "settings", label: "ตั้งค่าระบบ", icon: Settings },
];
const roleLabels: Record<Role, string> = {
  system_admin: "ผู้ดูแลระบบ", hr_officer: "เจ้าหน้าที่ HR", approver: "ผู้อนุมัติ", viewer: "ผู้ดูข้อมูล",
  supervisor: "หัวหน้างาน", hr_manager: "ผู้จัดการทรัพยากรบุคคล", executive: "ผู้บริหาร", employee: "พนักงาน",
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

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

  async function requestPasswordReset() {
    if (!supabase) return;
    if (!email.trim()) { setError("กรุณากรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน"); return; }
    setResetBusy(true); setError(""); setNotice("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setResetBusy(false);
    if (resetError) setError("ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ: " + resetError.message);
    else setNotice("ส่งลิงก์ยืนยันการรีเซ็ตรหัสผ่านไปยังอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย");
  }

  return <main className="login-wrap"><section className="login-card">
    <div className="brand-mark"><ShieldCheck size={30} /></div>
    <p className="eyebrow">STAR LIVE ONLINE</p><h1>Warning System</h1>
    <p className="muted">ระบบบริหารจัดการหนังสือเตือนพนักงาน</p>
    <div className="auth-tabs"><button className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>เข้าสู่ระบบ</button><button className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>สร้างบัญชีผู้ใช้งาน</button></div>
    <form onSubmit={submit} className="login-form">
      {mode === "signup" && <label>ชื่อ-นามสกุล<input required value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อผู้ใช้งาน" /></label>}
      <label>อีเมลผู้ใช้งาน<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></label>
      <label>รหัสผ่าน<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>{showPassword ? "ซ่อน" : "แสดง"}</button></div></label>
      {error && <p className="error-text">{error}</p>}{notice && <p className="success-text">{notice}</p>}
      <button className="primary-btn" disabled={busy}>{busy ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}</button>
      {mode === "login" && <button type="button" className="text-btn forgot-password" disabled={resetBusy} onClick={() => void requestPasswordReset()}>{resetBusy ? "กำลังส่งลิงก์..." : "ลืมรหัสผ่าน? ส่งลิงก์ยืนยันทางอีเมล"}</button>}
    </form>
    <p className="login-foot">การสร้างบัญชีใหม่จะได้รับสิทธิ์เริ่มต้นเป็นผู้ดูข้อมูลเท่านั้น</p>
  </section></main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [companyAccess, setCompanyAccess] = useState<CompanyAccess[]>([]);
  const [regulationCategories, setRegulationCategories] = useState<RegulationCategory[]>([]);
  const [regulationDocuments, setRegulationDocuments] = useState<RegulationDocument[]>([]);
  const [regulationSections, setRegulationSections] = useState<RegulationSection[]>([]);
  const [section, setSection] = useState<Section>(() => { const route = window.location.hash.replace(/^#\/?/, "").split("?")[0] as Section; return navItems.some(item => item.id === route) ? route : "overview"; });
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [warnings, setWarnings] = useState<WarningCase[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const syncRoute = () => { const route = window.location.hash.replace(/^#\/?/, "").split("?")[0] as Section; if (navItems.some(item => item.id === route)) setSection(route); };
    window.addEventListener("popstate", syncRoute); window.addEventListener("hashchange", syncRoute);
    if (!window.location.hash) window.history.replaceState({ section: "overview" }, "", "#overview");
    return () => { window.removeEventListener("popstate", syncRoute); window.removeEventListener("hashchange", syncRoute); };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => { setSession(nextSession); if (event === "PASSWORD_RECOVERY") setRecoveryMode(true); if (event === "SIGNED_OUT") setRecoveryMode(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true); setError("");
    const [p, companyResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,role,is_active,employee_id,default_company_id").eq("id", session.user.id).maybeSingle(),
      supabase.from("companies").select("id,company_code,company_name").eq("is_active", true).order("company_name"),
    ]);
    if (p.error) setError("ไม่สามารถอ่านโปรไฟล์ผู้ใช้งานได้: " + p.error.message);
    setProfile(p.data as Profile | null);
    if (companyResult.error) {
      setError("ไม่สามารถอ่านรายชื่อบริษัทที่ได้รับอนุญาตได้: " + companyResult.error.message);
      setCompanies([]);
      setLoading(false);
      return;
    }
    const availableCompanies = (companyResult.data || []) as Company[];
    setCompanies(availableCompanies);
    const preferredCompany = p.data?.default_company_id;
    const selectedCompany = activeCompanyId && availableCompanies.some(company => company.id === activeCompanyId)
      ? activeCompanyId
      : (preferredCompany && availableCompanies.some(company => company.id === preferredCompany)
        ? preferredCompany
        : availableCompanies[0]?.id || "");
    if (!selectedCompany) {
      setEmployees([]); setAllEmployees([]); setWarnings([]); setApprovals([]); setDepartments([]); setProfiles([]); setSignatures([]); setCompanyAccess([]); setRegulationCategories([]); setRegulationDocuments([]); setRegulationSections([]);
      setError("บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าถึงบริษัทใด กรุณาติดต่อผู้ดูแลระบบ");
      setLoading(false);
      return;
    }
    if (selectedCompany !== activeCompanyId) {
      setActiveCompanyId(selectedCompany);
      setLoading(false);
      return;
    }
    const [e, w, a, d, users, sigs, access, categories, documents, sections] = await Promise.all([
      supabase.from("employees").select("id,employee_code,first_name,last_name,company_id,department_id,job_title,status,employment_start_date,departments(name)").eq("company_id", selectedCompany).order("created_at", { ascending: false }),
      supabase.from("warning_cases").select("id,case_number,employee_id,company_id,incident_date,category,incident_description,warning_level,status,executive_ack_required,created_at,created_by,employees(employee_code,first_name,last_name),warning_attachments(id,storage_path,original_file_name)").eq("company_id", selectedCompany).order("created_at", { ascending: false }),
      supabase.from("warning_approvals").select("id,warning_id,decision,comments,warning_cases!inner(id,case_number,employee_id,company_id,incident_date,category,incident_description,warning_level,status,created_at,employees(employee_code,first_name,last_name))").eq("warning_cases.company_id", selectedCompany).order("created_at", { ascending: false }),
      supabase.from("departments").select("id,name,company_id").eq("company_id", selectedCompany).eq("is_active", true).order("name"),
      supabase.from("profiles").select("id,full_name,role,is_active,employee_id,default_company_id").order("full_name"),
      supabase.from("warning_signatures").select("id,warning_id,company_id,signer_id,signature_step,signer_name,document_digest,signed_at").eq("company_id", selectedCompany).order("signed_at"),
      supabase.from("user_company_access").select("profile_id,company_id"),
      supabase.from("regulation_categories").select("category_code,category_name_th,sort_order").order("sort_order"),
      supabase.from("regulation_documents").select("id,company_id,title,document_code,revision,effective_date,original_file_name,storage_path,source_status,created_at,is_shared_standard").order("created_at", { ascending: false }),
      supabase.from("regulation_sections").select("id,document_id,company_id,category_code,section_number,heading,content_text,source_page,sort_order").order("sort_order"),
    ]);
    setEmployees((e.data || []) as unknown as Employee[]);
    if (p.data?.role === "system_admin") {
      const allEmployeeResult = await supabase.from("employees").select("id,employee_code,first_name,last_name,company_id,department_id,job_title,status,employment_start_date,departments(name)").order("created_at", { ascending: false });
      setAllEmployees((allEmployeeResult.data || []) as unknown as Employee[]);
      if (allEmployeeResult.error) setError("โหลดทะเบียนพนักงานทุกบริษัทไม่สำเร็จ: " + allEmployeeResult.error.message);
    } else setAllEmployees((e.data || []) as unknown as Employee[]);
    setWarnings((w.data || []) as unknown as WarningCase[]);
    setApprovals((a.data || []) as unknown as Approval[]);
    setDepartments((d.data || []) as Department[]);
    setProfiles((users.data || []) as Profile[]);
    const signatureArtifacts = await supabase.from("warning_signature_artifacts").select("signature_id,signature_data");
    const signatureImageById = new Map((signatureArtifacts.data || []).map(item => [item.signature_id, item.signature_data]));
    setSignatures(((sigs.data || []) as any[]).map(item => ({ ...item, signature_data: signatureImageById.get(item.id) || null })));
    setCompanyAccess((access.data || []) as CompanyAccess[]);
    setRegulationCategories((categories.data || []) as RegulationCategory[]);
    setRegulationDocuments((documents.data || []) as RegulationDocument[]);
    setRegulationSections((sections.data || []) as RegulationSection[]);
    const firstError = e.error || w.error || a.error || d.error || users.error || sigs.error || access.error || categories.error || documents.error || sections.error;
    if (firstError) setError("โหลดข้อมูลบางส่วนไม่สำเร็จ: " + firstError.message);
    setLoading(false);
  }, [session, activeCompanyId]);

  useEffect(() => { if (session) void loadData(); else { setProfile(null); setCompanies([]); setActiveCompanyId(""); setCompanyAccess([]); setEmployees([]); setAllEmployees([]); setWarnings([]); setApprovals([]); } }, [session, loadData]);

  const navigate = (next: Section) => { setSection(next); if (window.location.hash !== "#" + next) window.history.pushState({ section: next }, "", "#" + next); };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3500); };
  async function signOut() { await supabase?.auth.signOut(); setSession(null); setProfile(null); }
  const active = navItems.find(item => item.id === section);
  const canManage = profile?.is_active && (profile.role === "system_admin" || profile.role === "hr_officer");
  const isAdmin = profile?.is_active && profile.role === "system_admin";

  if (!isSupabaseConfigured) return <main className="setup-wrap"><section className="setup-card"><div className="brand-mark"><ShieldCheck size={30} /></div><h1>Warning System</h1><p>ยังไม่ได้ตั้งค่า Supabase URL และ Publishable Key</p></section></main>;
  if (!session) return <AuthScreen onSignedIn={setSession} />;
  if (recoveryMode) return <PasswordRecoveryScreen onDone={() => setRecoveryMode(false)} />;

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

  async function updateProfileEmployee(userId: string, employeeId: string) {
    if (!supabase || !isAdmin) return;
    const { error: e } = await supabase.from("profiles").update({ employee_id: employeeId || null, updated_at: new Date().toISOString() }).eq("id", userId);
    if (e) notify("เชื่อมบัญชีกับพนักงานไม่สำเร็จ: " + e.message); else { notify("เชื่อมบัญชีผู้ใช้งานกับพนักงานแล้ว"); void loadData(); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small"><ShieldCheck size={22} /></div><div><strong>STAR LIVE</strong><span>WARNING SYSTEM</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{navItems.map(item => <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === "approvals" && approvals.filter(a => a.decision === "pending").length > 0 && <span className="pending-count">{approvals.filter(a => a.decision === "pending").length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={17} /><span>ระบบรักษาความปลอดภัย</span></div><button className="nav-item" onClick={signOut}><LogOut size={18} /><span>ออกจากระบบ</span></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="mobile-brand">STAR LIVE <span>/ WARNING</span></div><div className="top-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาข้อมูลในระบบ..." /></div>{companies.length > 1 && <select className="company-switcher" aria-label="เลือกบริษัท" value={activeCompanyId} onChange={e => setActiveCompanyId(e.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}</select>}<button className="icon-btn" onClick={() => void loadData()} aria-label="รีเฟรช"><RefreshCw size={17} /></button><div className="user-chip"><div className="avatar">{profile.full_name.slice(0, 1)}</div><div><strong>{profile.full_name}</strong><span>{roleLabels[profile.role]}</span></div><ChevronDown size={15} /></div></header>
      <section className="page-content">
        <div className="page-heading"><div><p className="eyebrow">HUMAN RESOURCES / WARNING MANAGEMENT</p><h1>{active?.label}</h1><p className="muted">จัดการข้อมูลและติดตามกระบวนการด้านวินัยพนักงานอย่างเป็นระบบ</p></div><div className="date-chip">{companies.find(company => company.id === activeCompanyId)?.company_name || "บริษัทที่เลือก"}</div></div>
        {error && <div className="inline-error">{error}</div>}
        {section === "overview" && <Overview employees={employees} warnings={warnings} approvals={approvals} onGo={navigate} />}
        {section === "employees" && <EmployeesModule companyId={activeCompanyId} companies={companies} onCompanyChange={setActiveCompanyId} employees={employees} departments={departments} canManage={!!canManage} query={search} userId={session.user.id} onSaved={() => { notify("บันทึกข้อมูลพนักงานแล้ว"); void loadData(); }} />}
        {section === "warnings" && <WarningsModule companyId={activeCompanyId} companies={companies} onCompanyChange={setActiveCompanyId} warnings={warnings} employees={employees} profiles={profiles.filter(p => p.is_active && (p.role === "approver" || p.role === "system_admin"))} canManage={!!canManage} profile={profile} signatures={signatures} query={search} userId={session.user.id} regulations={regulationSections} regulationDocuments={regulationDocuments} companyName={companies.find(c => c.id === activeCompanyId)?.company_name || "บริษัท"} onSaved={() => { notify("บันทึกข้อมูลหนังสือเตือนแล้ว"); void loadData(); }} />}
        {section === "approvals" && <ApprovalsModule approvals={approvals} canManage={!!canManage} onSaved={() => { notify("บันทึกผลการพิจารณาแล้ว"); void loadData(); }} />}
        {section === "reports" && <ReportsModule employees={employees} warnings={warnings} />}
        {section === "regulations" && <RegulationsModule categories={regulationCategories} documents={regulationDocuments} sections={regulationSections} query={search} onQueryChange={setSearch} />}
        {section === "settings" && <SettingsModule profile={profile} profiles={profiles} employees={allEmployees} companies={companies} companyAccess={companyAccess} onCompanyAccessChange={async (profileId, companyId, checked) => { if (!supabase || !isAdmin) return; const result = checked ? await supabase.from("user_company_access").insert({ profile_id: profileId, company_id: companyId }) : await supabase.from("user_company_access").delete().eq("profile_id", profileId).eq("company_id", companyId); if (result.error) notify("ปรับสิทธิ์บริษัทไม่สำเร็จ: " + result.error.message); else { notify("ปรับสิทธิ์บริษัทแล้ว"); void loadData(); } }} onRoleChange={updateEmployeeRole} onEmployeeLink={updateProfileEmployee} onCreateUser={async (input: AdminUserInput) => { if (!supabase || !isAdmin) throw new Error("System Admin permission required"); const { data, error } = await supabase.functions.invoke("admin-user-management", { body: { action: "create_user", ...input } }); if (error || data?.error) { let message = data?.error || error?.message || "สร้างบัญชีไม่สำเร็จ"; const context = (error as { context?: Response } | null)?.context; if (context) { const body = await context.clone().json().catch(() => null) as { error?: string; message?: string } | null; message = body?.error || body?.message || message; } notify("สร้างบัญชีไม่สำเร็จ: " + message); throw new Error(message); } notify("สร้างบัญชีและกำหนดสิทธิ์สำเร็จ"); void loadData(); }} onResetPassword={async (userId, newPassword) => { if (!supabase || !isAdmin) return; const { data, error } = await supabase.functions.invoke("admin-user-management", { body: { action: "reset_password", user_id: userId, new_password: newPassword } }); if (error || data?.error) notify("รีเซ็ตรหัสผ่านไม่สำเร็จ: " + (data?.error || error?.message)); else notify("รีเซ็ตรหัสผ่านสำเร็จ"); }} onBootstrap={loadData} />}
      </section>
    </main>
    {toast && <div className="toast-message"><CheckCircle2 size={17} />{toast}</div>}
    <footer className="app-footer no-print"><div>© 2026 Siam HRBP Soft· WARNING SYSTEM PRO (V1.0) &nbsp;| ติดต่อผู้พัฒนา LINE ID: <a href="https://line.me/ti/p/~dj_nodoubt" target="_blank" rel="noopener noreferrer">dj_nodoubt</a></div></footer>
  </div>;
}

function PasswordRecoveryScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (password !== confirmPassword) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setBusy(true); setError(""); setNotice("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError("เปลี่ยนรหัสผ่านไม่สำเร็จ: " + updateError.message);
    else { setNotice("เปลี่ยนรหัสผ่านสำเร็จ"); onDone(); }
  }
  return <main className="login-wrap"><section className="login-card"><div className="brand-mark"><ShieldCheck size={30} /></div><p className="eyebrow">ACCOUNT SECURITY</p><h1>ตั้งรหัสผ่านใหม่</h1><p className="muted">ยืนยันอีเมลจากลิงก์ที่ได้รับก่อนตั้งรหัสผ่านใหม่</p><form className="login-form" onSubmit={submit}><label>รหัสผ่านใหม่<div className="password-field"><input type={showPassword ? "text" : "password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>{showPassword ? "ซ่อน" : "แสดง"}</button></div></label><label>ยืนยันรหัสผ่าน<input type={showPassword ? "text" : "password"} minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>{error && <p className="error-text">{error}</p>}{notice && <p className="success-text">{notice}</p>}<button className="primary-btn" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}</button></form></section></main>;
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

function EmployeesModule({ companyId, companies, onCompanyChange, employees, departments, canManage, query, userId, onSaved }: { companyId: string; companies: Company[]; onCompanyChange: (id: string) => void; employees: Employee[]; departments: Department[]; canManage: boolean; query: string; userId: string; onSaved: () => void }) {
  const [showForm, setShowForm] = useState(false);
 const [showDepartment, setShowDepartment] = useState(false); const [departmentName, setDepartmentName] = useState(""); const [departmentError, setDepartmentError] = useState(""); const [editingId, setEditingId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [form, setForm] = useState({ employee_code: "", first_name: "", last_name: "", department_id: "", job_title: "", employment_start_date: "", status: "active" });
  const filtered = employees.filter(e => [e.employee_code, e.first_name, e.last_name, e.job_title || "", e.departments?.name || ""].join(" ").toLowerCase().includes(query.toLowerCase()));
  async function save(e: FormEvent) {
    e.preventDefault(); if (!supabase) return; setBusy(true); setError("");
    const payload = { ...form, company_id: companyId, department_id: form.department_id || null, employment_start_date: form.employment_start_date || null, updated_at: new Date().toISOString() };
    const result = editingId ? await supabase.from("employees").update(payload).eq("id", editingId) : await supabase.from("employees").insert({ ...payload, created_by: userId });
    setBusy(false); if (result.error) setError(result.error.message); else { setShowForm(false); setEditingId(""); setForm({ employee_code: "", first_name: "", last_name: "", department_id: "", job_title: "", employment_start_date: "", status: "active" }); onSaved(); }
  }
  async function saveDepartment(e: FormEvent) { e.preventDefault(); if (!supabase) return; setDepartmentError(""); const { error } = await supabase.from("departments").insert({ name: departmentName.trim(), company_id: companyId }); if (error) setDepartmentError(error.message); else { setDepartmentName(""); setShowDepartment(false); onSaved(); } }
  function editEmployee(employee: Employee) { setEditingId(employee.id); setForm({ employee_code: employee.employee_code, first_name: employee.first_name, last_name: employee.last_name, department_id: employee.department_id || "", job_title: employee.job_title || "", employment_start_date: employee.employment_start_date || "", status: employee.status }); setShowForm(true); }
  return <><div className="toolbar"><div><strong>ทะเบียนพนักงาน</strong><span>{filtered.length} รายการ</span></div>{canManage && <div className="toolbar-actions"><button className="secondary-small" onClick={() => setShowDepartment(!showDepartment)}>จัดการแผนก</button><button className="primary-small" onClick={() => { setEditingId(""); setForm({ employee_code: "", first_name: "", last_name: "", department_id: "", job_title: "", employment_start_date: "", status: "active" }); setShowForm(!showForm); }}><Plus size={16} /> เพิ่มพนักงาน</button></div>}</div>
    {showDepartment && <form className="form-panel department-form" onSubmit={saveDepartment}><div className="form-head"><strong>เพิ่มแผนก</strong><button type="button" className="close-btn" onClick={() => setShowDepartment(false)}><X size={17} /></button></div><div className="inline-form"><input required value={departmentName} onChange={e => setDepartmentName(e.target.value)} placeholder="ชื่อแผนก" /><button className="primary-small">บันทึกแผนก</button></div>{departmentError && <p className="error-text">{departmentError}</p>}</form>}
    {showForm && <form className="form-panel" onSubmit={save}><div className="form-head"><strong>{editingId ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มข้อมูลพนักงาน"}</strong><button type="button" className="close-btn" onClick={() => setShowForm(false)}><X size={17} /></button></div><div className="form-grid">
      <label>บริษัท<select disabled={!!editingId} value={companyId} onChange={e => onCompanyChange(e.target.value)}>{companies.map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}</select></label><label>รหัสพนักงาน<input required value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} /></label><label>ชื่อ<input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label><label>นามสกุล<input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label><label>แผนก<select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}><option value="">ไม่ระบุ</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>ตำแหน่ง<input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></label><label>วันที่เริ่มงาน<input type="date" value={form.employment_start_date} onChange={e => setForm({ ...form, employment_start_date: e.target.value })} /></label><label>สถานะ<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(statusLabels).filter(([v]) => ["active","resigned","terminated","suspended"].includes(v)).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label></div>{error && <p className="error-text">{error}</p>}<button className="primary-btn" disabled={busy}>{busy ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกข้อมูลพนักงาน"}</button></form>}
    <div className="table-wrap"><table><thead><tr><th>รหัสพนักงาน</th><th>ชื่อ-นามสกุล</th><th>แผนก</th><th>ตำแหน่ง</th><th>สถานะ</th>{canManage && <th>จัดการ</th>}</tr></thead><tbody>{filtered.map(e => <tr key={e.id}><td className="mono">{e.employee_code}</td><td><strong>{e.first_name} {e.last_name}</strong></td><td>{e.departments?.name || "—"}</td><td>{e.job_title || "—"}</td><td><StatusPill status={e.status} /></td>{canManage && <td><button className="table-action" onClick={() => editEmployee(e)}>แก้ไข</button></td>}</tr>)}</tbody></table>{!filtered.length && <EmptyState title="ไม่พบข้อมูลพนักงาน" detail={canManage ? "กดเพิ่มพนักงานเพื่อเริ่มบันทึกข้อมูล" : "ยังไม่มีข้อมูลในทะเบียนพนักงาน"} />}</div>
  </>;
}

function SignaturePadDialog({ signerName, stepLabel, onCancel, onConfirm, busy }: { signerName: string; stepLabel: string; onCancel: () => void; onConfirm: (signatureData: string) => void; busy: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  useEffect(() => { const canvas=canvasRef.current; if(!canvas)return; const ctx=canvas.getContext("2d"); if(!ctx)return; ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.strokeStyle="#142f4b"; ctx.lineWidth=3; ctx.lineCap="round"; ctx.lineJoin="round"; }, []);
  function point(event: React.PointerEvent<HTMLCanvasElement>) { const canvas=canvasRef.current!; const rect=canvas.getBoundingClientRect(); return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}; }
  function start(event: React.PointerEvent<HTMLCanvasElement>) { const canvas=canvasRef.current!; canvas.setPointerCapture(event.pointerId); const p=point(event); const ctx=canvas.getContext("2d")!; ctx.beginPath(); ctx.moveTo(p.x,p.y); drawing.current=true; setHasInk(true); }
  function move(event: React.PointerEvent<HTMLCanvasElement>) { if(!drawing.current)return; const p=point(event); const ctx=canvasRef.current!.getContext("2d")!; ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function clear() { const canvas=canvasRef.current!; const ctx=canvas.getContext("2d")!; ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); setHasInk(false); }
  return <div className="modal-backdrop signature-backdrop"><section className="signature-dialog" role="dialog" aria-modal="true"><div className="form-head"><div><strong>ลงนามอิเล็กทรอนิกส์</strong><p className="small-note">{stepLabel} · {signerName}</p></div><button type="button" className="close-btn" onClick={onCancel}><X size={17}/></button></div><p className="small-note">เซ็นชื่อในกรอบด้านล่างด้วยเมาส์หรือหน้าจอสัมผัส</p><canvas ref={canvasRef} className="signature-canvas" width={900} height={260} onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}} aria-label="พื้นที่วาดลายเซ็น"/><div className="signature-actions"><button type="button" className="secondary-small" onClick={clear}>ล้างลายเซ็น</button><span className="small-note">{signerName}</span><button type="button" className="primary-small" disabled={!hasInk||busy} onClick={()=>{const data=canvasRef.current?.toDataURL("image/png");if(data)onConfirm(data);}}>{busy?"กำลังบันทึก...":"ยืนยันและลงนาม"}</button></div></section></div>;
}

function WarningDocumentPreview({ warning, signatures, onClose }: { warning: WarningCase; signatures: any[]; onClose: () => void }) {
  const employee=warning.employees?[warning.employees.first_name,warning.employees.last_name].filter(Boolean).join(" "):"—";
  const steps=[{key:"issuer",label:"ผู้ออกหนังสือเตือน"},{key:"hr_manager_ack",label:"ผู้จัดการฝ่ายทรัพยากรบุคคล"},{key:"executive_ack",label:"ผู้บริหารรับทราบ"},{key:"employee_ack",label:"พนักงานรับทราบ"}];
  return <div className="modal-backdrop document-backdrop"><section className="document-dialog"><div className="document-toolbar no-print"><strong>ตัวอย่างหนังสือเตือน · {warning.case_number}</strong><div><button className="secondary-small" onClick={()=>window.print()}>พิมพ์ / บันทึก PDF</button><button className="close-btn" onClick={onClose}><X size={17}/></button></div></div><article className="warning-print-document"><header><h1>หนังสือเตือนพนักงาน</h1><p>WARNING LETTER</p></header><div className="document-meta"><span>เลขที่เอกสาร: {warning.case_number}</span><span>วันที่เกิดเหตุ: {new Date(warning.incident_date+"T00:00:00").toLocaleDateString("th-TH")}</span></div><p>เรื่อง: {levelLabels[warning.warning_level]||"หนังสือเตือน"}</p><p>เรียน: {employee}</p><p>ประเภทเหตุการณ์: {warning.category}</p><h3>รายละเอียดเหตุการณ์</h3><p className="document-paragraph">{warning.incident_description}</p><h3>การลงนามรับทราบและยืนยันเอกสาร</h3><div className="document-signature-grid">{steps.map(step=>{const sig=signatures.find(s=>s.warning_id===warning.id&&s.signature_step===step.key);return <div className="document-signature" key={step.key}><div className="document-signature-image">{sig?.signature_data?<img src={sig.signature_data} alt={"ลายเซ็น "+sig.signer_name}/>:<span>ยังไม่มีลายเซ็น</span>}</div><strong>{sig?.signer_name||"—"}</strong><span>{step.label}</span><small>{sig?.signed_at?new Date(sig.signed_at).toLocaleString("th-TH"):"รอลงนาม"}</small></div>;})}</div><footer>เอกสารอิเล็กทรอนิกส์ · ลายเซ็นผูกกับค่า SHA-256 ของเอกสาร ณ เวลาที่ลงนาม</footer></article></section></div>;
}
function WarningsModule({ companyId, companies, onCompanyChange, warnings, employees, profiles, canManage, profile, signatures, query, userId, regulations, regulationDocuments, companyName, onSaved }: { companyId: string; companies: Company[]; onCompanyChange: (id: string) => void; warnings: WarningCase[]; employees: Employee[]; profiles: Profile[]; canManage: boolean; profile: Profile; signatures: any[]; query: string; userId: string; regulations: RegulationSection[]; regulationDocuments: RegulationDocument[]; companyName: string; onSaved: () => void }) {
  const [signatureTarget, setSignatureTarget] = useState<{ warningId: string; step: string } | null>(null);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [previewWarning, setPreviewWarning] = useState<WarningCase | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const emptyForm = (): WarningLetterFormValue => ({ employee_id: "", incident_date: new Date().toISOString().slice(0, 10), incident_time: "", incident_location: "", category: "", incident_description: "", employee_explanation: "", proposed_action: "", regulation_text: "", warning_level: profile.role === "supervisor" ? "verbal" : "written_1", approver_id: "", executive_ack_required: false });
  const [form, setForm] = useState(emptyForm);
  const canCreate = canManage || profile.role === "supervisor";
  const hasSignature = (warningId: string) => signatures.some(s => s.warning_id === warningId);
  const canEditDraft = (warning: WarningCase) => warning.status === "draft" && !hasSignature(warning.id) &&
    (profile.role === "system_admin" || profile.role === "hr_officer" || warning.created_by === userId);
  const canCreateDraftRevision = (warning: WarningCase) => warning.status === "draft" && hasSignature(warning.id) &&
    (profile.role === "system_admin" || profile.role === "hr_officer" || warning.created_by === userId ||
      signatures.some(s => s.warning_id === warning.id && s.signature_step === "issuer" && s.signer_id === userId));
  const filtered = warnings.filter(w => [w.case_number, w.category, w.incident_description, w.employees?.first_name || "", w.employees?.last_name || ""].join(" ").toLowerCase().includes(query.toLowerCase()));

  function startEdit(warning: WarningCase) {
    if (!canEditDraft(warning)) return;
    setEditingId(warning.id);
    const splitMarker = "\n\n[ข้อบังคับที่เกี่ยวข้อง]\n";
    const parts = warning.incident_description.split(splitMarker);
    setForm({ employee_id: warning.employee_id, incident_date: warning.incident_date, incident_time: warning.incident_time || "", incident_location: warning.incident_location || "", category: warning.category, incident_description: parts[0], regulation_text: parts[1] || "", employee_explanation: warning.employee_explanation || "", proposed_action: warning.proposed_action || "", warning_level: warning.warning_level, approver_id: "", executive_ack_required: !!warning.executive_ack_required });
    setEvidence(null); setError(""); setShowForm(true);
  }
  async function createEditableCopy(warning: WarningCase) {
    if (!supabase || !canCreateDraftRevision(warning)) return;
    const confirmed = window.confirm("ฉบับร่างนี้มีลายเซ็นอิเล็กทรอนิกส์แล้ว จึงไม่สามารถแก้ไขเอกสารเดิมได้\n\nต้องการสร้างฉบับร่างใหม่จากข้อมูลฉบับนี้เพื่อแก้ไข โดยเก็บเอกสารและลายเซ็นเดิมไว้หรือไม่?");
    if (!confirmed) return;
    const caseNumber = "WRN-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + Date.now().toString().slice(-6);
    const { error: copyError } = await supabase.from("warning_cases").insert({
      case_number: caseNumber, employee_id: warning.employee_id, company_id: warning.company_id,
      incident_date: warning.incident_date, category: warning.category,
      incident_description: warning.incident_description, warning_level: warning.warning_level,
      executive_ack_required: !!warning.executive_ack_required, status: "draft", created_by: userId,
    });
    if (copyError) { window.alert("สร้างฉบับร่างใหม่ไม่สำเร็จ: " + copyError.message); return; }
    window.alert("สร้างฉบับร่างใหม่สำหรับแก้ไขแล้ว\nเลขที่เอกสาร: " + caseNumber + "\nเอกสารเดิมและลายเซ็นเดิมยังคงอยู่โดยไม่เปลี่ยนแปลง");
    onSaved();
  }

  function closeForm() { setShowForm(false); setEditingId(""); setEvidence(null); setError(""); setForm(emptyForm()); }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    if (evidence && (evidence.size > 10 * 1024 * 1024 || !["application/pdf","image/png","image/jpeg"].includes(evidence.type))) {
      setError("ไฟล์หลักฐานต้องเป็น PDF/JPG/PNG และมีขนาดไม่เกิน 10 MB"); setBusy(false); return;
    }
    let warningId = editingId;
    if (editingId) {
      const target = warnings.find(w => w.id === editingId);
      if (!target || !canEditDraft(target)) { setError("ไม่มีสิทธิ์แก้ไข หรือหนังสือเตือนไม่อยู่ในสถานะฉบับร่างแล้ว"); setBusy(false); return; }
      const { data: updatedWarning, error: updateError } = await supabase.from("warning_cases").update({
        employee_id: form.employee_id, company_id: companyId, incident_date: form.incident_date, incident_time: form.incident_time || null, incident_location: form.incident_location || null,
        category: form.category, incident_description: form.incident_description + (form.regulation_text ? "\n\n[ข้อบังคับที่เกี่ยวข้อง]\n" + form.regulation_text : ""), employee_explanation: form.employee_explanation || null, proposed_action: form.proposed_action || null,
        warning_level: form.warning_level,
        executive_ack_required: profile.role === "hr_officer" || profile.role === "system_admin" ? form.executive_ack_required : false,
        status: form.approver_id ? "pending_approval" : "draft", updated_by: userId, updated_at: new Date().toISOString(),
      }).eq("id", editingId).eq("status", "draft").select("id").maybeSingle();
      if (updateError || !updatedWarning) { setError(updateError?.message || "ไม่พบฉบับร่างหรือบัญชีนี้ไม่มีสิทธิ์แก้ไข"); setBusy(false); return; }
    } else {
      const caseNumber = "WRN-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + Date.now().toString().slice(-6);
      const { data, error: insertError } = await supabase.from("warning_cases").insert({
        case_number: caseNumber, employee_id: form.employee_id, company_id: companyId, incident_date: form.incident_date, incident_time: form.incident_time || null, incident_location: form.incident_location || null,
        category: form.category, incident_description: form.incident_description + (form.regulation_text ? "\n\n[ข้อบังคับที่เกี่ยวข้อง]\n" + form.regulation_text : ""), employee_explanation: form.employee_explanation || null, proposed_action: form.proposed_action || null,
        warning_level: form.warning_level, executive_ack_required: profile.role === "hr_officer" || profile.role === "system_admin" ? form.executive_ack_required : false,
        status: form.approver_id ? "pending_approval" : "draft", created_by: userId,
      }).select("id").single();
      if (insertError || !data) { setError(insertError?.message || "สร้างหนังสือเตือนไม่สำเร็จ"); setBusy(false); return; }
      warningId = data.id;
    }
    if (evidence && warningId) {
      const safeName = evidence.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = warningId + "/" + Date.now() + "-" + safeName;
      const { error: uploadError } = await supabase.storage.from("warning-evidence").upload(storagePath, evidence, { contentType: evidence.type, upsert: false });
      if (uploadError) { setError("บันทึกหนังสือเตือนแล้ว แต่แนบไฟล์ไม่สำเร็จ: " + uploadError.message); setBusy(false); return; }
      const { error: metaError } = await supabase.from("warning_attachments").insert({ warning_id: warningId, storage_path: storagePath, original_file_name: evidence.name, mime_type: evidence.type, file_size_bytes: evidence.size, uploaded_by: userId });
      if (metaError) { await supabase.storage.from("warning-evidence").remove([storagePath]); setError("อัปโหลดไฟล์แล้วแต่บันทึกข้อมูลไฟล์ไม่สำเร็จ: " + metaError.message); setBusy(false); return; }
    }
    if (form.approver_id && warningId) {
      const { error: approvalError } = await supabase.from("warning_approvals").insert({ warning_id: warningId, approver_id: form.approver_id });
      if (approvalError) {
        if (!editingId) await supabase.from("warning_cases").update({ status: "draft" }).eq("id", warningId);
        else await supabase.from("warning_cases").update({ status: "draft", updated_by: userId }).eq("id", warningId);
        setError("บันทึกหนังสือแล้ว แต่ส่งอนุมัติไม่สำเร็จ: " + approvalError.message); setBusy(false); return;
      }
    }
    setBusy(false); closeForm(); onSaved();
  }

  async function deleteWarning(warning: WarningCase) {
    if (!supabase || profile.role !== "system_admin") return;
    const confirmation = window.prompt(`การลบนี้จะลบหนังสือเตือน ${warning.case_number} พร้อมรายการอนุมัติ ไฟล์แนบ และลายเซ็นที่เกี่ยวข้องอย่างถาวร\n\nพิมพ์เลขที่เอกสารเพื่อยืนยันการลบ:`);
    if (confirmation !== warning.case_number) {
      if (confirmation !== null) window.alert("เลขที่เอกสารไม่ตรงกัน ยกเลิกการลบ");
      return;
    }
    setBusy(true);
    const { data: attachmentRows, error: attachmentQueryError } = await supabase.from("warning_attachments").select("storage_path").eq("warning_id", warning.id);
    if (attachmentQueryError) { setBusy(false); window.alert("ตรวจสอบไฟล์แนบไม่สำเร็จ: " + attachmentQueryError.message); return; }
    const paths = (attachmentRows || []).map(a => a.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("warning-evidence").remove(paths);
      if (storageError) { setBusy(false); window.alert("ลบไฟล์แนบไม่สำเร็จ จึงยกเลิกการลบหนังสือเตือน: " + storageError.message); return; }
    }
    const { error: deleteError } = await supabase.rpc("admin_delete_warning", { p_warning_id: warning.id });
    setBusy(false);
    if (deleteError) { window.alert("ลบหนังสือเตือนไม่สำเร็จ: " + deleteError.message + "\nกรุณาตรวจสอบไฟล์แนบใน Storage เนื่องจากไฟล์อาจถูกลบไปแล้ว"); return; }
    if (previewWarning?.id === warning.id) setPreviewWarning(null);
    window.alert("ลบหนังสือเตือน " + warning.case_number + " เรียบร้อยแล้ว");
    onSaved();
  }

  async function sign(warningId: string, step: string, signatureData: string) {
    if (!supabase) return;
    setSignatureBusy(true);
    const { error: signError } = await supabase.rpc("sign_warning", { p_warning_id: warningId, p_signature_step: step, p_signer_name: profile.full_name, p_consent_text: "ข้าพเจ้ายืนยันตัวตนและยินยอมลงนามอิเล็กทรอนิกส์ในหนังสือเตือนฉบับนี้", p_signature_data: signatureData });
    setSignatureBusy(false);
    if (signError) window.alert("ลงนามไม่สำเร็จ: " + signError.message); else { setSignatureTarget(null); onSaved(); }
  }

  return <>
    <div className="toolbar"><div><strong>ทะเบียนหนังสือเตือน</strong><span>{filtered.length} รายการ</span></div>{canCreate && <button className="primary-small" onClick={() => { closeForm(); setShowForm(true); }}><Plus size={16} /> สร้างหนังสือเตือน</button>}</div>
    {showForm && <form className="form-panel warning-letter-form-panel" onSubmit={save}><div className="form-head"><strong>{editingId ? "แก้ไขหนังสือเตือนฉบับร่าง" : "สร้างหนังสือเตือน"}</strong><button type="button" className="close-btn" onClick={closeForm}><X size={17} /></button></div>
      <WarningLetterFields value={form} onChange={setForm} employees={employees} regulations={regulations} documents={regulationDocuments} companyName={companyName} approvers={profiles} role={profile.role} onEvidenceChange={setEvidence} evidenceName={evidence?.name}/>
      {error && <p className="error-text">{error}</p>}<div className="letter-form-actions"><button className="primary-btn" disabled={busy || !employees.length}>{busy ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "บันทึกหนังสือเตือน"}</button><button type="button" className="secondary-small" onClick={closeForm}>ยกเลิก</button></div>
      {!employees.length && <p className="small-note">กรุณาเพิ่มข้อมูลพนักงานก่อนสร้างหนังสือเตือน</p>}</form>}
    <div className="table-wrap"><table><thead><tr><th>เลขที่เอกสาร</th><th>พนักงาน</th><th>วันที่เกิดเหตุ</th><th>ประเภท / ระดับ</th><th>สถานะ</th><th>การดำเนินการ</th></tr></thead><tbody>{filtered.map(w => <tr key={w.id}><td className="mono">{w.case_number}</td><td>{w.employees?.first_name} {w.employees?.last_name}</td><td>{new Date(w.incident_date).toLocaleDateString("th-TH")}</td><td>{w.category}<small className="cell-sub">{levelLabels[w.warning_level]}</small></td><td><StatusPill status={w.status} /></td><td><button className="table-action" onClick={() => setPreviewWarning(w)}>เปิดดูเอกสาร</button>{profile.role === "system_admin" && <button className="table-action danger-action" disabled={busy} onClick={() => void deleteWarning(w)}>ลบใบเตือน</button>}{w.warning_attachments?.map(a => <button key={a.id} className="table-action" onClick={() => void openEvidence(a.storage_path)}>{a.original_file_name}</button>)}{canEditDraft(w) && <button className="table-action" onClick={() => startEdit(w)}>แก้ไขฉบับร่าง</button>}{canCreateDraftRevision(w) && <button className="table-action" onClick={() => void createEditableCopy(w)}>สร้างฉบับร่างเพื่อแก้ไข</button>}{w.status === "draft" && hasSignature(w.id) && <small className="cell-sub">มีลายเซ็นแล้ว · เอกสารเดิมไม่สามารถแก้ไขได้</small>}{w.status === "approved" && (profile.role === "supervisor" || profile.role === "hr_officer") && !signatures.some(s => s.warning_id === w.id && s.signature_step === "issuer") && <button className="table-action" onClick={() => setSignatureTarget({warningId:w.id,step:"issuer"})}>ลงนามผู้ออก</button>}{profile.role === "hr_manager" && !signatures.some(s => s.warning_id === w.id && s.signature_step === "hr_manager_ack") && <button className="table-action" onClick={() => setSignatureTarget({warningId:w.id,step:"hr_manager_ack"})}>ลงนาม HR Manager</button>}{profile.role === "executive" && w.executive_ack_required && !signatures.some(s => s.warning_id === w.id && s.signature_step === "executive_ack") && <button className="table-action" onClick={() => setSignatureTarget({warningId:w.id,step:"executive_ack"})}>ลงนามผู้บริหาร</button>}{profile.role === "employee" && profile.employee_id === w.employee_id && w.status === "issued" && !signatures.some(s => s.warning_id === w.id && s.signature_step === "employee_ack") && <button className="table-action" onClick={() => setSignatureTarget({warningId:w.id,step:"employee_ack"})}>ลงนามรับทราบ</button>}</td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="ยังไม่มีหนังสือเตือน" detail="รายการที่สร้างจะแสดงในตารางนี้" />}</div>
    {signatureTarget && <SignaturePadDialog signerName={profile.full_name} stepLabel={({issuer:"ผู้ออกหนังสือเตือน",hr_manager_ack:"ผู้จัดการฝ่ายทรัพยากรบุคคล",executive_ack:"ผู้บริหารรับทราบ",employee_ack:"พนักงานรับทราบ"} as Record<string,string>)[signatureTarget.step]} busy={signatureBusy} onCancel={()=>setSignatureTarget(null)} onConfirm={data=>void sign(signatureTarget.warningId,signatureTarget.step,data)}/>}
    {previewWarning && <WarningDocumentPreview warning={previewWarning} signatures={signatures} onClose={()=>setPreviewWarning(null)}/>}
  </>;
}

async function openEvidence(path: string) { if (!supabase) return; const { data, error } = await supabase.storage.from("warning-evidence").createSignedUrl(path, 60); if (error) window.alert("เปิดไฟล์ไม่สำเร็จ: " + error.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }

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

function SettingsModule({ profile, profiles, employees, companies, companyAccess, onCompanyAccessChange, onRoleChange, onEmployeeLink, onCreateUser, onResetPassword, onBootstrap }: {
  profile: Profile; profiles: Profile[]; employees: Employee[]; companies: Company[]; companyAccess: CompanyAccess[];
  onCompanyAccessChange: (profileId: string, companyId: string, checked: boolean) => void;
  onRoleChange: (id: string, role: Role) => void; onEmployeeLink: (id: string, employeeId: string) => void;
  onCreateUser: (input: AdminUserInput) => Promise<void>; onResetPassword: (userId: string, newPassword: string) => Promise<void>;
  onBootstrap: () => Promise<void>;
}) {
  const initialCompany = companies.find(company => company.company_code === "STARLIVE") || companies[0];
  const [newUser, setNewUser] = useState<AdminUserInput>({
    full_name: "", email: "", password: "", role: "viewer", employee_id: null,
    company_ids: initialCompany ? [initialCompany.id] : [], default_company_id: initialCompany?.id || "",
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    if (!newUser.company_ids.length || !newUser.default_company_id) { setCreateError("กรุณากำหนดบริษัทที่เข้าถึงและบริษัทเริ่มต้น"); return; }
    if (newUser.role === "employee" && !newUser.employee_id) { setCreateError("กรุณาเชื่อมบัญชีกับทะเบียนพนักงาน"); return; }
    setCreateBusy(true); setCreateError("");
    try {
      await onCreateUser(newUser);
      setNewUser({ full_name: "", email: "", password: "", role: "viewer", employee_id: null, company_ids: initialCompany ? [initialCompany.id] : [], default_company_id: initialCompany?.id || "" });
    } catch (createFailure) {
      setCreateError(createFailure instanceof Error ? createFailure.message : "สร้างบัญชีไม่สำเร็จ");
    } finally { setCreateBusy(false); }
  }

  async function resetPassword(target: Profile) {
    const value = window.prompt("กำหนดรหัสผ่านใหม่สำหรับ " + target.full_name + " (อย่างน้อย 8 ตัวอักษร)");
    if (value === null) return;
    if (value.length < 8) { window.alert("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    await onResetPassword(target.id, value);
  }

  return <>
    <article className="panel settings-profile"><div className="avatar large">{profile.full_name.slice(0, 1)}</div><div><h3>{profile.full_name}</h3><p>{roleLabels[profile.role]} · {profile.is_active ? "ใช้งานอยู่" : "ระงับ"}</p></div></article>
    {profile.role === "system_admin" ? <>
      <form className="panel admin-create-user" onSubmit={createUser}>
        <div className="panel-head"><div><h3>สร้างบัญชีผู้ใช้งาน</h3><p>บัญชีที่สร้างโดย System Admin จะยืนยันอีเมลให้ทันที ไม่ต้องรออีเมลยืนยัน</p></div><Users size={19} /></div>
        <div className="form-grid">
          <label>ชื่อ-นามสกุล<input required value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} /></label>
          <label>อีเมล<input type="email" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} /></label>
          <label>รหัสผ่านเริ่มต้น<div className="password-field"><input type={showNewUserPassword ? "text" : "password"} minLength={8} required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /><button type="button" className="password-toggle" aria-label={showNewUserPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShowNewUserPassword(value => !value)}>{showNewUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <label>บทบาท<select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role, employee_id: e.target.value === "employee" ? newUser.employee_id : null })}>{Object.entries(roleLabels).filter(([value]) => value !== "system_admin").map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {newUser.role === "employee" && <label className="span-2">เชื่อมทะเบียนพนักงาน<select required value={newUser.employee_id || ""} onChange={e => { const selected = employees.find(employee => employee.id === e.target.value); const ids = selected && !newUser.company_ids.includes(selected.company_id) ? [...newUser.company_ids, selected.company_id] : newUser.company_ids; setNewUser({ ...newUser, employee_id: e.target.value || null, company_ids: ids, default_company_id: selected?.company_id || newUser.default_company_id || ids[0] || "" }); }}><option value="">เลือกพนักงาน</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.employee_code} · {employee.first_name} {employee.last_name}</option>)}</select></label>}
          <div className="span-2"><span className="field-label">บริษัทที่อนุญาตให้เข้าถึง</span><div className="company-access-list create-company-access">{companies.map(company => <label key={company.id}><input type="checkbox" checked={newUser.company_ids.includes(company.id)} onChange={e => setNewUser(current => { const ids = e.target.checked ? [...current.company_ids, company.id] : current.company_ids.filter(id => id !== company.id); const defaultId = ids.includes(current.default_company_id) ? current.default_company_id : ids[0] || ""; return { ...current, company_ids: ids, default_company_id: defaultId }; })} />{company.company_name}</label>)}</div></div>
          <label>บริษัทเริ่มต้น<select required value={newUser.default_company_id} onChange={e => setNewUser({ ...newUser, default_company_id: e.target.value })}>{companies.filter(company => newUser.company_ids.includes(company.id)).map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}</select></label>
        </div>
        {createError && <p className="error-text">{createError}</p>}
        <button className="primary-btn" disabled={createBusy}>{createBusy ? "กำลังสร้างบัญชี..." : "สร้างบัญชีและกำหนดสิทธิ์"}</button>
      </form>
      <article className="panel settings-users"><div className="panel-head"><div><h3>จัดการสิทธิ์ผู้ใช้งาน</h3><p>ปรับบทบาท เชื่อมทะเบียนพนักงาน และกำหนดบริษัทที่เข้าถึงได้</p></div><Users size={19} /></div>
        <div className="table-wrap"><table><thead><tr><th>ชื่อผู้ใช้งาน</th><th>สิทธิ์ปัจจุบัน</th><th>กำหนดสิทธิ์</th><th>เชื่อมข้อมูลพนักงาน</th><th>สิทธิ์เข้าถึงบริษัท</th><th>รหัสผ่าน</th></tr></thead><tbody>
          {profiles.map(p => <tr key={p.id}><td>{p.full_name}{p.id === profile.id ? " (บัญชีนี้)" : ""}</td><td>{roleLabels[p.role]}</td><td><select value={p.role} disabled={p.id === profile.id} onChange={e => onRoleChange(p.id, e.target.value as Role)}>{Object.entries(roleLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></td><td>{p.role === "employee" ? <select value={p.employee_id || ""} onChange={e => onEmployeeLink(p.id, e.target.value)}><option value="">เลือกพนักงาน</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.employee_code} · {employee.first_name} {employee.last_name}</option>)}</select> : "—"}</td><td>{p.role === "system_admin" ? "ทุกบริษัท" : <div className="company-access-list">{companies.map(company => <label key={company.id}><input type="checkbox" checked={companyAccess.some(access => access.profile_id === p.id && access.company_id === company.id)} onChange={e => onCompanyAccessChange(p.id, company.id, e.target.checked)} />{company.company_code}</label>)}</div>}</td><td>{p.id !== profile.id && <button className="table-action" onClick={() => void resetPassword(p)}>รีเซ็ต</button>}</td></tr>)}
        </tbody></table></div>
      </article>
    </> : <article className="panel"><h3>สิทธิ์และความปลอดภัย</h3><p className="muted">การเปลี่ยนบทบาทผู้ใช้งานและการจัดการบัญชีดำเนินการได้โดยผู้ดูแลระบบเท่านั้น</p></article>}
    <article className="panel"><div className="panel-head"><div><h3>การเริ่มต้นผู้ดูแลระบบ</h3><p>ใช้ได้ครั้งเดียวในช่วงติดตั้งระบบเท่านั้น</p></div><ShieldCheck size={19} /></div><p className="small-note">การตั้งค่าผู้ดูแลครั้งแรกจะปิดถาวรเมื่อมีบัญชีผู้ดูแลระบบแล้ว</p><BootstrapAdmin onDone={onBootstrap} /></article>
  </>;
}


function RegulationsModule({ categories, documents, sections, query, onQueryChange }: {
  categories: RegulationCategory[]; documents: RegulationDocument[]; sections: RegulationSection[];
  query: string; onQueryChange: (value: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const filtered = sections.filter(item => {
    const doc = documents.find(entry => entry.id === item.document_id);
    const categoryMatch = selectedCategory === "all" || item.category_code === selectedCategory;
    const searchable = [item.section_number || "", item.heading, item.content_text, doc?.title || "", doc?.document_code || ""].join(" ").toLocaleLowerCase("th-TH");
    return categoryMatch && (!query.trim() || searchable.includes(query.trim().toLocaleLowerCase("th-TH")));
  });
  const visibleDocuments = documents.filter(doc => selectedCategory === "all" || filtered.some(item => item.document_id === doc.id));

  return <>
    <div className="toolbar"><div><strong>คลังระเบียบข้อบังคับมาตรฐานกลาง</strong><span>{documents.length} เอกสาร · {categories.length} หมวด</span></div></div>
    <div className="regulation-search"><Search size={17} /><input value={query} onChange={e => onQueryChange(e.target.value)} placeholder="ค้นหาข้อบังคับ เช่น วันลา เวลาทำงาน ค่าชดเชย..." aria-label="ค้นหาข้อบังคับ" /><button type="button" className="table-action" onClick={() => onQueryChange("")} disabled={!query}>ล้าง</button></div>
    <div className="regulation-filters"><label>หมวดข้อบังคับ<select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}><option value="all">ทุกหมวด</option>{categories.map(category => <option key={category.category_code} value={category.category_code}>{category.sort_order}. {category.category_name_th}</option>)}</select></label><span className="regulation-result-count">{filtered.length} รายการในหมวดที่เลือก</span></div>
    <div className="regulation-layout">
      <aside className="panel regulation-documents"><div className="panel-head"><div><h3>รายการข้อบังคับ</h3><p>ข้อบังคับมาตรฐานกลาง ใช้ร่วมกันทุกบริษัท</p></div><FileText size={18} /></div>
        {visibleDocuments.map(doc => <div className="regulation-document" key={doc.id}><div><strong>{doc.title}</strong><small>{doc.document_code || "เอกสารข้อบังคับ"}</small><span className={"source-status " + doc.source_status}>{doc.source_status === "indexed" ? "ค้นหาได้" : doc.source_status === "needs_review" ? "ต้องตรวจสอบ" : "พร้อมอ่าน"}</span></div></div>)}
        {!visibleDocuments.length && <EmptyState title="ไม่พบเอกสารในหมวดนี้" detail="ลองเลือกหมวดอื่นหรือค้นหาด้วยคำสำคัญ" />}
      </aside>
      <section className="regulation-results"><div className="section-title"><div><h2>ผลการค้นหาและเนื้อหาข้อบังคับ</h2><p>{filtered.length} รายการ {query ? "ตรงกับคำค้น" : "ในหมวดที่เลือก"}</p></div></div>
        {filtered.map(item => <article className="panel regulation-section" key={item.id}><div className="regulation-section-head"><div><span>{categories.find(category => category.category_code === item.category_code)?.category_name_th || item.category_code}</span><h3>{item.heading}</h3><small>{item.section_number || "—"} · {documents.find(doc => doc.id === item.document_id)?.title || "เอกสารต้นฉบับ"}</small></div></div><div className="regulation-content">{item.content_text}</div></article>)}
        {!filtered.length && <EmptyState title="ไม่พบเนื้อหาข้อบังคับ" detail="ลองเปลี่ยนหมวดหรือคำค้นหา" />}
      </section>
    </div>
  </>;
}

export default App;
