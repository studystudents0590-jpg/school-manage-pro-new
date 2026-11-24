import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification
} from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getCountFromServer, onSnapshot, setDoc,
  query, updateDoc, where, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { auth, db } from './firebase';
import FinanceModule from './FinanceModule.jsx';
import TeachersModule from './TeachersModule.jsx';
import ClassesSectionsModule from './ClassesSectionsModule.jsx';
import SubjectsSyllabusModule from './SubjectsSyllabusModule.jsx';
import TimetableModule from './TimetableModule.jsx';
import ParentPortal from './ParentPortal.jsx';

const groups = [
 {title:'Super Admin',icon:'👑',items:[['Dashboard','📊'],['Schools Management','🏫'],['School Admins','👨‍💼'],['Roles & Permissions','🔐'],['Subscription & Plans','💳'],['System Settings','⚙️']]},
 {title:'Academic Management',icon:'🎓',items:[['Students','👨‍🎓'],['Admission','📝'],['Teachers & Staff','👩‍🏫'],['Classes & Sections','🏷️'],['Subjects & Syllabus','📚'],['Timetable','🗓️'],['Attendance','✅'],['Examinations','📋'],['Results & Report Cards','🏆'],['Homework','📖']]},
 {title:'Finance Management',icon:'💰',items:[['Fee Collection','💳'],['Fee Structure','🧮'],['Fee Dues','⏳'],['Student Ledger','📒'],['Fee Receipts','🧾'],['Discount & Scholarship','🎁'],['Expenses','💸'],['Financial Reports','📈']]},
 {title:'Communication',icon:'📢',items:[['Parent Portal','👨‍👩‍👧'],['Student Portal','🎒'],['Notices','📣'],['SMS & Notifications','✉️'],['Online Messages','💬'],['Homework Updates','📘']]},
 {title:'Other Services',icon:'🧰',items:[['Certificates','📜'],['ID Cards','🪪'],['Library','📚'],['Transport','🚌'],['Inventory','📦'],['Staff Payroll','💵'],['Backup & Security','🛡️'],['Reports & Analytics','📊']]}
];
const CLASS_LIST=['Nursery','LKG','UKG',...Array.from({length:12},(_,i)=>String(i+1))];
const blankStudent={name:'',admissionNo:'',penNumber:'',aadhaarLast4:'',admissionDate:'',fatherName:'',motherName:'',className:'',section:'',dob:'',gender:'',phone:'',whatsapp:'',address:'',email:'',academicYear:'2026-27',admissionType:'New Admission',admissionFee:'3000',renewalFee:'2000',admissionFeeStatus:'Pending',examFee:'0',examFeeStatus:'Pending',monthlySchoolFee:'',transportOpted:'No',vanRoute:'',vanStartDate:'',monthlyVanFee:'0',otherFeeName:'',otherFeeAmount:'0'};
const inputStyle={width:'100%',padding:11,border:'1px solid #cbd5e1',borderRadius:8,boxSizing:'border-box',fontSize:14,background:'#fff'};
const labelStyle={display:'block',fontWeight:600,fontSize:13,color:'#334155',marginBottom:6};
const primary={background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 15px',fontWeight:700,cursor:'pointer'};
const secondary={background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'10px 13px',fontWeight:600,cursor:'pointer'};
const danger={background:'#fee2e2',color:'#b91c1c',border:0,borderRadius:8,padding:'9px 12px',fontWeight:600,cursor:'pointer'};
const APP_OWNER_UID='axjtzbtoMzXJlqHUdUgZykDYgSw2';
const friendly=e=>e?.code==='auth/email-already-in-use'?'This email is already registered.':e?.code==='auth/weak-password'?'Password must contain at least 6 characters.':e?.code==='permission-denied'?'Permission denied. Please publish the supplied Firestore Rules.':e?.message||'Something went wrong.';

export default function App(){
 const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[checking,setChecking]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authError,setAuthError]=useState(''),[loginLoading,setLoginLoading]=useState(false),[showRegister,setShowRegister]=useState(false),[forgotMode,setForgotMode]=useState(false),[showTeacherRegister,setShowTeacherRegister]=useState(false);
 const [reg,setReg]=useState({schoolName:'',schoolCode:'',address:'',adminName:'',email:'',phone:'',password:''});
 const [active,setActive]=useState('Dashboard'),[queryText,setQueryText]=useState(''),[school,setSchool]=useState('All Schools');
 const [schools,setSchools]=useState([{id:'legacy-ips',name:'Iqra Public School',code:'IPS001',city:'Gadayipur, Mauaima, Prayagraj',status:'Active',legacy:true},{id:'legacy-ips2',name:'ips2',code:'IPS002',city:'',status:'Active',legacy:true}]);
 const [students,setStudents]=useState([]),[studentsLoading,setStudentsLoading]=useState(false),[studentError,setStudentError]=useState('');
 const [academicSessions,setAcademicSessions]=useState([]),[schoolClassSetup,setSchoolClassSetup]=useState([]),[academicSetupLoading,setAcademicSetupLoading]=useState(false);
 const [schoolStudentCounts,setSchoolStudentCounts]=useState({}),[schoolCountsLoading,setSchoolCountsLoading]=useState(false);
 const [studentSearch,setStudentSearch]=useState(''),[studentClassFilter,setStudentClassFilter]=useState('All Classes');
 const [showStudentForm,setShowStudentForm]=useState(false),[studentForm,setStudentForm]=useState(blankStudent),[editingStudent,setEditingStudent]=useState(null),[viewStudent,setViewStudent]=useState(null),[savingStudent,setSavingStudent]=useState(false);
 const [schoolForm,setSchoolForm]=useState({name:'',code:'',city:''}),[showAddSchool,setShowAddSchool]=useState(false);
 const registrationInProgress=useRef(false);
 const [schoolAction,setSchoolAction]=useState(null),[typedSchoolName,setTypedSchoolName]=useState(''),[schoolActionBusy,setSchoolActionBusy]=useState(false);
 const [profileEdit,setProfileEdit]=useState({name:'',city:'',phone:'',adminName:''});
 const [profileRequests,setProfileRequests]=useState([]),[myProfileRequests,setMyProfileRequests]=useState([]);
 const [profileRequestBusy,setProfileRequestBusy]=useState(false);

 useEffect(()=>onAuthStateChanged(auth,async current=>{
  if(registrationInProgress.current){setChecking(false);return;}
  if(!current){setUser(null);setProfile(null);setChecking(false);return;}
  try{
   let snap=await getDoc(doc(db,'users',current.uid));
   let p=snap.exists()?snap.data():null;
   if(p?.role==='teacher'){
    if(!current.emailVerified) throw new Error('Please verify your email before using Teacher Login.');
    const teacherSnap=await getDoc(doc(db,'teachers',p.teacherId));
    if(!teacherSnap.exists()) throw new Error('Teacher record not found. Contact your School Admin.');
    const td=teacherSnap.data();
    if(td.teacherAuthUid!==current.uid || td.status!=='Active' || (td.email||'').toLowerCase()!==(current.email||'').toLowerCase()) throw new Error('Teacher login is not active or no longer linked. Contact your School Admin.');
    const schoolSnap=await getDoc(doc(db,'schools',td.schoolId));
    if(!schoolSnap.exists()||schoolSnap.data().status!=='Active') throw new Error('Your school is not active. Contact your School Admin.');
    p={...p,...td,role:'teacher',teacherId:p.teacherId,schoolId:td.schoolId,schoolName:td.schoolName||schoolSnap.data().name||p.schoolName||'',displayName:td.name||p.displayName,email:current.email};
   }
   // Recover registrations where Auth and the school record were created but the user profile write was interrupted.
   if(!p){
    const owned=await getDocs(query(collection(db,'schools'),where('ownerUid','==',current.uid)));
    if(owned.size===1){
     const schoolDoc=owned.docs[0], sd=schoolDoc.data();
     p={role:'schooladmin',schoolId:schoolDoc.id,schoolName:sd.name||'',email:current.email||'',displayName:sd.adminName||'',createdAt:serverTimestamp()};
     await setDoc(doc(db,'users',current.uid),p);
    }
   }
   if(!p){
    if(!current.emailVerified) throw new Error('Please verify your email first. Open the verification link sent to your email, then log in again.');
    const teacherSnap=await getDocs(query(collection(db,'teachers'),where('email','==',(current.email||'').toLowerCase()),where('status','==','Active')));
    if(teacherSnap.size!==1) throw new Error(teacherSnap.empty?'No active teacher record matches this verified email. Ask your School Admin to add your email in Teachers & Staff.':'More than one active teacher record uses this email. Ask your School Admin to correct duplicate records.');
    const teacherDoc=teacherSnap.docs[0], td=teacherDoc.data();
    if(td.teacherAuthUid && td.teacherAuthUid!==current.uid) throw new Error('This teacher record is already linked to another login. Contact your School Admin.');
    // The teacher query is allowed only for an Active teacher record in an Active school.
    if(!td.teacherAuthUid) await updateDoc(doc(db,'teachers',teacherDoc.id),{teacherAuthUid:current.uid,loginLinkedAt:serverTimestamp()});
    p={...td,role:'teacher',teacherId:teacherDoc.id,schoolId:td.schoolId,schoolName:td.schoolName||'',displayName:td.name||current.email,email:current.email};
    await setDoc(doc(db,'users',current.uid),{role:'teacher',teacherId:teacherDoc.id,schoolId:td.schoolId,schoolName:p.schoolName,displayName:p.displayName,email:current.email,createdAt:serverTimestamp()});
   }
   if(!['superadmin','schooladmin','teacher','parent'].includes(p.role)) throw new Error('This account has no permitted role.');
   if(p.role==='teacher' && (!p.teacherId||!p.schoolId)) throw new Error('Teacher account is not linked correctly. Contact your School Admin.');
   if(p.role==='parent') {
    if(!p.schoolId) throw new Error('Parent account is not linked to a school. Contact your School Admin.');
    const parentSchool=await getDoc(doc(db,'schools',p.schoolId));
    if(!parentSchool.exists()||parentSchool.data().status!=='Active') throw new Error('Your school is not active. Contact your School Admin.');
    const linkedChildren=await getDocs(query(collection(db,'students'),where('parentUid','==',current.uid)));
    if(linkedChildren.empty) throw new Error('No child is linked to this Parent Login. Contact your School Admin.');
    p={...p,schoolName:p.schoolName||parentSchool.data().name||'',email:current.email||p.email||''};
   }
   setUser(current);setProfile(p);if(p?.role==='parent')setActive('Parent Portal');setAuthError('');
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
  const requestsRef=collection(db,'schoolProfileUpdateRequests');
  if(profile.role==='superadmin'){
   const q=query(requestsRef,where('status','==','Pending'));
   return onSnapshot(q,snap=>setProfileRequests(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>setAuthError('Profile requests load error: '+e.message));
  }
  if(profile.role==='schooladmin'&&profile.schoolId){
   const q=query(requestsRef,where('schoolId','==',profile.schoolId));
   return onSnapshot(q,snap=>setMyProfileRequests(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>setAuthError('Your profile requests load error: '+e.message));
  }
 },[user,profile]);

 useEffect(()=>{
  if(!user||!profile)return;
  if(profile.role==='parent'){setStudents([]);setStudentsLoading(false);setStudentError('');return;}
  // Never combine student records from different schools in the student workspace.
  if(profile.role==='superadmin'&&school==='All Schools'){
   setStudents([]);setStudentsLoading(false);setStudentError('');
   return;
  }
  const targetSchool=profile.role==='superadmin'?school:profile.schoolId;
  if(!targetSchool){setStudents([]);setStudentsLoading(false);return;}
  setStudentsLoading(true);setStudentError('');
  if(isTeacher){
   const allowedClasses=Array.isArray(profile.classes)?profile.classes:[];
   if(!(teacherPermissions.Students||teacherPermissions.Admission)||!allowedClasses.length){setStudents([]);setStudentsLoading(false);return;}
   const q=query(collection(db,'students'),where('schoolId','==',targetSchool),where('className','in',allowedClasses.slice(0,30)));
   return onSnapshot(q,snap=>{setStudents(snap.docs.map(d=>({id:d.id,...d.data()})));setStudentsLoading(false);},e=>{setStudentError('Students data load failed: '+e.message);setStudentsLoading(false);});
  }
  const q=query(collection(db,'students'),where('schoolId','==',targetSchool));
  return onSnapshot(q,snap=>{setStudents(snap.docs.map(d=>({id:d.id,...d.data()})));setStudentsLoading(false);},e=>{setStudentError('Students data load failed: '+e.message);setStudentsLoading(false);});
 },[user,profile,school]);

 // Load the selected school's academic session and its configured classes/sections.
 // This keeps the Admission form connected to the same setup used by Classes & Sections.
 useEffect(()=>{
  if(!user||!profile||profile.role==='parent'){setAcademicSessions([]);setSchoolClassSetup([]);setAcademicSetupLoading(false);return;}
  const targetSchool=profile.role==='superadmin'?school:profile.schoolId;
  if(!targetSchool||targetSchool==='All Schools'){
   setAcademicSessions([]);setSchoolClassSetup([]);setAcademicSetupLoading(false);return;
  }
  setAcademicSessions([]);setSchoolClassSetup([]);
  setAcademicSetupLoading(true);
  const sessionsQuery=query(collection(db,'academicSessions'),where('schoolId','==',targetSchool));
  const classesQuery=query(collection(db,'schoolClasses'),where('schoolId','==',targetSchool));
  let sessionsReady=false,classesReady=false;
  const finishLoading=()=>{if(sessionsReady&&classesReady)setAcademicSetupLoading(false);};
  const unsubSessions=onSnapshot(sessionsQuery,snap=>{
   setAcademicSessions(snap.docs.map(d=>({id:d.id,...d.data()})));
   sessionsReady=true;finishLoading();
  },e=>{setStudentError('Academic sessions could not be loaded: '+friendly(e));sessionsReady=true;finishLoading();});
  const unsubClasses=onSnapshot(classesQuery,snap=>{
   setSchoolClassSetup(snap.docs.map(d=>({id:d.id,...d.data()})));
   classesReady=true;finishLoading();
  },e=>{setStudentError('Class sections could not be loaded: '+friendly(e));classesReady=true;finishLoading();});
  return ()=>{unsubSessions();unsubClasses();};
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
 const handleForgotPassword=async e=>{e.preventDefault();setAuthError('');if(!email.trim()){setAuthError('Please enter your registered email address.');return;}setLoginLoading(true);try{await sendPasswordResetEmail(auth,email.trim().toLowerCase());setAuthError('Password reset link sent. Please check your email inbox and spam folder.');}catch(e){setAuthError(e?.code==='auth/user-not-found'?'No account was found with this email address.':e?.code==='auth/invalid-email'?'Please enter a valid email address.':friendly(e));}finally{setLoginLoading(false);}};
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
 const handleTeacherRegister=async e=>{
  e.preventDefault();setAuthError('');setLoginLoading(true);registrationInProgress.current=true;
  let created=null;
  try{
   const cleanEmail=email.trim().toLowerCase();
   if(!cleanEmail||password.length<6)throw new Error('Enter your teacher email and a password of at least 6 characters.');
   const cred=await createUserWithEmailAndPassword(auth,cleanEmail,password);created=cred.user;
   await sendEmailVerification(cred.user);
   await signOut(auth);
   setPassword('');setShowTeacherRegister(false);
   setAuthError('Verification email sent. Verify your email, then log in here. Your School Admin must first add the same email to your teacher record.');
  }catch(e){setAuthError(friendly(e));if(created){try{await signOut(auth);}catch(_){}}}
  finally{registrationInProgress.current=false;setChecking(false);setLoginLoading(false);}
 };
 const logout=async()=>{await signOut(auth);setUser(null);setProfile(null);setPassword('');setActive('Dashboard');};
 const isSuper=profile?.role==='superadmin';
 const isTeacher=profile?.role==='teacher';
 const teacherPermissions=profile?.permissions||{};
 const isAppOwner=isSuper&&user?.uid===APP_OWNER_UID;
 const mySchool=schools.find(s=>s.id===profile?.schoolId);
 const isPending=profile?.role==='schooladmin'&&mySchool?.status!=='Active';
 const openSchoolProfile=()=>{setProfileEdit({name:mySchool?.name||profile?.schoolName||'',city:mySchool?.city||'',phone:mySchool?.phone||'',adminName:mySchool?.adminName||profile?.displayName||''});setActive('School Profile');};
 const submitProfileUpdate=async e=>{
  e.preventDefault();if(!mySchool||!user)return;
  if(myProfileRequests.some(r=>r.status==='Pending')){setAuthError('A profile update request is already pending.');return;}
  const proposed={name:profileEdit.name.trim(),city:profileEdit.city.trim(),phone:profileEdit.phone.trim(),adminName:profileEdit.adminName.trim()};
  if(!proposed.name||!proposed.city||!proposed.phone||!proposed.adminName){setAuthError('Please fill all profile fields.');return;}
  setProfileRequestBusy(true);setAuthError('');
  try{await addDoc(collection(db,'schoolProfileUpdateRequests'),{schoolId:mySchool.id,schoolName:mySchool.name||'',ownerUid:user.uid,requestedBy:user.uid,previous:{name:mySchool.name||'',city:mySchool.city||'',phone:mySchool.phone||'',adminName:mySchool.adminName||''},proposed,status:'Pending',createdAt:serverTimestamp()});setAuthError('Profile update request submitted. Please wait for Super Admin approval.');}
  catch(err){setAuthError(friendly(err));}finally{setProfileRequestBusy(false);}
 };
 const decideProfileRequest=async(r,decision)=>{
  setProfileRequestBusy(true);setAuthError('');
  try{const batch=writeBatch(db);if(decision==='Approved'){batch.update(doc(db,'schools',r.schoolId),{...r.proposed,updatedAt:serverTimestamp()});batch.update(doc(db,'users',r.ownerUid),{schoolName:r.proposed.name,displayName:r.proposed.adminName,updatedAt:serverTimestamp()});}batch.update(doc(db,'schoolProfileUpdateRequests',r.id),{status:decision,reviewedAt:serverTimestamp(),reviewedBy:user.uid});await batch.commit();}
  catch(err){setAuthError(friendly(err));}finally{setProfileRequestBusy(false);}
 };
 const isParent=profile?.role==='parent';
  const visible=useMemo(()=>isParent?[{title:'Parent',icon:'👨‍👩‍👧',items:[['Parent Portal','👨‍👩‍👧']]}]:groups.map(g=>({...g,items:g.items.filter(([n])=>(!isTeacher||!!teacherPermissions[n])&&n.toLowerCase().includes(queryText.toLowerCase()))})).filter(g=>g.items.length),[queryText,isTeacher,teacherPermissions,isParent]);
 const addSchool=async e=>{
  e.preventDefault();
  try{await addDoc(collection(db,'schools'),{name:schoolForm.name.trim(),code:schoolForm.code.trim().toUpperCase(),city:schoolForm.city.trim(),status:'Active',createdAt:serverTimestamp()});setSchoolForm({name:'',code:'',city:''});setShowAddSchool(false);}
  catch(e){setAuthError(friendly(e));}
 };
 const openNewStudent=()=>{if(isSuper&&school==='All Schools'){setStudentError('Select one school before adding a student.');return;}setEditingStudent(null);setStudentForm({...blankStudent,admissionNo:'SMP-'+Date.now().toString().slice(-6)});setShowStudentForm(true);};
 const openEditStudent=s=>{if(isSuper&&school!==s.schoolId){setStudentError('This student does not belong to the selected school.');return;}setEditingStudent(s.id);setStudentForm({...blankStudent,...s});setShowStudentForm(true);};
 const saveStudent=async e=>{
  e.preventDefault();if(isTeacher){setStudentError('Teacher accounts have read-only student access.');return;}if(!studentForm.name.trim()||!studentForm.className){alert('Student name and class are required.');return;}
 const configuredClass=admissionClassRows.find(c=>c.className===studentForm.className);
 if(configuredClass&&Array.isArray(configuredClass.sections)&&configuredClass.sections.length>0&&!configuredClass.sections.includes(studentForm.section)){
  alert('Please select a valid Section for the selected Class.');return;
 }

  setSavingStudent(true);setStudentError('');
  if(isSuper&&school==='All Schools'){setStudentError('Please select one school from the top menu before adding or editing a student.');setSavingStudent(false);return;}
  const targetSchool=isSuper?school:profile.schoolId;
  if(!targetSchool){setStudentError('A valid school must be selected before saving.');setSavingStudent(false);return;}
  const schoolInfo=schools.find(s=>s.id===targetSchool);
  const payload={...studentForm,name:studentForm.name.trim(),admissionNo:studentForm.admissionNo.trim(),penNumber:studentForm.penNumber.trim(),feeConfig:{academicYear:studentForm.academicYear||'2026-27',admissionType:studentForm.admissionType||'New Admission',admissionFee:Number(studentForm.admissionType==='Renewal'?studentForm.renewalFee:studentForm.admissionFee)||0,admissionFeeType:studentForm.admissionType==='Renewal'?'Renewal Fee':'Admission Fee',admissionFeeStatus:studentForm.admissionFeeStatus||'Pending',examFee:Number(studentForm.examFee)||0,examFeeStatus:studentForm.examFeeStatus||'Pending',monthlySchoolFee:Number(studentForm.monthlySchoolFee)||0,transportOpted:studentForm.transportOpted==='Yes',vanRoute:studentForm.vanRoute||'',vanStartDate:studentForm.transportOpted==='Yes'?(studentForm.vanStartDate||studentForm.admissionDate||''): '',monthlyVanFee:studentForm.transportOpted==='Yes'?Number(studentForm.monthlyVanFee)||0:0,otherFeeName:studentForm.otherFeeName||'',otherFeeAmount:Number(studentForm.otherFeeAmount)||0},schoolId:targetSchool,schoolName:schoolInfo?.name||profile.schoolName||'',schoolCode:schoolInfo?.code||'',updatedAt:serverTimestamp()};
  try{if(editingStudent)await updateDoc(doc(db,'students',editingStudent),payload);else await addDoc(collection(db,'students'),{...payload,createdAt:serverTimestamp()});setShowStudentForm(false);setEditingStudent(null);setStudentForm(blankStudent);}
  catch(e){setStudentError('Save failed: '+friendly(e));}finally{setSavingStudent(false);}
 };
 const removeStudent=async s=>{if(isTeacher){setStudentError('Teacher accounts cannot delete student records.');return;}if(!window.confirm(`Delete ${s.name}'s record?`))return;try{await deleteDoc(doc(db,'students',s.id));}catch(e){setStudentError('Delete failed: '+friendly(e));}};
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
 const studentText=s=>`Student Admission Form\nName: ${s.name||''}\nAdmission No: ${s.admissionNo||''}\nPEN: ${s.penNumber||'—'}\nFather: ${s.fatherName||'—'}\nMother: ${s.motherName||'—'}\nClass: ${s.className||''} ${s.section||''}\nDOB: ${s.dob||'—'}\nMobile: ${s.phone||'—'}\nAddress: ${s.address||'—'}\nAcademic Year: ${s.feeConfig?.academicYear||s.academicYear||'—'}\nAdmission Type: ${s.feeConfig?.admissionType||s.admissionType||'—'}\nAdmission/Renewal Fee: ₹${s.feeConfig?.admissionFee??s.admissionFee??0} (${s.feeConfig?.admissionFeeStatus||s.admissionFeeStatus||'Pending'})\nAnnual Exam Fee: ₹${s.feeConfig?.examFee??s.examFee??0} (${s.feeConfig?.examFeeStatus||s.examFeeStatus||'Pending'})\nMonthly School Fee: ₹${s.feeConfig?.monthlySchoolFee??s.monthlySchoolFee??0}\nTransport: ${s.feeConfig?.transportOpted?'Yes':'No'} ${s.feeConfig?.vanRoute||''}\nVan Start Date: ${s.feeConfig?.vanStartDate||'—'}\nMonthly Van Fee: ₹${s.feeConfig?.monthlyVanFee??0}\nOther Fee: ${s.feeConfig?.otherFeeName||'—'} ₹${s.feeConfig?.otherFeeAmount??0}\nSchool: ${s.schoolName||''}`;
 const studentActions=async(s,action)=>{const msg=studentText(s);if(action==='view'){setViewStudent(s);return;}if(action==='copy'){try{await navigator.clipboard.writeText(msg);alert('Student form copied.');}catch(_){alert('Copy is not supported on this device.');}return;}if(action==='share'){if(navigator.share){try{await navigator.share({title:'Student Admission Form',text:msg});}catch(_){}}else{try{await navigator.clipboard.writeText(msg);alert('Sharing unavailable. Details copied; paste in WhatsApp.');}catch(_){alert('Sharing is not supported.');}}return;}const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const rows=msg.split('\n').slice(1).map(line=>{const i=line.indexOf(':');return `<p><b>${esc(line.slice(0,i))}:</b> ${esc(line.slice(i+1).trim())}</p>`}).join('');const w=window.open('','_blank');if(!w){alert('Allow pop-ups to print or save as PDF.');return;}w.document.write(`<html><head><title>Student Admission Form</title><style>body{font-family:Arial;padding:28px}h2{color:#1d4ed8}p{border-bottom:1px solid #ddd;padding:7px 0}</style></head><body><h2>${esc(s.schoolName||'School Manager Pro')}</h2><h3>Student Admission Form</h3>${rows}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();};
 const filteredStudents=students.filter(s=>`${s.name||''} ${s.admissionNo||''} ${s.penNumber||''} ${s.fatherName||''} ${s.phone||''} ${s.aadhaarLast4||''}`.toLowerCase().includes(studentSearch.toLowerCase())&&(studentClassFilter==='All Classes'||s.className===studentClassFilter));
 const activeAcademicSession=academicSessions.find(x=>x.status==='Active')||[...academicSessions].sort((a,b)=>String(b.startDate||'').localeCompare(String(a.startDate||'')))[0]||null;
 const admissionClassRows=schoolClassSetup.filter(c=>activeAcademicSession&&c.sessionId===activeAcademicSession.id&&(c.status||'Active')==='Active').sort((a,b)=>CLASS_LIST.indexOf(a.className)-CLASS_LIST.indexOf(b.className));
 const admissionClassNames=admissionClassRows.map(c=>c.className);
 const selectedAdmissionClass=admissionClassRows.find(c=>c.className===studentForm.className);
 const admissionSectionOptions=Array.isArray(selectedAdmissionClass?.sections)?selectedAdmissionClass.sections:[];
 const classes=[...new Set(students.map(s=>s.className).filter(Boolean))];
 if(checking)return <div style={styles.center}><div style={styles.loginCard}><h2>🏫 School Manager Pro</h2><p>Checking account...</p></div></div>;
 if(!user)return <div style={styles.center}><form style={styles.loginCard} onSubmit={showTeacherRegister?handleTeacherRegister:showRegister?handleRegister:forgotMode?handleForgotPassword:handleLogin}>
  <div style={{fontSize:44,textAlign:'center'}}>🏫</div><h1 style={{textAlign:'center',marginBottom:5}}>School Manager Pro</h1>
  <p style={{textAlign:'center',color:'#64748b'}}>{showTeacherRegister?'Teacher First-Time Registration':showRegister?'Register Your School':forgotMode?'Reset Your Password':'Secure Login'}</p>
  {showTeacherRegister?<><p style={{fontSize:13,color:'#64748b',lineHeight:1.5}}>Use the same email address your School Admin entered in your teacher record. Verify your email before logging in.</p><label style={styles.label}>Teacher Email Address</label><input style={styles.loginInput} type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter email added by School Admin"/><label style={styles.label}>Create Password</label><input style={styles.loginInput} type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></>:showRegister?<>

   {Object.entries({schoolName:'School Name',schoolCode:'School Code',address:'School Address',adminName:'Owner / Admin Name',email:'Email Address',phone:'Mobile Number',password:'Create Password'}).map(([k,l])=><label key={k} style={styles.label}>{l}<input required style={styles.loginInput} type={k==='email'?'email':k==='password'?'password':'text'} value={reg[k]} onChange={e=>setReg({...reg,[k]:e.target.value})} minLength={k==='password'?6:undefined}/></label>)}
   <p style={{fontSize:12,color:'#64748b'}}>Registration will be sent to Super Admin for approval.</p>
  </>:<>
   <label style={styles.label}>Email Address</label><input style={styles.loginInput} type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter registered email"/>
   {!forgotMode&&<><label style={styles.label}>Password</label><input style={styles.loginInput} type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password"/></>}
   {forgotMode&&<p style={{fontSize:13,color:'#64748b',lineHeight:1.5}}>We will email a secure password reset link to the registered email address. This works for School Admin and Super Admin accounts.</p>}
  </>}
  {authError&&<p style={styles.error}>{authError}</p>}
  <button type="submit" disabled={loginLoading} style={styles.loginButton}>{loginLoading?'Please wait...':showTeacherRegister?'Send Verification Email':showRegister?'Submit Registration':forgotMode?'Send Reset Link':'Login'}</button>
  {!showRegister&&!showTeacherRegister&&!forgotMode&&<button type="button" style={{...secondary,width:'100%',marginTop:10}} onClick={()=>{setForgotMode(true);setAuthError('');}}>Forgot Password?</button>}
  {forgotMode&&<button type="button" style={{...secondary,width:'100%',marginTop:10}} onClick={()=>{setForgotMode(false);setAuthError('');}}>Back to Login</button>}
  {!forgotMode&&!showTeacherRegister&&<button type="button" style={{...secondary,width:'100%',marginTop:10}} onClick={()=>{setShowRegister(!showRegister);setAuthError('');}}>{showRegister?'Already registered? Login':'Register New School'}</button>}
  {!showRegister&&!forgotMode&&<button type="button" style={{...secondary,width:'100%',marginTop:10}} onClick={()=>{setShowTeacherRegister(!showTeacherRegister);setAuthError('');setPassword('');}}>{showTeacherRegister?'Back to Login':'Teacher First-Time Registration'}</button>}
  <p style={{textAlign:'center',fontSize:12,color:'#64748b'}}>Firebase Authentication</p>
 </form></div>;
 if(isPending&&!isTeacher)return <div style={styles.center}><div style={styles.loginCard}><h2>⏳ Registration Pending</h2><p>Your school registration has been received. Super Admin approval is required before you can use the dashboard.</p><p><b>{profile?.schoolName||mySchool?.name}</b></p><button style={styles.loginButton} onClick={logout}>Logout</button></div></div>;

 return <div className="shell">
  <aside className="sidebar"><div className="brand"><span>🏫</span><div>School Manager Pro<small>NEW • MULTI-SCHOOL</small></div></div>
   <div className="side-caption">MAIN WORKSPACE</div><button className={'nav '+(active==='Dashboard'?'selected':'')} onClick={()=>setActive('Dashboard')}>📊 Dashboard</button>
    {!isSuper&&!isTeacher&&<button className={'nav '+(active==='School Profile'?'selected':'')} onClick={openSchoolProfile}>🏫 School Profile</button>}
    {isSuper&&<button className={'nav '+(active==='Profile Update Requests'?'selected':'')} onClick={()=>setActive('Profile Update Requests')}>📝 Profile Update Requests {profileRequests.length?`(${profileRequests.length})`:''}</button>}
   {groups.filter(g=>isSuper||g.title!=='Super Admin').map(g=><div className="side-group" key={g.title}><div className="side-caption">{g.icon} {g.title}</div>{g.items.filter(([n])=>isSuper?true:isTeacher?!!teacherPermissions[n]&&!['Fee Collection','Fee Structure','Fee Dues','Student Ledger','Fee Receipts','Discount & Scholarship','Expenses','Financial Reports'].includes(n):!['Schools Management','School Admins','Roles & Permissions','Subscription & Plans','System Settings'].includes(n)).map(([n,ic])=><button key={n} className={'nav '+(active===(n==='Admission'?'Students':n)?'selected':'')} onClick={()=>{if(n==='Admission'){setStudentError('');setActive('Students');if(!isTeacher)openNewStudent();}else{setActive(n);}}}>{ic} {n}</button>)}</div>)}
  </aside>
  <main className="main"><header className="top"><div><b>{active}</b><small>{isSuper?'Super Admin':isTeacher?`${profile?.displayName||'Teacher'} · ${profile?.schoolName||''}`:mySchool?.name||profile?.schoolName||'School Admin'} · School Manager Pro</small></div><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>{isSuper&&<select value={school} onChange={e=>setSchool(e.target.value)}><option>All Schools</option>{schools.filter(s=>!s.legacy&&!['On Hold','Archived','Deleted'].includes(s.status)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}<button className="secondary" onClick={logout}>Logout</button></div></header>
   <div className="content">
    {active==='Dashboard'?<><section className="hero"><div><span className="eyebrow">{isSuper?'SUPER ADMIN WORKSPACE':isTeacher?'TEACHER WORKSPACE':'SCHOOL ADMIN WORKSPACE'}</span><h1>Welcome to School Manager Pro</h1><p>{isSuper?'Manage registered schools and platform activity.':isTeacher?'Open only the modules and classes assigned by your School Admin.':'Manage your school from your mobile or computer.'}</p>{isSuper&&<button className="primary" onClick={()=>setActive('Schools Management')}>View School Registrations</button>}</div><div className="hero-icon">🏫</div></section><div className="stats"><div className="stat"><small>{isSuper?'Total Schools':'Your School'}</small><strong>{isSuper?schools.length:profile?.schoolName||'—'}</strong></div><div className="stat"><small>{isSuper?'Pending Approvals':'Total Students'}</small><strong>{isSuper?schools.filter(s=>!s.legacy&&s.status==='Pending').length:students.length}</strong></div><div className="stat"><small>Management Categories</small><strong>5</strong></div><div className="stat"><small>Modules</small><strong>{isTeacher?Object.values(teacherPermissions).filter(Boolean).length:groups.reduce((n,g)=>n+g.items.length,0)}</strong></div></div>{isSuper&&<section className="workspace" style={{marginTop:18}}><div className="section-head"><div><h2>School-wise Student Overview</h2><p>Student counts are calculated separately using each school's School ID.</p></div><span>{schoolCountsLoading?'Updating counts…':`Total: ${Object.values(schoolStudentCounts).reduce((a,b)=>a+b,0)}`}</span></div><div className="table-wrap"><table><thead><tr><th>School</th><th>School ID</th><th>Status</th><th>Students</th><th>Action</th></tr></thead><tbody>{schools.filter(s=>!s.legacy&&!['Archived','Deleted'].includes(s.status)).map(s=><tr key={s.id}><td>{s.name}</td><td style={{fontSize:12}}>{s.id}</td><td>{s.status}</td><td><b>{schoolStudentCounts[s.id]??'—'}</b></td><td><button style={secondary} onClick={()=>{setSchool(s.id);setActive('Students');}}>Open School</button></td></tr>)}{!schools.some(s=>!s.legacy&&!['Archived','Deleted'].includes(s.status))&&<tr><td colSpan="5">No online schools found.</td></tr>}</tbody></table></div></section>}<div className="section-head"><div><h2>Management Panels</h2><p>Choose a category and open a module.</p></div><input value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Search panels..."/></div>{visible.filter(g=>isSuper||g.title!=='Super Admin').map(g=><section className="category" key={g.title}><h3>{g.icon} {g.title}</h3><div className="tiles">{g.items.filter(([n])=>isSuper?true:isTeacher?!!teacherPermissions[n]&&!['Fee Collection','Fee Structure','Fee Dues','Student Ledger','Fee Receipts','Discount & Scholarship','Expenses','Financial Reports'].includes(n):!['Schools Management','School Admins','Roles & Permissions','Subscription & Plans','System Settings'].includes(n)).map(([n,ic])=><button className="tile" key={n} onClick={()=>{if(n==='Admission'){setStudentError('');setActive('Students');if(!isTeacher)openNewStudent();}else{setActive(n);}}}><span>{ic}</span><b>{n}</b><small>Open module →</small></button>)}</div></section>)}</>:null}
    {active==='School Profile'&&!isSuper?<section className="workspace"><div className="section-head"><div><h2>School Profile</h2><p>Edit school details and send them to Super Admin for approval.</p></div></div>
      <form onSubmit={submitProfileUpdate} style={{maxWidth:650,display:'grid',gap:14}}>
       <label>School Name<input required style={inputStyle} value={profileEdit.name} onChange={e=>setProfileEdit(v=>({...v,name:e.target.value}))}/></label>
       <label>Address<input required style={inputStyle} value={profileEdit.city} onChange={e=>setProfileEdit(v=>({...v,city:e.target.value}))}/></label>
       <label>Mobile Number<input required style={inputStyle} value={profileEdit.phone} onChange={e=>setProfileEdit(v=>({...v,phone:e.target.value}))}/></label>
       <label>Owner / Admin Name<input required style={inputStyle} value={profileEdit.adminName} onChange={e=>setProfileEdit(v=>({...v,adminName:e.target.value}))}/></label>
       <button className="primary" type="submit" disabled={profileRequestBusy||myProfileRequests.some(r=>r.status==='Pending')}>{profileRequestBusy?'Submitting...':'Submit for Super Admin Approval'}</button>
      </form><div style={{marginTop:22}}><h3>My Profile Update Requests</h3>{myProfileRequests.length===0?<p>No requests submitted yet.</p>:myProfileRequests.map(r=><div className="pending" key={r.id} style={{marginBottom:10}}><b>{r.status}</b><p>Requested school name: {r.proposed?.name}</p></div>)}</div></section>:null}
     {active==='Profile Update Requests'&&isSuper?<section className="workspace"><div className="section-head"><div><h2>Profile Update Requests</h2><p>Approve or reject school profile changes.</p></div></div>
      {profileRequests.length===0?<div className="pending">No pending profile update requests.</div>:profileRequests.map(r=><div className="pending" key={r.id} style={{marginBottom:14}}><h3>{r.proposed?.name||r.schoolName}</h3><p><b>Address:</b> {r.proposed?.city}</p><p><b>Mobile:</b> {r.proposed?.phone}</p><p><b>Owner / Admin:</b> {r.proposed?.adminName}</p><p><b>Previous school name:</b> {r.previous?.name}</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="primary" disabled={profileRequestBusy} onClick={()=>decideProfileRequest(r,'Approved')}>Approve</button><button style={danger} disabled={profileRequestBusy} onClick={()=>decideProfileRequest(r,'Rejected')}>Reject</button></div></div>)}</section>:null}
     {active==='Schools Management'&&isSuper?<section className="workspace"><div className="section-head"><div><h2>Schools Management</h2><p>Review registrations and control school access.</p></div><button style={primary} onClick={()=>setShowAddSchool(true)}>＋ Add School</button></div><div className="table-wrap"><table><thead><tr><th>School</th><th>Code</th><th>Admin</th><th>Address</th><th>Status</th><th>Actions</th></tr></thead><tbody>{schools.filter(s=>!s.convertedTo).map(s=><tr key={s.id}><td>{s.name}</td><td>{s.code}</td><td>{s.adminName||'—'}</td><td>{s.city||'—'}</td><td><b>{s.status}</b>{s.legacy?' · Demo (not online yet)':''}</td><td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{s.legacy?<button style={primary} onClick={()=>setSchoolAction({school:s,action:'restore'})}>Add to Online Schools</button>:null}{!s.legacy&&s.status==='Pending'&&<button style={primary} onClick={()=>approveSchool(s)}>Approve</button>}{isAppOwner&&!s.legacy&&s.status==='Active'&&<button style={secondary} onClick={()=>holdSchool(s)}>Put On Hold</button>}{isAppOwner&&!s.legacy&&s.status==='On Hold'&&<button style={primary} onClick={()=>restoreSchool(s)}>Restore Active</button>}{isAppOwner&&!s.legacy&&s.status!=='Archived'&&<button style={danger} onClick={()=>archiveSchool(s)}>Archive</button>}{isAppOwner&&!s.legacy&&s.status==='Archived'&&<button style={primary} onClick={()=>restoreSchool(s)}>Restore</button>}</div></td></tr>)}</tbody></table></div></section>:null}
    {active==='Students'&&(!isTeacher||teacherPermissions.Students||teacherPermissions.Admission)&&<section className="workspace"><div className="section-head"><div><h2>Students Management</h2><p>{isSuper?(school==='All Schools'?'Select one school to view its students.':'Showing records for '+(schools.find(s=>s.id===school)?.name||'selected school')):"Only your school's student records are shown."}</p></div>{!isTeacher&&(!isSuper||school!=='All Schools')&&<button style={primary} onClick={openNewStudent}>＋ Add Student</button>}</div>{isSuper&&school==='All Schools'?<div className="pending"><b>Choose a school first</b><p>Student records from different schools are not combined here. Select a school from the top menu or use the School-wise Student Overview on the Dashboard.</p></div>:null}{isTeacher&&<p className="pending">Read-only access: you can view students only in your assigned classes.</p>}{studentError&&<p style={{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8}}>{studentError}</p>}{!(isSuper&&school==='All Schools')&&<><div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'15px 0'}}><input style={{...inputStyle,flex:'1 1 220px'}} value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Search name, admission no, PEN, father, phone..."/><select style={{...inputStyle,flex:'0 1 180px'}} value={studentClassFilter} onChange={e=>setStudentClassFilter(e.target.value)}><option>All Classes</option>{classes.map(c=><option key={c}>{c}</option>)}</select></div><div style={{fontSize:13,color:'#64748b',marginBottom:10}}>Total students: <b>{filteredStudents.length}</b> {studentsLoading?' · Loading...':''}</div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Admission No.</th><th>PEN Number</th><th>Class</th><th>Father</th><th>Phone</th><th>Actions</th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.admissionNo||'—'}</td><td>{s.penNumber||'—'}</td><td>{s.className} {s.section}</td><td>{s.fatherName||'—'}</td><td>{s.phone||'—'}</td><td><div style={{display:'flex',gap:5,flexWrap:'wrap'}}><button style={secondary} onClick={()=>setViewStudent(s)}>View</button>{!isTeacher&&<><button style={secondary} onClick={()=>openEditStudent(s)}>Edit</button><button style={danger} onClick={()=>removeStudent(s)}>Delete</button><button style={secondary} onClick={()=>shareStudent(s,'whatsapp')}>WhatsApp</button><button style={secondary} onClick={()=>shareStudent(s,'sms')}>SMS</button><button style={secondary} onClick={()=>shareStudent(s,'pdf')}>PDF / Print</button></>}</div></td></tr>)}{!studentsLoading&&!filteredStudents.length&&<tr><td colSpan="7" style={{textAlign:'center',padding:25}}>No student records found.</td></tr>}</tbody></table></div></>}</section>}
    {active==='Timetable'&&(!isTeacher||!!teacherPermissions['Timetable'])&&!isParent&&<TimetableModule schoolId={isSuper?(school==='All Schools'?'':school):profile?.schoolId} schoolName={isSuper?(schools.find(s=>s.id===school)?.name||''):(profile?.schoolName||mySchool?.name||'')} profile={profile} students={students} onBack={()=>setActive('Dashboard')}/> }
    {active==='Parent Portal'&&<ParentPortal profile={profile} schoolId={profile?.schoolId} isAdmin={profile?.role==='schooladmin'||profile?.role==='superadmin'} students={students} onBack={()=>setActive('Dashboard')}/> }
    {active==='Classes & Sections'&&(!isTeacher||!!teacherPermissions['Classes & Sections'])&&<ClassesSectionsModule schoolId={isSuper?(school==='All Schools'?'':school):profile?.schoolId} schoolName={isSuper?(schools.find(s=>s.id===school)?.name||''):(profile?.schoolName||mySchool?.name||'')} profile={profile} isTeacher={isTeacher} students={students} onBack={()=>setActive('Dashboard')}/> }
    {active==='Teachers & Staff'&&!isTeacher&&<TeachersModule schoolId={isSuper?(school==='All Schools'?'':school):profile?.schoolId} schoolName={isSuper?(schools.find(s=>s.id===school)?.name||''):(profile?.schoolName||mySchool?.name||'')} profile={profile} onBack={()=>setActive('Dashboard')}/> }
    {active==='Subjects & Syllabus'&&(!isTeacher||!!teacherPermissions['Subjects & Syllabus'])&&<SubjectsSyllabusModule schoolId={isSuper?(school==='All Schools'?'':school):profile?.schoolId} schoolName={isSuper?(schools.find(s=>s.id===school)?.name||''):(profile?.schoolName||mySchool?.name||'')} profile={profile} isTeacher={isTeacher} onBack={()=>setActive('Dashboard')}/> }
    {groups.find(g=>g.title==='Finance Management')?.items.some(([name])=>name===active)&&!isTeacher&&<FinanceModule active={active} schoolId={isSuper?school:profile?.schoolId} schoolName={isSuper?(schools.find(s=>s.id===school)?.name||''):profile?.schoolName||mySchool?.name||''} students={students} profile={profile} onBack={()=>setActive('Dashboard')}/> }
    {!isParent&&active!=='Dashboard'&&active!=='Students'&&(!isTeacher||!!teacherPermissions[active])&&!groups.find(g=>g.title==='Finance Management')?.items.some(([name])=>name===active)&&!(active==='Schools Management'&&isSuper)&&!(active==='School Profile'&&!isSuper)&&!(active==='Profile Update Requests'&&isSuper)&&active!=='Teachers & Staff'&&active!=='Classes & Sections'&&active!=='Subjects & Syllabus'&&<section className="workspace"><button className="back" onClick={()=>setActive('Dashboard')}>← Dashboard</button><h2>{active}</h2><div className="pending"><b>MODULE FOUNDATION</b><p>This module is listed and will be connected in its development phase. Students and school registration are the current live modules.</p></div></section>}
   </div>
  </main>
  {schoolAction&&<div className="overlay"><form className="modal" onSubmit={confirmSchoolAction}><h2>{schoolAction.action==='hold'?'Block School':schoolAction.action==='archive'?'Archive School':'Unblock School'}</h2><p>To prevent accidental changes, type the exact school name to confirm:</p><p><b>{schoolAction.school.name}</b></p><input autoFocus required style={inputStyle} value={typedSchoolName} onChange={e=>setTypedSchoolName(e.target.value)} placeholder="Type school name exactly"/><p style={{fontSize:12,color:'#64748b'}}>This action is saved online in Firebase. Blocking stops the school from using the app while keeping its data. Unblocking restores access. No student, fee, receipt, or other school data is deleted. Permanent deletion is not enabled yet.</p><div className="actions"><button type="button" className="secondary" onClick={()=>setSchoolAction(null)}>Cancel</button><button className="primary" disabled={schoolActionBusy||typedSchoolName.trim()!==schoolAction.school.name}>{schoolActionBusy?'Saving...':'Confirm'}</button></div></form></div>}
  {showAddSchool&&<div className="overlay"><form className="modal" onSubmit={addSchool}><h2>Add New School</h2><label>School Name<input required value={schoolForm.name} onChange={e=>setSchoolForm({...schoolForm,name:e.target.value})}/></label><label>School Code<input required value={schoolForm.code} onChange={e=>setSchoolForm({...schoolForm,code:e.target.value.toUpperCase()})}/></label><label>City / Address<input value={schoolForm.city} onChange={e=>setSchoolForm({...schoolForm,city:e.target.value})}/></label><div className="actions"><button type="button" className="secondary" onClick={()=>setShowAddSchool(false)}>Cancel</button><button className="primary">Save School</button></div></form></div>}
  {showStudentForm&&<div className="overlay"><form className="modal" style={{maxWidth:700,maxHeight:'90vh',overflowY:'auto'}} onSubmit={saveStudent}><h2>{editingStudent?'Edit Student':'Add New Student'}</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>{[['name','Student Name',true],['admissionNo','Admission Number',false],['penNumber','PEN Number',false],['aadhaarLast4','Aadhaar Last 4 Digits (optional)',false],['admissionDate','Admission Date',false],['fatherName','Father Name',false],['motherName','Mother Name',false],['className','Class',true],['section','Section',false],['dob','Date of Birth',false],['gender','Gender',false],['phone','Mobile Number',false],['whatsapp','WhatsApp Number',false],['email','Email',false],['address','Address',false]].map(([key,label,required])=><label key={key} style={labelStyle}>{label}{key==='className'?<select required style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,className:e.target.value,section:''})}><option value="">Select Class</option>{(admissionClassNames.length?admissionClassNames:CLASS_LIST).map(c=><option key={c}>{c}</option>)}{studentForm.className&&!((admissionClassNames.length?admissionClassNames:CLASS_LIST).includes(studentForm.className))&&<option>{studentForm.className}</option>}</select>:key==='section'?<select style={inputStyle} value={studentForm.section||''} onChange={e=>setStudentForm({...studentForm,section:e.target.value})} disabled={!studentForm.className||(!admissionSectionOptions.length&&!studentForm.section)}><option value="">{!studentForm.className?'Select Class First':admissionSectionOptions.length?'Select Section':'No Sections Configured'}</option>{admissionSectionOptions.map(section=><option key={section} value={section}>{section}</option>)}{studentForm.section&&!admissionSectionOptions.includes(studentForm.section)&&<option value={studentForm.section}>{studentForm.section} (Existing)</option>}</select>:key==='gender'?<select style={inputStyle} value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select>:(key==='dob'||key==='admissionDate')?<input type="date" style={inputStyle} value={studentForm[key]||''} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>:key==='address'?<textarea style={inputStyle} rows="2" value={studentForm[key]} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>:<input required={required} type={key==='email'?'email':'text'} style={inputStyle} value={studentForm[key]||''} onChange={e=>setStudentForm({...studentForm,[key]:e.target.value})}/>}</label>)}</div>{academicSetupLoading?<p style={{fontSize:12,color:'#64748b'}}>Loading this school's Classes & Sections…</p>:activeAcademicSession?<p style={{fontSize:12,color:'#64748b'}}>Sections are loaded from Classes & Sections · Session {activeAcademicSession.name}.</p>:<p style={{fontSize:12,color:'#b45309'}}>No active Academic Session found. Set up a session and classes in Classes & Sections to use the linked Section dropdown.</p>}<h3 style={{gridColumn:'1/-1',margin:'10px 0 0',color:'#1d4ed8'}}>Fee Setup · Academic Year</h3><label style={labelStyle}>Academic Year<input style={inputStyle} value={studentForm.academicYear||'2026-27'} onChange={e=>setStudentForm({...studentForm,academicYear:e.target.value})} placeholder="2026-27"/></label><label style={labelStyle}>Admission Type<select style={inputStyle} value={studentForm.admissionType||'New Admission'} onChange={e=>setStudentForm({...studentForm,admissionType:e.target.value})}><option>New Admission</option><option>Renewal</option></select></label><label style={labelStyle}>{studentForm.admissionType==='Renewal'?'Renewal Fee (₹)':'Admission Fee (₹)'}<input type="number" min="0" style={inputStyle} value={studentForm.admissionType==='Renewal'?(studentForm.renewalFee??'2000'):(studentForm.admissionFee??'3000')} onChange={e=>setStudentForm({...studentForm,[studentForm.admissionType==='Renewal'?'renewalFee':'admissionFee']:e.target.value})}/></label><label style={labelStyle}>Admission/Renewal Status<select style={inputStyle} value={studentForm.admissionFeeStatus||'Pending'} onChange={e=>setStudentForm({...studentForm,admissionFeeStatus:e.target.value})}><option>Pending</option><option>Paid</option></select></label><label style={labelStyle}>Annual Exam Fee (₹)<input type="number" min="0" style={inputStyle} value={studentForm.examFee||'0'} onChange={e=>setStudentForm({...studentForm,examFee:e.target.value})}/></label><label style={labelStyle}>Exam Fee Status<select style={inputStyle} value={studentForm.examFeeStatus||'Pending'} onChange={e=>setStudentForm({...studentForm,examFeeStatus:e.target.value})}><option>Pending</option><option>Paid</option></select></label><label style={labelStyle}>Monthly School Fee (₹)<input type="number" min="0" required style={inputStyle} value={studentForm.monthlySchoolFee||''} onChange={e=>setStudentForm({...studentForm,monthlySchoolFee:e.target.value})}/></label><label style={labelStyle}>Transport Required?<select style={inputStyle} value={studentForm.transportOpted||'No'} onChange={e=>setStudentForm({...studentForm,transportOpted:e.target.value})}><option>No</option><option>Yes</option></select></label>{studentForm.transportOpted==='Yes'&&<><label style={labelStyle}>Van Start Date<input required type="date" style={inputStyle} value={studentForm.vanStartDate||studentForm.admissionDate||''} onChange={e=>setStudentForm({...studentForm,vanStartDate:e.target.value})}/></label><label style={labelStyle}>Van Route<select style={inputStyle} value={studentForm.vanRoute||''} onChange={e=>{const rates={Basrahi:900,Bake:750,Alipur:850,Pilkhuwa:600,Mauaima:600,Dubahi:650};setStudentForm({...studentForm,vanRoute:e.target.value,monthlyVanFee:String(rates[e.target.value]||0)})}}><option value="">Select Route</option>{['Basrahi','Bake','Alipur','Pilkhuwa','Mauaima','Dubahi'].map(r=><option key={r}>{r}</option>)}</select></label><label style={labelStyle}>Monthly Van Fee (₹)<input type="number" min="0" style={inputStyle} value={studentForm.monthlyVanFee||'0'} onChange={e=>setStudentForm({...studentForm,monthlyVanFee:e.target.value})}/></label></>}<label style={labelStyle}>Other Fee Name (Optional)<input style={inputStyle} value={studentForm.otherFeeName||''} onChange={e=>setStudentForm({...studentForm,otherFeeName:e.target.value})}/></label><label style={labelStyle}>Other Fee Amount (₹)<input type="number" min="0" style={inputStyle} value={studentForm.otherFeeAmount||'0'} onChange={e=>setStudentForm({...studentForm,otherFeeAmount:e.target.value})}/></label><div style={{gridColumn:'1/-1',background:'#eff6ff',padding:12,borderRadius:8,fontSize:13}}>Fee summary: Admission/Renewal ₹{Number(studentForm.admissionType==='Renewal'?studentForm.renewalFee:studentForm.admissionFee)||0} · Exam ₹{Number(studentForm.examFee)||0} · Monthly School ₹{Number(studentForm.monthlySchoolFee)||0} · Monthly Van ₹{studentForm.transportOpted==='Yes'?Number(studentForm.monthlyVanFee)||0:0} · Other ₹{Number(studentForm.otherFeeAmount)||0}</div><p style={{fontSize:12,color:'#64748b'}}>School: {isSuper?(school==='All Schools'?'Select a school from the top list':schools.find(s=>s.id===school)?.name):profile?.schoolName}</p><div className="actions"><button type="button" className="secondary" onClick={()=>studentActions(studentForm,'view')}>View</button><button type="button" className="secondary" onClick={()=>studentActions(studentForm,'share')}>Share</button><button type="button" className="secondary" onClick={()=>studentActions(studentForm,'print')}>Print / Download PDF</button><button type="button" className="secondary" onClick={()=>studentActions(studentForm,'copy')}>Copy</button><button type="button" className="secondary" onClick={()=>setShowStudentForm(false)}>Cancel</button><button className="primary" disabled={savingStudent}>{savingStudent?'Saving...':'Save Student'}</button></div></form></div>}
  {viewStudent&&<div className="overlay"><div className="modal" style={{maxWidth:560}}><h2>Student Details</h2>{Object.entries({Name:viewStudent.name,'Admission No.':viewStudent.admissionNo,'PEN Number':viewStudent.penNumber,'Father Name':viewStudent.fatherName,'Mother Name':viewStudent.motherName,Class:`${viewStudent.className||''} ${viewStudent.section||''}`,'Date of Birth':viewStudent.dob,Gender:viewStudent.gender,Phone:viewStudent.phone,WhatsApp:viewStudent.whatsapp,Email:viewStudent.email,Address:viewStudent.address,School:viewStudent.schoolName,'Academic Year':viewStudent.feeConfig?.academicYear||viewStudent.academicYear,'Admission Type':viewStudent.feeConfig?.admissionType,'Admission / Renewal Fee':`₹${viewStudent.feeConfig?.admissionFee??0} · ${viewStudent.feeConfig?.admissionFeeStatus||'Pending'}`,'Annual Exam Fee':`₹${viewStudent.feeConfig?.examFee??0} · ${viewStudent.feeConfig?.examFeeStatus||'Pending'}`,'Monthly School Fee':`₹${viewStudent.feeConfig?.monthlySchoolFee??0}`,'Transport':viewStudent.feeConfig?.transportOpted?`${viewStudent.feeConfig?.vanRoute||''} · ₹${viewStudent.feeConfig?.monthlyVanFee??0}/month`:'No','Van Start Date':viewStudent.feeConfig?.vanStartDate||'—','Other Fee':`${viewStudent.feeConfig?.otherFeeName||'—'} · ₹${viewStudent.feeConfig?.otherFeeAmount??0}`}).map(([k,v])=><p key={k} style={{borderBottom:'1px solid #e2e8f0',padding:'7px 0',margin:0}}><b>{k}:</b> {v||'—'}</p>)}<div className="actions"><button style={secondary} onClick={()=>studentActions(viewStudent,'share')}>Share</button><button style={secondary} onClick={()=>studentActions(viewStudent,'print')}>Print / Download PDF</button><button style={secondary} onClick={()=>studentActions(viewStudent,'copy')}>Copy</button><button style={primary} onClick={()=>setViewStudent(null)}>Close</button></div></div></div>}
 </div>;
}
const styles={center:{minHeight:'100vh',display:'flex',justifyContent:'center',alignItems:'center',padding:20,background:'#eef3fb',fontFamily:'Arial,sans-serif'},loginCard:{width:'100%',maxWidth:460,background:'#fff',padding:28,borderRadius:18,boxShadow:'0 10px 35px rgba(0,0,0,.10)',boxSizing:'border-box'},label:{display:'block',marginTop:14,marginBottom:7,fontWeight:600,color:'#334155'},loginInput:{width:'100%',padding:13,border:'1px solid #cbd5e1',borderRadius:9,fontSize:16,boxSizing:'border-box'},loginButton:{width:'100%',marginTop:22,padding:14,background:'#2457d6',color:'#fff',border:0,borderRadius:9,fontSize:16,fontWeight:700},error:{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8,fontSize:13}};
