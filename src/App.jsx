import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getCountFromServer, onSnapshot, setDoc,
  query, updateDoc, where, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import FinanceModule from './FinanceModule.jsx';

const groups = [
 {title:'Super Admin',icon:'👑',items:[['Dashboard','📊'],['Schools Management','🏫'],['School Admins','👨‍💼'],['Roles & Permissions','🔐'],['Subscription & Plans','💳'],['System Settings','⚙️']]},
 {title:'Academic Management',icon:'🎓',items:[['Students','👨‍🎓'],['Admission','📝'],['Teachers & Staff','👩‍🏫'],['Classes & Sections','🏷️'],['Subjects & Syllabus','📚'],['Timetable','🗓️'],['Attendance','✅'],['Examinations','📋'],['Results & Report Cards','🏆'],['Homework','📖']]},
 {title:'Finance Management',icon:'💰',items:[['Fee Collection','💳'],['Fee Structure','🧮'],['Fee Dues','⏳'],['Student Ledger','📒'],['Fee Receipts','🧾'],['Discount & Scholarship','🎁'],['Expenses','💸'],['Financial Reports','📈']]},
 {title:'Communication',icon:'📢',items:[['Parent Portal','👨‍👩‍👧'],['Student Portal','🎒'],['Notices','📣'],['SMS & Notifications','✉️'],['Online Messages','💬'],['Homework Updates','📘']]},
 {title:'Other Services',icon:'🧰',items:[['Certificates','📜'],['ID Cards','🪪'],['Library','📚'],['Transport','🚌'],['Inventory','📦'],['Staff Payroll','💵'],['Backup & Security','🛡️'],['Reports & Analytics','📊']]}
];
const CLASS_LIST=['Nursery','LKG','UKG',...Array.from({length:12},(_,i)=>String(i+1))];
const blankStudent={name:'',admissionNo:'',penNumber:'',fatherName:'',motherName:'',className:'',section:'',dob:'',gender:'',phone:'',whatsapp:'',address:'',email:''};
const inputStyle={width:'100%',padding:11,border:'1px solid #cbd5e1',borderRadius:8,boxSizing:'border-box',fontSize:14,background:'#fff'};
const labelStyle={display:'block',fontWeight:600,fontSize:13,color:'#334155',marginBottom:6};
const primary={background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 15px',fontWeight:700,cursor:'pointer'};
const secondary={background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'10px 13px',fontWeight:600,cursor:'pointer'};
const danger={background:'#fee2e2',color:'#b91c1c',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'};
const friendly=e=>e?.code==='auth/email-already-in-use'?'This email is already registered.':e?.code==='auth/weak-password'?'Password must contain at least 6 characters.':e?.code==='permission-denied'?'Permission denied. Please publish the supplied Firestore Rules.':e?.message||'Something went wrong.';

export default function App(){
 const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[checking,setChecking]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authError,setAuthError]=useState(''),[loginLoading,setLoginLoading]=useState(false),[showRegister,setShowRegister]=useState(false);
 const [reg,setReg]=useState({schoolName:'',schoolCode:'',address:'',adminName:'',email:'',phone:'',password:''});
 const [active,setActive]=useState('Dashboard'),[queryText,setQueryText]=useState(''),[school,setSchool]=useState('All Schools');
 const [schools,setSchools]=useState([{id:'legacy-ips',name:'Iqra Public School',code:'IPS001',city:'Gadayipur, Mauaima, Prayagraj',status:'Active',legacy:true},{id:'legacy-ips2',name:'ips2',code:'IPS002',city:'',status:'Active',legacy:true}]);
 const [students,setStudents]=useState([]),[studentsLoading,setStudentsLoading]=useState(false),[studentError,setStudentError]=useState('');
 const [schoolStudentCounts,setSchoolStudentCounts]=useState({}),[schoolCountsLoading,setSchoolCountsLoading]=useState(false);
 const [studentSearch,setStudentSearch]=useState(''),[studentClassFilter,setStudentClassFilter]=useState('All Classes');
 const [showStudentForm,setShowStudentForm]=useState(false),[studentForm,setStudentForm]=useState(blankStudent),[editingStudent,setEditingStudent]=useState(null),[viewStudent,setViewStudent]=useState(null),[savingStudent,setSavingStudent]=useState(false);
 const [schoolForm,setSchoolForm]=useState({name:'',code:'',city:''}),[showAddSchool,setShowAddSchool]=useState(false);
 const registrationInProgress=useRef(false);
 const [schoolAction,setSchoolAction]=useState(null),[typedSchoolName,setTypedSchoolName]=useState(''),[schoolActionBusy,setSchoolActionBusy]=useState(false);

 useEffect(()=>onAuthStateChanged(auth,async current=>{
  if(registrationInProgress.current){setChecking(false);return;}
  if(!current){setUser(null);setProfile(null);setChecking(false);return;}
  try{
   let snap=await getDoc(doc(db,'users',current.uid));
   let p=snap.exists()?snap.data():null;
   // Recover registrations where Auth and the school record were created but the user profile write was interrupted.
   if(!p){
    const owned=await getDocs(query(collection(db,'schools'),where('ownerUid','==',current.uid)));
    if(owned.size===1){
     const schoolDoc=owned.docs[0], sd=schoolDoc.data();
     p={role:'schooladmin',schoolId:schoolDoc.id,schoolName:sd.name||'',email:current.email||'',displayName:sd.adminName||'',createdAt:serverTimestamp()};
     await setDoc(doc(db,'users',current.uid),p);
    }
   }
   if(!p) throw new Error('User profile not found. Contact Super Admin for account recovery.');
   if(!['superadmin','schooladmin'].includes(p.role)) throw new Error('This account has no permitted role.');
   setUser(current);setProfile(p);setAuthError('');
  }catch(e){setUser(null);setProfile(null);setAuthError(e.message||'Account verification failed.');await signOut(auth);}
  setChecking(false);
 }),[]);

 useEffect(()=>{
  if(!user||profile?.role!=='superadmin')return;
  return onSnapshot(collection(db,'schools'),snap=>{
   const cloud=snap.docs.map(d=>({id:d.id,...d.data()}));
   setSchools(prev=>[...prev.filter(s=>s.legacy),...cloud]);
  },e=>setAuthError('Schools load error: '+e.message));
 },[user,profile]);

 useEffect(()=>{
  if(!user||profile?.role!=='schooladmin'||!profile?.schoolId)return;
  return onSnapshot(doc(db,'schools',profile.schoolId),snap=>{
   if(snap.exists()){const s={id:snap.id,...snap.data()};setSchools(prev=>[...prev.filter(x=>x.id!==s.id),s]);}
  },e=>setAuthError('School status check failed: '+e.message));
 },[user,profile]);

 useEffect(()=>{
  if(!user||!profile)return;
  // Never combine student records from different schools in the student workspace.
  if(profile.role==='superadmin'&&school==='All Schools'){
   setStudents([]);setStudentsLoading(false);setStudentError('');
   return;
  }
  const targetSchool=profile.role==='superadmin'?school:profile.schoolId;
  if(!targetSchool){setStudents([]);setStudentsLoading(false);return;}
  setStudentsLoading(true);setStudentError('');
  const q=query(collection(db,'students'),where('schoolId','==',targetSchool));
  return onSnapshot(q,snap=>{setStudents(snap.docs.map(d=>({id:d.id,...d.data()})));setStudentsLoading(false);},e=>{setStudentError('Students data load failed: '+e.message);setStudentsLoading(false);});
 },[user,profile,school]);

 useEffect(()=>{
  if(!user||profile?.role!=='superadmin')return;
  let cancelled=false;
  const loadCounts=async()=>{
   setSchoolCountsLoading(true);
   try{
    const online=schools.filter(s=>!s.legacy&&!['Archived','Deleted'].includes(s.status));
    const pairs=await Promise.all(online.map(async s=>{
     const snap=await getCountFromServer(query(collection(db,'students'),where('schoolId','==',s.id)));
     return [s.id,snap.data().count];
    }));
    if(!cancelled)setSchoolStudentCounts(Object.fromEntries(pairs));
   }catch(e){if(!cancelled)setAuthError('School-wise student counts could not be loaded: '+e.message);}
   finally{if(!cancelled)setSchoolCountsLoading(false);}
  };
  loadCounts();
  return ()=>{cancelled=true;};
 },[user,profile,schools]);

 const handleLogin=async e=>{e.preventDefault();setAuthError('');setLoginLoading(true);try{await signInWithEmailAndPassword(auth,email.trim(),password);}catch(e){setAuthError(friendly(e));}finally{setLoginLoading(false);}};
 const handleRegister=async e=>{
  e.preventDefault();setAuthError('');setLoginLoading(true);registrationInProgress.current=true;
  let created=null;
  try{
   if(reg.password.length<6)throw new Error('Password must contain at least 6 characters.');
   const cleanEmail=reg.email.trim().toLowerCase();
   const cred=await createUserWithEmailAndPassword(auth,cleanEmail,reg.password);created=cred.user;
   const schoolRef=await addDoc(collection(db,'schools'),{name:reg.schoolName.trim(),code:reg.schoolCode.trim().toUpperCase(),city:reg.address.trim(),phone:reg.phone.trim(),adminName:reg.adminName.trim(),ownerUid:cred.user.uid,status:'Pending',createdAt:serverTimestamp()});
   const profileData={role:'schooladmin',schoolId:schoolRef.id,schoolName:reg.schoolName.trim(),email:cleanEmail,displayName:reg.adminName.trim(),createdAt:serverTimestamp()};
   await setDoc(doc(db,'users',cred.user.uid),profileData);
   await signOut(auth);
   setEmail(cleanEmail);setPassword('');setReg({schoolName:'',schoolCode:'',address:'',adminName:'',email:'',phone:'',password:''});
   setShowRegister(false);
   setAuthError('Registration submitted successfully. Please wait for Super Admin approval. You can log in after approval.');
  }catch(e){
   setAuthError(e?.code==='auth/email-already-in-use'?'This email already has an account. Use Login; the app will try to recover its school profile.':friendly(e));
   if(created){try{await signOut(auth);}catch(_){}}
  }finally{registrationInProgress.current=false;setChecking(false);setLoginLoading(false);}
 };
 const logout=async()=>{await signOut(auth);setUser(null);setProfile(null);setPassword('');setActive('Dashboard');};
 const isSuper=profile?.role==='superadmin';
 const mySchool=schools.find(s=>s.id===profile?.schoolId);
 const isPending=!isSuper&&mySchool?.status!=='Active';
 const visible=useMemo(()=>groups.map(g=>({...g,items:g.items.filter(([n])=>n.toLowerCase().includes(queryText.toLowerCase()))})).filter(g=>g.items.length),[queryText]);
 const addSchool=async e=>{
  e.preventDefault();
  try{await addDoc(collection(db,'schools'),{name:schoolForm.name.trim(),code:schoolForm.code.trim().toUpperCase(),city:schoolForm.city.trim(),status:'Active',createdAt:serverTimestamp()});setSchoolForm({name:'',code:'',city:''});setShowAddSchool(false);}
  catch(e){setAuthError(friendly(e));}
 };
 const openNewStudent=()=>{if(isSuper&&school==='All Schools'){setStudentError('Select one school before adding a student.');return;}setEditingStudent(null);setStudentForm({...blankStudent,admissionNo:'SMP-'+Date.now().toString().slice(-6)});setShowStudentForm(true);};
 const openEditStudent=s=>{if(isSuper&&school!==s.schoolId){setStudentError('This student does not belong to the selected school.');return;}setEditingStudent(s.id);setStudentForm({...blankStudent,...s});setShowStudentForm(true);};
 const saveStudent=async e=>{
  e.preventDefault();if(!studentForm.name.trim()||!studentForm.className){alert('Student name and class are required.');return;}
  setSavingStudent(true);setStudentError('');
  if(isSuper&&school==='All Schools'){setStudentError('Please select one school from the top menu before adding or editing a student.');setSavingStudent(false);return;}
  const targetSchool=isSuper?school:profile.schoolId;
  if(!targetSchool){setStudentError('A valid school must be selected before saving.');setSavingStudent(false);return;}
  const schoolInfo=schools.find(s=>s.id===targetSchool);
  const payload={...studentForm,name:studentForm.name.trim(),admissionNo:studentForm.admissionNo.trim(),penNumber:studentForm.penNumber.trim(),schoolId:targetSchool,schoolName:schoolInfo?.name||profile.schoolName||'',schoolCode:schoolInfo?.code||'',updatedAt:serverTimestamp()};
  try{if(editingStudent)await updateDoc(doc(db,'students',editingStudent),payload);else await addDoc(collection(db,'students'),{...payload,createdAt:serverTimestamp()});setShowStudentForm(false);setEditingStudent(null);setStudentForm(blankStudent);}
  catch(e){setStudentError('Save failed: '+friendly(e));}finally{setSavingStudent(false);}
 };
 const removeStudent=async s=>{if(!window.confirm(`Delete ${s.name}'s record?`))return;try{await deleteDoc(doc(db,'students',s.id));}catch(e){setStudentError('Delete failed: '+friendly(e));}};
 const approveSchool=async s=>{try{await updateDoc(doc(db,'schools',s.id),{status:'Active',approvedAt:serverTimestamp(),updatedAt:serverTimestamp()});}catch(e){setAuthError(friendly(e));}};
 const holdSchool=async s=>{setSchoolAction({school:s,action:'hold'});setTypedSchoolName('');};
 const restoreSchool=async s=>{setSchoolAction({school:s,action:'restore'});setTypedSchoolName('');};
 const archiveSchool=async s=>{setSchoolAction({school:s,action:'archive'});setTypedSchoolName('');};
 const confirmSchoolAction=async e=>{
  e.preventDefault();if(!schoolAction)return;
  const {school:s,action}=schoolAction;
  if(typedSchoolName.trim()!==s.name){alert('School name does not match. No changes made.');return;}
  setSchoolActionBusy(true);
  try{
   if(s.legacy){
    if(action==='hold'||action==='restore'||action==='archive'){
     const ref=await addDoc(collection(db,'schools'),{name:s.name,code:s.code,city:s.city||'',status:action==='hold'?'On Hold':action==='archive'?'Archived':'Active',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),migratedFromLegacy:true});
     setSchools(prev=>prev.map(x=>x.id===s.id?{...x,convertedTo:ref.id}:x));
    }
   }else{
    const status=action==='hold'?'On Hold':action==='archive'?'Archived':'Active';
    await updateDoc(doc(db,'schools',s.id),{status,updatedAt:serverTimestamp(),...(action==='archive'?{archivedAt:serverTimestamp()}:{}),...(action==='restore'?{restoredAt:serverTimestamp()}:{})});
   }
   setSchoolAction(null);setTypedSchoolName('');
  }catch(err){setAuthError(friendly(err));}
  finally{setSchoolActionBusy(false);}
 };
 const shareStudent=(s,kind)=>{
  const msg=`Student Details\nName: ${s.name||''}\nAdmission No: ${s.admissionNo||''}\nPEN Number: ${s.penNumber||'—'}\nFather: ${s.fatherName||''}\nClass: ${s.className||''} ${s.section||''}\nSchool: ${s.schoolName||''}\nPhone: ${s.phone||''}`;
  const phone=(s.whatsapp||s.phone||'').replace(/\D/g,'');
  if(kind==='whatsapp')window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank','noopener,noreferrer');
  else if(kind==='sms')window.location.href=`sms:${phone}?body=${encodeURIComponent(msg)}`;
  else{const w=window.open('','_blank');if(!w){alert('Allow pop-ups, then try again.');return;}const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.document.write(`<html><head><title>Student Details</title><style>body{font-family:Arial;padding:28px}h2{color:#1d4ed8}p{border-bottom:1px solid #ddd;padding:8px 0}</style></head><body><h2>School Manager Pro</h2><h3>Student Details</h3>${[['Name',s.name],['Admission No',s.admissionNo],['PEN Number',s.penNumber],['Father Name',s.fatherName],['Mother Name',s.motherName],['Class',`${s.className||''} ${s.section||''}`],['DOB',s.dob],['Gender',s.gender],['Phone',s.phone],['Address',s.address],['School',s.schoolName]].map(([k,v])=>`<p><b>${k}:</b> ${esc(v||'—')}</p>`).join('')}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();}
 };
 const filteredStudents=students.filter(s=>`${s.name||''} ${s.admissionNo||''} ${s.penNumber||''} ${s.fatherName||''} ${s.phone||''}`.toLowerCase().includes(studentSearch.toLowerCase())&&(studentClassFilter==='All Classes'||s.className===studentClassFilter));
 const classes=[...new Set(students.map(s=>s.className).filter(Boolean))];
 if(checking)return <div style={styles.center}><div style={styles.loginCard}><h2>🏫 School Manager Pro</h2><p>Checking account...</p></div></div>;
 if(!user)return <div style={styles.center}><form style={styles.loginCard} onSubmit={showRegister?handleRegister:handleLogin}>
  <div style={{fontSize:44,textAlign:'center'}}>🏫</div><h1 style={{textAlign:'center',marginBottom:5}}>School Manager Pro</h1>
  <p style={{textAlign:'center',color:'#64748b'}}>{showRegister?'Register Your School':'Secure Login'}</p>
  {showRegister?<>
   {Object.entries({schoolName:'School Name',schoolCode:'School Code',address:'School Address',adminName:'Owner / Admin Name',email:'Email Address',phone:'Mobile Number',password:'Create Password'}).map(([k,l])=><label key={k} style={styles.label}>{l}<input required style={styles.loginInput} type={k==='email'?'email':k==='password'?'password':'text'} value={reg[k]} onChange={e=>setReg({...reg,[k]:e.target.value})} minLength={k==='password'?6:undefined}/></label>)}
   <p style={{fontSize:12,color:'#64748b'}}>Registration will be sent to Super Admin for approval.</p>
  </>:<>
   <label style={styles.label}>Email Address</label><input style={styles.loginInput} type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter email"/>
   <label style={styles.label}>Password</label><input style={styles.loginInput} type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/>
  </>}
  {authError&&<p style={styles.error}>{authError}</p>}
  <button type="submit" disabled={loginLoading} style={styles.loginButton}>{loginLoading?'Please wait...':showRegister?'Submit Registration':'Login'}</button>
  <button type="button" style={{...secondary,width:'100%',marginTop:10}} onClick={()=>{setShowRegister(!showRegister);setAuthError('');}}>{showRegister?'Already registered? Login':'Register New School'}</button>
  <p style={{textAlign:'center',fontSize:12,color:'#64748b'}}>Firebase Authentication</p>
 </form></div>;
 if(isPending)return <div style={styles.center}><div style={styles.loginCard}><h2>⏳ Registration Pending</h2><p>Your school registration has been received. Super Admin approval is required before you can use the dashboard.</p><p><b>{profile?.schoolName||mySchool?.name}</b></p><button style={styles.loginButton} onClick={logout}>Logout</button></div></div>;

 return <div className="shell">
  <aside className="sidebar"><div className="brand"><span>🏫</span><div>School Manager Pro<small>NEW • MULTI-SCHOOL</small></div></div>
   <div className="side-caption">MAIN WORKSPACE</div><button className={'nav '+(active==='Dashboard'?'selected':'')} onClick={()=>setActive('Dashboard')}>📊 Dashboard</button>
   {groups.filter(g=>isSuper||g.title!=='Super Admin').map(g=><div className="side-group" key={g.title}><div className="side-caption">{g.icon} {g.title}</div>{g.items.filter(([n])=>isSuper||!['Schools Management','School Admins','Roles & Permissions','Subscription & Plans','System Settings'].includes(n)).map(([n,ic])=><button key={n} className={'nav '+(active===n?'selected':'')} onClick={()=>setActive(n)}>{ic} {n}</button>)}</div>)}
  </aside>
  <main className="main"><header className="top"><div><b>{active}</b><small>{isSuper?'Super Admin':profile?.schoolName||'School Admin'} · School Manager Pro</small></div><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>{isSuper&&<select value={school} onChange={e=>setSchool(e.target.value)}><option>All Schools</option>{schools.filter(s=>!s.legacy&&!['On Hold','Archived','Deleted'].includes(s.status)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}<button className="secondary" onClick={logout}>Logout</button></div></header>
   <div className="content">
    {active==='Dashboard'?<><section className="hero"><div><span className="eyebrow">{isSuper?'SUPER ADMIN WORKSPACE':'SCHOOL ADMIN WORKSPACE'}</span><h1>Welcome to School Manager Pro</h1><p>{isSuper?'Manage registered schools and platform activity.':'Manage your school from your mobile or computer.'}</p>{isSuper&&<button className="primary" onClick={()=>setActive('Schools Management')}>View School Registrations</button>}</div><div className="hero-icon">🏫</div></section><div className="stats"><div className="stat"><small>{isSuper?'Total Schools':'Your School'}</small><strong>{isSuper?schools.length:profile?.schoolName||'—'}</strong></div><div className="stat"><small>{isSuper?'Pending Approvals':'Total Students'}</small><strong>{isSuper?schools.filter(s=>!s.legacy&&s.status==='Pending').length:students.length}</strong></div><div className="stat"><small>Management Categories</small><strong>5</strong></div><div className="stat"><small>Modules</small><strong>{groups.reduce((n,g)=>n+g.items.length,0)}</strong></div></div>{isSuper&&<section className="workspace" style={{marginTop:18}}><div className="section-head"><div><h2>School-wise Student Overview</h2><p>Student counts are calculated separately using each school's School ID.</p></div><span>{schoolCountsLoading?'Updating counts…':`Total: ${Object.values(schoolStudentCounts).reduce((a,b)=>a+b,0)}`}</span></div><div className="table-wrap"><table><thead><tr><th>School</th><th>School ID</th><th>Status</th><th>Students</th><th>Action</th></tr></thead><tbody>{schools.filter(s=>!s.legacy&&!['Archived','Deleted'].includes(s.status)).map(s=><tr key={s.id}><td>{s.name}</td><td style={{fontSize:12}}>{s.id}</td><td>{s.status}</td><td><b>{schoolStudentCounts[s.id]??'—'}</b></td><td><button style={secondary} onClick={()=>{setSchool(s.id);setActive('Students');}}>Open School</button></td></tr>)}{!schools.some(s=>!s.legacy&&!['Archived','Deleted'].includes(s.status))&&<tr><td colSpan="5">No online schools found.</td></tr>}</tbody></table></div></section>}<div className="section-head"><div><h2>Management Panels</h2><p>Choose a category and open a module.</p></div><input value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Search panels..."/></div>{visible.filter(g=>isSuper||g.title!=='Super Admin').map(g=><section className="category" key={g.title}><h3>{g.icon} {g.title}</h3><div className="tiles">{g.items.filter(([n])=>isSuper||!['Schools Management','School Admins','Roles & Permissions','Subscription & Plans','System Settings'].includes(n)).map(([n,ic])=><button className="tile" key={n} onClick={()=>setActive(n)}><span>{ic}</span><b>{n}</b><small>Open module →</small></button>)}</div></section>)}</>:null}
    {active==='Schools Management'&&isSuper?<section className="workspace"><div className="section-head"><div><h2>Schools Management</h2><p>Review registrations and control school access.</p></div><button style={primary} onClick={()=>setShowAddSchool(true)}>＋ Add School</button></div><div className="table-wrap"><table><thead><tr><th>School</th><th>Code</th><th>Admin</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead><tbody>{schools.filter(s=>!s.convertedTo).map(s=><tr key={s.id}><td>{s.name}</td><td>{s.code}</td><td>{s.adminName||'—'}</td><td>{s.city||'—'}</td><td><b>{s.status}</b>{s.legacy?' · Demo (not online yet)':''}</td><td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{s.legacy?<button style={primary} onClick={()=>setSchoolAction({school:s,action:'restore'})}>Add to Online Schools</button>:null}{!s.legacy&&s.status==='Pending'&&<button style={primary} onClick={()=>approveSchool(s)}>Approve</button>}{!s.legacy&&s.status==='Active'&&<button style={secondary} onClick={()=>holdSchool(s)}>Put On Hold</button>}{!s.legacy&&s.status==='On Hold'&&<button style={primary} onClick={()=>restoreSchool(s)}>Restore Active</button>}{!s.legacy&&s.status!=='Archived'&&<button style={danger} onClick={()=>archiveSchool(s)}>Archive</button>}{!s.legacy&&s.status==='Archived'&&<button style={primary} onClick={()=>restoreSchool(s)}>Restore</button>}</div></td></tr>)}</tbody></table></div></section>:null}
    {active==='Students'&&<section className="workspace"><div className="section-head"><div><h2>Students Management</h2><p>{isSuper?(school==='All Schools'?'Select one school to view its students.':'Showing records for '+(schools.find(s=>s.id===school)?.name||'selected school')):"Only your school's student records are shown."}</p></div>{(!isSuper||school!=='All Schools')&&<button style={primary} onClick={openNewStudent}>＋ Add Student</button>}</div>{isSuper&&school==='All Schools'?<div className="pending"><b>Choose a school first</b><p>Student records from different schools are not combined here. Select a school from the top menu or use the School-wise Student Overview on the Dashboard.</p></div>:null}{studentError&&<p style={{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8}}>{studentError}</p>}{!(isSuper&&school==='All Schools')&&<><div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'15px 0'}}><input style={{...inputStyle,flex:'1 1 220px'}} value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Search name, admission no, PEN, father, phone..."/><select style={{...inputStyle,flex:'0 1 180px'}} value={studentClassFilter} onChange={e=>setStudentClassFilter(e.target.value)}><option>All Classes</option>{classes.map(c=><option key={c}>{c}</option>)}</select></div><div style={{fontSize:13,color:'#64748b',marginBottom:10}}>Total students: <b>{filteredStudents.length}</b> {studentsLoading?' · Loading...':''}</div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Admission No.</th><th>PEN Number</th><th>Class</th><th>Father</th><th>Phone</th><th>Actions</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.admissionNo||'—'}</td><td>{s.penNumber||'—'}</td><td>{s.className} {s.section}</td><td>{s.fatherName||'—'}</td><td>{s.phone||'—'}</td><td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}><button style={secondary} onClick={()=>setViewStudent(s)}>View</button><button style={secondary} onClick={()=>openEditStudent(s)}>Edit</button><button style={danger} onClick={()=>removeStudent(s)}>Delete</button><button style={secondary} onClick={()=>shareStudent(s,'whatsapp')}>WhatsApp</button><button style={secondary} onClick={()=>shareStudent(s,'sms')}>SMS</button><button style={secondary} onClick={()=>shareStudent(s,'pdf')}>PDF / Print</button></div></td></tr>)}{!studentsLoading&&!filteredStudents.length&&<tr><td colSpan="7" style={{textAlign:'center',padding:25}}>No student records found.</td></tr>}</tbody></table></div></>}</section>}
    {groups.find(g=>g.title==='Finance Management')?.items.some(([name])=>name===active)&&<FinanceModule active={active} schoolId={isSuper?school:profile?.schoolId} schoolName={isSuper?(schools.find(s=>s.id===school)?.name||''):profile?.schoolName||mySchool?.name||''} students={students} profile={profile} onBack={()=>setActive('Dashboard')}/> }
    {active!=='Dashboard'&&active!=='Students'&&!groups.find(g=>g.title==='Finance Management')?.items.some(([name])=>name===active)&&!(active==='Schools Management'&&isSuper)&&<section className="workspace"><button className="back" onClick={()=>setActive('Dashboard')}>← Dashboard</button><h2>{active}</h2><div className="pending"><b>MODULE FOUNDATION</b><p>This module is listed and will be connected in its development phase. Students and school registration are the current live modules.</p></div></section>}
   </div>
  </main>
  {schoolAction&&<div className="overlay"><form className="modal" onSubmit={confirmSchoolAction}><h2>{schoolAction.action==='hold'?'Put School On Hold':schoolAction.action==='archive'?'Archive School':'Add / Restore School'}</h2><p>To prevent accidental changes, type the exact school name to confirm:</p><p><b>{schoolAction.school.name}</b></p><input autoFocus required style={inputStyle} value={typedSchoolName} onChange={e=>setTypedSchoolName(e.target.value)} placeholder="Type school name exactly"/><p style={{fontSize:12,color:'#64748b'}}>This action is saved online in Firebase. Archive does not permanently erase school or student records. Permanent deletion is intentionally not enabled in this update; it must include backup and deletion of related records.</p><div className="actions"><button type="button" className="secondary" onClick={()=>setSchoolAction(null)}>Cancel</button><button className="primary" disabled={schoolActionBusy||typedSchoolName.trim()!==schoolAction.school.name}>{schoolActionBusy?'Saving...':'Confirm'}</button></div></form></div>}
  {showAddSchool&&<div className="overlay"><form className="modal" onSubmit={addSchool}><h2>Add New School</h2><label>School Name<input required value={schoolForm.name} onChange={e=>setSchoolForm({...schoolForm,name:e.target.value})}/></label><label>School Code<input required value={schoolForm.code} onChange={e=>setSchoolForm({...schoolForm,code:e.target.value.toUpperCase()})}/></label><label>City / Address<input value={schoolForm.city} onChange={e=>setSchoolForm({...schoolForm,city:e.target.value})}/></label><div className="actions"><button type="button" className="secondary" onClick={()=>setShowAddSchool(false)}>Cancel</button><button className="primary">Save School</button></div></form></div>}
  {showStudentForm&&<div className="overlay"><form className="modal" style={{maxWidth:700,maxHeight:'90vh',overflowY:'auto'}} onSubmit={saveStudent}><h2>{editingStudent?'Edit Student':'Add New Student'}</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>{[['name','Student Name',true],['admissionNo','Admission Number',false],['penNumber','PEN Number',false],['fatherName','Father Name',false],['motherName','Mother Name',false],['className','Class',true],['section','Section',false],['dob','Date of Birth',false],['gender','Gender',false],['phone','Mobile Number',false],['whatsapp','WhatsApp Number',false],['email','Email',false],['address','Address',false]].map(([key,label,required])=><label key={key} style={labelStyle}>{label}{key==='className'?<select required style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}><option value="">Select Class</option>{CLASS_LIST.map(c=><option key={c}>{c}</option>)}</select>:key==='gender'?<select style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>:key==='dob'?<input type="date" style={inputStyle} value={studentForm[key]||''} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>:key==='address'?<textarea style={inputStyle} rows="2" value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>:<input required={required} type={key==='email'?'email':'text'} style={inputStyle} value={studentForm[key]||''} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>}</label>)}</div><p style={{fontSize:12,color:'#64748b'}}>School: {isSuper?(school==='All Schools'?'Select a school from the top list':schools.find(s=>s.id===school)?.name):profile?.schoolName}</p><div className="actions"><button type="button" className="secondary" onClick={()=>setShowStudentForm(false)}>Cancel</button><button className="primary" disabled={savingStudent}>{savingStudent?'Saving...':'Save Student'}</button></div></form></div>}
  {viewStudent&&<div className="overlay"><div className="modal" style={{maxWidth:560}}><h2>Student Details</h2>{Object.entries({Name:viewStudent.name,'Admission No.':viewStudent.admissionNo,'PEN Number':viewStudent.penNumber,'Father Name':viewStudent.fatherName,'Mother Name':viewStudent.motherName,Class:`${viewStudent.className||''} ${viewStudent.section||''}`,'Date of Birth':viewStudent.dob,Gender:viewStudent.gender,Phone:viewStudent.phone,WhatsApp:viewStudent.whatsapp,Email:viewStudent.email,Address:viewStudent.address,School:viewStudent.schoolName}).map(([k,v])=><p key={k} style={{borderBottom:'1px solid #e2e8f0',padding:'7px 0',margin:0}}><b>{k}:</b> {v||'—'}</p>)}<div className="actions"><button style={secondary} onClick={()=>shareStudent(viewStudent,'whatsapp')}>WhatsApp</button><button style={secondary} onClick={()=>shareStudent(viewStudent,'pdf')}>PDF / Print</button><button style={primary} onClick={()=>setViewStudent(null)}>Close</button></div></div></div>}
 </div>;
}
const styles={center:{minHeight:'100vh',display:'flex',justifyContent:'center',alignItems:'center',padding:20,background:'#eef3fb',fontFamily:'Arial,sans-serif'},loginCard:{width:'100%',maxWidth:460,background:'#fff',padding:28,borderRadius:18,boxShadow:'0 10px 35px rgba(0,0,0,.10)',boxSizing:'border-box'},label:{display:'block',marginTop:14,marginBottom:7,fontWeight:600,color:'#334155'},loginInput:{width:'100%',padding:13,border:'1px solid #cbd5e1',borderRadius:9,fontSize:16,boxSizing:'border-box'},loginButton:{width:'100%',marginTop:22,padding:14,background:'#2457d6',color:'#fff',border:0,borderRadius:9,fontSize:16,fontWeight:700},error:{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8,fontSize:13}};
