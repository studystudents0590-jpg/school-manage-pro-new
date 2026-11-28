
import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp,
  updateDoc, where
} from 'firebase/firestore';
import { db } from './firebase';
import { CLASS_OPTIONS, getClassLabel, getClassOptionsWithLegacy } from './classSystem';

const box={background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:14};
const field={width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8,boxSizing:'border-box',fontSize:14,background:'#fff'};
const btn={background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 14px',fontWeight:700,cursor:'pointer'};
const soft={background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'};
const danger={background:'#fee2e2',color:'#b91c1c',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'};
const errText=e=>e?.code==='permission-denied'?'Firebase Rules ne is action ko allow nahi kiya. Rules update aur permission settings check karein.':e?.message||'Something went wrong.';
const blankSubject={className:'',subjectName:'',subjectCode:'',type:'Theory',compulsory:'Compulsory',teacherIds:[],teacherNames:[]};
const blankChapter=()=>({title:'',topics:'',objective:'',status:'Pending'});
const perms=['View','Create','Edit','Delete'];

export default function SubjectsSyllabusModule({schoolId,schoolName,profile,isTeacher=false,onBack}){
 const isAdmin=!isTeacher && ['schooladmin','superadmin'].includes(profile?.role);
 const p=profile?.permissions||{};
 const canView=!isTeacher || (p['Subjects & Syllabus']===true && p['Syllabus: View']===true);
 const canCreate=isAdmin || (p['Subjects & Syllabus']===true && p['Syllabus: Create']===true);
 const canEdit=isAdmin || (p['Subjects & Syllabus']===true && p['Syllabus: Edit']===true);
 const canDelete=isAdmin || (p['Subjects & Syllabus']===true && p['Syllabus: Delete']===true);
 const assignedClasses=Array.isArray(profile?.classes)?profile.classes:[];
 const assignedSubjects=Array.isArray(profile?.subjects)?profile.subjects:[];
 const [sessions,setSessions]=useState([]),[classes,setClasses]=useState([]),[teachers,setTeachers]=useState([]),[subjects,setSubjects]=useState([]),[plans,setPlans]=useState([]);
 const [sessionId,setSessionId]=useState(''),[className,setClassName]=useState(''),[subjectId,setSubjectId]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [subjectForm,setSubjectForm]=useState(blankSubject),[editingSubject,setEditingSubject]=useState(null),[showSubjectForm,setShowSubjectForm]=useState(false);
 const [bulkSubjects,setBulkSubjects]=useState([blankSubject]);
 const [chapterForm,setChapterForm]=useState(blankChapter()),[editingChapter,setEditingChapter]=useState(-1),[showChapterForm,setShowChapterForm]=useState(false);
 const [bulkChapterMode,setBulkChapterMode]=useState(false),[bulkChapterDraft,setBulkChapterDraft]=useState('');
 const [objectiveForm,setObjectiveForm]=useState('');
 const [topicManagerChapter,setTopicManagerChapter]=useState(-1),[topicDraft,setTopicDraft]=useState(''),[editingTopicIndex,setEditingTopicIndex]=useState(-1),[topicBusy,setTopicBusy]=useState(false);

 useEffect(()=>{
  if(!schoolId){setSessions([]);setClasses([]);setTeachers([]);setLoading(false);return;}
  setLoading(true);setError('');
  const qS=query(collection(db,'academicSessions'),where('schoolId','==',schoolId));
  const qC=isTeacher?null:query(collection(db,'schoolClasses'),where('schoolId','==',schoolId));
  const unS=onSnapshot(qS,s=>{const rows=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.status==='Active'?-1:1)-(b.status==='Active'?-1:1));setSessions(rows);setSessionId(old=>old||rows.find(x=>x.status==='Active')?.id||rows[0]?.id||'');setLoading(false);},e=>{setError(errText(e));setLoading(false);});
  const unC=qC?onSnapshot(qC,s=>{const rows=s.docs.map(d=>({id:d.id,...d.data()}));setClasses(rows);setClassName(old=>old||rows.find(x=>x.status==='Active')?.className||rows[0]?.className||'');},e=>setError(errText(e))):()=>{setClasses(assignedClasses.map((name,i)=>({id:`assigned-${i}`,className:name,status:'Active'})));setClassName(old=>old||assignedClasses[0]||'');};
  const unT=isAdmin?onSnapshot(query(collection(db,'teachers'),where('schoolId','==',schoolId)),s=>setTeachers(s.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.status==='Active')),e=>setError(errText(e))):()=>{};
  return ()=>{unS();unC();unT();};
 },[schoolId,isTeacher,(assignedClasses||[]).join('|')]);

 useEffect(()=>{
  if(!schoolId||!sessionId){setSubjects([]);setPlans([]);return;}
  const classList=isTeacher?assignedClasses.filter(Boolean).slice(0,30):[];
  if(isTeacher && !classList.length){setSubjects([]);setPlans([]);return;}
  const base=[where('schoolId','==',schoolId),where('sessionId','==',sessionId)];
  const qs=isTeacher
   ?query(collection(db,'schoolSubjects'),...base,where('className','in',classList),where('teacherIds','array-contains',profile?.teacherId||''))
   :query(collection(db,'schoolSubjects'),...base);
  const qp=isTeacher
   ?query(collection(db,'syllabusPlans'),...base,where('className','in',classList),where('teacherIds','array-contains',profile?.teacherId||''))
   :query(collection(db,'syllabusPlans'),...base);
  const u1=onSnapshot(qs,s=>setSubjects(s.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(errText(e)));
  const u2=onSnapshot(qp,s=>setPlans(s.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(errText(e)));
  return ()=>{u1();u2();};
 },[schoolId,sessionId,isTeacher,(assignedClasses||[]).join('|')]);

 const currentSession=sessions.find(s=>s.id===sessionId);
 const activeClasses=useMemo(()=>{
  const sessionClasses=classes.filter(c=>(!sessionId||isTeacher||c.sessionId===sessionId));
  const sourceValues=isTeacher?assignedClasses:[...CLASS_OPTIONS.map(item=>item.value),...sessionClasses.map(c=>c.className)];
  return getClassOptionsWithLegacy(sourceValues).map((item,index)=>({id:`common-${index}`,className:item.value,label:item.label,status:'Active'}));
 },[classes,sessionId,isTeacher,assignedClasses]);
 const visibleSubjects=useMemo(()=>subjects.filter(s=>s.sessionId===sessionId&&s.className===className&&(s.status||'Active')!=='Disabled').filter(s=>!isTeacher||((s.teacherIds||[]).includes(profile?.teacherId)||assignedSubjects.includes(s.subjectName))),[subjects,sessionId,className,isTeacher,assignedSubjects,profile?.teacherId]);
 const selectedSubject=visibleSubjects.find(s=>s.id===subjectId)||visibleSubjects[0]||null;
 const selectedPlan=selectedSubject?plans.find(x=>x.subjectId===selectedSubject.id&&x.className===className&&x.sessionId===sessionId):null;
 const chapters=selectedPlan?.chapters||[];
 const canAddChapter=isAdmin || (selectedPlan ? canEdit : canCreate);
 const completed=chapters.filter(c=>c.status==='Completed').length;
 const percent=chapters.length?Math.round(completed*100/chapters.length):0;

 useEffect(()=>{if(!visibleSubjects.length){setSubjectId('');return;}setSubjectId(old=>visibleSubjects.some(s=>s.id===old)?old:visibleSubjects[0].id);},[visibleSubjects]);

 const startAddSubject=()=>{setEditingSubject(null);setSubjectForm({...blankSubject,className,teacherIds:[],teacherNames:[]});setBulkSubjects([{...blankSubject,className,teacherIds:[],teacherNames:[]}]);setShowSubjectForm(true);};
 const updateBulkSubject=(index,patch)=>setBulkSubjects(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
 const addBulkSubjectRow=()=>setBulkSubjects(rows=>[...rows,{...blankSubject,className,teacherIds:[],teacherNames:[]}]);
 const removeBulkSubjectRow=index=>setBulkSubjects(rows=>rows.length<=1?rows:rows.filter((_,i)=>i!==index));
 const startEditSubject=s=>{setEditingSubject(s.id);setSubjectForm({...blankSubject,...s,teacherIds:s.teacherIds||[],teacherNames:s.teacherNames||[]});setShowSubjectForm(true);};
 const saveSubject=async e=>{
  e.preventDefault();if(!isAdmin||!schoolId||!sessionId)return;
  const rows=editingSubject?[subjectForm]:bulkSubjects;
  if(!rows.length||rows.some(row=>!row.className||!String(row.subjectName||'').trim())){setError('Har subject ke liye class aur subject name bharein.');return;}
  const seen=new Set();
  for(const row of rows){
   const key=`${row.className}::${String(row.subjectName||'').trim().toLowerCase()}`;
   if(seen.has(key)){setError(`List mein ${row.subjectName} subject duplicate hai.`);return;}
   seen.add(key);
   const duplicate=subjects.some(existing=>existing.id!==editingSubject&&existing.sessionId===sessionId&&existing.className===row.className&&String(existing.subjectName||'').trim().toLowerCase()===String(row.subjectName||'').trim().toLowerCase()&&(existing.status||'Active')!=='Disabled');
   if(duplicate){setError(`${row.className} mein ${row.subjectName} subject pehle se bana hua hai.`);return;}
  }
  setBusy(true);setError('');
  try{
   for(const row of rows){
    const selectedTeachers=teachers.filter(t=>(row.teacherIds||[]).includes(t.id));
    const payload={schoolId,schoolName:schoolName||'',sessionId,sessionName:currentSession?.name||'',className:row.className,subjectName:row.subjectName.trim(),subjectCode:(row.subjectCode||'').trim(),type:row.type||'Theory',compulsory:row.compulsory||'Compulsory',teacherIds:selectedTeachers.map(t=>t.id),teacherNames:selectedTeachers.map(t=>t.name),status:'Active',updatedAt:serverTimestamp()};
    if(editingSubject)await updateDoc(doc(db,'schoolSubjects',editingSubject),payload);
    else await addDoc(collection(db,'schoolSubjects'),{...payload,createdAt:serverTimestamp(),createdBy:profile?.uid||''});
   }
   setShowSubjectForm(false);setNotice(editingSubject?'Subject updated successfully.':`${rows.length} subject(s) saved successfully.`);
  }catch(e){setError(errText(e));}finally{setBusy(false);}
 };
 const disableSubject=async s=>{if(!isAdmin||!window.confirm(`Disable ${s.subjectName}? Existing syllabus history will remain.`))return;try{await updateDoc(doc(db,'schoolSubjects',s.id),{status:'Disabled',updatedAt:serverTimestamp()});setNotice('Subject disabled. Existing syllabus is preserved.');}catch(e){setError(errText(e));}};
 const savePlan=async nextChapters=>{
  if(!selectedSubject||!schoolId||!sessionId)return;
  const existing=plans.find(x=>x.subjectId===selectedSubject.id&&x.className===className&&x.sessionId===sessionId);
  const payload={schoolId,schoolName:schoolName||'',sessionId,sessionName:currentSession?.name||'',className,subjectId:selectedSubject.id,subjectName:selectedSubject.subjectName,teacherIds:selectedSubject.teacherIds||[],chapters:nextChapters,updatedAt:serverTimestamp(),updatedBy:profile?.teacherId||profile?.uid||''};
  if(existing)await updateDoc(doc(db,'syllabusPlans',existing.id),payload);
  else await addDoc(collection(db,'syllabusPlans'),{...payload,createdAt:serverTimestamp(),createdBy:profile?.teacherId||profile?.uid||''});
 };
 const submitChapter=async e=>{e.preventDefault();if(!selectedSubject||!canAddChapter)return;
  const next=[...chapters];
  if(editingChapter<0&&bulkChapterMode){
   const names=bulkChapterDraft.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
   if(!names.length){setError('Kam se kam ek chapter name likhein.');return;}
   const existing=new Set(chapters.map(c=>String(c.title||'').trim().toLowerCase()));
   const fresh=names.filter((name,i)=>!existing.has(name.toLowerCase())&&names.findIndex(x=>x.toLowerCase()===name.toLowerCase())===i);
   if(!fresh.length){setError('Ye chapters pehle se maujood hain.');return;}
   fresh.forEach(title=>next.push({title,topics:[],objective:'',status:'Pending',updatedAt:new Date().toISOString()}));
  }else{
   if(!chapterForm.title.trim()){setError('Chapter name likhein.');return;}
   const item={title:chapterForm.title.trim(),topics:chapterForm.topics.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean),objective:chapterForm.objective.trim(),status:chapterForm.status,updatedAt:new Date().toISOString()};
   if(editingChapter>=0)next[editingChapter]=item;else next.push(item);
  }
  setBusy(true);setError('');try{await savePlan(next);setShowChapterForm(false);setEditingChapter(-1);setChapterForm(blankChapter());setBulkChapterDraft('');setBulkChapterMode(false);setNotice('Syllabus chapter(s) saved successfully.');}catch(e){setError(errText(e));}finally{setBusy(false);}
 };
 const editChapter=(ch,i)=>{if(!canEdit)return;setEditingChapter(i);setChapterForm({title:ch.title||'',topics:(ch.topics||[]).join(', '),objective:ch.objective||'',status:ch.status||'Pending'});setShowChapterForm(true);};
 const openTopicManager=i=>{setTopicManagerChapter(i);setTopicDraft('');setEditingTopicIndex(-1);};
 const saveTopicDraft=async()=>{if(topicManagerChapter<0||!selectedSubject)return;const chapter=chapters[topicManagerChapter];if(!chapter)return;const additions=topicDraft.split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);if(!additions.length){setError('Kam se kam ek topic ka naam likhein.');return;}const current=Array.isArray(chapter.topics)?chapter.topics:[];const existingKeys=new Set(current.map(x=>String(x).trim().toLowerCase()));const fresh=additions.filter(x=>!existingKeys.has(x.toLowerCase()));if(!fresh.length){setError('Ye topic pehle se maujood hai.');return;}const next=chapters.map((c,i)=>i===topicManagerChapter?{...c,topics:[...current,...fresh],updatedAt:new Date().toISOString()}:c);setTopicBusy(true);setError('');try{await savePlan(next);setTopicDraft('');setNotice(`${fresh.length} topic(s) added successfully.`);}catch(e){setError(errText(e));}finally{setTopicBusy(false);}};
 const updateTopic=async(index,value)=>{if(topicManagerChapter<0||!value.trim())return;const chapter=chapters[topicManagerChapter];const current=Array.isArray(chapter?.topics)?chapter.topics:[];if(current.some((x,i)=>i!==index&&String(x).trim().toLowerCase()===value.trim().toLowerCase())){setError('Ye topic pehle se maujood hai.');return;}const next=chapters.map((c,i)=>i===topicManagerChapter?{...c,topics:current.map((x,j)=>j===index?value.trim():x),updatedAt:new Date().toISOString()}:c);setTopicBusy(true);setError('');try{await savePlan(next);setEditingTopicIndex(-1);setNotice('Topic updated successfully.');}catch(e){setError(errText(e));}finally{setTopicBusy(false);}};
 const deleteTopic=async index=>{if(topicManagerChapter<0||!canDelete)return;const chapter=chapters[topicManagerChapter];const current=Array.isArray(chapter?.topics)?chapter.topics:[];const target=current[index];if(!window.confirm(`Delete topic "${target}"? Historical performance data will be kept.`))return;const archived=[...(chapter.deletedTopics||[]),{title:target,deletedAt:new Date().toISOString(),deletedBy:profile?.uid||profile?.teacherId||''}];const next=chapters.map((c,i)=>i===topicManagerChapter?{...c,topics:current.filter((_,j)=>j!==index),deletedTopics:archived,updatedAt:new Date().toISOString()}:c);setTopicBusy(true);setError('');try{await savePlan(next);setNotice('Topic deleted from active syllabus. Historical data is preserved.');}catch(e){setError(errText(e));}finally{setTopicBusy(false);}};
 const moveTopic=async(index,direction)=>{if(topicManagerChapter<0||!canEdit)return;const chapter=chapters[topicManagerChapter];const current=[...(chapter?.topics||[])];const target=index+direction;if(target<0||target>=current.length)return;[current[index],current[target]]=[current[target],current[index]];const next=chapters.map((c,i)=>i===topicManagerChapter?{...c,topics:current,updatedAt:new Date().toISOString()}:c);setTopicBusy(true);try{await savePlan(next);}catch(e){setError(errText(e));}finally{setTopicBusy(false);}};
 const changeChapterStatus=async(i,status)=>{if(!canEdit)return;const next=chapters.map((c,index)=>index===i?{...c,status}:c);setBusy(true);try{await savePlan(next);}catch(e){setError(errText(e));}finally{setBusy(false);}};
 const deleteChapter=async i=>{if(!canDelete||!window.confirm('Is chapter ko delete karna hai?'))return;const next=chapters.filter((_,index)=>index!==i);setBusy(true);try{await savePlan(next);setNotice('Chapter deleted.');}catch(e){setError(errText(e));}finally{setBusy(false);}};
 const deleteWholePlan=async()=>{if(!canDelete||!selectedPlan||!window.confirm('Is subject ka poora syllabus delete karna hai?'))return;setBusy(true);try{await deleteDoc(doc(db,'syllabusPlans',selectedPlan.id));setNotice('Syllabus plan deleted.');}catch(e){setError(errText(e));}finally{setBusy(false);}};

 const syllabusPlainText=()=>{
  const lines=[`${schoolName||'School'} - Subjects & Syllabus`,`Session: ${currentSession?.name||''}`,`Class: ${className}`,`Subject: ${selectedSubject?.subjectName||''}`,''];
  chapters.forEach((ch,i)=>{lines.push(`Chapter ${i+1}: ${ch.title} (${ch.status||'Pending'})`);(ch.topics||[]).forEach((t,j)=>lines.push(`  ${String.fromCharCode(65+(j%26))}. ${t}`));if(ch.objective)lines.push(`  Objective: ${ch.objective}`);lines.push('');});
  return lines.join('\n');
 };
 const downloadSyllabus=()=>{
  if(!selectedSubject)return;
  const content='\ufeff'+syllabusPlainText();
  const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${className}-${selectedSubject.subjectName}-Syllabus.txt`.replace(/[^a-z0-9._-]/gi,'_');document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 };
 const printSyllabus=()=>{
  if(!selectedSubject)return;
  const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const rows=chapters.map((ch,i)=>`<section><h3>Chapter ${i+1}: ${esc(ch.title)}</h3><ol type="A">${(ch.topics||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ol>${ch.objective?`<p><b>Objective:</b> ${esc(ch.objective)}</p>`:''}<p>Status: ${esc(ch.status||'Pending')}</p></section>`).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Syllabus</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#172033}h1{margin-bottom:4px}h2{color:#475569;font-size:17px}section{border-bottom:1px solid #ddd;padding:8px 0;break-inside:avoid}li{margin:5px 0}@media print{button{display:none}}</style></head><body><h1>${esc(schoolName||'School')}</h1><h2>${esc(currentSession?.name||'')} · ${esc(className)} · ${esc(selectedSubject.subjectName)}</h2>${rows||'<p>No chapters added.</p>'}<button onclick="window.print()">Print / Save as PDF</button></body></html>`;
  const w=window.open('','_blank');if(!w){setError('Print window blocked. Browser pop-ups allow karein.');return;}w.document.open();w.document.write(html);w.document.close();
 };
 const shareSyllabus=async()=>{
  if(!selectedSubject)return;const text=syllabusPlainText();
  try{if(navigator.share)await navigator.share({title:`${selectedSubject.subjectName} Syllabus`,text});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);setNotice('Syllabus copied. Ab WhatsApp ya kisi app mein share kar sakte hain.');}else setError('Is browser mein sharing supported nahi hai.');}catch(e){if(e?.name!=='AbortError')setError(e.message||'Share nahi ho saka.');}
 };
 if(!schoolId)return <section style={box}><button style={soft} onClick={onBack}>← Dashboard</button><h2>Subjects & Syllabus</h2><p>Super Admin: pehle ek school select karein.</p></section>;
 if(!canView)return <section style={box}><button style={soft} onClick={onBack}>← Dashboard</button><h2>Subjects & Syllabus</h2><p>School Admin ne aapko Syllabus View permission nahi di hai.</p></section>;
 return <div>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:14}}><div><button style={soft} onClick={onBack}>← Dashboard</button><h2 style={{margin:'12px 0 3px'}}>Subjects & Syllabus</h2><div style={{fontSize:13,color:'#64748b'}}>{schoolName||'School'} · {currentSession?.name||'Academic Session'}</div></div>{isAdmin&&<button style={btn} onClick={startAddSubject} disabled={!sessionId}>＋ Add Subject</button>}</div>
  {error&&<div style={{...box,background:'#fff1f2',borderColor:'#fecdd3',color:'#9f1239'}}>{error}</div>}{notice&&<div style={{...box,background:'#f0fdf4',borderColor:'#bbf7d0',color:'#166534'}}>{notice}</div>}
  <section style={box}><label style={{display:'block',fontWeight:700,marginBottom:6}}>Academic Session</label><select style={field} value={sessionId} onChange={e=>setSessionId(e.target.value)}>{sessions.map(s=><option key={s.id} value={s.id}>{s.name} {s.status==='Active'?'(Current)':'(Previous)'}</option>)}</select><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:12}}><label style={{fontWeight:700,fontSize:13}}>Class<select style={{...field,marginTop:6}} value={className} onChange={e=>setClassName(e.target.value)}><option value="">Select Class</option>{activeClasses.map(c=><option key={c.id} value={c.className}>{c.label||getClassLabel(c.className)}</option>)}</select></label><label style={{fontWeight:700,fontSize:13}}>Subject<select style={{...field,marginTop:6}} value={selectedSubject?.id||''} onChange={e=>setSubjectId(e.target.value)}><option value="">Select Subject</option>{visibleSubjects.map(s=><option key={s.id} value={s.id}>{s.subjectName} {s.subjectCode?`(${s.subjectCode})`:''}</option>)}</select></label></div></section>
  {isAdmin&&<section style={box}><div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 4px'}}>Subject Management · {className||'Select Class'}</h3><p style={{margin:0,color:'#64748b',fontSize:13}}>Subjects are saved class-wise and session-wise. Teacher assignments use Teachers & Staff records.</p></div>{className&&<button style={soft} onClick={startAddSubject}>＋ Add Subject</button>}</div>{subjects.filter(s=>s.sessionId===sessionId&&s.className===className).map(s=><div key={s.id} style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',borderBottom:'1px solid #f1f5f9',padding:'10px 0',flexWrap:'wrap'}}><div><b>{s.subjectName}</b> <span style={{fontSize:12,color:'#64748b'}}>{s.subjectCode||''} · {s.type} · {s.compulsory}</span><div style={{fontSize:12,color:'#64748b'}}>Teachers: {(s.teacherNames||[]).join(', ')||'Not assigned'} · {s.status||'Active'}</div></div><div style={{display:'flex',gap:6}}><button style={soft} onClick={()=>startEditSubject(s)}>Edit</button>{s.status!=='Disabled'&&<button style={danger} onClick={()=>disableSubject(s)}>Disable</button>}</div></div>)}{!subjects.some(s=>s.sessionId===sessionId&&s.className===className)&&<p style={{color:'#64748b'}}>Is class ke liye abhi subject add nahi hua.</p>}</section>}
  <section style={box}><h3 style={{margin:'0 0 5px'}}>Syllabus Summary Report</h3><p style={{margin:'0 0 10px',fontSize:13,color:'#64748b'}}>Session-wise progress for the selected class. Teacher names are taken from subject assignments.</p>{visibleSubjects.length===0?<p style={{color:'#64748b'}}>No active subjects to report for this class.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:520}}><thead><tr>{['Subject','Assigned Teacher','Total Chapters','Completed','Pending','Progress'].map(x=><th key={x} style={{textAlign:'left',padding:8,borderBottom:'1px solid #e2e8f0',fontSize:12,color:'#64748b'}}>{x}</th>)}</tr></thead><tbody>{visibleSubjects.map(sub=>{const plan=plans.find(x=>x.subjectId===sub.id&&x.className===className&&x.sessionId===sessionId);const list=plan?.chapters||[];const done=list.filter(ch=>ch.status==='Completed').length;const pct=list.length?Math.round(done*100/list.length):0;return <tr key={sub.id}><td style={{padding:8,borderBottom:'1px solid #f1f5f9'}}>{sub.subjectName}</td><td style={{padding:8,borderBottom:'1px solid #f1f5f9'}}>{(sub.teacherNames||[]).join(', ')||'—'}</td><td style={{padding:8,borderBottom:'1px solid #f1f5f9'}}>{list.length}</td><td style={{padding:8,borderBottom:'1px solid #f1f5f9'}}>{done}</td><td style={{padding:8,borderBottom:'1px solid #f1f5f9'}}>{list.length-done}</td><td style={{padding:8,borderBottom:'1px solid #f1f5f9'}}>{pct}%</td></tr>})}</tbody></table></div>}</section>
  <section style={box}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 4px'}}>Syllabus Progress</h3><p style={{margin:0,color:'#64748b',fontSize:13}}>{selectedSubject?`${className} · ${selectedSubject.subjectName}`:'Class aur subject select karein'}</p></div>{selectedSubject&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{canAddChapter&&<button style={btn} onClick={()=>{setEditingChapter(-1);setBulkChapterMode(false);setChapterForm(blankChapter());setShowChapterForm(true);}}>＋ Add Chapter</button>}<button style={soft} onClick={shareSyllabus}>Share</button><button style={soft} onClick={downloadSyllabus}>Download</button><button style={soft} onClick={printSyllabus}>Print / PDF</button></div>}</div>
   {!selectedSubject?<p style={{color:'#64748b'}}>Abhi is class ke liye subject available nahi hai. School Admin subject add karein ya Teacher ko subject assign karein.</p>:<><div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',margin:'14px 0'}}><div style={{fontSize:28,fontWeight:800,color:'#1d4ed8'}}>{percent}%</div><div style={{flex:1,minWidth:150}}><div style={{height:10,background:'#e2e8f0',borderRadius:20,overflow:'hidden'}}><div style={{width:`${percent}%`,height:'100%',background:'#2563eb'}}/></div><small style={{color:'#64748b'}}>{completed} completed / {chapters.length} total chapters</small></div>{selectedPlan&&canDelete&&<button style={danger} onClick={deleteWholePlan}>Delete Syllabus</button>}</div>
   {chapters.length===0?<p style={{color:'#64748b'}}>Abhi syllabus chapter add nahi hua.</p>:chapters.map((ch,i)=><div key={`${ch.title}-${i}`} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:12,margin:'9px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><div><b>{i+1}. {ch.title}</b><span style={{marginLeft:8,fontSize:11,color:ch.status==='Completed'?'#15803d':'#b45309'}}>{ch.status||'Pending'}</span><div style={{fontSize:13,color:'#475569',marginTop:4}}>Topics: {(ch.topics||[]).length} topic(s) · {(ch.topics||[]).slice(0,3).join(', ')}{(ch.topics||[]).length>3?' …':''}</div>{ch.objective&&<div style={{fontSize:13,color:'#64748b',marginTop:4}}>Objective: {ch.objective}</div>}</div><div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>{(canEdit||canCreate)&&<button style={soft} onClick={()=>openTopicManager(i)}>Manage Topics</button>}{canEdit&&<><button style={soft} onClick={()=>changeChapterStatus(i,ch.status==='Completed'?'Pending':'Completed')}>{ch.status==='Completed'?'Mark Pending':'Mark Completed'}</button><button style={soft} onClick={()=>editChapter(ch,i)}>Edit</button></>}{canDelete&&<button style={danger} onClick={()=>deleteChapter(i)}>Delete</button>}</div></div></div>)}</>}
  </section>
  {showSubjectForm&&<div style={{position:'fixed',inset:0,background:'#0008',display:'grid',placeItems:'center',zIndex:1200,padding:14}}><form onSubmit={saveSubject} style={{background:'#fff',borderRadius:14,padding:20,width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box'}}><h3>{editingSubject?'Edit Subject':'Add Multiple Subjects'}</h3><p style={{color:'#64748b',fontSize:13,marginTop:-6}}>Academic Session: {currentSession?.name||'Selected Session'} · Ek baar mein jitne chahein subjects add karein.</p>
   {(editingSubject?[subjectForm]:bulkSubjects).map((row,index)=><div key={index} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:12,marginBottom:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><strong>Subject {index+1}</strong>{!editingSubject&&bulkSubjects.length>1&&<button type="button" style={danger} onClick={()=>removeBulkSubjectRow(index)}>Remove</button>}</div>
    <label style={{display:'block',fontWeight:650,marginBottom:8}}>Class<select required style={field} value={row.className} onChange={e=>editingSubject?setSubjectForm({...subjectForm,className:e.target.value}):updateBulkSubject(index,{className:e.target.value})}><option value="">Select Class</option>{activeClasses.map(c=><option key={c.id} value={c.className}>{c.label||getClassLabel(c.className)}</option>)}</select></label>
    <label style={{display:'block',fontWeight:650,marginBottom:8}}>Subject Name<input required style={field} placeholder="e.g. English, Hindi, Maths" value={row.subjectName} onChange={e=>editingSubject?setSubjectForm({...subjectForm,subjectName:e.target.value}):updateBulkSubject(index,{subjectName:e.target.value})}/></label>
    <label style={{display:'block',fontWeight:650,marginBottom:8}}>Subject Code<input style={field} value={row.subjectCode||''} onChange={e=>editingSubject?setSubjectForm({...subjectForm,subjectCode:e.target.value}):updateBulkSubject(index,{subjectCode:e.target.value})}/></label>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label style={{fontWeight:650}}>Type<select style={{...field,marginTop:6}} value={row.type||'Theory'} onChange={e=>editingSubject?setSubjectForm({...subjectForm,type:e.target.value}):updateBulkSubject(index,{type:e.target.value})}><option>Theory</option><option>Practical</option><option>Theory + Practical</option></select></label><label style={{fontWeight:650}}>Category<select style={{...field,marginTop:6}} value={row.compulsory||'Compulsory'} onChange={e=>editingSubject?setSubjectForm({...subjectForm,compulsory:e.target.value}):updateBulkSubject(index,{compulsory:e.target.value})}><option>Compulsory</option><option>Optional</option></select></label></div>
    <label style={{display:'block',fontWeight:650,margin:'12px 0 6px'}}>Assigned Teachers</label><div style={{maxHeight:120,overflowY:'auto',border:'1px solid #e2e8f0',borderRadius:8,padding:10}}>{teachers.map(t=><label key={t.id} style={{display:'flex',gap:8,padding:5}}><input type="checkbox" checked={(row.teacherIds||[]).includes(t.id)} onChange={e=>{const ids=e.target.checked?[...(row.teacherIds||[]),t.id]:(row.teacherIds||[]).filter(id=>id!==t.id);editingSubject?setSubjectForm({...subjectForm,teacherIds:ids}):updateBulkSubject(index,{teacherIds:ids});}}/>{t.name} · {(t.classes||[]).join(', ')}</label>)}{!teachers.length&&<small>No active teachers found.</small>}</div>
   </div>)}
   {!editingSubject&&<button type="button" style={{...soft,marginBottom:12}} onClick={addBulkSubjectRow}>＋ Add Another Subject</button>}
   <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8}}><button type="button" style={soft} onClick={()=>setShowSubjectForm(false)}>Cancel</button><button style={btn} disabled={busy}>{busy?'Saving...':editingSubject?'Update Subject':`Save All ${bulkSubjects.length} Subject(s)`}</button></div></form></div>}
  {topicManagerChapter>=0&&chapters[topicManagerChapter]&&<div style={{position:'fixed',inset:0,background:'#0008',display:'grid',placeItems:'center',zIndex:1300,padding:14}}><section style={{background:'#fff',borderRadius:14,padding:18,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div><h3 style={{margin:'0 0 4px'}}>Manage Topics</h3><div style={{fontSize:13,color:'#64748b'}}>{chapters[topicManagerChapter].title}</div></div><button type="button" style={soft} onClick={()=>setTopicManagerChapter(-1)}>Close</button></div><div style={{marginTop:14}}><label style={{display:'block',fontWeight:650,marginBottom:6}}>Add one or multiple topics</label><textarea style={field} rows="5" placeholder={'Write one topic per line\nOr separate topics with commas'} value={topicDraft} onChange={e=>setTopicDraft(e.target.value)} disabled={!canCreate}/><div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><button type="button" style={btn} onClick={saveTopicDraft} disabled={!canCreate||topicBusy}>{topicBusy?'Saving...':'＋ Add Topics'}</button></div></div><h4 style={{margin:'18px 0 8px'}}>Existing Topics ({(chapters[topicManagerChapter].topics||[]).length})</h4>{(chapters[topicManagerChapter].topics||[]).length===0?<p style={{color:'#64748b'}}>No topics added yet.</p>:(chapters[topicManagerChapter].topics||[]).map((topic,index)=><div key={`${index}-${topic}`} style={{display:'flex',alignItems:'center',gap:7,padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}><div style={{width:28,color:'#64748b',fontSize:12,fontWeight:700}}>{String.fromCharCode(65+index)}.</div>{editingTopicIndex===index?<><input style={{...field,flex:1,minWidth:0}} defaultValue={topic} id={`topic-edit-${index}`}/><button type="button" style={soft} onClick={()=>updateTopic(index,document.getElementById(`topic-edit-${index}`)?.value||'')} disabled={topicBusy}>Save</button><button type="button" style={soft} onClick={()=>setEditingTopicIndex(-1)}>Cancel</button></>:<><div style={{flex:1,minWidth:0,wordBreak:'break-word'}}>{topic}</div>{canEdit&&<><button type="button" style={soft} onClick={()=>setEditingTopicIndex(index)}>Edit</button><button type="button" style={soft} onClick={()=>moveTopic(index,-1)} disabled={index===0||topicBusy}>↑</button><button type="button" style={soft} onClick={()=>moveTopic(index,1)} disabled={index===(chapters[topicManagerChapter].topics||[]).length-1||topicBusy}>↓</button></>}{canDelete&&<button type="button" style={danger} onClick={()=>deleteTopic(index)} disabled={topicBusy}>Delete</button>}</>}</div>)}</section></div>}
  {showChapterForm&&<div style={{position:'fixed',inset:0,background:'#0008',display:'grid',placeItems:'center',zIndex:1200,padding:14}}><form onSubmit={submitChapter} style={{background:'#fff',borderRadius:14,padding:20,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box'}}>
   <h3>{editingChapter>=0?'Edit Chapter':'Add Chapter'}</h3>
   {editingChapter<0&&<div style={{display:'flex',gap:8,marginBottom:14}}><button type="button" style={!bulkChapterMode?btn:soft} onClick={()=>setBulkChapterMode(false)}>Add One</button><button type="button" style={bulkChapterMode?btn:soft} onClick={()=>setBulkChapterMode(true)}>Add Multiple</button></div>}
   {editingChapter<0&&bulkChapterMode?<><label style={{display:'block',fontWeight:650,marginBottom:8}}>Chapter Names (one per line)</label><textarea required style={field} rows="8" placeholder={'Nutrition in Plants\nNutrition in Animals\nFibre to Fabric'} value={bulkChapterDraft} onChange={e=>setBulkChapterDraft(e.target.value)}/><small style={{color:'#64748b'}}>Har line se ek chapter banega. Numbering automatically 1, 2, 3... hogi. Har chapter ke topics baad mein alag add kar sakte hain.</small></>:<>
    <label style={{display:'block',fontWeight:650,marginBottom:8}}>Chapter Name<input required style={field} placeholder="e.g. Nutrition in Plants" value={chapterForm.title} onChange={e=>setChapterForm({...chapterForm,title:e.target.value})}/></label>
    <label style={{display:'block',fontWeight:650,marginBottom:8}}>Initial Topics (optional)<textarea style={field} rows="5" placeholder={'One topic per line\nOr comma separated'} value={chapterForm.topics} onChange={e=>setChapterForm({...chapterForm,topics:e.target.value})}/></label>
    <label style={{display:'block',fontWeight:650,marginBottom:8}}>Learning Objective<textarea style={field} rows="2" value={chapterForm.objective} onChange={e=>setChapterForm({...chapterForm,objective:e.target.value})}/></label>
    <label style={{display:'block',fontWeight:650}}>Status<select style={{...field,marginTop:6}} value={chapterForm.status} onChange={e=>setChapterForm({...chapterForm,status:e.target.value})}><option>Pending</option><option>Completed</option></select></label>
   </>}
   <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}><button type="button" style={soft} onClick={()=>{setShowChapterForm(false);setBulkChapterMode(false);}}>Cancel</button><button style={btn} disabled={busy}>{busy?'Saving...':editingChapter>=0?'Update Chapter':bulkChapterMode?'Save All Chapters':'Save Chapter'}</button></div>
  </form></div>}
 </div>;
}
