import React,{useEffect,useMemo,useState} from 'react';
import {addDoc,collection,deleteDoc,doc,onSnapshot,query,serverTimestamp,updateDoc,where} from 'firebase/firestore';
import {db} from './firebase';

const classes=['Nursery','LKG','UKG',...Array.from({length:12},(_,i)=>String(i+1))];
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const css={field:{padding:9,border:'1px solid #cbd5e1',borderRadius:8,width:'100%',boxSizing:'border-box'},btn:{padding:'9px 13px',border:0,borderRadius:8,background:'#2457d6',color:'#fff',fontWeight:700,cursor:'pointer'},soft:{padding:'8px 12px',border:0,borderRadius:8,background:'#eef2ff',color:'#1e40af',cursor:'pointer'},danger:{padding:'8px 12px',border:0,borderRadius:8,background:'#fee2e2',color:'#b91c1c',cursor:'pointer'}};
const sessionDefault=()=>{const d=new Date(),y=d.getMonth()>=3?d.getFullYear():d.getFullYear()-1;return `${y}-${String(y+1).slice(-2)}`};
export default function TimetableModule({schoolId,schoolName,profile,students=[],onBack}){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [session,setSession]=useState(sessionDefault()),[className,setClassName]=useState('Nursery'),[section,setSection]=useState('A');
 const [daysOpen,setDaysOpen]=useState(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
 const [periods,setPeriods]=useState([{type:'period',name:'Period 1',start:'08:00',end:'08:40',subject:'',teacher:''},{type:'period',name:'Period 2',start:'08:40',end:'09:20',subject:'',teacher:''},{type:'break',name:'Short Break',start:'09:20',end:'09:35',subject:'',teacher:''},{type:'period',name:'Period 3',start:'09:35',end:'10:15',subject:'',teacher:''}]);
 const [day,setDay]=useState('Monday'),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[versionName,setVersionName]=useState('Main Timetable');
 useEffect(()=>{if(!schoolId){setRows([]);setLoading(false);return;}setLoading(true);const q=query(collection(db,'schoolTimetables'),where('schoolId','==',schoolId));return onSnapshot(q,s=>{setRows(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},e=>{setError(e.message);setLoading(false);});},[schoolId]);
 const current=useMemo(()=>rows.find(r=>r.sessionId===session&&r.className===className&&r.section===(section||'')&&r.status==='Active'),[rows,session,className,section]);
 useEffect(()=>{if(current){setDaysOpen(current.days||daysOpen);setPeriods(current.periods||periods);setVersionName(current.versionName||'Main Timetable');}else if(!editing){setPeriods([{type:'period',name:'Period 1',start:'08:00',end:'08:40',subject:'',teacher:''}]);}},[current?.id]);
 const updatePeriod=(i,key,value)=>setPeriods(p=>p.map((x,n)=>n===i?{...x,[key]:value}:x));
 const save=async()=>{if(!schoolId){setError('Select one school first.');return;}if(!periods.length){setError('Add at least one period.');return;}setBusy(true);setError('');try{
  const parentUids=[...new Set(students.filter(s=>s.className===className&&(s.section||'')===(section||'')&&s.parentUid).map(s=>s.parentUid))];
  const payload={schoolId,schoolName:schoolName||'',sessionId:session,className,section:section||'',days:daysOpen,periods,versionName,status:'Active',parentUids,updatedAt:serverTimestamp(),updatedBy:profile?.uid||profile?.id||''};
  if(editing){
   const otherActive=rows.filter(r=>r.sessionId===session&&r.className===className&&r.section===(section||'')&&r.status==='Active'&&r.id!==editing);
   for(const r of otherActive)await updateDoc(doc(db,'schoolTimetables',r.id),{status:'Inactive',supersededAt:serverTimestamp()});
   await updateDoc(doc(db,'schoolTimetables',editing),payload);
   setEditing(null);
  } else if(current){await updateDoc(doc(db,'schoolTimetables',current.id),payload);}
  else {const batch=rows.filter(r=>r.sessionId===session&&r.className===className&&r.section===(section||'')&&r.status==='Active');for(const r of batch)await updateDoc(doc(db,'schoolTimetables',r.id),{status:'Inactive',supersededAt:serverTimestamp()});await addDoc(collection(db,'schoolTimetables'),{...payload,createdAt:serverTimestamp()});}
  setError('Saved successfully.');
 }catch(e){setError('Save failed: '+e.message);}finally{setBusy(false);}};
 const addPeriod=type=>setPeriods(p=>[...p,{type,name:type==='break'?'Break':`Period ${p.filter(x=>x.type==='period').length+1}`,start:'10:15',end:'10:55',subject:'',teacher:''}]);
 const removePeriod=i=>setPeriods(p=>p.filter((_,n)=>n!==i));
 const copyTo=async targetClass=>{if(!current)return;setBusy(true);try{const old=rows.find(r=>r.sessionId===session&&r.className===targetClass&&r.section===section&&r.status==='Active');if(old)await updateDoc(doc(db,'schoolTimetables',old.id),{status:'Inactive',supersededAt:serverTimestamp()});const parentUids=[...new Set(students.filter(s=>s.className===targetClass&&(s.section||'')===(section||'')&&s.parentUid).map(s=>s.parentUid))];await addDoc(collection(db,'schoolTimetables'),{...current,className:targetClass,parentUids,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),copiedFrom:current.id});setError(`Copied to Class ${targetClass}.`);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const print=()=>window.print();
 const editVersion=r=>{setEditing(r.id);setSession(r.sessionId||session);setClassName(r.className||className);setSection(r.section||'');setDaysOpen(r.days||[]);setPeriods(Array.isArray(r.periods)?r.periods.map(p=>({...p})):[]);setVersionName(r.versionName||'Main Timetable');setError(`Editing: ${r.versionName||'Timetable'}. Make changes and press Save Timetable.`);};
 const cancelEdit=()=>{setEditing(null);if(current){setDaysOpen(current.days||[]);setPeriods(current.periods||[]);setVersionName(current.versionName||'Main Timetable');}setError('Edit cancelled.');};
 const canEdit=profile?.role==='schooladmin'||profile?.role==='superadmin';
 return <section className="workspace">
  <div className="section-head"><div><h2>Timetable Management</h2><p>Session-wise class and section timetable · {schoolName}</p></div><button style={css.soft} onClick={onBack}>← Back</button></div>
  {error&&<p className="pending">{error}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:14}}>
   <label>Academic Session<input style={css.field} value={session} onChange={e=>setSession(e.target.value)} /></label>
   <label>Class<select style={css.field} value={className} onChange={e=>setClassName(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></label>
   <label>Section<input style={css.field} value={section} onChange={e=>setSection(e.target.value)} placeholder="A / B / C"/></label>
   <label>Version Name<input style={css.field} value={versionName} onChange={e=>setVersionName(e.target.value)}/></label>
  </div>
  {canEdit&&<div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}><button style={css.soft} onClick={()=>addPeriod('period')}>＋ Add Period</button><button style={css.soft} onClick={()=>addPeriod('break')}>＋ Add Break</button><button style={css.btn} disabled={busy} onClick={save}>{busy?'Saving…':editing?'Update Timetable':'Save Timetable'}</button>{editing&&<button style={css.danger} disabled={busy} onClick={cancelEdit}>Cancel Edit</button>}<button style={css.soft} onClick={print}>Print / Save PDF</button></div>}
  <div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'12px 0'}}>{days.map(d=><label key={d} style={{fontSize:13}}><input type="checkbox" checked={daysOpen.includes(d)} onChange={e=>setDaysOpen(a=>e.target.checked?[...a,d]:a.filter(x=>x!==d))}/> {d}</label>)}</div>
  <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',background:'#fff'}}><thead><tr><th style={{padding:10,border:'1px solid #cbd5e1'}}>Type / Time</th><th style={{padding:10,border:'1px solid #cbd5e1'}}>Name</th><th style={{padding:10,border:'1px solid #cbd5e1'}}>Subject</th><th style={{padding:10,border:'1px solid #cbd5e1'}}>Teacher</th>{canEdit&&<th>Action</th>}</tr></thead><tbody>{periods.map((p,i)=><tr key={i} style={{background:p.type==='break'?'#fff7ed':'#fff'}}><td style={{padding:7,border:'1px solid #e2e8f0'}}><small>{p.type}</small><div style={{display:'flex',gap:4}}><input aria-label="Start" type="time" style={css.field} value={p.start} disabled={!canEdit} onChange={e=>updatePeriod(i,'start',e.target.value)}/><input aria-label="End" type="time" style={css.field} value={p.end} disabled={!canEdit} onChange={e=>updatePeriod(i,'end',e.target.value)}/></div></td><td style={{padding:7,border:'1px solid #e2e8f0'}}><input style={css.field} value={p.name} disabled={!canEdit} onChange={e=>updatePeriod(i,'name',e.target.value)}/></td><td style={{padding:7,border:'1px solid #e2e8f0'}}><input style={css.field} value={p.subject} disabled={!canEdit||p.type==='break'} onChange={e=>updatePeriod(i,'subject',e.target.value)}/></td><td style={{padding:7,border:'1px solid #e2e8f0'}}><input style={css.field} value={p.teacher} disabled={!canEdit||p.type==='break'} onChange={e=>updatePeriod(i,'teacher',e.target.value)}/></td>{canEdit&&<td><button style={css.danger} onClick={()=>removePeriod(i)}>Delete</button></td>}</tr>)}</tbody></table></div>
  <h3 style={{marginTop:22}}>Timetable Versions</h3>{loading?'Loading…':rows.filter(r=>r.sessionId===session&&r.className===className&&r.section===(section||'')).map(r=><div key={r.id} style={{padding:10,border:'1px solid #e2e8f0',borderRadius:8,marginBottom:8,display:'flex',justifyContent:'space-between',gap:10}}><span>{r.versionName||'Timetable'} · {r.status}</span>{canEdit&&<span style={{display:'flex',gap:6,flexWrap:'wrap'}}><button style={css.soft} onClick={()=>editVersion(r)}>Edit</button> <button style={css.soft} onClick={()=>updateDoc(doc(db,'schoolTimetables',r.id),{status:'Active',restoredAt:serverTimestamp()})}>Activate</button> <button style={css.danger} onClick={()=>updateDoc(doc(db,'schoolTimetables',r.id),{status:'Trash',deletedAt:serverTimestamp()})}>Trash</button></span>}</div>)}
  {canEdit&&current&&<div style={{marginTop:14}}><label>Copy current timetable to class <select style={css.field} onChange={e=>e.target.value&&copyTo(e.target.value)} defaultValue=""><option value="">Select class</option>{classes.filter(c=>c!==className).map(c=><option key={c}>{c}</option>)}</select></label></div>}
  <style>{`@page{size:A4 landscape;margin:12mm}@media print{body *{visibility:hidden!important}.timetable-print-area,.timetable-print-area *{visibility:visible!important}.timetable-print-area{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;background:#fff!important;color:#111827!important}.timetable-print-area table{width:100%;border-collapse:collapse;font-size:12px}.timetable-print-area th,.timetable-print-area td{border:1px solid #64748b;padding:8px;text-align:left}.timetable-print-area h1{font-size:22px;margin:0 0 6px}.timetable-print-area .print-meta{font-size:13px;margin:0 0 16px}.timetable-print-area .print-days{margin:0 0 12px;font-size:12px}.timetable-print-area tr{break-inside:avoid;page-break-inside:avoid}}`}</style>
  <div className="timetable-print-area" style={{display:'none'}}>
   <div style={{textAlign:'center',marginBottom:16}}>
    <h1>{schoolName||'School Timetable'}</h1>
    <div className="print-meta"><strong>TIME TABLE</strong> &nbsp; | &nbsp; Academic Session: {session} &nbsp; | &nbsp; Class: {className} &nbsp; | &nbsp; Section: {section||'-'}</div>
    <div className="print-days"><strong>Working Days:</strong> {daysOpen.join(', ')||'Not selected'}</div>
   </div>
   <table><thead><tr><th>Period Time</th><th>Period Name</th><th>Subject</th><th>Teacher</th><th>Days</th></tr></thead>
    <tbody>{periods.map((p,i)=><tr key={`print-${i}`}><td>{p.start||'-'} – {p.end||'-'}</td><td>{p.name|| (p.type==='break'?'Break':`Period ${i+1}`)}</td><td>{p.type==='break'?'BREAK':(p.subject||'-')}</td><td>{p.type==='break'?'-':(p.teacher||'-')}</td><td>{daysOpen.join(', ')||'-'}</td></tr>)}</tbody>
   </table>
  </div>
 </section>;
}
