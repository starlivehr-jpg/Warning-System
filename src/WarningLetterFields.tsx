import { useMemo, useState } from "react";
import { BookOpen, Search, UserRound, FileText } from "lucide-react";

export type WarningLetterFormValue = {
  employee_id: string;
  incident_date: string;
  incident_time: string;
  incident_location: string;
  category: string;
  incident_description: string;
  employee_explanation: string;
  proposed_action: string;
  regulation_text: string;
  warning_level: string;
  approver_id: string;
  executive_ack_required: boolean;
};

type EmployeeOption = {
  id: string; employee_code: string; first_name: string; last_name: string;
  job_title: string | null; status?: string; departments?: { name: string } | null;
};
type RegulationOption = {
  id: string; section_number: string | null; heading: string; content_text: string;
  category_code: string; document_id: string;
};
type Props = {
  value: WarningLetterFormValue;
  onChange: (value: WarningLetterFormValue) => void;
  employees: EmployeeOption[];
  regulations: RegulationOption[];
  documents: { id: string; title: string }[];
  companyName: string;
  approvers: { id: string; full_name: string; role: string }[];
  role: string;
  onEvidenceChange: (file: File | null) => void;
  evidenceName?: string;
};

const levelOptions = [
  ["verbal", "ตักเตือนด้วยวาจา (บันทึกหลักฐาน)"],
  ["written_1", "ตักเตือนเป็นหนังสือ ครั้งที่ 1"],
  ["written_2", "ตักเตือนเป็นหนังสือ ครั้งที่ 2"],
  ["final_written", "ตักเตือนเป็นหนังสือ (ขั้นสุดท้าย)"],
];

