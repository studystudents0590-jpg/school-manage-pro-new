import React, {useEffect, useMemo, useState} from 'react';
import {collection, doc, getDoc, getDocs, query, where, setDoc, addDoc, serverTimestamp, updateDoc, arrayUnion} from 'firebase/firestore';
import {auth, db} from './firebase';

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const months=['April','May','June','July','August','September','October','November','December','January','February','March'];
const academicYear=(start)=>`${start}-${String(start+1).slice(-2)}`;
const rangeForYear=y=>({start:`${y}-04-01`,end:`${y+1}-03-31`});
const rangeForMonth=value=>{const [y,m]=value.split('-').map(Number);const last=new Date(y,m,0).getDate();return {start:`${y}-${String(m).padStart(2,'0')}-01`,end:`${y}-${String(m).padStart(2,'0')}-${last}`};};
const pct=(n,total)=>total?Math.round(n*100/total):0;
const statuses=['Present','Absent','Leave','Half Day'];
const palette={Present:'#dcfce7',Absent:'#fee2e2',Leave:'#fef3c7','Half Day':'#dbeafe','Not Marked':'#f1f5f9'};
const field={width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8,background:'#fff',boxSizing:'border-box'};
const btn={border:0,borderRadius:8,padding:'10px 13px',fontWeight:650,cursor:'pointer',background:'#eef2ff',color:'#1e40af'};
const primary={...btn,background:'#2457d6',color:'#fff'};
const panel={background:'#fff',border:'1px solid #e2e8f0',borderRadius:13,padding:15,marginBottom:14};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default function TeacherAttendanceModule({schoolId,schoolName,profile,isTeacher=false,onBack}){
 const [teachers,setTeachers]=useState([]),[records,setRecords]=useState([]),[applications,setApplications]=useState([]);
 const [date,setDate]=useState(today()),[type,setType]=useState('daily'),[month,setMonth]=useState(today().slice(0,7)),[year,setYear]=useState(String(new Date().getMonth()>=3?new Date().getFullYear():new Date().getFullYear()-1));
 const [draft,setDraft]=useState({}),[search,setSearch]=useState(''),[filter,setFilter]=useState('All'),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [selected,setSelected]=useState(null),[leaveFrom,setLeaveFrom]=useState(today()),[leaveTo,setLeaveTo]=useState(today()),[leaveReason,setLeaveReason]=useState(''),[myTeacher,setMyTeacher]=useState(null);
 const adminUid=auth.currentUser?.uid||'';
 useEffect(()=>{if(!schoolId){setTeachers([]);setRecords([]);setApplications([]);setLoading(false);setError('Pehle ek school select karein.');return;}
  let live=true;setLoading(true);setError('');
  const loadData=isTeacher
   ? Promise.all([
      profile?.teacherId?getDoc(doc(db,'teachers',profile.teacherId)):Promise.resolve(null),
      profile?.teacherId?getDocs(query(collection(db,'teacherLeaveApplications'),where('schoolId','==',schoolId),where('teacherId','==',profile.teacherId))):Promise.resolve({docs:[]})
     ]).then(([td,ls])=>{if(!live)return;setMyTeacher(td?.exists()?{id:td.id,...td.data()}:null);setApplications(ls.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));setLoading(false);})
   : Promise.all([
      getDocs(query(collection(db,'teachers'),where('schoolId','==',schoolId))),
      getDocs(query(collection(db,'teacherAttendance'),where('schoolId','==',schoolId))),
      getDocs(query(collection(db,'teacherLeaveApplications'),where('schoolId','==',schoolId)))
     ]).then(([ts,rs,ls])=>{if(!live)return;setTeachers(ts.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.status==='Active'));setRecords(rs.docs.map(d=>({id:d.id,...d.data()})));setApplications(ls.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));setLoading(false);});
  loadData.catch(e=>{if(!live)return;setError('Data load nahi hua: '+e.message);setLoading(false);});
  return ()=>{live=false;};
 },[schoolId]);
 const selectedRange=useMemo(()=>type==='daily'?{start:date,end:date}:type==='monthly'?rangeForMonth(month):rangeForYear(Number(year)),[type,date,month,year]);
 const periodRecords=useMemo(()=>records.filter(r=>r.date>=selectedRange.start&&r.date<=selectedRange.end),[records,selectedRange]);
 const dailyRows=useMemo(()=>teachers.map(t=>{const rec=records.find(r=>r.teacherId===t.id&&r.date===date);return {...t,status:rec?.status||'Not Marked',record:rec};}),[teachers,records,date]);
 useEffect(()=>{setDraft(Object.fromEntries(dailyRows.map(t=>[t.id,t.status])));},[dailyRows]);
 const counts=useMemo(()=>{const c={Present:0,Absent:0,Leave:0,'Half Day':0,'Not Marked':0};if(type==='daily'){dailyRows.forEach(t=>c[t.status]=(c[t.status]||0)+1);}else{periodRecords.forEach(r=>c[r.status]=(c[r.status]||0)+1);c['Not Marked']=Math.max(0,teachers.length* Math.max(1,type==='monthly'?new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate():365)-periodRecords.length);}return c;},[type,dailyRows,periodRecords,teachers.length,month]);
 const total=type==='daily'?teachers.length:periodRecords.length;
 const filtered=dailyRows.filter(t=>(filter==='All'||t.status===filter)&&`${t.name} ${t.employeeId} ${t.phone}`.toLowerCase().includes(search.toLowerCase()));
 const saveDay=async()=>{if(!schoolId)return;setSaving(true);setError('');setMessage('');try{const writes=teachers.filter(t=>statuses.includes(draft[t.id])).map(t=>{const id=`${encodeURIComponent(schoolId)}_${date}_${encodeURIComponent(t.id)}`;const old=records.find(r=>r.teacherId===t.id&&r.date===date);const next=draft[t.id];return setDoc(doc(db,'teacherAttendance',id),{schoolId,schoolName:schoolName||'',teacherId:t.id,teacherName:t.name||'',employeeId:t.employeeId||'',date,status:next,markedBy:adminUid,markedByRole:profile?.role||'admin',updatedAt:serverTimestamp(),history:arrayUnion({status:next,changedBy:adminUid,changedAt:new Date().toISOString(),previousStatus:old?.status||'Not Marked'})},{merge:true});});await Promise.all(writes);const snap=await getDocs(query(collection(db,'teacherAttendance'),where('schoolId','==',schoolId)));setRecords(snap.docs.map(d=>({id:d.id,...d.data()})));setMessage('Teacher attendance save/update ho gayi.');}catch(e){setError('Save nahi hua: '+e.message);}finally{setSaving(false);}};
 const setAll=status=>setDraft(Object.fromEntries(teachers.map(t=>[t.id,status])));
 const decideApplication=async(app,status)=>{try{await updateDoc(doc(db,'teacherLeaveApplications',app.id),{status,reviewedBy:adminUid,reviewedAt:serverTimestamp()});setApplications(prev=>prev.map(x=>x.id===app.id?{...x,status}:x));setMessage(`Leave application ${status}.`);}catch(e){setError('Application update nahi hui: '+e.message);}};
 const submitLeave=async e=>{e.preventDefault();if(!schoolId||!profile?.teacherId||!myTeacher){setError('Teacher account link nahi mila. School Admin se contact karein.');return;}if(!leaveReason.trim()){setError('Leave ka reason likhein.');return;}if(leaveTo<leaveFrom){setError('To Date, From Date se pehle nahi ho sakti.');return;}try{setSaving(true);setError('');await addDoc(collection(db,'teacherLeaveApplications'),{schoolId,schoolName:schoolName||'',teacherId:profile.teacherId,teacherName:myTeacher.name||profile.displayName||'Teacher',employeeId:myTeacher.employeeId||'',fromDate:leaveFrom,toDate:leaveTo,reason:leaveReason.trim(),status:'Pending',createdAt:serverTimestamp()});setLeaveReason('');const snap=await getDocs(query(collection(db,'teacherLeaveApplications'),where('schoolId','==',schoolId),where('teacherId','==',profile.teacherId)));setApplications(snap.docs.map(d=>({id:d.id,...d.data()})));setMessage('Leave application Admin ko bhej di gayi hai.');}catch(e){setError('Leave application submit nahi hui: '+e.message);}finally{setSaving(false);}};
 const exportCsv=()=>{const rows=[['Teacher','Employee ID','Date','Status'],...periodRecords.map(r=>[r.teacherName,r.employeeId,r.date,r.status])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=`teacher-attendance-${type}-${date}.csv`;a.click();URL.revokeObjectURL(a.href);};
 const printReport=()=>{const w=window.open('','_blank');if(!w)return;const rows=periodRecords.map(r=>`<tr><td>${esc(r.teacherName)}</td><td>${esc(r.employeeId)}</td><td>${esc(r.date)}</td><td>${esc(r.status)}</td></tr>`).join('');w.document.write(`<html><head><title>Teacher Attendance</title><style>body{font-family:Arial;padding:24px}h2{text-align:center}table{width:100%;border-collapse:collapse}td,th{border:1px solid #888;padding:8px;text-align:left}</style></head><body><h2>${esc(schoolName||'School')}<br>Teacher Attendance</h2><p>${esc(type.toUpperCase())}: ${esc(selectedRange.start)} to ${esc(selectedRange.end)}</p><p>Present: ${counts.Present||0} | Absent: ${counts.Absent||0} | Leave: ${counts.Leave||0} | Half Day: ${counts['Half Day']||0}</p><table><tr><th>Teacher</th><th>Employee ID</th><th>Date</th><th>Status</th></tr>${rows}</table></body></html>`);w.document.close();w.print();};
 const card=(label,value,color)=> <div style={{background:color,borderRadius:11,padding:13,minWidth:0}}><small style={{color:'#475569'}}>{label}</small><strong style={{display:'block',fontSize:25,color:'#172b45'}}>{value}</strong></div>;
 if(isTeacher)return <div style={{padding:4}}>
  <section style={panel}><h2 style={{marginTop:0}}>🗓️ My Leave Applications</h2><p style={{color:'#64748b'}}>Aap apni attendance khud Present mark nahi kar sakte. Chhutti ke liye application bhejein; Admin approve ya reject karega.</p>
   {error&&<p style={{color:'#b91c1c'}}>{error}</p>}{message&&<p style={{color:'#166534'}}>{message}</p>}
   {loading?<p>Loading...</p>:!myTeacher?<p>Teacher login record nahi mila. Admin se teacher account link karwayein.</p>:<form onSubmit={submitLeave} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
    <label>From Date<input required type="date" style={field} value={leaveFrom} onChange={e=>setLeaveFrom(e.target.value)}/></label>
    <label>To Date<input required type="date" style={field} value={leaveTo} min={leaveFrom} onChange={e=>setLeaveTo(e.target.value)}/></label>
    <label style={{gridColumn:'1/-1'}}>Reason<textarea required style={{...field,minHeight:85}} value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} placeholder="Leave ka reason likhein"/></label>
    <div><button type="submit" style={primary} disabled={saving}>{saving?'Sending...':'Submit Leave Application'}</button></div>
   </form>}
  </section>
  <section style={panel}><h3 style={{marginTop:0}}>My Application History</h3>{applications.length?applications.map(a=><div key={a.id} style={{border:'1px solid #e2e8f0',borderRadius:9,padding:12,marginTop:9}}><b>{a.fromDate} to {a.toDate}</b><p style={{margin:'6px 0'}}>{a.reason}</p><span style={{background:(a.status||'Pending')==='Approved'?'#dcfce7':(a.status||'Pending')==='Rejected'?'#fee2e2':'#fef3c7',padding:'4px 9px',borderRadius:12}}>{a.status||'Pending'}</span></div>):<p style={{color:'#64748b'}}>Abhi koi application nahi hai.</p>}</section>
 </div>;
 return <div style={{padding:4}}>
  <div style={{...panel,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 5px'}}>👩‍🏫 Teacher & Staff Attendance</h2><small style={{color:'#64748b'}}>{schoolName||'Selected School'} · Admin controlled attendance</small></div><button style={btn} onClick={onBack}>← Dashboard</button></div>
  {error&&<div style={{...panel,background:'#fee2e2',color:'#991b1b'}}>{error}</div>}{message&&<div style={{...panel,background:'#dcfce7',color:'#166534'}}>{message}</div>}
  <section style={panel}>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
    <label>Report Type<select style={field} value={type} onChange={e=>setType(e.target.value)}><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="yearly">Academic Year</option></select></label>
    {type==='daily'&&<label>Attendance Date<input type="date" style={field} value={date} onChange={e=>setDate(e.target.value)}/></label>}
    {type==='monthly'&&<label>Month<select style={field} value={month} onChange={e=>setMonth(e.target.value)}>{Array.from({length:12},(_,i)=>{const y=Number(year)+(i<9?0:1);const m=[4,5,6,7,8,9,10,11,12,1,2,3][i];return <option key={`${y}-${m}`} value={`${y}-${String(m).padStart(2,'0')}`}>{months[i]} {y}</option>;})}</select></label>}
    {type==='yearly'&&<label>Academic Year<select style={field} value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:8},(_,i)=>{const y=new Date().getFullYear()-4+i;return <option key={y} value={y}>{academicYear(y)}</option>;})}</select></label>}
   </div>
  </section>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:10,marginBottom:14}}>
   {card('Total Teachers',teachers.length,'#eff6ff')}{card('Present',counts.Present||0,'#dcfce7')}{card('Absent',counts.Absent||0,'#fee2e2')}{card('Leave',counts.Leave||0,'#fef3c7')}{card('Half Day',counts['Half Day']||0,'#dbeafe')}{card('Not Marked',type==='daily'?(counts['Not Marked']||0):Math.max(0,teachers.length-(new Set(periodRecords.map(r=>r.teacherId))).size),'#f1f5f9')}
  </div>
  <div style={{...panel,display:'flex',gap:8,flexWrap:'wrap'}}><button style={btn} onClick={printReport}>PDF / Print Report</button><button style={btn} onClick={exportCsv}>Download CSV</button><button style={btn} onClick={()=>setAll('Present')}>Mark All Present</button><button style={btn} onClick={()=>setAll('Absent')}>Mark All Absent</button></div>
  <section style={panel}>
   <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}><div><h3 style={{margin:'0 0 5px'}}>Daily Teacher Attendance</h3><small style={{color:'#64748b'}}>Teachers cannot mark themselves Present. Only Admin can save or change attendance.</small></div><button style={primary} disabled={saving||loading} onClick={saveDay}>{saving?'Saving...':'Save / Update Attendance'}</button></div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:9,margin:'14px 0'}}><input style={field} placeholder="Search teacher / Employee ID" value={search} onChange={e=>setSearch(e.target.value)}/><select style={field} value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{[...statuses,'Not Marked'].map(s=><option key={s}>{s}</option>)}</select></div>
   {loading?<p>Loading teachers...</p>:!teachers.length?<p>No active teachers found. Add teachers in Teachers & Staff first.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:650}}><thead><tr style={{background:'#f1f5f9',textAlign:'left'}}>{['#','Teacher','Employee ID','Status','Action'].map(x=><th key={x} style={{padding:10}}>{x}</th>)}</tr></thead><tbody>{filtered.map((t,i)=><tr key={t.id} style={{borderBottom:'1px solid #e2e8f0'}}><td style={{padding:10}}>{i+1}</td><td style={{padding:10}}><b>{t.name}</b><div style={{fontSize:12,color:'#64748b'}}>{t.designation||'Teacher'}</div></td><td style={{padding:10}}>{t.employeeId||'—'}</td><td style={{padding:10}}><span style={{background:palette[draft[t.id]]||palette['Not Marked'],padding:'5px 8px',borderRadius:15,fontSize:12}}>{draft[t.id]||'Not Marked'}</span></td><td style={{padding:10}}><select style={{...field,minWidth:130}} value={draft[t.id]||'Not Marked'} onChange={e=>setDraft(p=>({...p,[t.id]:e.target.value}))}><option value="Not Marked">Not Marked</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div>}
  </section>
  <section style={panel}>
   <h3 style={{marginTop:0}}>Leave Applications</h3><small style={{color:'#64748b'}}>Teacher applications appear here for Admin approval/rejection.</small>
   {!applications.length?<p style={{color:'#64748b'}}>No leave applications found.</p>:applications.map(a=><div key={a.id} style={{border:'1px solid #e2e8f0',borderRadius:9,padding:12,marginTop:10}}><b>{a.teacherName||'Teacher'}</b> · {a.fromDate||a.date||'—'} to {a.toDate||a.date||'—'}<p style={{margin:'6px 0'}}>{a.reason||'No reason provided'}</p><small>Status: {a.status||'Pending'}</small>{(a.status||'Pending')==='Pending'&&<div style={{display:'flex',gap:8,marginTop:9}}><button style={primary} onClick={()=>decideApplication(a,'Approved')}>Approve</button><button style={{...btn,background:'#fee2e2',color:'#b91c1c'}} onClick={()=>decideApplication(a,'Rejected')}>Reject</button></div>}</div>)}
  </section>
  <section style={panel}><h3 style={{marginTop:0}}>Attendance History</h3><p style={{color:'#64748b',fontSize:12}}>Selected period: {selectedRange.start} to {selectedRange.end}. Admin changes are recorded with who changed them and when.</p><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}><thead><tr style={{background:'#f1f5f9',textAlign:'left'}}><th style={{padding:9}}>Teacher</th><th style={{padding:9}}>Date</th><th style={{padding:9}}>Status</th><th style={{padding:9}}>Marked By</th></tr></thead><tbody>{periodRecords.map(r=><tr key={r.id} style={{borderBottom:'1px solid #e2e8f0'}}><td style={{padding:9}}>{r.teacherName}</td><td style={{padding:9}}>{r.date}</td><td style={{padding:9}}>{r.status}</td><td style={{padding:9}}>{r.markedByRole||'Admin'}</td></tr>)}{!periodRecords.length&&<tr><td colSpan="4" style={{padding:12,color:'#64748b'}}>No attendance records in this period.</td></tr>}</tbody></table></div></section>
 </div>;
}
