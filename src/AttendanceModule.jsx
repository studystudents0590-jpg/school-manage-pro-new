import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const styles = {
  panel:{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:16,marginBottom:16},
  field:{width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8,background:'#fff',boxSizing:'border-box'},
  primary:{background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 15px',fontWeight:700,cursor:'pointer'},
  secondary:{background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'},
  muted:{fontSize:12,color:'#64748b'}
};
const statuses=['Present','Absent','Leave','Half Day'];
const statusColors={Present:'#dcfce7',Absent:'#fee2e2',Leave:'#fef3c7','Half Day':'#dbeafe'};
const errorText=e=>e?.code==='permission-denied'?'Firestore permission denied. Please add and publish the Attendance rules supplied with this update.':e?.message||'Something went wrong.';

export default function AttendanceModule({schoolId,schoolName,profile,students=[],studentsLoading=false,isTeacher=false,onBack}) {
  const [date,setDate]=useState(today());
  const [className,setClassName]=useState('');
  const [section,setSection]=useState('All Sections');
  const [attendance,setAttendance]=useState({});
  const [saved,setSaved]=useState({});
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [reportLoading,setReportLoading]=useState(false);
  const [report,setReport]=useState([]);
  const [search,setSearch]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  const classOptions=useMemo(()=>[...new Set(students.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[students]);
  useEffect(()=>{if(!className&&classOptions.length)setClassName(classOptions[0]);else if(className&&!classOptions.includes(className))setClassName(classOptions[0]||'');},[classOptions,className]);
  const sectionOptions=useMemo(()=>[...new Set(students.filter(s=>s.className===className).map(s=>s.section).filter(Boolean))].sort(),[students,className]);
  useEffect(()=>{if(section!=='All Sections'&&!sectionOptions.includes(section))setSection('All Sections');},[sectionOptions,section]);
  const visibleStudents=useMemo(()=>students.filter(s=>s.className===className&&(section==='All Sections'||(s.section||'')===section)&&(`${s.name||''} ${s.admissionNo||''} ${s.fatherName||''} ${s.rollNo||''}`).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(a.name||'').localeCompare(b.name||'')),[students,className,section,search]);

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      if(!schoolId||!date){setAttendance({});setSaved({});return;}
      setLoading(true);setError('');setMessage('');
      try{
        const constraints=[where('schoolId','==',schoolId),where('date','==',date)];
        if(isTeacher){if(!className){setLoading(false);return;}constraints.push(where('className','==',className));}
        const q=query(collection(db,'attendanceRecords'),...constraints);
        const snap=await getDocs(q);
        if(cancelled)return;
        const records={};snap.forEach(d=>{const x=d.data();records[x.studentId]={status:x.status||'Present',recordId:d.id};});
        setSaved(records);setAttendance(prev=>{const next={};visibleStudents.forEach(s=>{next[s.id]=records[s.id]?.status||'Present';});return next;});
      }catch(e){if(!cancelled)setError(errorText(e));}
      finally{if(!cancelled)setLoading(false);}
    }
    load();return()=>{cancelled=true;};
  },[schoolId,date,students,className,isTeacher]);

  // Keep the visible list in sync when class/section changes without creating new student records.
  useEffect(()=>{setAttendance(prev=>{const next={...prev};visibleStudents.forEach(s=>{if(!next[s.id])next[s.id]=saved[s.id]?.status||'Present';});return next;});},[visibleStudents,saved]);

  const counts=useMemo(()=>visibleStudents.reduce((a,s)=>{const v=attendance[s.id]||'Present';a[v]=(a[v]||0)+1;return a;},{Present:0,Absent:0,Leave:0,'Half Day':0}),[visibleStudents,attendance]);
  const markAll=status=>{const next={...attendance};visibleStudents.forEach(s=>{next[s.id]=status;});setAttendance(next);};
  const saveAttendance=async()=>{
    if(!schoolId){setError('Select a school before marking attendance.');return;}
    if(!visibleStudents.length){setError('No admitted students found in this class/section.');return;}
    setSaving(true);setError('');setMessage('');
    try{
      const batch=writeBatch(db);
      visibleStudents.forEach(s=>{
        const recordId=`${schoolId}_${date}_${s.id}`;
        const ref=doc(db,'attendanceRecords',recordId);
        const record={schoolId,studentId:s.id,studentName:s.name||'',admissionNo:s.admissionNo||'',className:s.className||'',section:s.section||'',date,status:attendance[s.id]||'Present',markedBy:profile?.uid||profile?.email||profile?.displayName||'',markedByRole:profile?.role||'',updatedAt:serverTimestamp()};
        if(!saved[s.id])record.createdAt=serverTimestamp();
        batch.set(ref,record,{merge:true});
      });
      await batch.commit();
      const next={...saved};visibleStudents.forEach(s=>{next[s.id]={status:attendance[s.id]||'Present',recordId:`${schoolId}_${date}_${s.id}`};});
      setSaved(next);setMessage(`Attendance saved for ${visibleStudents.length} students.`);
    }catch(e){setError(errorText(e));}
    finally{setSaving(false);}
  };
  const loadMonthlyReport=async()=>{
    if(!schoolId)return;
    setReportLoading(true);setError('');setMessage('');
    try{
      const month=date.slice(0,7),start=`${month}-01`,end=`${month}-31`;
      const constraints=[where('schoolId','==',schoolId),where('date','>=',start),where('date','<=',end)];
      if(isTeacher&&className)constraints.push(where('className','==',className));
      const q=query(collection(db,'attendanceRecords'),...constraints);
      const snap=await getDocs(q);setReport(snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>!className||r.className===className));
    }catch(e){setError(errorText(e));}
    finally{setReportLoading(false);}
  };
  const exportCsv=()=>{
    const rows=[['Date','Student Name','Admission No.','Class','Section','Status'],...report.map(r=>[r.date,r.studentName,r.admissionNo,r.className,r.section,r.status])];
    const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    const blob=new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`attendance-${date.slice(0,7)}.csv`;a.click();URL.revokeObjectURL(url);
  };

  return <section className="workspace">
    <div className="section-head"><div><h2>✅ Attendance Management</h2><p>{schoolName||'School'} · Students are loaded directly from Admission / Students records.</p></div><button style={styles.secondary} onClick={onBack}>← Dashboard</button></div>
    {studentsLoading&&<p style={styles.muted}>Loading admitted students…</p>}
    {!schoolId&&<p className="pending">Please select one school from the top menu before using Attendance.</p>}
    {error&&<p style={{background:'#fee2e2',color:'#991b1b',padding:11,borderRadius:8}}>{error}</p>}
    {message&&<p style={{background:'#dcfce7',color:'#166534',padding:11,borderRadius:8}}>{message}</p>}
    <div style={styles.panel}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
        <label style={{fontSize:13,fontWeight:600}}>Attendance Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...styles.field,display:'block',marginTop:6}}/></label>
        <label style={{fontSize:13,fontWeight:600}}>Class<select value={className} onChange={e=>setClassName(e.target.value)} style={{...styles.field,display:'block',marginTop:6}}><option value="">Select Class</option>{classOptions.map(c=><option key={c}>{c}</option>)}</select></label>
        <label style={{fontSize:13,fontWeight:600}}>Section<select value={section} onChange={e=>setSection(e.target.value)} style={{...styles.field,display:'block',marginTop:6}}><option>All Sections</option>{sectionOptions.map(s=><option key={s}>{s}</option>)}</select></label>
        <label style={{fontSize:13,fontWeight:600}}>Search Student<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name / Admission No." style={{...styles.field,display:'block',marginTop:6}}/></label>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:10,marginBottom:14}}>
      {[['Total',visibleStudents.length,'#eff6ff'],['Present',counts.Present||0,'#dcfce7'],['Absent',counts.Absent||0,'#fee2e2'],['Leave',counts.Leave||0,'#fef3c7'],['Half Day',counts['Half Day']||0,'#dbeafe']].map(([label,value,bg])=><div key={label} style={{background:bg,padding:13,borderRadius:10}}><div style={{fontSize:12,color:'#475569'}}>{label}</div><strong style={{fontSize:23}}>{value}</strong></div>)}
    </div>
    <div style={styles.panel}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12}}><div><b>Student Attendance</b><div style={styles.muted}>One record per student per date · Existing attendance can be edited and saved again.</div></div><div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button style={styles.secondary} onClick={()=>markAll('Present')}>Mark All Present</button><button style={styles.secondary} onClick={()=>markAll('Absent')}>Mark All Absent</button></div></div>
      <div className="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th>Class / Section</th><th>Attendance</th></tr></thead><tbody>
        {visibleStudents.map((s,i)=><tr key={s.id}><td>{i+1}</td><td><b>{s.name||'Unnamed Student'}</b><div style={styles.muted}>{s.fatherName||''}</div></td><td>{s.admissionNo||'—'}</td><td>{s.className||'—'} / {s.section||'—'}</td><td><select value={attendance[s.id]||'Present'} onChange={e=>setAttendance(p=>({...p,[s.id]:e.target.value}))} style={{...styles.field,minWidth:125,background:statusColors[attendance[s.id]||'Present']}}>{statuses.map(v=><option key={v}>{v}</option>)}</select></td></tr>)}
        {!loading&&!visibleStudents.length&&<tr><td colSpan="5" style={{textAlign:'center',padding:24}}>No admitted students found for this class/section.</td></tr>}
      </tbody></table></div>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button style={styles.primary} disabled={saving||loading||!visibleStudents.length||!schoolId} onClick={saveAttendance}>{saving?'Saving…':'Save / Update Attendance'}</button></div>
    </div>
    <div style={styles.panel}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><div><b>Monthly Attendance Report</b><div style={styles.muted}>Report month is selected from the Attendance Date above.</div></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={styles.secondary} onClick={loadMonthlyReport} disabled={reportLoading}>{reportLoading?'Loading…':'View Monthly Report'}</button><button style={styles.secondary} onClick={exportCsv} disabled={!report.length}>Download Excel-compatible CSV</button></div></div>
      {report.length>0&&<><p style={styles.muted}>Records: {report.length} · Class: {className||'All'}</p><div className="table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Admission No.</th><th>Class</th><th>Status</th></tr></thead><tbody>{report.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.studentName}</td><td>{r.admissionNo||'—'}</td><td>{r.className} {r.section}</td><td>{r.status}</td></tr>)}</tbody></table></div></>}
      {report.length===0&&<p style={styles.muted}>Select a date in the required month, then click View Monthly Report.</p>}
    </div>
  </section>;
}