export default function WarningLetterFields({ value, onChange, employees, regulations, documents, companyName, approvers, role, onEvidenceChange, evidenceName }: Props) {
  const [regulationQuery, setRegulationQuery] = useState("");
  const selectedEmployee = employees.find(e => e.id === value.employee_id);
  const selectedClauses = useMemo(() => value.regulation_text ? value.regulation_text.split("\n---\n").filter(Boolean) : [], [value.regulation_text]);
  const matching = useMemo(() => {
    const q = regulationQuery.trim().toLocaleLowerCase("th-TH");
    if (!q) return regulations.slice(0, 8);
    const terms = q.split(/\s+/).filter(Boolean);
    return regulations.map(item => {
      const text = [item.section_number || "", item.heading, item.content_text, documents.find(d => d.id === item.document_id)?.title || ""].join(" ").toLocaleLowerCase("th-TH");
      const score = terms.reduce((n, term) => n + (text.includes(term) ? (item.section_number?.toLocaleLowerCase("th-TH") === term ? 8 : 2) : 0), 0);
      return { item, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 12).map(x => x.item);
  }, [regulationQuery, regulations, documents]);
  function patch(partial: Partial<WarningLetterFormValue>) { onChange({ ...value, ...partial }); }
  function toggleClause(item: RegulationOption) {
    const key = item.id;
    const existing = new Map(regulations.map(r => [r.id, r]));
    const current = selectedClauses.map(text => {
      const match = text.match(/^\[REF:([^\]]+)\]/);
      return match ? match[1] : "";
    });
    if (current.includes(key)) {
      patch({ regulation_text: selectedClauses.filter(text => !text.startsWith("[REF:" + key + "]")).join("\n---\n") });
      return;
    }
    const source = "[REF:" + key + "]" + (item.section_number ? item.section_number + " " : "") + item.heading + "\n" + item.content_text;
    patch({ regulation_text: [...selectedClauses, source].join("\n---\n") });
  }
  const selectedIds = new Set(selectedClauses.map(t => t.match(/^\[REF:([^\]]+)\]/)?.[1]).filter(Boolean));
  return <div className="warning-letter-builder">
    <div className="letter-company-head"><div className="letter-brand-mark"><ShieldCheckIcon /></div><div><strong>{companyName}</strong><small>แบบฟอร์มหนังสือตักเตือนพนักงาน · WARNING LETTER</small></div></div>
    <div className="letter-title"><h2>หนังสือตักเตือน (WARNING LETTER)</h2><p>เรื่อง แจ้งการกระทำผิดวินัยและข้อบังคับเกี่ยวกับการทำงาน</p></div>

    <section className="letter-section">
      <h3><UserRound size={16}/> 1. ข้อมูลผู้ถูกตักเตือน</h3>
      <label>เลือกพนักงานจากทะเบียน<select required value={value.employee_id} onChange={e => patch({employee_id:e.target.value})}><option value="">เลือกพนักงาน</option>{employees.filter(e=>!e.status || e.status==="active").map(e=><option key={e.id} value={e.id}>{e.employee_code} · {e.first_name} {e.last_name}</option>)}</select></label>
      {selectedEmployee && <div className="employee-auto-grid"><div><small>รหัสพนักงาน</small><strong>{selectedEmployee.employee_code}</strong></div><div><small>ชื่อ-นามสกุล</small><strong>{selectedEmployee.first_name} {selectedEmployee.last_name}</strong></div><div><small>ตำแหน่ง</small><strong>{selectedEmployee.job_title || "—"}</strong></div><div><small>แผนก / ฝ่าย</small><strong>{selectedEmployee.departments?.name || "—"}</strong></div></div>}
    </section>

    <section className="letter-section">
      <h3><FileText size={16}/> 2. วัน เวลา สถานที่ และรายละเอียดการกระทำผิด</h3>
      <div className="letter-grid three"><label>วันที่เกิดเหตุ<input type="date" required value={value.incident_date} onChange={e=>patch({incident_date:e.target.value})}/></label><label>เวลาประมาณ<input type="time" value={value.incident_time} onChange={e=>patch({incident_time:e.target.value})}/></label><label>สถานที่เกิดเหตุ<input value={value.incident_location} onChange={e=>patch({incident_location:e.target.value})} placeholder="ระบุสถานที่ / จุดปฏิบัติงาน"/></label></div>
      <label>ประเภทเหตุการณ์<input required value={value.category} onChange={e=>patch({category:e.target.value})} placeholder="เช่น ขาดงาน / มาสาย / ฝ่าฝืนระเบียบ"/></label>
      <label>รายละเอียดข้อเท็จจริงและพฤติการณ์<textarea required rows={5} value={value.incident_description} onChange={e=>patch({incident_description:e.target.value})} placeholder="ระบุข้อเท็จจริง วันเวลา เหตุการณ์ และพฤติการณ์ให้ชัดเจน"/></label>
      <label>คำชี้แจงของพนักงาน (ถ้ามี)<textarea rows={3} value={value.employee_explanation} onChange={e=>patch({employee_explanation:e.target.value})} placeholder="บันทึกคำชี้แจงของพนักงาน"/></label>
    </section>

    <section className="letter-section">
      <h3><BookOpen size={16}/> 3. ข้อบังคับเกี่ยวกับการทำงานที่เกี่ยวข้อง</h3>
      <div className="letter-regulation-search"><Search size={16}/><input value={regulationQuery} onChange={e=>setRegulationQuery(e.target.value)} placeholder="ค้นหาคำสำคัญหรือเลขข้อ เช่น 10.2.1, มาสาย, การขาดงาน"/></div>
      <p className="letter-helper">ระบบแนะนำข้อที่เกี่ยวข้องจากคลังข้อบังคับมาตรฐานกลาง เลือกได้มากกว่าหนึ่งข้อ</p>
      <div className="letter-regulation-results">{matching.map(item=><label className="letter-regulation-option" key={item.id}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={()=>toggleClause(item)}/><span><strong>{item.section_number || "ไม่ระบุเลขข้อ"} · {item.heading}</strong><small>{documents.find(d=>d.id===item.document_id)?.title || "ข้อบังคับมาตรฐานกลาง"}</small><span>{item.content_text.slice(0,260)}{item.content_text.length>260?"…":""}</span></span></label>)}{!matching.length&&<p className="letter-helper">ไม่พบข้อบังคับที่ตรงกับคำค้นหา</p>}</div>
      {selectedClauses.length>0&&<div className="letter-selected-clauses"><strong>ข้อบังคับที่เลือก ({selectedClauses.length})</strong>{selectedClauses.map((clause,i)=><div key={i}>{clause.replace(/^\[REF:[^\]]+\]/,"")}</div>)}</div>}
    </section>

    <section className="letter-section">
      <h3>4. ระดับการพิจารณาลงโทษทางวินัย</h3>
      <div className="letter-level-grid">{levelOptions.map(([key,label])=><label key={key}><input type="radio" name="warning-level" checked={value.warning_level===key} disabled={role==="supervisor"&&key!=="verbal"} onChange={()=>patch({warning_level:key})}/>{label}</label>)}</div>
      <label>แนวทางดำเนินการ / คำสั่งให้ปรับปรุงแก้ไข<textarea rows={3} value={value.proposed_action} onChange={e=>patch({proposed_action:e.target.value})} placeholder="ระบุแนวทางแก้ไขหรือการดำเนินการที่คาดหวัง"/></label>
      <p className="letter-legal-note">หากพนักงานยังคงฝ่าฝืนหรือกระทำความผิดซ้ำภายในระยะเวลาตามกฎหมาย บริษัทจะพิจารณาดำเนินการทางวินัยตามข้อบังคับเกี่ยวกับการทำงานและกฎหมายที่เกี่ยวข้อง</p>
    </section>

    <section className="letter-section">
      <h3>5. การเสนออนุมัติและลงนาม</h3>
      <label>ผู้อนุมัติ<select value={value.approver_id} onChange={e=>patch({approver_id:e.target.value})}><option value="">บันทึกเป็นฉบับร่าง</option>{approvers.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
      {(role==="hr_officer"||role==="system_admin")&&<label className="letter-check"><input type="checkbox" checked={value.executive_ack_required} onChange={e=>patch({executive_ack_required:e.target.checked})}/> กำหนดให้ผู้บริหารลงนามรับทราบหนังสือฉบับนี้</label>}
      <div className="letter-signature-steps"><div><b>1. ผู้ออกหนังสือเตือน</b><small>ลงนามหลังได้รับอนุมัติ / ตามสิทธิ์เดิม</small></div><div><b>2. HR Manager</b><small>ลงนามรับทราบทุกฉบับ</small></div>{value.executive_ack_required&&<div><b>3. ผู้บริหาร</b><small>ลงนามตามที่ HR กำหนด</small></div>}<div><b>{value.executive_ack_required?"4":"3"}. พนักงาน</b><small>ลงนามรับทราบเป็นขั้นตอนสุดท้าย</small></div></div>
      <label>แนบหลักฐานเพิ่มเติม (PDF / JPG / PNG ไม่เกิน 10 MB)<input type="file" accept=".pdf,image/jpeg,image/png" onChange={e=>onEvidenceChange(e.target.files?.[0]||null)}/>{evidenceName&&<small>{evidenceName}</small>}</label>
    </section>
    <div className="letter-print-hint">แบบฟอร์มนี้จะถูกบันทึกเป็นหนังสือเตือนในระบบ และใช้ลำดับการลงนามอิเล็กทรอนิกส์ชุดเดิม</div>
  </div>;
}

function ShieldCheckIcon(){return <span aria-hidden="true">✦</span>}
