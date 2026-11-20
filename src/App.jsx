import React, { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  onSnapshot, query, updateDoc, where, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';

const groups = [
 {title:'Super Admin',icon:'👑',items:[['Dashboard','📊'],['Schools Management','🏫'],['School Admins','👨‍💼'],['Roles & Permissions','🔐'],['Subscription & Plans','💳'],['System Settings','⚙️']]},
 {title:'Academic Management',icon:'🎓',items:[['Students','👨‍🎓'],['Admission','📝'],['Teachers & Staff','👩‍🏫'],['Classes & Sections','🏷️'],['Subjects & Syllabus','📚'],['Timetable','🗓️'],['Attendance','✅'],['Examinations','📋'],['Results & Report Cards','🏆'],['Homework','📖']]},
 {title:'Finance Management',icon:'💰',items:[['Fee Collection','💳'],['Fee Structure','🧮'],['Fee Dues','⏳'],['Student Ledger','📒'],['Fee Receipts','🧾'],['Discount & Scholarship','🎁'],['Expenses','💸'],['Financial Reports','📈']]},
 {title:'Communication',icon:'📢',items:[['Parent Portal','👨‍👩‍👧'],['Student Portal','🎒'],['Notices','📣'],['SMS & Notifications','✉️'],['Online Messages','💬'],['Homework Updates','📘']]},
 {title:'Other Services',icon:'🧰',items:[['Certificates','📜'],['ID Cards','🪪'],['Library','📚'],['Transport','🚌'],['Inventory','📦'],['Staff Payroll','💵'],['Backup & Security','🛡️'],['Reports & Analytics','📊']]}
];

const blankStudent = {
 name:'', admissionNo:'', fatherName:'', motherName:'', className:'', section:'',
 dob:'', gender:'', phone:'', whatsapp:'', address:'', email:''
};

const inputStyle = {width:'100%',padding:11,border:'1px solid #cbd5e1',borderRadius:8,boxSizing:'border-box',fontSize:14,background:'#fff'};
const labelStyle = {display:'block',fontWeight:600,fontSize:13,color:'#334155',marginBottom:6};
const primary = {background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 15px',fontWeight:700,cursor:'pointer'};
const secondary = {background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'10px 13px',fontWeight:600,cursor:'pointer'};
const danger = {background:'#fee2e2',color:'#b91c1c',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'};

export default function App() {
 const [user,setUser] = useState(null);
 const [checking,setChecking] = useState(true);
 const [email,setEmail] = useState('');
 const [password,setPassword] = useState('');
 const [authError,setAuthError] = useState('');
 const [loginLoading,setLoginLoading] = useState(false);
 const [active,setActive] = useState('Dashboard');
 const [queryText,setQueryText] = useState('');
 const [school,setSchool] = useState('All Schools');
 const [schools,setSchools] = useState([
  {id:1,name:'Iqra Public School',code:'IPS001',city:'Gadayipur, Mauaima, Prayagraj',status:'Active'},
  {id:2,name:'ips2',code:'IPS002',city:'',status:'Active'}
 ]);
 const [showAddSchool,setShowAddSchool] = useState(false);
 const [schoolForm,setSchoolForm] = useState({name:'',code:'',city:''});

 const [students,setStudents] = useState([]);
 const [studentsLoading,setStudentsLoading] = useState(false);
 const [studentError,setStudentError] = useState('');
 const [studentSearch,setStudentSearch] = useState('');
 const [studentClassFilter,setStudentClassFilter] = useState('All Classes');
 const [showStudentForm,setShowStudentForm] = useState(false);
 const [studentForm,setStudentForm] = useState(blankStudent);
 const [editingStudent,setEditingStudent] = useState(null);
 const [viewStudent,setViewStudent] = useState(null);
 const [savingStudent,setSavingStudent] = useState(false);

 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async currentUser => {
   if (!currentUser) { setUser(null); setChecking(false); return; }
   try {
    const userSnap = await getDoc(doc(db,'users',currentUser.uid));
    if (userSnap.exists() && userSnap.data().role === 'superadmin') {
     setUser(currentUser); setAuthError('');
    } else {
     setUser(null); setAuthError('आपके अकाउंट को Super Admin की अनुमति नहीं है।');
     await signOut(auth);
    }
   } catch (error) {
    setUser(null); setAuthError('Account verify नहीं हो पाया। Firebase Rules जाँचें।');
    await signOut(auth);
   }
   setChecking(false);
  });
  return () => unsubscribe();
 }, []);

 useEffect(() => {
  if (!user) return;
  setStudentsLoading(true);
  setStudentError('');
  const selected = school;
  const studentsRef = collection(db,'students');
  const q = selected === 'All Schools'
   ? query(studentsRef)
   : query(studentsRef,where('schoolName','==',selected));
  const unsubscribe = onSnapshot(q, snap => {
   setStudents(snap.docs.map(d=>({id:d.id,...d.data()})));
   setStudentsLoading(false);
  }, error => {
   setStudentError('Students डेटा लोड नहीं हुआ: '+error.message);
   setStudentsLoading(false);
  });
  return () => unsubscribe();
 }, [user,school]);

 const handleLogin = async e => {
  e.preventDefault(); setAuthError(''); setLoginLoading(true);
  try { await signInWithEmailAndPassword(auth,email.trim(),password); }
  catch(error) {
   setAuthError(error.code==='auth/invalid-credential'?'Email या Password गलत है।':error.message);
  }
  setLoginLoading(false);
 };

 const handleLogout = async () => {
  await signOut(auth); setUser(null); setPassword(''); setActive('Dashboard');
 };

 const visible = useMemo(() => groups.map(g=>({
  ...g,items:g.items.filter(([n])=>n.toLowerCase().includes(queryText.toLowerCase()))
 })).filter(g=>g.items.length),[queryText]);

 const addSchool = e => {
  e.preventDefault();
  if (!schoolForm.name.trim() || !schoolForm.code.trim()) return;
  if (schools.some(s=>s.code.toLowerCase()===schoolForm.code.trim().toLowerCase())) {
   alert('School code already exists'); return;
  }
  setSchools(p=>[...p,{...schoolForm,id:Date.now(),status:'Active'}]);
  setSchoolForm({name:'',code:'',city:''}); setShowAddSchool(false);
 };

 const openNewStudent = () => {
  setEditingStudent(null);
  setStudentForm({...blankStudent, admissionNo:'IPS-'+Date.now().toString().slice(-6)});
  setShowStudentForm(true);
 };
 const openEditStudent = s => {
  setEditingStudent(s.id);
  setStudentForm({...blankStudent,...s});
  setShowStudentForm(true);
 };
 const saveStudent = async e => {
  e.preventDefault();
  if (!studentForm.name.trim() || !studentForm.className) {
   alert('Student name और class भरना जरूरी है।'); return;
  }
  setSavingStudent(true); setStudentError('');
  const schoolName = school === 'All Schools' ? (schools[0]?.name || 'Iqra Public School') : school;
  const schoolInfo = schools.find(s=>s.name===schoolName) || schools[0];
  const payload = {
   ...studentForm,
   name:studentForm.name.trim(),
   admissionNo:studentForm.admissionNo.trim(),
   schoolName,
   schoolCode:schoolInfo?.code || '',
   updatedAt:serverTimestamp()
  };
  try {
   if (editingStudent) await updateDoc(doc(db,'students',editingStudent),payload);
   else await addDoc(collection(db,'students'),{...payload,createdAt:serverTimestamp()});
   setShowStudentForm(false); setEditingStudent(null); setStudentForm(blankStudent);
  } catch(error) {
   setStudentError('Save नहीं हुआ: '+error.message);
  }
  setSavingStudent(false);
 };
 const removeStudent = async s => {
  if (!window.confirm(`क्या ${s.name} का रिकॉर्ड हटाना चाहते हैं?`)) return;
  try { await deleteDoc(doc(db,'students',s.id)); }
  catch(error) { setStudentError('Delete नहीं हुआ: '+error.message); }
 };
 const shareStudent = (s,kind) => {
  const msg = `Student Details\nName: ${s.name||''}\nAdmission No: ${s.admissionNo||''}\nFather: ${s.fatherName||''}\nClass: ${s.className||''} ${s.section||''}\nSchool: ${s.schoolName||''}\nPhone: ${s.phone||''}`;
  const phone = (s.whatsapp || s.phone || '').replace(/\D/g,'');
  if (kind==='whatsapp') {
   const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
   window.open(url,'_blank','noopener,noreferrer');
  } else if (kind==='sms') {
   window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`;
  } else {
   const w = window.open('','_blank');
   if (!w) { alert('Pop-up allow करें, फिर PDF/Print दबाएँ।'); return; }
   w.document.write(`<html><head><title>Student Details</title><style>body{font-family:Arial;padding:28px}h2{color:#1d4ed8}p{border-bottom:1px solid #ddd;padding:8px 0}</style></head><body><h2>School Manager Pro</h2><h3>Student Details</h3>${[['Name',s.name],['Admission No',s.admissionNo],['Father Name',s.fatherName],['Mother Name',s.motherName],['Class',`${s.className||''} ${s.section||''}`],['Date of Birth',s.dob],['Gender',s.gender],['Phone',s.phone],['Address',s.address],['School',s.schoolName]].map(([k,v])=>`<p><b>${k}:</b> ${String(v||'')}</p>`).join('')}<script>window.onload=()=>window.print()</script></body></html>`);
   w.document.close();
  }
 };

 const filteredStudents = students.filter(s=>{
  const text = `${s.name||''} ${s.admissionNo||''} ${s.fatherName||''} ${s.phone||''}`.toLowerCase();
  return text.includes(studentSearch.toLowerCase()) &&
   (studentClassFilter==='All Classes' || s.className===studentClassFilter);
 });
 const classes = [...new Set(students.map(s=>s.className).filter(Boolean))].sort();

 if (checking) return <div style={styles.center}><div style={styles.loginCard}><h2>🏫 School Manager Pro</h2><p>Checking your account...</p></div></div>;
 if (!user) return (
  <div style={styles.center}>
   <form style={styles.loginCard} onSubmit={handleLogin}>
    <div style={{fontSize:48,textAlign:'center'}}>🏫</div>
    <h1 style={{textAlign:'center',marginBottom:5}}>School Manager Pro</h1>
    <p style={{textAlign:'center',color:'#64748b'}}>Super Admin Login</p>
    <label style={styles.label}>Email Address</label>
    <input style={styles.loginInput} type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email"/>
    <label style={styles.label}>Password</label>
    <input style={styles.loginInput} type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/>
    {authError && <p style={styles.error}>{authError}</p>}
    <button type="submit" disabled={loginLoading} style={styles.loginButton}>{loginLoading?'Please wait...':'Login'}</button>
    <p style={{textAlign:'center',fontSize:12,color:'#64748b'}}>Secure Firebase Authentication</p>
   </form>
  </div>
 );

 return (
  <div className="shell">
   <aside className="sidebar">
    <div className="brand"><span>🏫</span><div>School Manager Pro<small>NEW • MULTI-SCHOOL</small></div></div>
    <div className="side-caption">MAIN WORKSPACE</div>
    <button className={'nav '+(active==='Dashboard'?'selected':'')} onClick={()=>setActive('Dashboard')}>📊 Dashboard</button>
    {groups.map(g=><div className="side-group" key={g.title}>
     <div className="side-caption">{g.icon} {g.title}</div>
     {g.items.map(([n,ic])=><button key={n} className={'nav '+(active===n?'selected':'')} onClick={()=>setActive(n)}>{ic} {n}</button>)}
    </div>)}
   </aside>

   <main className="main">
    <header className="top">
     <div><b>{active}</b><small>School Manager Pro · New Platform</small></div>
     <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <select value={school} onChange={e=>setSchool(e.target.value)}><option>All Schools</option>{schools.map(s=><option key={s.id}>{s.name}</option>)}</select>
      <button className="secondary" onClick={handleLogout}>Logout</button>
     </div>
    </header>

    <div className="content">
     {active==='Dashboard' ? <>
      <section className="hero"><div><span className="eyebrow">SUPER ADMIN WORKSPACE</span><h1>Welcome to School Manager Pro</h1><p>One platform to manage multiple schools, academics, finance and communication.</p><button className="primary" onClick={()=>setShowAddSchool(true)}>＋ Add New School</button></div><div className="hero-icon">🏫</div></section>
      <div className="stats">
       <div className="stat"><small>Total Schools</small><strong>{schools.length}</strong></div>
       <div className="stat"><small>Active Schools</small><strong>{schools.filter(s=>s.status==='Active').length}</strong></div>
       <div className="stat"><small>Management Categories</small><strong>5</strong></div>
       <div className="stat"><small>Modules</small><strong>{groups.reduce((n,g)=>n+g.items.length,0)}</strong></div>
      </div>
      <div className="section-head"><div><h2>All Management Panels</h2><p>Choose a category and open a module.</p></div><input value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Search panels..."/></div>
      {visible.map(g=><section className="category" key={g.title}><h3>{g.icon} {g.title}</h3><div className="tiles">{g.items.map(([n,ic])=><button className="tile" key={n} onClick={()=>setActive(n)}><span>{ic}</span><b>{n}</b><small>Open module →</small></button>)}</div></section>)}
     </> : active==='Students' ? (
      <section className="workspace">
       <div className="section-head">
        <div><h2>Students Management</h2><p>Student records are saved in Firebase Firestore.</p></div>
        <button style={primary} onClick={openNewStudent}>＋ Add Student</button>
       </div>
       {studentError && <p style={{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8}}>{studentError}</p>}
       <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'15px 0'}}>
        <input style={{...inputStyle,flex:'1 1 220px'}} value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Search name, admission no, father, phone..."/>
        <select style={{...inputStyle,flex:'0 1 180px'}} value={studentClassFilter} onChange={e=>setStudentClassFilter(e.target.value)}><option>All Classes</option>{classes.map(c=><option key={c}>{c}</option>)}</select>
       </div>
       <div style={{fontSize:13,color:'#64748b',marginBottom:10}}>Total students: <b>{filteredStudents.length}</b> {studentsLoading?' · Loading...':''}</div>
       <div className="table-wrap"><table><thead><tr><th>Name</th><th>Admission No.</th><th>Class</th><th>Father</th><th>Phone</th><th>Actions</th></tr></thead>
        <tbody>{filteredStudents.map(s=><tr key={s.id}>
         <td>{s.name}</td><td>{s.admissionNo||'—'}</td><td>{s.className} {s.section}</td><td>{s.fatherName||'—'}</td><td>{s.phone||'—'}</td>
         <td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          <button style={secondary} onClick={()=>setViewStudent(s)}>View</button>
          <button style={secondary} onClick={()=>openEditStudent(s)}>Edit</button>
          <button style={danger} onClick={()=>removeStudent(s)}>Delete</button>
          <button style={secondary} onClick={()=>shareStudent(s,'whatsapp')}>WhatsApp</button>
          <button style={secondary} onClick={()=>shareStudent(s,'sms')}>SMS</button>
          <button style={secondary} onClick={()=>shareStudent(s,'pdf')}>PDF / Print</button>
         </div></td>
        </tr>)}
        {!studentsLoading && filteredStudents.length===0 && <tr><td colSpan="6" style={{textAlign:'center',padding:25}}>No student records found. Add your first student.</td></tr>}
        </tbody></table></div>
      </section>
     ) : active==='Schools Management' ? (
      <section className="workspace"><div className="section-head"><div><h2>Schools Management</h2><p>Add and view schools in this workspace.</p></div><button className="primary" onClick={()=>setShowAddSchool(true)}>＋ Add School</button></div>
       <div className="table-wrap"><table><thead><tr><th>School</th><th>Code</th><th>Location</th><th>Status</th></tr></thead><tbody>{schools.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.code}</td><td>{s.city||'—'}</td><td><span className="status">{s.status}</span></td></tr>)}</tbody></table></div>
      </section>
     ) : <section className="workspace"><button className="back" onClick={()=>setActive('Dashboard')}>← Dashboard</button><h2>{active}</h2><div className="pending"><b>MODULE FOUNDATION</b><p>This module will be implemented in its development phase. Students module is the first live Firebase module.</p></div></section>}
    </div>
   </main>

   {showAddSchool && <div className="overlay"><form className="modal" onSubmit={addSchool}><h2>Add New School</h2>
    <label>School Name<input required value={schoolForm.name} onChange={e=>setSchoolForm({...schoolForm,name:e.target.value})}/></label>
    <label>School Code<input required value={schoolForm.code} onChange={e=>setSchoolForm({...schoolForm,code:e.target.value.toUpperCase()})}/></label>
    <label>City / Address<input value={schoolForm.city} onChange={e=>setSchoolForm({...schoolForm,city:e.target.value})}/></label>
    <div className="actions"><button type="button" className="secondary" onClick={()=>setShowAddSchool(false)}>Cancel</button><button className="primary">Save School</button></div>
   </form></div>}

   {showStudentForm && <div className="overlay"><form className="modal" style={{maxWidth:650,maxHeight:'90vh',overflowY:'auto'}} onSubmit={saveStudent}>
    <h2>{editingStudent?'Edit Student':'Add New Student'}</h2>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
     {[
      ['name','Student Name',true],['admissionNo','Admission Number',false],['fatherName','Father Name',false],['motherName','Mother Name',false],
      ['className','Class',true],['section','Section',false],['dob','Date of Birth',false],['gender','Gender',false],
      ['phone','Mobile Number',false],['whatsapp','WhatsApp Number',false],['email','Email',false],['address','Address',false]
     ].map(([key,label,required])=><label key={key} style={labelStyle}>{label}
      {key==='gender' ? <select style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>
      : key==='className' ? <select required style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}><option value="">Select Class</option>{['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'].map(c=><option key={c}>{c}</option>)}</select>
      : key==='dob' ? <input type="date" style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>
      : key==='address' ? <textarea style={inputStyle} rows="2" value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>
      : <input required={required} type={key==='email'?'email':'text'} style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>}
     </label>)}
    </div>
    <p style={{fontSize:12,color:'#64748b'}}>School: {school==='All Schools'?(schools[0]?.name||'Iqra Public School'):school}</p>
    <div className="actions"><button type="button" className="secondary" onClick={()=>setShowStudentForm(false)}>Cancel</button><button className="primary" disabled={savingStudent}>{savingStudent?'Saving...':'Save Student'}</button></div>
   </form></div>}

   {viewStudent && <div className="overlay"><div className="modal" style={{maxWidth:560}}>
    <h2>Student Details</h2>
    {Object.entries({Name:viewStudent.name,'Admission No.':viewStudent.admissionNo,'Father Name':viewStudent.fatherName,'Mother Name':viewStudent.motherName,Class:`${viewStudent.className||''} ${viewStudent.section||''}`,'Date of Birth':viewStudent.dob,Gender:viewStudent.gender,Phone:viewStudent.phone,WhatsApp:viewStudent.whatsapp,Email:viewStudent.email,Address:viewStudent.address,School:viewStudent.schoolName}).map(([k,v])=><p key={k} style={{borderBottom:'1px solid #e2e8f0',padding:'7px 0',margin:0}}><b>{k}:</b> {v||'—'}</p>)}
    <div className="actions"><button style={secondary} onClick={()=>shareStudent(viewStudent,'whatsapp')}>WhatsApp</button><button style={secondary} onClick={()=>shareStudent(viewStudent,'pdf')}>PDF / Print</button><button style={primary} onClick={()=>setViewStudent(null)}>Close</button></div>
   </div></div>}
  </div>
 );
}

const styles = {
 center:{minHeight:'100vh',display:'flex',justifyContent:'center',alignItems:'center',padding:20,background:'#eef3fb',fontFamily:'Arial,sans-serif'},
 loginCard:{width:'100%',maxWidth:420,background:'#fff',padding:28,borderRadius:18,boxShadow:'0 10px 35px rgba(0,0,0,.10)',boxSizing:'border-box'},
 label:{display:'block',marginTop:18,marginBottom:7,fontWeight:600,color:'#334155'},
 loginInput:{width:'100%',padding:13,border:'1px solid #cbd5e1',borderRadius:9,fontSize:16,boxSizing:'border-box'},
 loginButton:{width:'100%',marginTop:22,padding:14,background:'#2457d6',color:'#fff',border:0,borderRadius:9,fontSize:16,fontWeight:700},
 error:{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8,fontSize:13}
};
