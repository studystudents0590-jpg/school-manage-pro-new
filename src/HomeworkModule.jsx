import React,{useEffect,useMemo,useState} from 'react';
import {addDoc,collection,deleteDoc,doc,onSnapshot,query,serverTimestamp,updateDoc,where} from 'firebase/firestore';
import {getDownloadURL,ref,uploadBytes} from 'firebase/storage';
import {auth,db,storage} from './firebase';

const field={width:'100%',padding:10,border:'1px solid #cbd5e1',borderRadius:9,boxSizing:'border-box',background:'#fff'};
const btn={padding:'10px 14px',border:0,borderRadius:9,background:'#2457d6',color:'#fff',fontWeight:700,cursor:'pointer'};
const soft={...btn,background:'#eef2ff',color:'#1e40af'};
const card={background:'#fff',border:'1px solid #e2e8f0',borderRadius:13,padding:14,marginBottom:12};
const split=(v)=>Array.isArray(v)?v:String(v||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
const err=e=>e?.code==='permission-denied'?'Firebase permission denied. Firestore/Storage rules must allow this school-scoped Homework operation.':e?.message||'Something went wrong.';
export default function HomeworkModule({schoolId,schoolName,profile,students=[],isTeacher=false,isParent=false,onBack}){
 const [assignments,setAssignments]=useState([]),[linked,setLinked]=useState([]),[subs,setSubs]=useState([]),[teachers,setTeachers]=useState([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [tab,setTab]=useState(isParent?'My Homework':'Assignments'),[editing,setEditing]=useState(null),[selected,setSelected]=useState(null),[submissionText,setSubmissionText]=useState(''),[submissionFile,setSubmissionFile]=useState(null);
 const [form,setForm]=useState({title:'',className:'',section:'All Sections',subject:'',description:'',assignedDate:new Date().toISOString().slice(0,10),dueDate:'',attachmentUrl:'',attachmentName:''});
 const uid=auth.currentUser?.uid||'',isAdmin=profile?.role==='schooladmin'||profile?.role==='superadmin';
 const myTeacher=teachers.find(t=>t.id===profile?.teacherId)||profile||{};
 const teacherClasses=useMemo(()=>split(myTeacher.classes),[myTeacher.classes]);
 const teacherSubjects=useMemo(()=>split(myTeacher.subjects),[myTeacher.subjects]);
 const classNames=useMemo(()=>[...new Set(students.map(s=>s.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[students]);
 const subjects=useMemo(()=>{const ss=students.filter(s=>s.className===form.className).flatMap(s=>Array.isArray(s.subjects)?s.subjects:[]);return [...new Set([...ss,...teacherSubjects].filter(Boolean))];},[students,form.className,teacherSubjects]);
 useEffect(()=>{if(!schoolId){setAssignments([]);setLoading(false);return;}
  setLoading(true);
  const q=query(collection(db,'homeworkAssignments'),where('schoolId','==',schoolId));
  return onSnapshot(q,s=>{setAssignments(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));setLoading(false);},e=>{setError(err(e));setLoading(false);});
 },[schoolId]);
 useEffect(()=>{if(!schoolId||!isTeacher)return;
  const q=query(collection(db,'teachers'),where('schoolId','==',schoolId));
  return onSnapshot(q,s=>setTeachers(s.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(err(e)));
 },[schoolId,isTeacher]);
 useEffect(()=>{if(!isParent||!uid)return;
  const q=query(collection(db,'students'),where('parentUid','==',uid));
  return onSnapshot(q,s=>setLinked(s.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(err(e)));
 },[isParent,uid]);
 useEffect(()=>{if(!schoolId)return;
  const q=query(collection(db,'homeworkSubmissions'),where('schoolId','==',schoolId));
  return onSnapshot(q,s=>setSubs(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0))),e=>setError(err(e)));
 },[schoolId]);
 const visibleAssignments=useMemo(()=>{
  if(isParent)return assignments.filter(a=>linked.some(s=>s.className===a.className&&(a.section==='All Sections'||!a.section||s.section===a.section)));
  if(isTeacher)return assignments.filter(a=>(!teacherClasses.length||teacherClasses.includes(a.className))&&(!teacherSubjects.length||teacherSubjects.includes(a.subject)));
  return assignments;
 },[assignments,linked,isParent,isTeacher,teacherClasses,teacherSubjects]);
 const reset=()=>{setEditing(null);setForm({title:'',className:'',section:'All Sections',subject:'',description:'',assignedDate:new Date().toISOString().slice(0,10),dueDate:'',attachmentUrl:'',attachmentName:''});};
 const upload=async(file,folder)=>{
  if(!file)return null;
  if(file.size>10*1024*1024)throw new Error('File size must be 10 MB or less.');
  const safe=file.name.replace(/[^a-z0-9._-]/gi,'_');
  const path=`homework/${schoolId}/${folder}/${Date.now()}_${safe}`;
  const result=await uploadBytes(ref(storage,path),file);
  return {url:await getDownloadURL(result.ref),name:file.name,path};
 };
 const saveAssignment=async e=>{
  e.preventDefault();if(!schoolId)return setError('Select a school first.');
  if(!form.title.trim()||!form.className||!form.subject||!form.description.trim()||!form.dueDate)return setError('Please fill all required homework details.');
  if(form.dueDate<form.assignedDate)return setError('Submission date cannot be earlier than assigned date.');
  if(isTeacher&&teacherClasses.length&&!teacherClasses.includes(form.className))return setError('You can assign homework only to your assigned classes.');
  if(isTeacher&&teacherSubjects.length&&!teacherSubjects.includes(form.subject))return setError('You can assign homework only for your assigned subjects.');
  setBusy(true);setError('');setNotice('');
  try{
   let attachment={url:form.attachmentUrl||'',name:form.attachmentName||''};
   const file=document.getElementById('homework-assignment-file')?.files?.[0];
   if(file)attachment=await upload(file,'assignments');
   const data={schoolId,schoolName:schoolName||profile?.schoolName||'',title:form.title.trim(),className:form.className,section:form.section,subject:form.subject,description:form.description.trim(),assignedDate:form.assignedDate,dueDate:form.dueDate,attachmentUrl:attachment.url,attachmentName:attachment.name,createdBy:uid,createdByName:profile?.displayName||profile?.name||'School Staff',createdByRole:isTeacher?'teacher':'admin',updatedAt:serverTimestamp()};
   if(editing)await updateDoc(doc(db,'homeworkAssignments',editing.id),data);
   else await addDoc(collection(db,'homeworkAssignments'),{...data,status:'Active',createdAt:serverTimestamp()});
   setNotice(editing?'Homework updated.':'Homework assigned successfully.');reset();setTab('Assignments');
  }catch(e){setError('Homework save nahi hua: '+err(e));}finally{setBusy(false);}
 };
 const startEdit=a=>{setEditing(a);setForm({title:a.title||'',className:a.className||'',section:a.section||'All Sections',subject:a.subject||'',description:a.description||'',assignedDate:a.assignedDate||'',dueDate:a.dueDate||'',attachmentUrl:a.attachmentUrl||'',attachmentName:a.attachmentName||''});setTab('Create Homework');};
 const shareWhatsApp=a=>{
  const msg=`${schoolName||a.schoolName||'School'}\nHOMEWORK\nTitle: ${a.title}\nClass: ${a.className} ${a.section==='All Sections'?'':a.section}\nSubject: ${a.subject}\nAssigned: ${a.assignedDate}\nSubmission Date: ${a.dueDate}\n\n${a.description}${a.attachmentUrl?'\nAttachment: '+a.attachmentUrl:''}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank','noopener,noreferrer');
 };
 const submitHomework=async e=>{
  e.preventDefault();if(!selected)return;
  const child=linked.find(s=>s.id===selected.studentId)||students.find(s=>s.id===selected.studentId);
  if(!child)return setError('Linked student record not found.');
  setBusy(true);setError('');setNotice('');
  try{
   let attachment={url:'',name:''};if(submissionFile)attachment=await upload(submissionFile,`submissions/${selected.id}`);
   const old=subs.find(x=>x.assignmentId===selected.id&&x.studentId===child.id);
   const data={schoolId,assignmentId:selected.id,assignmentTitle:selected.title,studentId:child.id,studentName:child.name||'',admissionNo:child.admissionNo||'',className:child.className||'',section:child.section||'',parentUid:uid,text:submissionText.trim(),attachmentUrl:attachment.url,attachmentName:attachment.name,status:'Submitted',submittedAt:serverTimestamp(),updatedAt:serverTimestamp()};
   if(old)await updateDoc(doc(db,'homeworkSubmissions',old.id),data);else await addDoc(collection(db,'homeworkSubmissions'),data);
   setNotice('Homework submitted successfully.');setSelected(null);setSubmissionText('');setSubmissionFile(null);
  }catch(e){setError('Submission failed: '+err(e));}finally{setBusy(false);}
 };
 const markSubmission=async(s,status)=>{setBusy(true);setError('');try{await updateDoc(doc(db,'homeworkSubmissions',s.id),{status,checkedBy:uid,checkedByName:profile?.displayName||profile?.name||'Teacher',checkedAt:serverTimestamp()});setNotice(`Submission marked ${status}.`);}catch(e){setError(err(e));}finally{setBusy(false);}};
 const remove=async a=>{if(!window.confirm(`Delete homework "${a.title}"? Existing submissions will remain in history.`))return;try{await deleteDoc(doc(db,'homeworkAssignments',a.id));setNotice('Homework deleted. Submission history is retained.');}catch(e){setError(err(e));}};
 const myChildren=isParent?linked:students;
 const assignmentSubs=a=>subs.filter(s=>s.assignmentId===a.id);
 const assignmentCard=a=><article key={a.id} style={card}>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><span style={{fontSize:12,color:'#64748b'}}>{a.className} · {a.section||'All Sections'} · {a.subject}</span><h3 style={{margin:'5px 0'}}>{a.title}</h3></div><span style={{fontSize:12,fontWeight:700,color:a.status==='Active'?'#047857':'#64748b'}}>{a.status||'Active'}</span></div>
  <p style={{whiteSpace:'pre-wrap',margin:'8px 0'}}>{a.description}</p>
  <div style={{fontSize:13,color:'#64748b'}}>Assigned: {a.assignedDate||'—'} · Submit by: <b>{a.dueDate||'—'}</b></div>
  {a.attachmentUrl&&<p><a href={a.attachmentUrl} target="_blank" rel="noreferrer">📎 {a.attachmentName||'Open attachment'}</a></p>}
  {!isParent&&!isTeacher&&<div style={{fontSize:13,marginTop:8}}>Submissions: {assignmentSubs(a).length}</div>}
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
   <button style={soft} onClick={()=>shareWhatsApp(a)}>Share on WhatsApp</button>
   {isParent&&myChildren.filter(s=>s.className===a.className&&(a.section==='All Sections'||!a.section||s.section===a.section)).map(ch=><button key={ch.id} style={btn} onClick={()=>{setSelected({...a,studentId:ch.id});setSubmissionText('');setSubmissionFile(null);}}>Submit for {ch.name}</button>)}
   {!isParent&&<button style={soft} onClick={()=>setTab(`Submissions:${a.id}`)}>View Submissions ({assignmentSubs(a).length})</button>}
   {!isParent&&(isAdmin||isTeacher)&&<><button style={soft} onClick={()=>startEdit(a)}>Edit</button>{isAdmin&&<button style={{...soft,color:'#b91c1c'}} onClick={()=>remove(a)}>Delete</button>}</>}
  </div>
 </article>;
 if(!schoolId)return <section className="workspace"><button className="back" onClick={onBack}>← Dashboard</button><p className="pending">Please select a school first.</p></section>;
 const submissionView=tab.startsWith('Submissions:')?assignments.find(a=>a.id===tab.split(':')[1]):null;
 return <section className="workspace">
  <div className="section-head"><div><h2>📖 Homework Management</h2><p>{schoolName||profile?.schoolName||'School'} · Assign, share, submit and check homework</p></div><button className="back" onClick={onBack}>← Dashboard</button></div>
  {error&&<div className="pending" style={{background:'#fee2e2',color:'#991b1b'}}>{error}</div>}{notice&&<div className="pending" style={{background:'#dcfce7',color:'#166534'}}>{notice}</div>}
  <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'}}>{(isParent?['My Homework']:['Assignments',...((isAdmin||isTeacher)?['Create Homework']:[])]).map(t=><button key={t} style={tab===t?btn:soft} onClick={()=>{setTab(t);setError('');}}>{t}</button>)}</div>
  {loading?<p>Loading homework…</p>:null}
  {(tab==='Assignments'||tab==='My Homework')&&!loading&&<>{visibleAssignments.length?visibleAssignments.map(assignmentCard):<div className="pending">No homework found for this class yet.</div>}</>}
  {tab==='Create Homework'&&(isAdmin||isTeacher)&&<form onSubmit={saveAssignment} style={{...card,display:'grid',gap:12}}>
   <h3>{editing?'Edit Homework':'Create New Homework'}</h3>
   <label>Homework Title<input required style={field} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="e.g. Chapter 3 – Exercise"/></label>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
    <label>Class<select required style={field} value={form.className} onChange={e=>setForm(v=>({...v,className:e.target.value,subject:''}))}><option value="">Select Class</option>{(isTeacher&&teacherClasses.length?teacherClasses:classNames).map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Section<select style={field} value={form.section} onChange={e=>setForm(v=>({...v,section:e.target.value}))}><option>All Sections</option>{[...new Set(students.filter(s=>s.className===form.className).map(s=>s.section).filter(Boolean))].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Subject<select required style={field} value={form.subject} onChange={e=>setForm(v=>({...v,subject:e.target.value}))}><option value="">Select Subject</option>{(isTeacher&&teacherSubjects.length?teacherSubjects:subjects).map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Assigned Date<input required type="date" style={field} value={form.assignedDate} onChange={e=>setForm(v=>({...v,assignedDate:e.target.value}))}/></label>
    <label>Submission Date<input required type="date" style={field} value={form.dueDate} onChange={e=>setForm(v=>({...v,dueDate:e.target.value}))}/></label>
   </div>
   <label>Homework Details / Instructions<textarea required rows="5" style={field} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))} placeholder="Write homework clearly…"/></label>
   <label>Attach Photo / PDF / Document (Max 10 MB)<input id="homework-assignment-file" type="file" accept="image/*,.pdf,.doc,.docx" style={field}/>{form.attachmentName&&<small>Current: {form.attachmentName}</small>}</label>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button disabled={busy} style={btn}>{busy?'Saving…':editing?'Update Homework':'Assign Homework'}</button><button type="button" style={soft} onClick={reset}>Clear</button></div>
  </form>}
  {submissionView&&<div style={card}><h3>Submissions – {submissionView.title}</h3>{assignmentSubs(submissionView).length?assignmentSubs(submissionView).map(s=><div key={s.id} style={{borderTop:'1px solid #e2e8f0',padding:'12px 0'}}><b>{s.studentName}</b> · {s.className} {s.section}<p>{s.text||'No written answer.'}</p>{s.attachmentUrl&&<p><a href={s.attachmentUrl} target="_blank" rel="noreferrer">📎 {s.attachmentName||'Open submission'}</a></p>}<p>Status: <b>{s.status}</b></p>{(isAdmin||isTeacher)&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={soft} onClick={()=>markSubmission(s,'Checked')}>Mark Checked</button><button style={soft} onClick={()=>markSubmission(s,'Needs Correction')}>Needs Correction</button></div>}</div>):<p className="pending">No submissions yet.</p>}<button style={soft} onClick={()=>setTab('Assignments')}>Back to Assignments</button></div>}
  {selected&&<div style={{...card,border:'2px solid #2457d6'}}><h3>Submit Homework – {selected.title}</h3><p>{selected.studentId&&myChildren.find(s=>s.id===selected.studentId)?.name}</p><form onSubmit={submitHomework} style={{display:'grid',gap:10}}><label>Answer / Notes<textarea rows="4" style={field} value={submissionText} onChange={e=>setSubmissionText(e.target.value)} placeholder="Write your answer or note…"/></label><label>Upload Homework Photo / PDF<input type="file" accept="image/*,.pdf" style={field} onChange={e=>setSubmissionFile(e.target.files?.[0]||null)}/></label><button style={btn} disabled={busy}>{busy?'Submitting…':'Submit Homework'}</button><button type="button" style={soft} onClick={()=>setSelected(null)}>Cancel</button></form></div>}
  <p style={{fontSize:12,color:'#64748b',marginTop:16}}>WhatsApp opens a prepared message. Review the class/parent recipient and send it. The app stores homework and submissions separately for each school.</p>
 </section>;
    }
