import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, onSnapshot, query, where, updateDoc, doc, writeBatch, serverTimestamp, arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';
import { CLASS_LIST, getClassLabel, compareClasses } from './classSystem';

const DEFAULT_CLASSES = CLASS_LIST;
const getCurrentAcademicSessionName = (date = new Date()) => {
 const year = date.getFullYear();
 const startYear = date.getMonth() >= 3 ? year : year - 1;
 return `${startYear}-${String(startYear + 1).slice(-2)}`;
};
const box={background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:14};
const field={width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8,boxSizing:'border-box',fontSize:14};
const btn={background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 14px',fontWeight:700,cursor:'pointer'};
const soft={background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'};
const errText=e=>e?.code==='permission-denied'?'Permission denied. Please add and publish the Academic Phase 1 Firestore rules supplied with this update.':e?.message||'Something went wrong.';

export default function ClassesSectionsModule({schoolId,schoolName,profile,isTeacher=false,students=[],onBack}){
 const [sessions,setSessions]=useState([]),[classes,setClasses]=useState([]),[teachers,setTeachers]=useState([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [sessionName,setSessionName]=useState(getCurrentAcademicSessionName()),[showSession,setShowSession]=useState(false);
 const [sessionPromptKind,setSessionPromptKind]=useState('manual');
 const [dismissedAnnualPrompt,setDismissedAnnualPrompt]=useState('');
 const [showClass,setShowClass]=useState(false),[editing,setEditing]=useState(null);
 const [form,setForm]=useState({className:'',sections:'A, B',classTeacherId:'',classTeacherName:'',capacity:''});
 const [selectedSession,setSelectedSession]=useState('');
 const canManage=!isTeacher && !!schoolId;
 const teacherClasses=Array.isArray(profile?.classes)?profile.classes:[];

 useEffect(()=>{
  if(!schoolId){setSessions([]);setClasses([]);setTeachers([]);setLoading(false);return;}
  setLoading(true);setError('');
  const q1=query(collection(db,'academicSessions'),where('schoolId','==',schoolId));
  const q2=query(collection(db,'schoolClasses'),where('schoolId','==',schoolId));
  const q3=isTeacher?null:query(collection(db,'teachers'),where('schoolId','==',schoolId));
  const un1=onSnapshot(q1,s=>{const rows=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>((a.status==='Active'?0:1)-(b.status==='Active'?0:1))||String(b.startDate||'').localeCompare(String(a.startDate||'')));setSessions(rows);setSelectedSession(old=>old||rows.find(x=>x.status==='Active')?.id||rows[0]?.id||'');setLoading(false);},e=>{setError(errText(e));setLoading(false);});
  const classQuery=isTeacher?(teacherClasses.length?query(collection(db,'schoolClasses'),where('schoolId','==',schoolId),where('className','in',teacherClasses.slice(0,30))):null):q2;
  const un2=classQuery?onSnapshot(classQuery,s=>setClasses(s.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(errText(e))):()=>setClasses([]);
  const un3=q3?onSnapshot(q3,s=>setTeachers(s.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.status==='Active')),e=>setError(errText(e))):()=>{};
  return ()=>{un1();un2();un3();};
 },[schoolId,isTeacher,profile?.teacherId,(profile?.classes||[]).join('|')]);

 // From 1 April onward, suggest the correct April-March academic session.
 // The app never creates it silently: a School Admin must confirm the prompt.
 useEffect(()=>{
  if(!canManage || loading || showSession) return;
  const suggestedName=getCurrentAcademicSessionName();
  if(dismissedAnnualPrompt===suggestedName) return;
  const alreadyExists=sessions.some(s=>String(s.name||'').trim().toLowerCase()===suggestedName.toLowerCase());
  if(!alreadyExists){
   setSessionName(suggestedName);
   setSessionPromptKind('annual');
   setShowSession(true);
  }
 },[canManage,loading,sessions,showSession,dismissedAnnualPrompt]);

 const activeSession=sessions.find(s=>s.id===selectedSession)||sessions.find(s=>s.status==='Active')||null;
 const duplicateSessionNames=[...new Set(sessions.map(s=>String(s.name||'').trim()).filter((name,index,all)=>name&&all.findIndex(x=>x.toLowerCase()===name.toLowerCase())!==index))];
 const visibleClasses=useMemo(()=>classes.filter(c=>(!selectedSession||c.sessionId===selectedSession)&&(!isTeacher||teacherClasses.includes(c.className))),[classes,selectedSession,isTeacher,teacherClasses]);
 const studentCount=(className,section)=>students.filter(s=>s.className===className&&(!section||String(s.section||'').trim()===section)).length;
 const startNewClass=()=>{setEditing(null);setForm({className:'',sections:'A, B',classTeacherId:'',classTeacherName:'',capacity:''});setShowClass(true);};
 const startEdit=c=>{setEditing(c.id);setForm({className:c.className||'',sections:(c.sections||[]).join(', '),classTeacherId:c.classTeacherId||'',classTeacherName:c.classTeacherName||'',capacity:c.capacity??''});setShowClass(true);};
 const saveSession=async e=>{
  e.preventDefault();if(!canManage)return;
  const name=sessionName.trim();if(!name)return;
  if(sessions.some(s=>String(s.name||'').trim().toLowerCase()===name.toLowerCase())){setError('This academic session already exists for this school. Select the existing session instead of creating a duplicate.');return;}
  setBusy(true);setError('');
  try{
   const batch=writeBatch(db);
   sessions.filter(s=>s.status==='Active').forEach(s=>batch.update(doc(db,'academicSessions',s.id),{status:'Inactive',updatedAt:serverTimestamp()}));
   const ref=doc(collection(db,'academicSessions'));
   batch.set(ref,{schoolId,schoolName:schoolName||'',name,status:'Active',startDate:`${name.slice(0,4)}-04-01`,endDate:`${name.slice(5,9)||Number(name.slice(0,4))+1}-03-31`,createdAt:serverTimestamp(),createdBy:profile?.uid||profile?.email||''});
   await batch.commit();setSelectedSession(ref.id);setDismissedAnnualPrompt(name);setShowSession(false);setSessionPromptKind('manual');setSessionName(getCurrentAcademicSessionName());
  }catch(e){setError(errText(e));}finally{setBusy(false);}
 };
 const activateSession=async s=>{
  if(!canManage)return;setBusy(true);setError('');
  try{const batch=writeBatch(db);sessions.forEach(x=>batch.update(doc(db,'academicSessions',x.id),{status:x.id===s.id?'Active':'Inactive',updatedAt:serverTimestamp()}));await batch.commit();setSelectedSession(s.id);}
  catch(e){setError(errText(e));}finally{setBusy(false);}
 };
 const addDefaultClasses=async()=>{
  if(!canManage||!activeSession)return;
  const existing=new Set(classes.filter(c=>c.sessionId===activeSession.id).map(c=>String(c.className||'').trim().toLowerCase()));
  const missing=DEFAULT_CLASSES.filter(n=>!existing.has(n.toLowerCase()));if(!missing.length){setError('All default classes already exist in this academic session.');return;}
  setBusy(true);setError('');
  try{const batch=writeBatch(db);missing.forEach(className=>{const ref=doc(collection(db,'schoolClasses'));batch.set(ref,{schoolId,schoolName:schoolName||'',sessionId:activeSession.id,sessionName:activeSession.name,className,sections:['A','B'],classTeacherId:'',classTeacherName:'',capacity:'',status:'Active',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});await batch.commit();}
  catch(e){setError(errText(e));}finally{setBusy(false);}
 };
 const saveClass=async e=>{
  e.preventDefault();if(!canManage||!activeSession)return;
  const className=form.className.trim();if(!className){setError('Please enter a class name.');return;}
  if(classes.some(c=>c.sessionId===activeSession.id&&c.id!==editing&&String(c.className||'').trim().toLowerCase()===className.toLowerCase())){setError('This class already exists in the selected academic session. Please edit the existing class instead.');return;}
  const sectionValues=form.sections.split(',').map(x=>x.trim()).filter(Boolean);
  const sections=sectionValues.filter((value,index)=>sectionValues.findIndex(x=>x.toLowerCase()===value.toLowerCase())===index);
  const teacher=teachers.find(t=>t.id===form.classTeacherId);
  const payload={schoolId,schoolName:schoolName||'',sessionId:activeSession.id,sessionName:activeSession.name,className,sections,classTeacherId:teacher?.id||'',classTeacherName:teacher?.name||'',capacity:form.capacity===''?'':Number(form.capacity),status:editing?(classes.find(c=>c.id===editing)?.status||'Active'):'Active',updatedAt:serverTimestamp()};
  setBusy(true);setError('');
  try{
   const batch=writeBatch(db);
   if(editing)batch.update(doc(db,'schoolClasses',editing),payload);
   else batch.set(doc(collection(db,'schoolClasses')),{...payload,createdAt:serverTimestamp()});
   // Keep the teacher's assigned-class list in sync; module permission remains separately controlled.
   if(teacher?.id)batch.update(doc(db,'teachers',teacher.id),{classes:arrayUnion(className),updatedAt:serverTimestamp()});
   await batch.commit();setShowClass(false);setEditing(null);
  }
  catch(e){setError(errText(e));}finally{setBusy(false);}
 };
 const toggleStatus=async c=>{if(!canManage)return;try{await updateDoc(doc(db,'schoolClasses',c.id),{status:c.status==='Active'?'Inactive':'Active',updatedAt:serverTimestamp()});}catch(e){setError(errText(e));}};

 if(!schoolId)return <section style={box}><button style={soft} onClick={onBack}>← Dashboard</button><h2>Classes & Sections</h2><p>Please select one school from the Super Admin school selector first.</p></section>;
 return <div>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:14}}><div><button style={soft} onClick={onBack}>← Dashboard</button><h2 style={{margin:'12px 0 3px'}}>Classes & Sections</h2><div style={{color:'#64748b',fontSize:13}}>{schoolName||'Selected School'} · Academic setup</div></div>{canManage&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={soft} onClick={()=>{setSessionPromptKind('manual');setSessionName(getCurrentAcademicSessionName());setShowSession(true);}}>＋ New Academic Session</button><button style={btn} onClick={startNewClass} disabled={!activeSession}>＋ Add Class</button></div>}</div>
  {error&&<div style={{...box,background:'#fff1f2',color:'#9f1239',borderColor:'#fecdd3'}}>{error}</div>}
  {duplicateSessionNames.length>0&&<div style={{...box,background:'#fff7ed',color:'#9a3412',borderColor:'#fed7aa'}}>Duplicate academic session name found: {duplicateSessionNames.join(', ')}. Please verify which record is correct before changing or deleting any session. New duplicate sessions are now blocked.</div>}
  {isTeacher&&<div style={{...box,background:'#eff6ff',color:'#1e40af'}}>Teacher view is read-only. Only your assigned classes are displayed.</div>}
  <section style={box}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 5px'}}>Academic Sessions</h3><p style={{margin:0,color:'#64748b',fontSize:13}}>Previous sessions remain saved. Duplicate session names are not allowed.</p></div>{canManage&&<button style={soft} onClick={()=>{setSessionPromptKind('manual');setSessionName(getCurrentAcademicSessionName());setShowSession(true);}}>＋ Add Session</button>}</div>
   {loading?<p>Loading academic data…</p>:sessions.length===0?<p style={{color:'#64748b'}}>No academic session created yet. Create a session to begin setting up classes.</p>:<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>{sessions.map(s=><button key={s.id} onClick={()=>setSelectedSession(s.id)} style={{...soft,background:selectedSession===s.id?'#dbeafe':'#f1f5f9',border:selectedSession===s.id?'1px solid #2563eb':'1px solid transparent'}}>{s.name} · {s.status==='Active'?'Current':'Previous'}</button>)}</div>}
   {canManage&&sessions.length>0&&activeSession?.status!=='Active'&&<button style={{...btn,marginTop:12}} onClick={()=>activateSession(activeSession)} disabled={busy}>Set selected session as Current</button>}
  </section>
  <section style={box}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 5px'}}>Class List {activeSession?`— ${activeSession.name}`:''}</h3><p style={{margin:0,color:'#64748b',fontSize:13}}>Manage class sections and class teachers for the selected academic session.</p></div>{canManage&&activeSession&&<button style={soft} onClick={addDefaultClasses} disabled={busy}>Add Default Classes</button>}</div>
   {!activeSession?<p style={{color:'#64748b'}}>Create an academic session first.</p>:visibleClasses.length===0?<p style={{color:'#64748b'}}>No classes found for this session. Use “Add Default Classes” or “Add Class”.</p>:<div style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:650}}><thead><tr>{['Class','Sections','Class Teacher','Students','Status',...(canManage?['Actions']:[])].map(x=><th key={x} style={{textAlign:'left',padding:10,borderBottom:'1px solid #e2e8f0',fontSize:12,color:'#64748b'}}>{x}</th>)}</tr></thead><tbody>{[...visibleClasses].sort(compareClasses).map(c=><tr key={c.id}><td style={{padding:10,borderBottom:'1px solid #f1f5f9',fontWeight:700}}>{getClassLabel(c.className)}</td><td style={{padding:10,borderBottom:'1px solid #f1f5f9'}}>{(c.sections||[]).join(', ')||'—'}</td><td style={{padding:10,borderBottom:'1px solid #f1f5f9'}}>{c.classTeacherName||'Not assigned'}</td><td style={{padding:10,borderBottom:'1px solid #f1f5f9'}}>{studentCount(c.className)}</td><td style={{padding:10,borderBottom:'1px solid #f1f5f9'}}>{c.status||'Active'}</td>{canManage&&<td style={{padding:10,borderBottom:'1px solid #f1f5f9'}}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button style={soft} onClick={()=>startEdit(c)}>Edit</button><button style={soft} onClick={()=>toggleStatus(c)}>{c.status==='Active'?'Deactivate':'Activate'}</button></div></td>}</tr>)}</tbody></table></div>}
  </section>
  {showSession&&<div style={{position:'fixed',inset:0,background:'#0008',display:'grid',placeItems:'center',zIndex:1000,padding:14}}><form onSubmit={saveSession} style={{background:'#fff',borderRadius:14,padding:20,width:'100%',maxWidth:420,boxSizing:'border-box'}}><h3 style={{marginTop:0}}>{sessionPromptKind==='annual'?'New Academic Year':'Create Academic Session'}</h3>{sessionPromptKind==='annual'&&<p style={{color:'#334155',lineHeight:1.5}}>A new academic year is due. The suggested session follows the April–March calendar. Confirm to create it and make it Current. Previous session records will remain saved.</p>}<label style={{display:'block',fontWeight:600,marginBottom:6}}>Session Name</label><input style={field} required value={sessionName} onChange={e=>setSessionName(e.target.value)} placeholder="2027-28"/><p style={{fontSize:12,color:'#64748b'}}>Academic sessions run from 1 April to 31 March. The new session becomes current only after your confirmation.</p><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}><button type="button" style={soft} onClick={()=>{if(sessionPromptKind==='annual')setDismissedAnnualPrompt(sessionName);setShowSession(false);setSessionPromptKind('manual');}}>Not now</button><button style={btn} disabled={busy}>{busy?'Saving…':sessionPromptKind==='annual'?'Confirm & Create':'Create Session'}</button></div></form></div>}
  {showClass&&<div style={{position:'fixed',inset:0,background:'#0008',display:'grid',placeItems:'center',zIndex:1000,padding:14}}><form onSubmit={saveClass} style={{background:'#fff',borderRadius:14,padding:20,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto',boxSizing:'border-box'}}><h3 style={{marginTop:0}}>{editing?'Edit Class':'Add Class'}</h3><label style={{display:'block',fontWeight:600,marginBottom:6}}>Class Name</label><input style={field} required value={form.className} onChange={e=>setForm({...form,className:e.target.value})} placeholder="e.g. Class 1"/><label style={{display:'block',fontWeight:600,margin:'12px 0 6px'}}>Sections (comma separated)</label><input style={field} value={form.sections} onChange={e=>setForm({...form,sections:e.target.value})} placeholder="A, B, C"/><label style={{display:'block',fontWeight:600,margin:'12px 0 6px'}}>Class Teacher</label><select style={field} value={form.classTeacherId} onChange={e=>setForm({...form,classTeacherId:e.target.value})}><option value="">Not assigned</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}{t.designation?` · ${t.designation}`:''}</option>)}</select><label style={{display:'block',fontWeight:600,margin:'12px 0 6px'}}>Section Capacity (optional)</label><input style={field} type="number" min="0" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} placeholder="e.g. 40"/><p style={{fontSize:12,color:'#64748b'}}>Academic Session: {activeSession?.name}</p><div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}><button type="button" style={soft} onClick={()=>setShowClass(false)}>Cancel</button><button style={btn} disabled={busy}>{busy?'Saving…':'Save Class'}</button></div></form></div>}
 </div>;
}
