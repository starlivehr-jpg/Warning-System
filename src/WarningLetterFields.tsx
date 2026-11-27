import { useEffect, useMemo, useRef, useState } from "react";
import sourceTemplate from "./warning_letter_template.html?raw";
import type { WarningLetterFormValue } from "./WarningLetterFields";

type EmployeeOption = { id:string; employee_code:string; first_name:string; last_name:string; job_title:string|null; status?:string; departments?:{name:string}|null };
type RegulationOption = { id:string; section_number:string|null; heading:string; content_text:string; category_code:string; document_id:string };
type SignatureRecord = { warning_id:string; signature_step:string; signature_data:string; signer_name:string; signed_at:string };
type Props = {
  value:WarningLetterFormValue; onChange:(v:WarningLetterFormValue)=>void;
  employees:EmployeeOption[]; regulations:RegulationOption[]; documents:{id:string;title:string}[];
  companyName:string; approvers:{id:string;full_name:string;role:string}[]; role:string;
  onEvidenceChange:(f:File|null)=>void; evidenceName?:string;
  warningId?:string; caseNumber?:string; createdAt?:string; signatures?:SignatureRecord[];
  onSignatureRequest?:(index:number)=>void; readOnly?:boolean;
};

const bridgeScript = String.raw`
(function(){
 const CHANNEL="star-warning-letter-source";
 let currentModel={};
 const send=(type,payload)=>{try{parent.postMessage(Object.assign({channel:CHANNEL,type:type},payload||{}),"*")}catch(e){}};
 const setValue=(el,value)=>{if(!el)return;el.value=value==null?"":String(value);};
 const thaiDate=(iso)=>{if(!iso)return "";const p=String(iso).slice(0,10).split("-");return p.length===3?p[2]+"/"+p[1]+"/"+(Number(p[0])+543):iso};
 const renderClauses=(text)=>String(text||"").split("\n---\n").filter(Boolean).map(x=>x.replace(/^\[REF:[^\]]+\]/,"")).join("\n\n");
 function makeEmployeeSelect(model){
  const old=document.getElementById("empNameInput");if(!old)return null;
  let select=old;if(old.tagName!=="SELECT"){select=document.createElement("select");select.id="empNameInput";select.className=old.className;select.required=true;old.replaceWith(select)}
  select.innerHTML='<option value="">เลือกพนักงานจากทะเบียน</option>';
  (model.employees||[]).filter(e=>!e.status||e.status==="active").forEach(e=>{const o=document.createElement("option");o.value=e.id;o.textContent=(e.employee_code||"")+" · "+e.first_name+" "+e.last_name;select.appendChild(o)});
  select.onchange=()=>{const e=(model.employees||[]).find(x=>x.id===select.value);send("change",{field:"employee_id",value:select.value});if(e){const f=document.querySelectorAll("#documentArea .grid.grid-cols-12 input[type=text]");setValue(f[0],e.employee_code);setValue(f[1],e.job_title||"");setValue(f[2],e.departments?.name||"");const name=document.getElementById("sigName1");if(name)name.value=e.first_name+" "+e.last_name}};
  return select;
 }
 function addSystemFields(){
  const main=document.querySelector("#documentArea section.space-y-3");if(!main)return;
  const details=main.children[1];
  if(details&&!document.getElementById("systemCategoryInput")){const label=document.createElement("label");label.className="block text-xs mb-1";label.innerHTML='<span class="font-semibold">ประเภทเหตุการณ์:</span> <input id="systemCategoryInput" type="text" class="form-line-input w-64" placeholder="ระบุประเภทเหตุการณ์">';details.insertBefore(label,details.querySelector(".editable-box"));label.querySelector("input").addEventListener("input",e=>send("change",{field:"category",value:e.target.value}))}
  const levels=main.querySelector(".bg-slate-50");
  if(levels&&!document.getElementById("employeeExplanationInput")){const extras=document.createElement("div");extras.className="grid grid-cols-2 gap-2 mt-2 text-xs";extras.innerHTML='<label>คำชี้แจงของพนักงาน (ถ้ามี)<textarea id="employeeExplanationInput" rows="2" class="editable-box w-full"></textarea></label><label>แนวทางดำเนินการ / คำสั่งให้ปรับปรุงแก้ไข<textarea id="proposedActionInput" rows="2" class="editable-box w-full"></textarea></label>';levels.appendChild(extras);extras.querySelector("#employeeExplanationInput").addEventListener("input",e=>send("change",{field:"employee_explanation",value:e.target.value}));extras.querySelector("#proposedActionInput").addEventListener("input",e=>send("change",{field:"proposed_action",value:e.target.value}))}
  const boxes=main.querySelectorAll(".editable-box");
  if(boxes[1]&&!document.getElementById("regulationSearchBox")){const search=document.createElement("div");search.id="regulationSearchBox";search.className="no-print mb-2 text-xs";search.innerHTML='<div class="flex items-center gap-2 border border-slate-300 rounded p-2 bg-white"><i class="fa-solid fa-magnifying-glass"></i><input id="regulationSearchInput" type="search" class="w-full outline-none" placeholder="ค้นหาข้อบังคับด้วยคำสำคัญหรือเลขข้อ เช่น 10.2.1, มาสาย, วันลา"></div><div id="regulationSearchResults" class="mt-1 max-h-36 overflow-auto border border-slate-200 rounded bg-white"></div>';boxes[1].parentElement.insertBefore(search,boxes[1]);search.querySelector("input").addEventListener("input",()=>renderRegulations(currentModel))}
 }
 function renderRegulations(model){
  const result=document.getElementById("regulationSearchResults");if(!result)return;
  const q=(document.getElementById("regulationSearchInput")?.value||"").trim().toLocaleLowerCase("th-TH");
  const selected=String(model.value?.regulation_text||"").split("\n---\n").map(x=>x.match(/^\[REF:([^\]]+)\]/)?.[1]).filter(Boolean);
  const docs=model.documents||[];
  const rows=(model.regulations||[]).map(r=>{const text=[r.section_number||"",r.heading,r.content_text,docs.find(d=>d.id===r.document_id)?.title||""].join(" ").toLocaleLowerCase("th-TH");const score=!q?1:q.split(/\s+/).reduce((n,t)=>n+(text.includes(t)?(String(r.section_number||"").includes(t)?10:2):0),0);return {r:r,score:score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,20);
  result.innerHTML="";if(!rows.length){result.textContent="ไม่พบข้อบังคับที่ตรงกับคำค้นหา";return}
  rows.forEach(({r})=>{const label=document.createElement("label");label.className="flex items-start gap-2 p-2 border-b border-slate-100 cursor-pointer";const cb=document.createElement("input");cb.type="checkbox";cb.checked=selected.includes(r.id);cb.className="mt-1";const body=document.createElement("span");body.className="flex flex-col";const title=document.createElement("b");title.textContent=(r.section_number||"ไม่ระบุเลขข้อ")+" "+r.heading;const doc=document.createElement("small");doc.className="text-slate-500";doc.textContent=docs.find(d=>d.id===r.document_id)?.title||"ข้อบังคับ";const content=document.createElement("span");content.className="text-slate-600";content.textContent=String(r.content_text||"").slice(0,220);body.append(title,doc,content);label.append(cb,body);cb.addEventListener("change",()=>{let entries=String(currentModel.value?.regulation_text||"").split("\n---\n").filter(Boolean);if(cb.checked)entries.push("[REF:"+r.id+"]"+(r.section_number?r.section_number+" ":"")+r.heading+"\n"+r.content_text);else entries=entries.filter(x=>!x.startsWith("[REF:"+r.id+"]"));const text=entries.join("\n---\n");const box=document.querySelectorAll("#documentArea .editable-box")[1];if(box)box.textContent=renderClauses(text);currentModel.value=Object.assign({},currentModel.value,{regulation_text:text});send("change",{field:"regulation_text",value:text});renderRegulations(currentModel)});result.appendChild(label)})
 }
 function apply(model){
  currentModel=model||{};const value=model.value||{};
  const head=document.querySelector("#documentArea header [contenteditable=true]");if(head)head.textContent=model.companyName||"";
  const address=head?.nextElementSibling;if(address)address.innerHTML=model.companyAddress||"";
  const meta=document.querySelectorAll("#documentArea header .text-right input");if(meta[0])setValue(meta[0],model.caseNumber||"เลขที่เอกสารกำหนดเมื่อบันทึก");
  setValue(document.getElementById("docDateInput"),thaiDate(model.createdAt||new Date().toISOString().slice(0,10)));
  const emp=makeEmployeeSelect(model);if(emp)emp.value=value.employee_id||"";
  const empInputs=document.querySelectorAll("#documentArea .grid.grid-cols-12 input[type=text]");const employee=(model.employees||[]).find(e=>e.id===value.employee_id);
  setValue(empInputs[0],employee?.employee_code||"");setValue(empInputs[1],employee?.job_title||"");setValue(empInputs[2],employee?.departments?.name||"");
  const incident=document.querySelectorAll("#documentArea section.space-y-3 .grid.grid-cols-12 input");setValue(incident[0],thaiDate(value.incident_date));setValue(incident[1],value.incident_time||"");setValue(incident[2],value.incident_location||"");
  const boxes=document.querySelectorAll("#documentArea .editable-box");if(boxes[0])boxes[0].textContent=value.incident_description||"";if(boxes[1])boxes[1].textContent=renderClauses(value.regulation_text||"");
  setValue(document.getElementById("systemCategoryInput"),value.category||"");setValue(document.getElementById("employeeExplanationInput"),value.employee_explanation||"");setValue(document.getElementById("proposedActionInput"),value.proposed_action||"");
  const levels=document.querySelectorAll("#documentArea section.space-y-3 .bg-slate-50 input[type=checkbox]");const keys=["verbal","written_1","written_2","final_written"];levels.forEach((el,i)=>{el.checked=keys[i]===value.warning_level;el.onchange=()=>{levels.forEach((x,j)=>x.checked=i===j);send("change",{field:"warning_level",value:keys[i]})}});
  const signatures=model.signatures||[];const map={employee_ack:1,issuer:2,hr_manager_ack:3,executive_ack:4};[1,2,3,4].forEach(i=>{const step=Object.keys(map).find(k=>map[k]===i);const sig=signatures.find(s=>s.signature_step===step);const img=document.getElementById("sigImg"+i);const hint=document.getElementById("sigHint"+i);if(img){img.src=sig?.signature_data||"";img.classList.toggle("hidden",!sig?.signature_data)}if(hint)hint.style.display=sig?.signature_data?"none":""});
  document.querySelectorAll("#documentArea .sig-area").forEach((el,i)=>{el.onclick=()=>send("signature_request",{index:i+1,warningId:model.warningId||""})});
  if(model.readOnly){document.querySelectorAll("#documentArea input,#documentArea textarea,#documentArea select").forEach(el=>el.disabled=true);document.querySelectorAll("#documentArea [contenteditable=true]").forEach(el=>el.setAttribute("contenteditable","false"));document.querySelectorAll("#documentArea .editable-box").forEach(el=>el.setAttribute("contenteditable","false"))}
  const execBox=document.getElementById("sigBox4")?.closest(".border");if(execBox)execBox.style.display=value.executive_ack_required?"":"none";
  const sig1=document.getElementById("sigBox1")?.closest(".border");if(sig1){const title=sig1.querySelector(".font-bold span");if(title)title.textContent="1. พนักงานผู้ถูกเตือน"}
  renderRegulations(model);
  if(model.readOnly){const toolbar=document.querySelector(".sticky");if(toolbar)toolbar.querySelectorAll("button").forEach(b=>{if(!b.textContent.includes("พิมพ์"))b.style.display="none"})}
  if(!model.warningId)document.querySelectorAll(".sig-area").forEach(el=>{el.style.opacity=".55";el.title="บันทึกฉบับร่างก่อนจึงจะลงนามผ่านระบบได้"});
 }
 window.openSignatureModal=function(index,roleTitle){send("signature_request",{index:index,roleTitle:roleTitle,warningId:currentModel.warningId||""})};
 window.addEventListener("message",function(event){const m=event.data;if(!m||m.channel!==CHANNEL)return;if(m.type==="init")apply(m.model);if(m.type==="refresh-signatures"){currentModel.signatures=m.signatures||[];apply(currentModel)}});
 window.addEventListener("load",function(){addSystemFields();if(currentModel&&currentModel.value)apply(currentModel)});
})();
`;

