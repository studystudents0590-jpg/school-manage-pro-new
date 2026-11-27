import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getClassOptionsWithLegacy, getClassLabel } from './classSystem';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const styles = {
  panel:{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:16,marginBottom:16},
  field:{width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:8,background:'#fff',boxSizing:'border-box'},
  primary:{background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 15px',fontWeight:700,cursor:'pointer'},
  secondary:{background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'},
  muted:{fontSize:12,color:'#64748b'},
  stat:{padding:14,borderRadius:11,minWidth:0}
};
const statuses=['Present','Absent','Leave','Half Day'];
const statusColors={Present:'#dcfce7',Absent:'#fee2e2',Leave:'#fef3c7','Half Day':'#dbeafe'};
const errorText=e=>e?.code==='permission-denied'?'Firestore permission denied. Check the Attendance read/write rules for this account.':e?.message||'Something went wrong.';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthOf=d=>(d||'').slice(0,7);
const academicYearStart=d=>{const [y,m]=String(d||today()).split('-').map(Number);return m>=4?y:y-1;};
const academicYearLabel=y=>`${y}-${String(y+1).slice(-2)}`;
const academicYearRange=y=>({start:`${y}-04-01`,end:`${y+1}-03-31`});
const statusCounts=rows=>rows.reduce((a,r)=>{const s=r.status||'Present';a[s]=(a[s]||0)+1;return a;},{Present:0,Absent:0,Leave:0,'Half Day':0});
const percent=(n,total)=>total?Math.round(n*100/total):0;
const pctLabel=(n,total)=>`${percent(n,total)}%`;

export default function AttendanceModule({schoolId,schoolName,profile,students=[],studentsLoading=false,isTeacher=false,onBack}) {
  const [date,setDate]=useState(today());
  const [className,setClassName]=useState('');
  const [section,setSection]=useState('All Sections');
  const [attendance,setAttendance]=useState({});
  const [saved,setSaved]=useState({});
  const [records,setRecords]=useState([]);
  const [studentLeaveApps,setStudentLeaveApps]=useState([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [reportLoading,setReportLoading]=useState(false);
  const [reportReady,setReportReady]=useState(false);
  const [search,setSearch]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [detailClass,setDetailClass]=useState('');
  const [detailStatus,setDetailStatus]=useState('All');
  const [historyStudent,setHistoryStudent]=useState(null);
  const [view,setView]=useState('overview');
  const [periodType,setPeriodType]=useState('daily');
  const [searchMonth,setSearchMonth]=useState(monthOf(today()));
  const [searchYear,setSearchYear]=useState(String(academicYearStart(today())));
  const [absenceDetails,setAbsenceDetails]=useState({});
  const [globalStudentSearch,setGlobalStudentSearch]=useState('');

  // Reason/application controls are intentionally limited by role.
  const isSchoolAdmin = profile?.role === 'schooladmin';
  const isPlatformSuperAdmin = profile?.role === 'superadmin';
  const canEditReason = isSchoolAdmin || (isTeacher && profile?.permissions?.Attendance === true);
  const canReviewApplication = isSchoolAdmin;

  const activeStudents=useMemo(()=>students.filter(s=>!['inactive','left','transferred','deleted'].includes(String(s.status||'').toLowerCase()) && s.isActive!==false),[students]);
  const classOptions=useMemo(()=>getClassOptionsWithLegacy(activeStudents.map(s=>s.className)).map(option=>option.value),[activeStudents]);
  useEffect(()=>{if(!className&&classOptions.length)setClassName(classOptions[0]);else if(className&&!classOptions.includes(className))setClassName(classOptions[0]||'');},[classOptions,className]);
  const sectionOptions=useMemo(()=>[...new Set(activeStudents.filter(s=>s.className===className).map(s=>s.section).filter(Boolean))].sort(),[activeStudents,className]);
  useEffect(()=>{if(section!=='All Sections'&&!sectionOptions.includes(section))setSection('All Sections');},[sectionOptions,section]);

  const selectedStudents=useMemo(()=>activeStudents.filter(s=>s.className===className&&(section==='All Sections'||(s.section||'')===section)&&(`${s.name||''} ${s.admissionNo||''} ${s.fatherName||''} ${s.rollNo||''}`).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(a.name||'').localeCompare(b.name||'')),[activeStudents,className,section,search]);
  const selectedDayRecords=useMemo(()=>records.filter(r=>r.date===date),[records,date]);
  const recordMap=useMemo(()=>{const m={};selectedDayRecords.forEach(r=>{m[r.studentId]=r;});return m;},[selectedDayRecords]);
  const leaveApplicationMap=useMemo(()=>{const m={};studentLeaveApps.filter(a=>(a.fromDate||'')<=date&&(a.toDate||'')>=date).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).forEach(a=>{if(!m[a.studentId])m[a.studentId]=a;});return m;},[studentLeaveApps,date]);
  const visibleRows=useMemo(()=>selectedStudents.map(s=>({...s,status:attendance[s.id]||recordMap[s.id]?.status||'Present'})),[selectedStudents,attendance,recordMap]);
  const counts=useMemo(()=>statusCounts(visibleRows),[visibleRows]);

  const loadRecords=useCallback(async()=>{
    if(!schoolId){setRecords([]);setSaved({});return;}
    setLoading(true);setError('');
    try{
      // Teacher reads are constrained to the exact classes assigned by the School Admin;
      // School Admin reads remain school-wide. This also satisfies Firestore query rules.
      const assignedClasses=Array.isArray(profile?.classes)?profile.classes.filter(Boolean):[];
      let attendanceSnaps=[];
      if(isTeacher){
        for(let i=0;i<assignedClasses.length;i+=30){
          attendanceSnaps.push(await getDocs(query(collection(db,'attendanceRecords'),where('schoolId','==',schoolId),where('className','in',assignedClasses.slice(i,i+30)))));
        }
      } else {
        // Super Admin keeps the existing attendance overview/read access, but never loads leave applications.
        attendanceSnaps=[await getDocs(query(collection(db,'attendanceRecords'),where('schoolId','==',schoolId)))];
      }
      const list=attendanceSnaps.flatMap(snap=>snap.docs.map(d=>({id:d.id,...d.data()})));
      setRecords(list);
      // Parent-submitted leave applications are likewise limited to assigned classes for teachers.
      if(isTeacher && assignedClasses.length){
        const appQueries=[];
        for(let i=0;i<assignedClasses.length;i+=30){
          appQueries.push(getDocs(query(collection(db,'studentLeaveApplications'),where('schoolId','==',schoolId),where('className','in',assignedClasses.slice(i,i+30)))));
        }
        const appSnaps=await Promise.all(appQueries);
        setStudentLeaveApps(appSnaps.flatMap(x=>x.docs.map(d=>({id:d.id,...d.data()}))));
      } else if(!isTeacher && !isPlatformSuperAdmin){
        const appSnap=await getDocs(query(collection(db,'studentLeaveApplications'),where('schoolId','==',schoolId)));
        setStudentLeaveApps(appSnap.docs.map(d=>({id:d.id,...d.data()})));
      } else setStudentLeaveApps([]);
      const day={};list.filter(r=>r.date===date).forEach(r=>{day[r.studentId]={status:r.status||'Present',recordId:r.id};});
      setSaved(day);
      setAttendance(prev=>{const next={...prev};activeStudents.forEach(s=>{if(s.className===className)next[s.id]=day[s.id]?.status||'Present';});return next;});
    }catch(e){setError(errorText(e));}
    finally{setLoading(false);}
  },[schoolId,date,activeStudents,className,isTeacher,profile]);

  useEffect(()=>{loadRecords();},[loadRecords]);
  useEffect(()=>{setAttendance(prev=>{const next={...prev};selectedStudents.forEach(s=>{next[s.id]=recordMap[s.id]?.status||'Present';});return next;});},[selectedStudents,recordMap]);

  const schoolDayRows=useMemo(()=>{
    const byId=new Map(selectedDayRecords.map(r=>[r.studentId,r]));
    return activeStudents.map(s=>{const r=byId.get(s.id);return r?{...s,status:r.status||'Present',date:r.date}:null;}).filter(Boolean);
  },[activeStudents,selectedDayRecords]);
  const overview=useMemo(()=>classOptions.map(c=>{
    const classStudents=activeStudents.filter(s=>s.className===c);
    const classRecords=schoolDayRows.filter(r=>r.className===c);
    const n=statusCounts(classRecords);
    const marked=classRecords.length;
    return {className:c,total:classStudents.length,marked,present:n.Present||0,absent:n.Absent||0,leave:n.Leave||0,half:n['Half Day']||0,notMarked:Math.max(0,classStudents.length-marked),percentage:percent(n.Present||0,marked)};
  }),[classOptions,activeStudents,schoolDayRows]);
  const schoolCounts=useMemo(()=>statusCounts(schoolDayRows),[schoolDayRows]);
  const markAll=status=>{const next={...attendance};selectedStudents.forEach(s=>{next[s.id]=status;});setAttendance(next);};
  const saveAttendance=async()=>{
    if(!schoolId){setError('Select a school before marking attendance.');return;}
    if(!selectedStudents.length){setError('No admitted students found in this class/section.');return;}
    setSaving(true);setError('');setMessage('');
    try{
      const batch=writeBatch(db);
      selectedStudents.forEach(s=>{
        const recordId=`${schoolId}_${date}_${s.id}`;
        const ref=doc(db,'attendanceRecords',recordId);
        const extra=absenceDetails[s.id]||{};
        const record={schoolId,studentId:s.id,studentName:s.name||'',admissionNo:s.admissionNo||'',className:s.className||'',section:s.section||'',date,status:attendance[s.id]||'Present',absenceReason:extra.reason??recordMap[s.id]?.absenceReason??'',applicationStatus:canReviewApplication?(extra.applicationStatus??recordMap[s.id]?.applicationStatus??'Not Submitted'):(recordMap[s.id]?.applicationStatus||'Not Submitted'),applicationText:extra.applicationText??recordMap[s.id]?.applicationText??'',markedBy:profile?.uid||profile?.email||profile?.displayName||'',markedByRole:profile?.role||'',updatedAt:serverTimestamp()};
        if(!saved[s.id])record.createdAt=serverTimestamp();
        batch.set(ref,record,{merge:true});
      });
      await batch.commit();
      setMessage(`Attendance saved for ${selectedStudents.length} students.`);
      await loadRecords();
    }catch(e){setError(errorText(e));}
    finally{setSaving(false);}
  };

  const updateAttendanceReason=async(record,changes)=>{
    if(!record?.id || (!isSchoolAdmin && !(isTeacher && profile?.permissions?.Attendance===true)) || isPlatformSuperAdmin)return;
    setError('');setMessage('');
    try{
      await updateDoc(doc(db,'attendanceRecords',record.id),{...changes,updatedAt:serverTimestamp()});
      setRecords(prev=>prev.map(r=>r.id===record.id?{...r,...changes}:r));
      setMessage('Attendance reason updated.');
    }catch(e){setError(errorText(e));}
  };

  const updateLeaveApplication=async(app,changes)=>{
    if(!app?.id || (!isSchoolAdmin && !(isTeacher && profile?.permissions?.Attendance===true)) || isPlatformSuperAdmin)return;
    setError('');setMessage('');
    try{
      await updateDoc(doc(db,'studentLeaveApplications',app.id),{...changes,updatedAt:serverTimestamp(),updatedBy:profile?.uid||profile?.teacherId||''});
      setStudentLeaveApps(prev=>prev.map(a=>a.id===app.id?{...a,...changes}:a));
      setMessage(isSchoolAdmin?'Leave application updated.':'Application reason updated.');
    }catch(e){setError(errorText(e));}
  };

  const loadMonthlyReport=async()=>{
    setReportLoading(true);setError('');setMessage('');
    try{await loadRecords();setReportReady(true);setView('reports');}
    catch(e){setError(errorText(e));}
    finally{setReportLoading(false);}
  };
  const monthRecords=useMemo(()=>records.filter(r=>monthOf(r.date)===monthOf(date)&&(!isTeacher||r.className===className)),[records,date,isTeacher,className]);
  const monthSummary=useMemo(()=>statusCounts(monthRecords),[monthRecords]);
  const academicYear=Number(searchYear)||academicYearStart(date);
  const yearRange=academicYearRange(academicYear);
  const periodRecords=useMemo(()=>{
    let rows=records;
    if(periodType==='daily') rows=rows.filter(r=>r.date===date);
    else if(periodType==='monthly') rows=rows.filter(r=>monthOf(r.date)===searchMonth);
    else rows=rows.filter(r=>r.date>=yearRange.start&&r.date<=yearRange.end);
    if(isTeacher) rows=rows.filter(r=>activeStudents.some(s=>s.id===r.studentId));
    return rows;
  },[records,periodType,date,searchMonth,yearRange.start,yearRange.end,isTeacher,activeStudents]);
  const periodSummary=useMemo(()=>statusCounts(periodRecords),[periodRecords]);
  const classDetailStudents=useMemo(()=>{
    const list=activeStudents.filter(s=>s.className===detailClass);
    return list.map(s=>{
      const rows=periodRecords.filter(r=>r.className===detailClass&&r.studentId===s.id);
      if(periodType==='daily'){
        const r=rows[0];
        return {...s,...(r||{}),status:r?.status||'Not Marked',recordsCount:rows.length};
      }
      const n=statusCounts(rows); const total=rows.length;
      return {...s,status:total?`Present ${n.Present||0} · Absent ${n.Absent||0}`:'No Record',recordsCount:total,periodPresent:n.Present||0,periodAbsent:n.Absent||0,periodLeave:n.Leave||0,periodHalf:n['Half Day']||0,periodPercent:percent(n.Present||0,total),absenceReason:rows.filter(r=>r.absenceReason).map(r=>r.absenceReason).join(', '),applicationStatus:rows.some(r=>r.applicationStatus==='Submitted'||r.applicationStatus==='Approved')?'Application Submitted':'',applicationText:rows.filter(r=>r.applicationText).map(r=>r.applicationText).join('; ')};
    }).filter(s=>detailStatus==='All'||(periodType==='daily'?s.status===detailStatus:detailStatus==='Present'?s.periodPresent>0:detailStatus==='Absent'?s.periodAbsent>0:detailStatus==='Leave'?s.periodLeave>0:detailStatus==='Half Day'?s.periodHalf>0:detailStatus==='No Record'?!s.recordsCount:false));
  },[activeStudents,detailClass,periodRecords,periodType,detailStatus]);

  const periodDenominator=periodType==='daily'?activeStudents.length:periodRecords.length;
  const globalSearchResults=useMemo(()=>{const q=globalStudentSearch.trim().toLowerCase();if(!q)return [];return activeStudents.filter(s=>`${s.name||''} ${s.admissionNo||''} ${s.fatherName||''} ${s.rollNo||''}`.toLowerCase().includes(q)).slice(0,20);},[activeStudents,globalStudentSearch]);
  const periodOverview=useMemo(()=>classOptions.map(c=>{
    const pupils=activeStudents.filter(s=>s.className===c);
    const rows=periodRecords.filter(r=>r.className===c);
    const n=statusCounts(rows); const marked=rows.length;
    return {className:c,total:pupils.length,marked,present:n.Present||0,absent:n.Absent||0,leave:n.Leave||0,half:n['Half Day']||0,notMarked:periodType==='daily'?Math.max(0,pupils.length-marked):0};
  }),[classOptions,activeStudents,periodRecords,periodType]);
  const periodTitle=periodType==='daily'?`Daily Attendance · ${date}`:periodType==='monthly'?`Monthly Attendance · ${searchMonth}`:`Academic Year ${academicYearLabel(academicYear)} (April–March)`;
  const applyPeriodSearch=()=>{if(periodType==='monthly'&&/^\d{4}-\d{2}$/.test(searchMonth)){setDate(`${searchMonth}-01`);setDetailClass('');}else if(periodType==='yearly'){setDate(`${academicYear}-04-01`);setDetailClass('');}};
  const exportCsv=(rows=monthRecords,file='attendance-monthly')=>{
    const data=[['Date','Student Name','Admission No.','Class','Section','Status','Reason','Application Status','Application Details'],...rows.map(r=>[r.date,r.studentName,r.admissionNo,r.className,r.section,r.status,r.absenceReason,r.applicationStatus,r.applicationText])];
    const csv=data.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    const blob=new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${file}-${date.slice(0,7)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const printReport=(title,rows,summaryTitle='Attendance Report')=>{
    const counts=statusCounts(rows);
    const body=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.studentName||r.name||'')}</td><td>${esc(r.admissionNo||'—')}</td><td>${esc(r.className||'')}</td><td>${esc(r.section||'—')}</td><td>${esc(r.date||date)}</td><td>${esc(r.status||'Not Marked')}</td><td>${esc(r.absenceReason||'—')}</td><td>${esc(r.applicationStatus||'—')}</td></tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;color:#17243a;padding:22px}h1{text-align:center;margin:0 0 5px;font-size:22px}h2{font-size:16px;margin:20px 0 8px}.sub{text-align:center;color:#64748b;font-size:12px;margin-bottom:18px}.stats{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.stats span{border:1px solid #ddd;border-radius:7px;padding:8px 12px;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #d9e0e8;padding:7px;text-align:left}th{background:#edf2f8}@media print{body{padding:8mm}}</style></head><body><h1>${esc(schoolName||'School')}</h1><div class="sub">${esc(title)} · Generated ${esc(new Date().toLocaleString())}</div><h2>${esc(summaryTitle)}</h2><div class="stats"><span>Total Records: ${rows.length}</span><span>Present: ${counts.Present||0}</span><span>Absent: ${counts.Absent||0}</span><span>Leave: ${counts.Leave||0}</span><span>Half Day: ${counts['Half Day']||0}</span></div><table><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th>Class</th><th>Section</th><th>Date</th><th>Status</th><th>Reason</th><th>Application</th></tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`;
    const w=window.open('','_blank');if(!w){setError('Allow pop-ups to open the PDF / Print preview.');return;}w.document.open();w.document.write(html);w.document.close();
  };
  const shareReport=async(title,rows)=>{
    const c=statusCounts(rows);
    const msg=`${schoolName||'School'}\n${title}\nTotal: ${rows.length}\nPresent: ${c.Present||0}\nAbsent: ${c.Absent||0}\nLeave: ${c.Leave||0}\nHalf Day: ${c['Half Day']||0}`;
    try{if(navigator.share)await navigator.share({title,text:msg});else if(navigator.clipboard){await navigator.clipboard.writeText(msg);setMessage('Attendance summary copied. You can paste it in WhatsApp.');}else setMessage(msg);}catch(e){if(e?.name!=='AbortError')setError('Sharing was not completed.');}
  };

  const absentToday=periodRecords.filter(r=>r.status==='Absent');
  const presentToday=schoolDayRows.filter(r=>r.status==='Present');
  const selectedClassRows=schoolDayRows.filter(r=>r.className===detailClass);
  const studentHistory=useMemo(()=>historyStudent?records.filter(r=>r.studentId===historyStudent.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')):[],[records,historyStudent]);

  return <section className="workspace">
    <div className="section-head"><div><h2>✅ Attendance Management</h2><p>{schoolName||'School'} · Admission-linked students · Nursery to Class 12 as configured in this school.</p></div><button style={styles.secondary} onClick={onBack}>← Dashboard</button></div>
    {studentsLoading&&<p style={styles.muted}>Loading admitted students…</p>}
    {!schoolId&&<p className="pending">Please select one school from the top menu before using Attendance.</p>}
    {error&&<p role="alert" style={{background:'#fee2e2',color:'#991b1b',padding:11,borderRadius:8,whiteSpace:'pre-wrap'}}>{error}</p>}
    {message&&<p style={{background:'#dcfce7',color:'#166534',padding:11,borderRadius:8}}>{message}</p>}

    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:13}}>
      {[['mark','Mark Attendance'],['overview','All Classes Overview'],['reports','Reports & Calendar']].map(([v,label])=><button key={v} style={view===v?styles.primary:styles.secondary} onClick={()=>setView(v)}>{label}</button>)}
    </div>

    <div style={styles.panel}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
        {view!=='overview'&&<label style={{fontSize:13,fontWeight:600}}>Attendance Date<input type="date" value={date} onChange={e=>{setDate(e.target.value);setReportReady(false);}} style={{...styles.field,display:'block',marginTop:6}}/></label>}
        {view==='mark'&&<label style={{fontSize:13,fontWeight:600}}>Class<select value={className} onChange={e=>setClassName(e.target.value)} style={{...styles.field,display:'block',marginTop:6}}><option value="">Select Class</option>{classOptions.map(c=><option key={c} value={c}>{getClassLabel(c)}</option>)}</select></label>}
        {view==='mark'&&<label style={{fontSize:13,fontWeight:600}}>Section<select value={section} onChange={e=>setSection(e.target.value)} style={{...styles.field,display:'block',marginTop:6}}><option>All Sections</option>{sectionOptions.map(s=><option key={s}>{s}</option>)}</select></label>}
        {view==='mark'&&<label style={{fontSize:13,fontWeight:600}}>Search Student<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name / Admission No." style={{...styles.field,display:'block',marginTop:6}}/></label>}
      </div>
    </div>

    {view==='mark'&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:10,marginBottom:14}}>
        {[['Total',selectedStudents.length,'#eff6ff'],['Present',counts.Present||0,'#dcfce7'],['Absent',counts.Absent||0,'#fee2e2'],['Leave',counts.Leave||0,'#fef3c7'],['Half Day',counts['Half Day']||0,'#dbeafe']].map(([label,value,bg])=><div key={label} style={{...styles.stat,background:bg}}><div style={{fontSize:12,color:'#475569'}}>{label}</div><strong style={{fontSize:23}}>{value}</strong></div>)}
      </div>
      <div style={styles.panel}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12}}><div><b>Student Attendance</b><div style={styles.muted}>One record per student per date · Existing attendance can be edited and saved again.</div></div><div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button style={styles.secondary} onClick={()=>markAll('Present')}>Mark All Present</button><button style={styles.secondary} onClick={()=>markAll('Absent')}>Mark All Absent</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th>Class / Section</th><th>Attendance</th><th>Reason / Leave Application</th><th>History</th></tr></thead><tbody>
          {visibleRows.map((s,i)=><tr key={s.id}><td>{i+1}</td><td><b>{s.name||'Unnamed Student'}</b><div style={styles.muted}>{s.fatherName||''}</div></td><td>{s.admissionNo||'—'}</td><td>{s.className||'—'} / {s.section||'—'}</td><td><select value={attendance[s.id]||'Present'} onChange={e=>setAttendance(p=>({...p,[s.id]:e.target.value}))} style={{...styles.field,minWidth:125,background:statusColors[attendance[s.id]||'Present']}}>{statuses.map(v=><option key={v}>{v}</option>)}</select></td><td style={{minWidth:210}}>{(()=>{const app=leaveApplicationMap[s.id];const record=recordMap[s.id];return <div style={{display:'grid',gap:5}}>{(app||record?.absenceReason||record?.applicationText||['Absent','Leave'].includes(attendance[s.id]||record?.status||'Present'))&&<><div style={styles.muted}>Reason: {app?.reason||record?.absenceReason||'No reason submitted'}</div>{app&&<><div style={styles.muted}>Parent application · {app.fromDate} to {app.toDate} · {app.status||'Pending'}</div>{canEditReason&&!isPlatformSuperAdmin&&<textarea aria-label="Edit leave reason" placeholder="Edit application reason" defaultValue={app.reason||''} key={`${app.id}-${app.reason||''}`} onBlur={e=>{if(e.target.value!==app.reason)updateLeaveApplication(app,{reason:e.target.value});}} style={styles.field}/>}{canReviewApplication&&<div style={{display:'flex',gap:5,flexWrap:'wrap'}}><button type="button" style={styles.primary} onClick={()=>updateLeaveApplication(app,{status:'Approved',reviewedBy:profile?.uid||'',reviewedAt:serverTimestamp()})}>Accept</button><button type="button" style={{...styles.secondary,color:'#991b1b'}} onClick={()=>updateLeaveApplication(app,{status:'Rejected',reviewedBy:profile?.uid||'',reviewedAt:serverTimestamp()})}>Reject</button><button type="button" style={styles.secondary} onClick={()=>updateLeaveApplication(app,{reason:'',status:'Pending',reviewedBy:'',reviewedAt:null})}>Reset</button></div>}</>}{!app&&record&&<><div style={styles.muted}>Attendance note: {record.applicationText||'—'} · {record.applicationStatus||'Not Submitted'}</div>{canEditReason&&!isPlatformSuperAdmin&&<><input placeholder="Reason (Fever etc.)" value={absenceDetails[s.id]?.reason??record.absenceReason??''} onChange={e=>setAbsenceDetails(p=>({...p,[s.id]:{...p[s.id],reason:e.target.value}}))} style={styles.field}/><textarea placeholder="Application details / parent message" value={absenceDetails[s.id]?.applicationText??record.applicationText??''} onChange={e=>setAbsenceDetails(p=>({...p,[s.id]:{...p[s.id],applicationText:e.target.value}}))} style={styles.field}/><button type="button" style={styles.secondary} onClick={()=>setAbsenceDetails(p=>({...p,[s.id]:{...p[s.id],reason:'',applicationText:''}}))}>Reset Reason</button></>}</>}</>}</div>;})()}</td><td><button style={styles.secondary} onClick={()=>setHistoryStudent(s)}>View</button></td></tr>)}
          {!loading&&!visibleRows.length&&<tr><td colSpan="7" style={{textAlign:'center',padding:24}}>No admitted students found for this class/section.</td></tr>}
        </tbody></table></div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button style={styles.primary} disabled={saving||loading||!selectedStudents.length||!schoolId} onClick={saveAttendance}>{saving?'Saving…':'Save / Update Attendance'}</button></div>
      </div>
    </>}

    {view==='overview'&&<>
      <div style={styles.panel}>
        <b>Attendance Search</b>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,marginTop:10}}>
          <label style={{fontSize:13,fontWeight:600}}>Report Type<select value={periodType} onChange={e=>setPeriodType(e.target.value)} style={{...styles.field,display:'block',marginTop:5}}><option value="daily">Daily</option><option value="monthly">Monthly</option><option value="yearly">Academic Year (April–March)</option></select></label>
          {periodType==='daily'&&<label style={{fontSize:13,fontWeight:600}}>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...styles.field,display:'block',marginTop:5}}/></label>}
          {periodType==='monthly'&&<label style={{fontSize:13,fontWeight:600}}>Month<input type="month" value={searchMonth} onChange={e=>setSearchMonth(e.target.value)} style={{...styles.field,display:'block',marginTop:5}}/></label>}
          {periodType==='yearly'&&<label style={{fontSize:13,fontWeight:600}}>Academic Year<select value={searchYear} onChange={e=>setSearchYear(e.target.value)} style={{...styles.field,display:'block',marginTop:5}}>{Array.from({length:8},(_,i)=>academicYearStart(today())-4+i).map(y=><option key={y} value={y}>{academicYearLabel(y)} (April–March)</option>)}</select></label>}
        </div>
        {periodType!=='daily'&&<button style={{...styles.primary,marginTop:10}} onClick={applyPeriodSearch}>Search Report</button>}
        <div style={{...styles.muted,marginTop:8}}>बिना Search किए आज की Daily Attendance दिखेगी। Academic Year हमेशा April से March तक रहेगा।</div>
        <label style={{fontSize:13,fontWeight:600,display:'block',marginTop:12}}>Search Student (Name / Admission No. / Father Name)<input value={globalStudentSearch} onChange={e=>setGlobalStudentSearch(e.target.value)} placeholder="बच्चे का नाम या Admission No. लिखें" style={{...styles.field,display:'block',marginTop:5}}/></label>
        {globalSearchResults.length>0&&<div style={{marginTop:8,border:'1px solid #e2e8f0',borderRadius:9,overflow:'hidden'}}>{globalSearchResults.map(s=>{const rs=records.filter(r=>r.studentId===s.id&& (periodType==='daily'?r.date===date:periodType==='monthly'?monthOf(r.date)===searchMonth:r.date>=yearRange.start&&r.date<=yearRange.end));const latest=rs.sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];return <div key={s.id} style={{padding:10,borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><div><b>{s.name||'Unnamed Student'}</b><div style={styles.muted}>{s.className} · {s.admissionNo||'No Admission No.'} · {latest?.status||'No Record'}</div><div style={styles.muted}>{latest?.absenceReason||''} {latest?.applicationStatus?`· ${latest.applicationStatus}`:''}</div></div><button style={styles.secondary} onClick={()=>setHistoryStudent(s)}>View History</button></div>})}</div>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:10,marginBottom:14}}>
        {[['Total Students',activeStudents.length,'#eff6ff'],['Marked Records',periodRecords.length,'#e0f2fe'],['Present',periodSummary.Present||0,'#dcfce7'],['Absent',periodSummary.Absent||0,'#fee2e2'],['Leave',periodSummary.Leave||0,'#fef3c7'],['Half Day',periodSummary['Half Day']||0,'#dbeafe'],...(periodType==='daily'?[['Not Marked',Math.max(0,activeStudents.length-periodRecords.length),'#f1f5f9']]:[])].map(([l,n,bg])=><div key={l} style={{...styles.stat,background:bg}}><div style={{fontSize:12,color:'#475569'}}>{l}{l!=='Total Students'&&l!=='Marked Records'?` · ${pctLabel(n,periodDenominator)}`:''}</div><strong style={{fontSize:23}}>{n}</strong></div>)}
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        <button style={styles.secondary} onClick={()=>printReport(periodTitle,periodRecords)}>PDF / Print All Classes</button>
        <button style={styles.secondary} onClick={()=>exportCsv(periodRecords,'all-classes-attendance')}>Download CSV</button>
        <button style={styles.secondary} onClick={()=>shareReport(periodTitle,periodRecords)}>Share Summary</button>
        <button style={styles.secondary} onClick={()=>{setDetailClass('');setDetailStatus('Absent');}}>Show Absent Students</button>
      </div>
      <div style={styles.panel}>
        <b>Class-wise Attendance · {periodTitle}</b>
        <p style={styles.muted}>किसी Class पर क्लिक करके उस Class के सभी बच्चों की Attendance देखें।</p>
        {periodOverview.map(c=><button key={c.className} onClick={()=>{setDetailClass(c.className);setDetailStatus('All');}} style={{display:'block',width:'100%',textAlign:'left',border:'1px solid #e2e8f0',borderRadius:10,padding:12,marginTop:9,background:'#fff',cursor:'pointer',color:'#17243a'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><b>{c.className}</b><span style={{fontSize:12,color:'#475569'}}>Total {c.total} · Marked {c.marked} · Not Marked {c.notMarked}</span></div>
          <div style={{display:'flex',height:9,borderRadius:20,overflow:'hidden',background:'#eef2f7',margin:'9px 0'}}>{c.present>0&&<span style={{width:`${c.present/Math.max((periodType==='daily'?c.total:c.marked),1)*100}%`,background:'#16a34a'}}/>}{c.absent>0&&<span style={{width:`${c.absent/Math.max((periodType==='daily'?c.total:c.marked),1)*100}%`,background:'#dc2626'}}/>}{(c.leave+c.half)>0&&<span style={{width:`${(c.leave+c.half)/Math.max((periodType==='daily'?c.total:c.marked),1)*100}%`,background:'#eab308'}}/>}{periodType==='daily'&&c.notMarked>0&&<span style={{width:`${c.notMarked/Math.max(c.total,1)*100}%`,background:'#cbd5e1'}}/>}</div>
          <div style={{display:'flex',gap:13,flexWrap:'wrap',fontSize:12}}><span style={{color:'#15803d'}}>Present {c.present} ({pctLabel(c.present,periodType==='daily'?c.total:c.marked)})</span><span style={{color:'#b91c1c'}}>Absent {c.absent} ({pctLabel(c.absent,periodType==='daily'?c.total:c.marked)})</span><span style={{color:'#a16207'}}>Leave {c.leave} ({pctLabel(c.leave,periodType==='daily'?c.total:c.marked)})</span><span style={{color:'#1d4ed8'}}>Half Day {c.half} ({pctLabel(c.half,periodType==='daily'?c.total:c.marked)})</span>{periodType==='daily'&&<span style={{color:'#64748b'}}>Not Marked {c.notMarked} ({pctLabel(c.notMarked,c.total)})</span>}<b style={{marginLeft:'auto'}}>Open →</b></div>
        </button>)}
        {!periodOverview.length&&<p style={styles.muted}>No active admitted students found for this school.</p>}
      </div>
      {periodType==='yearly'&&<div style={styles.panel}><b>Month-wise Summary · Academic Year {academicYearLabel(academicYear)}</b><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:8,marginTop:10}}>{Array.from({length:12},(_,i)=>{const y=academicYear+(i<9?0:1),m=((i+3)%12)+1,key=`${y}-${String(m).padStart(2,'0')}`,rows=periodRecords.filter(r=>monthOf(r.date)===key),n=statusCounts(rows);return <div key={key} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:9,padding:10}}><b>{new Date(y,m-1,1).toLocaleString('en',{month:'long'})}</b><div style={styles.muted}>{y}</div><div style={{fontSize:12,marginTop:5}}><span style={{color:'#15803d'}}>Present {n.Present||0}</span><br/><span style={{color:'#b91c1c'}}>Absent {n.Absent||0}</span><br/>Leave {n.Leave||0} · Half {n['Half Day']||0}</div></div>})}</div></div>}
      {detailClass&&<div style={styles.panel}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap',alignItems:'center'}}><div><b>{detailClass} · Student List</b><div style={styles.muted}>{periodTitle}</div></div><button style={styles.secondary} onClick={()=>setDetailClass('')}>Close</button></div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap',margin:'12px 0'}}>{['All','Present','Absent','Leave','Half Day','Not Marked','No Record'].map(s=><button key={s} style={detailStatus===s?styles.primary:styles.secondary} onClick={()=>setDetailStatus(s)}>{s}</button>)}</div>
        <div className="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th>Section</th><th>Status</th><th>Reason / Application</th><th>History</th></tr></thead><tbody>{classDetailStudents.map((s,i)=><tr key={s.id}><td>{i+1}</td><td>{s.name||'Unnamed Student'}</td><td>{s.admissionNo||'—'}</td><td>{s.section||'—'}</td><td><b style={{color:s.status==='Absent'?'#b91c1c':s.status==='Present'?'#15803d':'#475569'}}>{s.status}</b>{periodType!=='daily'&&s.recordsCount>0&&<div style={styles.muted}>Present {s.periodPresent} ({s.periodPercent}%) · Absent {s.periodAbsent} · Leave {s.periodLeave} · Half Day {s.periodHalf}</div>}</td><td>{(()=>{const app=leaveApplicationMap[s.id];return <div style={{display:'grid',gap:5}}><div>{app?.reason||s.absenceReason||'—'}</div>{app&&<><div style={styles.muted}>Parent application · {app.fromDate} to {app.toDate} · {app.status||'Pending'}</div>{canEditReason&&!isPlatformSuperAdmin&&<><textarea aria-label="Edit leave reason" defaultValue={app.reason||''} key={`${app.id}-${app.reason||''}-detail`} onBlur={e=>{if(e.target.value!==app.reason)updateLeaveApplication(app,{reason:e.target.value});}} style={styles.field}/>{!canReviewApplication&&<button type="button" style={styles.secondary} onClick={()=>updateLeaveApplication(app,{reason:''})}>Reset Reason</button>}</>}{canReviewApplication&&<div style={{display:'flex',gap:5,flexWrap:'wrap'}}><button type="button" style={styles.primary} onClick={()=>updateLeaveApplication(app,{status:'Approved',reviewedBy:profile?.uid||'',reviewedAt:serverTimestamp()})}>Accept</button><button type="button" style={{...styles.secondary,color:'#991b1b'}} onClick={()=>updateLeaveApplication(app,{status:'Rejected',reviewedBy:profile?.uid||'',reviewedAt:serverTimestamp()})}>Reject</button><button type="button" style={styles.secondary} onClick={()=>updateLeaveApplication(app,{reason:'',status:'Pending',reviewedBy:'',reviewedAt:null})}>Reset</button></div>}</>}{!app&&<><div style={styles.muted}>{s.applicationStatus||''} {s.applicationText?`· ${s.applicationText}`:''}</div>{canEditReason&&!isPlatformSuperAdmin&&s.id&&s.date&&<><textarea aria-label="Edit attendance reason" defaultValue={s.absenceReason||''} key={`${s.id}-${s.date}-${s.absenceReason||''}`} placeholder="Reason / application details" onBlur={e=>{if(e.target.value!==(s.absenceReason||''))updateAttendanceReason(records.find(r=>r.studentId===s.id&&r.date===s.date),{absenceReason:e.target.value});}} style={styles.field}/><button type="button" style={styles.secondary} onClick={()=>updateAttendanceReason(records.find(r=>r.studentId===s.id&&r.date===s.date),{absenceReason:'',applicationText:''})}>Reset Reason</button></>}</>}</div>;})()}</td><td><button style={styles.secondary} onClick={()=>setHistoryStudent(s)}>View</button></td></tr>)}</tbody></table></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button style={styles.secondary} onClick={()=>printReport(`${detailClass} Attendance · ${date}`,classDetailStudents)}>Class PDF / Print</button><button style={styles.secondary} onClick={()=>exportCsv(classDetailStudents,`${detailClass}-attendance`)}>Class CSV</button><button style={styles.secondary} onClick={()=>shareReport(`${detailClass} Attendance · ${date}`,classDetailStudents)}>Share Class Summary</button></div>
      </div>}
    </>}

    {view==='reports'&&<>
      <div style={styles.panel}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap',alignItems:'center'}}><div><b>Attendance Report</b><div style={styles.muted}>Selected month: {monthOf(date)} · Academic Year: {academicYearLabel(academicYear)} (April–March).</div></div><button style={styles.primary} onClick={loadMonthlyReport} disabled={reportLoading}>{reportLoading?'Loading…':'Refresh Monthly Report'}</button></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:9,marginTop:13}}>{[['Records',monthRecords.length],['Present',monthSummary.Present||0],['Absent',monthSummary.Absent||0],['Leave',monthSummary.Leave||0],['Half Day',monthSummary['Half Day']||0]].map(([l,n])=><div key={l} style={{background:'#f8fafc',padding:11,borderRadius:9}}><small>{l}</small><strong style={{display:'block',fontSize:21}}>{n}</strong></div>)}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button style={styles.secondary} onClick={()=>printReport(`Monthly Attendance · ${monthOf(date)}`,monthRecords)}>Monthly PDF / Print</button><button style={styles.secondary} onClick={()=>exportCsv()}>Download Excel-compatible CSV</button><button style={styles.secondary} onClick={()=>shareReport(`Monthly Attendance · ${monthOf(date)}`,monthRecords)}>Share Summary</button></div>
      </div>
      <div style={styles.panel}>
        <b>Attendance Calendar · {monthOf(date)}</b>
        <p style={styles.muted}>हर तारीख पर सेव Attendance Records की संख्या। किसी तारीख पर क्लिक करके उस दिन की Attendance देखें।</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:6}}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{textAlign:'center',fontSize:11,color:'#64748b',fontWeight:700}}>{d}</div>)}
          {Array.from({length:new Date(Number(date.slice(0,4)),Number(date.slice(5,7))-1,1).getDay()},(_,i)=><div key={`blank-${i}`}/>)}
          {Array.from({length:new Date(Number(date.slice(0,4)),Number(date.slice(5,7)),0).getDate()},(_,i)=>{const day=i+1,ds=`${monthOf(date)}-${String(day).padStart(2,'0')}`,n=records.filter(r=>r.date===ds).length;return <button key={ds} onClick={()=>{setDate(ds);setView('overview');}} style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 2px',background:ds===date?'#dbeafe':'#fff',minWidth:0}}><b>{day}</b><small style={{display:'block',fontSize:9,color:n?'#15803d':'#94a3b8'}}>{n?`${n} rec.`:'—'}</small></button>;})}
        </div>
      </div>
    </>}

    {historyStudent&&<div style={{position:'fixed',inset:0,background:'#0f172a88',zIndex:9999,display:'grid',placeItems:'center',padding:14}} onClick={()=>setHistoryStudent(null)}>
      <div style={{background:'#fff',borderRadius:14,padding:18,width:'min(700px,100%)',maxHeight:'85vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><div><b>Student Attendance History</b><div style={styles.muted}>{historyStudent.name} · {historyStudent.admissionNo||'No Admission No.'}</div></div><button style={styles.secondary} onClick={()=>setHistoryStudent(null)}>Close</button></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:7,margin:'13px 0'}}>{[['Present',statusCounts(studentHistory).Present||0],['Absent',statusCounts(studentHistory).Absent||0],['Leave',statusCounts(studentHistory).Leave||0],['Half Day',statusCounts(studentHistory)['Half Day']||0]].map(([l,n])=><div key={l} style={{background:'#f1f5f9',borderRadius:8,padding:8}}><small>{l}</small><b style={{display:'block',fontSize:20}}>{n}</b></div>)}</div>
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Class</th><th>Status</th><th>Reason</th><th>Application</th></tr></thead><tbody>{studentHistory.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.className}</td><td>{r.status}</td><td>{r.absenceReason||'—'}</td><td>{r.applicationStatus||'—'}{r.applicationText?` · ${r.applicationText}`:''}</td></tr>)}</tbody></table></div>
        <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}><button style={styles.secondary} onClick={()=>printReport(`${historyStudent.name} · Attendance History`,studentHistory)}>Student History PDF / Print</button><button style={styles.secondary} onClick={()=>exportCsv(studentHistory,'student-attendance-history')}>Download CSV</button></div>
      </div>
    </div>}
  </section>;
}