export default function WarningLetterFields(props:Props){
 const {value,onChange,employees,regulations,documents,companyName,approvers,role,onEvidenceChange,evidenceName,warningId,caseNumber,createdAt,signatures,onSignatureRequest,readOnly=false}=props;
 const iframeRef=useRef<HTMLIFrameElement|null>(null);const [loaded,setLoaded]=useState(false);const [approverId,setApproverId]=useState(value.approver_id||"");
 const model=useMemo(()=>({value,employees,regulations,documents,companyName,companyAddress:"",approvers,role,warningId,caseNumber,createdAt,signatures:signatures||[],readOnly}),[value,employees,regulations,documents,companyName,approvers,role,warningId,caseNumber,createdAt,signatures,readOnly]);
 const srcDoc=useMemo(()=>sourceTemplate.replace("</body>","<script>"+bridgeScript+"</script></body>"),[]);
 useEffect(()=>{if(loaded)iframeRef.current?.contentWindow?.postMessage({channel:"star-warning-letter-source",type:"init",model},"*")},[loaded,model]);
 useEffect(()=>{function receive(event:MessageEvent){if(event.source!==iframeRef.current?.contentWindow||event.data?.channel!=="star-warning-letter-source")return;if(event.data.type==="change"){const field=event.data.field;let next=event.data.value;if(field==="incident_date"&&/^\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{4}$/.test(next)){const [d,m,y]=next.split(/[\\/.-]/);const year=Number(y)>2400?Number(y)-543:Number(y);next=String(year).padStart(4,"0")+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0")}onChange({...value,[field]:next})}if(event.data.type==="signature_request")onSignatureRequest?.(event.data.index)}window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive)},[value,onChange,onSignatureRequest]);
 useEffect(()=>{setApproverId(value.approver_id||"")},[value.approver_id]);
 return <div className="source-letter-workspace">
  {!readOnly&&<div className="source-letter-extra source-workflow-controls"><div className="source-workflow-row"><label>ผู้อนุมัติ / ผู้บริหาร (ไม่บังคับ)<select value={approverId} onChange={e=>{setApproverId(e.target.value);onChange({...value,approver_id:e.target.value})}}><option value="">บันทึกเป็นฉบับร่าง</option>{approvers.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.role}</option>)}</select></label><label className="source-exec-control"><input type="checkbox" checked={value.executive_ack_required} disabled={role!=="hr_officer"&&role!=="system_admin"} onChange={e=>onChange({...value,executive_ack_required:e.target.checked})}/> กำหนดให้ผู้บริหารลงนามรับทราบ</label></div><label className="source-evidence-control">แนบหลักฐานเพิ่มเติม (PDF / JPG / PNG ไม่เกิน 10 MB)<input type="file" accept=".pdf,image/jpeg,image/png" onChange={e=>onEvidenceChange(e.target.files?.[0]||null)}/>{evidenceName&&<small>{evidenceName}</small>}</label></div>}
  <iframe ref={iframeRef} title="หนังสือตักเตือนตามแบบต้นฉบับ" srcDoc={srcDoc} onLoad={()=>setLoaded(true)} className="source-template-iframe"/>
 </div>;
}
