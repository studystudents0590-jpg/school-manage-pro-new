import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const inputStyle={width:'100%',padding:11,border:'1px solid #cbd5e1',borderRadius:8,boxSizing:'border-box',fontSize:14,background:'#fff'};
const labelStyle={display:'block',fontWeight:600,fontSize:13,color:'#334155',marginBottom:6};
const primary={background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 15px',fontWeight:700,cursor:'pointer'};
const secondary={background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'10px 13px',fontWeight:600,cursor:'pointer'};
export default function FinanceModule({active,schoolId,schoolName,students,profile,onBack}){
 const [payments,setPayments]=useState([]),[structures,setStructures]=useState([]),[discounts,setDiscounts]=useState([]),[expenses,setExpenses]=useState([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [search,setSearch]=useState(''),[studentSearch,setStudentSearch]=useState(''),[year,setYear]=useState('2026-27'),[studentId,setStudentId]=useState(''),[feeType,setFeeType]=useState('Monthly School Fee'),[amount,setAmount]=useState(''),[paymentDate,setPaymentDate]=useState(new Date().toISOString().slice(0,10)),[method,setMethod]=useState('Cash'),[months,setMonths]=useState([]),[notes,setNotes]=useState('');
 const [className,setClassName]=useState(''),[collectionClass,setCollectionClass]=useState(''),[monthlyFee,setMonthlyFee]=useState(''),[admissionFee,setAdmissionFee]=useState(''),[vanFee,setVanFee]=useState(''),[renewalFee,setRenewalFee]=useState(''),[examFee,setExamFee]=useState(''),[otherFee,setOtherFee]=useState('');
 const [expenseTitle,setExpenseTitle]=useState(''),[expenseAmount,setExpenseAmount]=useState(''),[expenseDate,setExpenseDate]=useState(new Date().toISOString().slice(0,10));
 const [discountStudent,setDiscountStudent]=useState(''),[discountAmount,setDiscountAmount]=useState(''),[discountReason,setDiscountReason]=useState('');
 const [reportSearch,setReportSearch]=useState('');
 const [viewReceipt,setViewReceipt]=useState(null);
 const [duesClass,setDuesClass]=useState('All Classes'),[duesMonth,setDuesMonth]=useState('All Months'),[duesStudentId,setDuesStudentId]=useState('');
 useEffect(()=>{
  if(!schoolId){setLoading(false);return;}
  setLoading(true);setError('');
  const refs=[['feePayments',setPayments],['feeStructures',setStructures],['feeDiscounts',setDiscounts],['schoolExpenses',setExpenses]];
  const unsubs=refs.map(([name,setter])=>onSnapshot(query(collection(db,name),where('schoolId','==',schoolId)),snap=>setter(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(e.message)));
  setLoading(false);return()=>unsubs.forEach(u=>u());
 },[schoolId]);
 const collectionClasses=[...new Set(students.map(s=>String(s.className||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const collectionStudents=students.filter(s=>String(s.className||'').trim()===collectionClass);
 const searchableCollectionStudents=collectionStudents.filter(s=>`${s.name||''} ${s.admissionNo||''} ${s.penNumber||''} ${s.rollNo||''} ${s.rollNumber||''} ${s.fatherName||''} ${s.phone||''} ${s.whatsapp||''} ${s.aadhaarLast4||s.aadhaar||''}`.toLowerCase().includes(studentSearch.toLowerCase().trim()));
 const selectedStudent=students.find(s=>s.id===studentId && String(s.className||'').trim()===collectionClass);
 const activePayments=payments.filter(p=>p.status!=='cancelled');
 const inYear=d=>{const dt=String(d||'');const y=Number(year.slice(0,4));return dt>=`${y}-04-01`&&dt<=`${y+1}-03-31`;};
 const paid=activePayments.filter(inYear).reduce((a,p)=>a+Number(p.amount||0),0);
 const allPaid=activePayments.reduce((a,p)=>a+Number(p.amount||0),0);
 const classStructure=students.map(st=>{const f=structures.find(x=>x.className===st.className);return {student:st,fee:Number(f?.monthlyFee||0),months:12};});
 const charges=classStructure.reduce((a,x)=>a+x.fee*x.months,0)+structures.reduce((a,x)=>a+Number(x.admissionFee||0),0);
 const dues=Math.max(0,charges-paid);
 const studentPayments=activePayments.filter(p=>p.studentId===studentId);
 const studentPaid=studentPayments.reduce((a,p)=>a+Number(p.amount||0),0);
 const monthNames=['April','May','June','July','August','September','October','November','December','January','February','March'];
 const monthlyFeeType=feeType==='Monthly School Fee'||feeType==='Monthly Van Fee';
 const paidMonths=activePayments.filter(p=>p.studentId===studentId&&p.feeType===feeType&&p.academicYear===year).flatMap(p=>String(p.months||'').split(',').map(x=>x.trim()).filter(Boolean));
 const toggleMonth=m=>setMonths(old=>old.includes(m)?old.filter(x=>x!==m):[...old,m]);
 const changeCollectionClass=value=>{setCollectionClass(value);setStudentId('');setStudentSearch('');setMonths([]);setAmount('');setError('');};
 const changeStudent=value=>{setStudentId(value);setMonths([]);setAmount('');setError('');};
 const changeFeeType=value=>{setFeeType(value);setMonths([]);setAmount('');};
 const changeYear=value=>{setYear(value);setMonths([]);};
 const paidMonthsFor=(sid,type,session)=>activePayments.filter(p=>p.studentId===sid&&p.feeType===type&&p.academicYear===session).flatMap(p=>String(p.months||'').split(',').map(x=>x.trim()).filter(Boolean));
 const monthsDueThrough=(session,student)=>{
  const start=Number(String(session).slice(0,4));
  const now=new Date();
  const sessionEnd=new Date(start+1,2,31,23,59,59);
  const cutoff=now>sessionEnd?12:now<new Date(start,3,1)?0:Math.min(12,Math.max(0,(now.getFullYear()-start)*12+now.getMonth()-3+1));
  return monthNames.slice(0,cutoff);
 };
 const feeDueDetails=(st,session=year)=>{
  const saved=st.feeConfig||{};
  const structure=structures.find(x=>x.className===st.className&&x.academicYear===session);
  const matchesSaved=String(saved.academicYear||st.academicYear||'')===String(session);
  const feeSource=matchesSaved?{monthlyFee:saved.monthlySchoolFee,vanFee:saved.transportOpted?saved.monthlyVanFee:0,admissionFee:saved.admissionType==='New Admission'?saved.admissionFee:0,renewalFee:saved.admissionType==='Renewal'?saved.admissionFee:0,examFee:saved.examFee,otherFee:saved.otherFeeAmount,otherFeeName:saved.otherFeeName,admissionFeeStatus:saved.admissionFeeStatus,examFeeStatus:saved.examFeeStatus}:structure;
  if(!feeSource)return {lines:[],totals:{},grand:0,missingStructure:true};
  const dueMonths=monthsDueThrough(session,st);
  const paidFor=(type)=>activePayments.filter(p=>p.studentId===st.id&&p.academicYear===session&&p.feeType===type);
  const paidMonthSet=(type)=>new Set(paidFor(type).flatMap(p=>String(p.months||'').split(',').map(x=>x.trim()).filter(Boolean)));
  const lines=[];
  const addMonthly=(type,label,rate)=>{const paidSet=paidMonthSet(type);dueMonths.forEach(m=>{if(!paidSet.has(m)&&Number(rate||0)>0)lines.push({month:m,type:label,amount:Number(rate||0)});});};
  addMonthly('Monthly School Fee','School Fee',feeSource.monthlyFee);
  addMonthly('Monthly Van Fee','Van Fee',feeSource.vanFee);
  const admissionDate=st.admissionDate||st.admissionOn||st.joiningDate||'';
  const admissionSession=admissionDate?`${String(admissionDate).slice(0,4)}-${String(Number(String(admissionDate).slice(0,4))+1).slice(-2)}`:session;
  const oneTime=[['Admission Fee','Admission Fee',admissionSession===session&&feeSource.admissionFeeStatus!=='Paid'?feeSource.admissionFee:0],['Renewal Fee','Renewal Fee',feeSource.admissionFeeStatus!=='Paid'?feeSource.renewalFee:0],['Exam Fee','Exam Fee',feeSource.examFeeStatus==='Paid'?0:feeSource.examFee],['Other Fee','Other Fee',feeSource.otherFee]];
  oneTime.forEach(([type,label,charge])=>{const total=Number(charge||0);if(total<=0)return;const paid=paidFor(type).reduce((a,p)=>a+Number(p.amount||0),0);const due=Math.max(0,total-paid);if(due>0)lines.push({month:'Annual / One-time',type:label==='Other Fee'?(feeSource.otherFeeName||label):label,amount:due});});
  const totals={};lines.forEach(x=>totals[x.type]=(totals[x.type]||0)+x.amount);
  return {lines,totals,grand:lines.reduce((a,x)=>a+x.amount,0),missingStructure:false};
 };
 const studentDue=(st)=>feeDueDetails(st).grand;
 const getStudentFeeSummary=(st)=>{
  if(!st)return null;
  const sessionStart=Number(year.slice(0,4));
  const sessionRows=structures.filter(x=>x.className===st.className&&/^\d{4}-\d{2}$/.test(String(x.academicYear||''))&&Number(String(x.academicYear).slice(0,4))<=sessionStart);
  let currentDue=0,previousDue=0;
  sessionRows.forEach(structure=>{
   const sy=Number(String(structure.academicYear).slice(0,4));
   const session=structure.academicYear;
   const isSelected=session===year;
   const now=new Date();
   const cutoff=isSelected?Math.min(12,Math.max(0,(now.getFullYear()-sy)*12+now.getMonth()-3+(now.getDate()>=1?1:0))):(sy<sessionStart?12:0);
   const dueMonthNames=monthNames.slice(0,cutoff);
   const schoolPaid=paidMonthsFor(st.id,'Monthly School Fee',session);
   const vanPaid=paidMonthsFor(st.id,'Monthly Van Fee',session);
   const schoolUnpaid=dueMonthNames.filter(m=>!schoolPaid.includes(m)).length;
   const vanUnpaid=dueMonthNames.filter(m=>!vanPaid.includes(m)).length;
   const balance=schoolUnpaid*Number(structure.monthlyFee||0)+vanUnpaid*Number(structure.vanFee||0);
   if(isSelected)currentDue+=balance; else if(sy<sessionStart)previousDue+=balance;
  });
  const history=activePayments.filter(p=>p.studentId===st.id).sort((a,b)=>String(b.paymentDate||'').localeCompare(String(a.paymentDate||'')));
  const totalPaid=history.reduce((sum,p)=>sum+Number(p.amount||0),0);
  return {currentDue,previousDue,totalDue:currentDue+previousDue,totalPaid,history};
 };
 const rows=activePayments.filter(p=>inYear(p.paymentDate));
 const reportRows=activePayments.filter(p=>`${p.studentName||''} ${p.className||''} ${p.receiptNo||''}`.toLowerCase().includes(reportSearch.toLowerCase()));
 const printDoc=(title,body)=>{const w=window.open('','_blank');if(!w){alert('Please allow pop-ups to print or save PDF.');return;}w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;padding:24px;color:#111}h1,h2{margin:0 0 12px}table{border-collapse:collapse;width:100%;margin-top:15px}td,th{border:1px solid #bbb;padding:8px;text-align:left}.muted{color:#555;font-size:12px}@media print{button{display:none}}</style></head><body><h1>${schoolName||'School Manager Pro'}</h1><h2>${title}</h2><p class="muted">Academic Session: ${year} · Generated: ${new Date().toLocaleString()}</p>${body}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();};
 const table=(headers,items)=>`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${items.map(row=>`<tr>${row.map(v=>`<td>${String(v??'—').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const renderTable=(headers,items)=><div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{items.length?items.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v??'—'}</td>)}</tr>):<tr><td colSpan={headers.length}>No records found.</td></tr>}</tbody></table></div>;
 const shareReport=(title,body)=>{const txt=`${schoolName||'School'}\n${title}\n${body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,2500)}`;if(navigator.share)navigator.share({title,text:txt}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>setMessage('Report copied. You can share it now.'));else setMessage('Use Print / PDF to save this report.');};
 const actions=(title,body)=><div style={{display:'flex',gap:7,flexWrap:'wrap',margin:'12px 0'}}><button style={secondary} onClick={()=>shareReport(title,body)}>Share</button><button style={secondary} onClick={()=>shareReport(title,body)}>Send</button><button style={secondary} onClick={()=>printDoc(title,body)}>PDF</button><button style={secondary} onClick={()=>printDoc(title,body)}>Print</button></div>;
 const savePayment=async e=>{e.preventDefault();if(!schoolId||!collectionClass)return setError('Select a class first.');if(!selectedStudent)return setError('Select a student from the selected class.');const n=Number(amount);if(!(n>0))return setError('Enter a valid amount.');if(monthlyFeeType&&!months.length)return setError('Select at least one unpaid month.');if(months.some(m=>paidMonths.includes(m)))return setError('A selected month is already paid.');try{setError('');const receiptNo=`R-${Date.now()}`;await addDoc(collection(db,'feePayments'),{schoolId,studentId:selectedStudent.id,studentName:selectedStudent.name||'',admissionNo:selectedStudent.admissionNo||'',className:selectedStudent.className||'',feeType,amount:n,paymentDate,academicYear:year,paymentMode:method,months:months.join(', '),notes:notes.trim(),receiptNo,status:'paid',createdAt:serverTimestamp(),createdBy:profile?.displayName||profile?.email||''});setAmount('');setMonths([]);setNotes('');setMessage(`Payment saved. Receipt: ${receiptNo}`);}catch(e){setError(e.message);}};
 const saveStructure=async e=>{e.preventDefault();if(!schoolId||!className)return setError('Select class.');try{const old=structures.find(x=>x.className===className&&x.academicYear===year);const data={schoolId,className,monthlyFee:Number(monthlyFee||0),admissionFee:Number(admissionFee||0),vanFee:Number(vanFee||0),renewalFee:Number(renewalFee||0),examFee:Number(examFee||0),otherFee:Number(otherFee||0),academicYear:year,updatedAt:serverTimestamp()};if(old)await updateDoc(doc(db,'feeStructures',old.id),data);else await addDoc(collection(db,'feeStructures'),{...data,createdAt:serverTimestamp()});setMessage('Fee structure saved.');}catch(e){setError(e.message);}};
 const saveExpense=async e=>{e.preventDefault();try{await addDoc(collection(db,'schoolExpenses'),{schoolId,title:expenseTitle.trim(),amount:Number(expenseAmount),expenseDate,academicYear:year,createdAt:serverTimestamp()});setExpenseTitle('');setExpenseAmount('');setMessage('Expense saved.');}catch(e){setError(e.message);}};
 const saveDiscount=async e=>{e.preventDefault();const st=students.find(s=>s.id===discountStudent);if(!st)return setError('Select student.');try{await addDoc(collection(db,'feeDiscounts'),{schoolId,studentId:st.id,studentName:st.name||'',amount:Number(discountAmount),reason:discountReason,academicYear:year,createdAt:serverTimestamp()});setMessage('Discount saved.');setDiscountAmount('');setDiscountReason('');}catch(e){setError(e.message);}};
 const panelBody=()=>{
  if(active==='Fee Collection'){
   const feeSummary=selectedStudent?getStudentFeeSummary(selectedStudent):null;
   return <>
    <form onSubmit={savePayment} style={formGrid}>
     <label style={labelStyle}>Class<select style={inputStyle} required value={collectionClass} onChange={e=>changeCollectionClass(e.target.value)}><option value="">Select Class</option>{collectionClasses.map(c=><option value={c} key={c}>{c}</option>)}</select></label>
     <label style={labelStyle}>Search Student<input style={inputStyle} value={studentSearch} disabled={!collectionClass} onChange={e=>{setStudentSearch(e.target.value);setStudentId('');setMonths([]);}} placeholder="Name / Roll No. / Admission / Father / Mobile / PEN"/></label>
     <label style={labelStyle}>Select Student<select style={inputStyle} required disabled={!collectionClass} value={studentId} onChange={e=>changeStudent(e.target.value)}><option value="">{collectionClass?'Select Student':'First Select Class'}</option>{searchableCollectionStudents.map(s=><option value={s.id} key={s.id}>{s.name} · Adm: {s.admissionNo||'—'} · Roll: {s.rollNo||s.rollNumber||'—'} · Father: {s.fatherName||'—'} · Mobile: {s.whatsapp||s.phone||'—'}</option>)}</select></label>
     <label style={labelStyle}>Fee Type<select style={inputStyle} value={feeType} onChange={e=>changeFeeType(e.target.value)}>{['Admission Fee','Renewal Fee','Monthly School Fee','Monthly Van Fee','Exam Fee','Other Fee'].map(x=><option key={x}>{x}</option>)}</select></label>
     <label style={labelStyle}>Amount (₹)<input style={inputStyle} type="number" min="1" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
     <label style={labelStyle}>Payment Date<input style={inputStyle} type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label>
     <label style={labelStyle}>Academic Session<input style={inputStyle} value={year} onChange={e=>changeYear(e.target.value)}/></label>
     <label style={labelStyle}>Payment Mode<select style={inputStyle} value={method} onChange={e=>setMethod(e.target.value)}>{['Cash','UPI','Bank','Online'].map(x=><option key={x}>{x}</option>)}</select></label>
     {monthlyFeeType&&<div style={{gridColumn:'1/-1'}}><div style={labelStyle}>{feeType==='Monthly School Fee'?'School Fee Months':'Van Fee Months'} (Paid months cannot be selected)</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(105px,1fr))',gap:8}}>{monthNames.map(m=>{const locked=paidMonths.includes(m);const checked=months.includes(m);return <label key={m} style={{display:'flex',alignItems:'center',gap:6,padding:9,border:'1px solid #cbd5e1',borderRadius:8,background:locked?'#ecfdf5':checked?'#eff6ff':'#fff',opacity:locked ? 0.7 : 1}}><input type="checkbox" disabled={locked} checked={locked||checked} onChange={()=>toggleMonth(m)}/><span>{m}{locked?' ✓ Paid':''}</span></label>})}</div></div>}
     <label style={labelStyle}>Notes<input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <button style={primary}>Save Payment & Create Receipt</button>
    </form>
    {selectedStudent&&feeSummary&&<div style={{border:'1px solid #cbd5e1',borderRadius:12,padding:14,margin:'14px 0',background:'#f8fafc'}}>
     <h3 style={{margin:'0 0 8px'}}>Student Fee Status</h3>
     <div style={{fontSize:13,color:'#475569',lineHeight:1.7}}><b>{selectedStudent.name}</b> · Class {selectedStudent.className} · Admission No: {selectedStudent.admissionNo||'—'}<br/>Father: {selectedStudent.fatherName||'—'} · Mobile: {selectedStudent.whatsapp||selectedStudent.phone||'—'}</div>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))',gap:9,marginTop:12}}>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:10}}><small>Previous Session Due</small><div style={{fontSize:18,fontWeight:800,color:'#b45309'}}>{money(feeSummary.previousDue)}</div></div>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:10}}><small>{year} Due</small><div style={{fontSize:18,fontWeight:800,color:'#b45309'}}>{money(feeSummary.currentDue)}</div></div>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:10}}><small>Total Monthly Fee Balance</small><div style={{fontSize:18,fontWeight:800,color:feeSummary.totalDue>0?'#b91c1c':'#15803d'}}>{money(feeSummary.totalDue)}</div></div>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:10}}><small>Total Fees Received</small><div style={{fontSize:18,fontWeight:800,color:'#166534'}}>{money(feeSummary.totalPaid)}</div></div>
     </div>
     <h4 style={{margin:'14px 0 6px'}}>Previous Fee Payments</h4>
     {renderTable(['Date','Session','Fee Type','Months','Received','Receipt No.'],feeSummary.history.map(p=>[p.paymentDate,p.academicYear,p.feeType,p.months||'—',money(p.amount),p.receiptNo||'—']))}
     <p style={{fontSize:12,color:'#64748b',marginBottom:0}}>Note: Balance above is calculated from available class-wise monthly school/van fee structures and paid-month records. Admission, renewal, exam fees, discounts and unrecorded previous balances are not included in this monthly balance.</p>
    </div>}
    <p style={{fontSize:13,color:'#64748b'}}>Payment save hone par Receipt, Ledger, Dues aur Reports isi record se update honge.</p>
   </>;
  }

  if(active==='Fee Structure')return <><form onSubmit={saveStructure} style={formGrid}><label style={labelStyle}>Class<select style={inputStyle} required value={className} onChange={e=>setClassName(e.target.value)}><option value="">Select Class</option>{['Nursery','LKG','UKG',...Array.from({length:12},(_,i)=>String(i+1))].map(x=><option key={x}>{x}</option>)}</select></label>{[['Monthly School Fee',monthlyFee,setMonthlyFee],['Admission Fee',admissionFee,setAdmissionFee],['Monthly Van Fee',vanFee,setVanFee],['Renewal Fee',renewalFee,setRenewalFee],['Exam Fee (annual)',examFee,setExamFee],['Other Annual Fee',otherFee,setOtherFee]].map(([l,v,f])=><label key={l} style={labelStyle}>{l}<input style={inputStyle} type="number" min="0" value={v} onChange={e=>f(e.target.value)}/></label>)}<button style={primary}>Save Fee Structure</button></form>{renderTable(['Class','School / Month','Admission','Van / Month','Renewal','Exam','Other','Session'],structures.map(x=>[x.className,money(x.monthlyFee),money(x.admissionFee),money(x.vanFee),money(x.renewalFee),money(x.examFee),money(x.otherFee),x.academicYear]))}</>;
  if(active==='Fee Dues'){
   const normalize=value=>String(value??'').toLowerCase().replace(/\s+/g,' ').trim();
   const digits=value=>String(value??'').replace(/\D/g,'');
   const queryText=normalize(search);
   const queryDigits=digits(search);
   const yearStudents=students.filter(st=>duesClass==='All Classes'||String(st.className||'').trim()===String(duesClass).trim());
   const searched=yearStudents.filter(st=>{
    const textFields=[st.name,st.admissionNo,st.penNumber,st.fatherName,st.phone,st.whatsapp,st.rollNo,st.rollNumber,st.aadhaarLast4,st.aadhaar];
    const textMatch=textFields.some(value=>normalize(value).includes(queryText));
    const aadhaarDigits=digits(st.aadhaarLast4||st.aadhaar||'');
    const phoneDigits=digits(st.phone||st.whatsapp||'');
    const numericMatch=!!queryDigits&&(aadhaarDigits.includes(queryDigits)||phoneDigits.includes(queryDigits)||digits(st.admissionNo).includes(queryDigits)||digits(st.rollNo||st.rollNumber).includes(queryDigits));
    return !queryText||textMatch||numericMatch;
   });
   const allStudentRows=searched.map(st=>({student:st,detail:feeDueDetails(st,year)}));
   // The selected month means ONLY that month's monthly dues. Annual/one-time
   // charges are shown under All Months and in the student's full-year details.
   const forSelectedMonth=detail=>{
    if(duesMonth==='All Months')return detail;
    const lines=detail.lines.filter(line=>line.month===duesMonth);
    const totals={};
    lines.forEach(line=>{totals[line.type]=(totals[line.type]||0)+Number(line.amount||0);});
    return {...detail,lines,totals,grand:lines.reduce((sum,line)=>sum+Number(line.amount||0),0)};
   };
   const monthFiltered=allStudentRows.map(x=>({...x,detail:forSelectedMonth(x.detail)}));
   const chosen=students.find(st=>st.id===duesStudentId);
   const chosenDetail=chosen?feeDueDetails(chosen,year):null;
   // Build a complete month-by-month status view for the selected student.
   // A month after the current session month remains blank unless a payment
   // has already been recorded for it.
   const chosenMonthlyStatus=chosen&&!chosenDetail?.missingStructure?(()=>{
    const saved=chosen.feeConfig||{};
    const matchesSaved=String(saved.academicYear||chosen.academicYear||'')===String(year);
    const structure=structures.find(x=>x.className===chosen.className&&x.academicYear===year);
    const feeSource=matchesSaved?{monthlyFee:saved.monthlySchoolFee,vanFee:saved.transportOpted?saved.monthlyVanFee:0}:structure;
    if(!feeSource)return [];
    const dueMonths=new Set(monthsDueThrough(year,chosen));
    const schoolPaid=new Set(paidMonthsFor(chosen.id,'Monthly School Fee',year));
    const vanPaid=new Set(paidMonthsFor(chosen.id,'Monthly Van Fee',year));
    const rows=[];
    monthNames.forEach(month=>{
     const add=(feeName,rate,paidSet)=>{
      const amount=Number(rate||0);
      if(amount<=0)return;
      let status='';
      if(paidSet.has(month))status='Paid';
      else if(dueMonths.has(month))status='Remaining';
      rows.push({month,feeName,status,amount:status==='Remaining'?amount:0});
     };
     add('School Fee',feeSource.monthlyFee,schoolPaid);
     add('Van Fee',feeSource.vanFee,vanPaid);
    });
    return rows;
   })():[];
   const summaryClasses=duesClass==='All Classes'?collectionClasses:[duesClass];
   const classSummary=summaryClasses.map(c=>{
    const list=students.filter(st=>String(st.className||'').trim()===String(c).trim()).map(st=>({st,d:forSelectedMonth(feeDueDetails(st,year))}));
    const due=list.filter(x=>x.d.grand>0);
    return {className:c,totalStudents:list.length,count:due.length,total:due.reduce((a,x)=>a+x.d.grand,0)};
   }).filter(x=>x.totalStudents>0);
   return <div style={{display:'grid',gap:14}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
     <label style={labelStyle}>Academic Year<select style={inputStyle} value={year} onChange={e=>{setYear(e.target.value);setDuesStudentId('');}}>{['2026-27','2025-26','2024-25','2023-24'].map(x=><option key={x}>{x}</option>)}</select></label>
     <label style={labelStyle}>Class<select style={inputStyle} value={duesClass} onChange={e=>{setDuesClass(e.target.value);setDuesStudentId('');}}><option>All Classes</option>{collectionClasses.map(c=><option key={c}>{c}</option>)}</select></label>
     <label style={labelStyle}>Month<select style={inputStyle} value={duesMonth} onChange={e=>setDuesMonth(e.target.value)}><option>All Months</option>{monthNames.map(m=><option key={m}>{m}</option>)}</select></label>
    </div>
    <input style={inputStyle} placeholder="Search Name / Mobile / Aadhaar Last 4 Digits / Admission No. / Roll No. / PEN / Father Name" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="finance-card"><h3 style={{marginTop:0}}>Class-wise Fee Summary · {year} · {duesMonth}</h3>{renderTable(['Class','Total Students','Students with Due','Total Pending'],classSummary.map(x=>[<button style={secondary} onClick={()=>{setDuesClass(x.className);setDuesStudentId('');}}>{x.className}</button>,x.totalStudents,x.count,money(x.total)]))}</div>
    <div className="finance-card"><h3 style={{marginTop:0}}>Student-wise Fee Status · {duesMonth}</h3><p className="muted">चुनी हुई Class के सभी विद्यार्थी दिखाई देंगे। Month चुनने पर केवल उसी महीने की School/Van Fee दिखाई जाएगी; पूरी साल की हिस्ट्री View Details में मिलेगी।</p>{renderTable(['Student','Class','Father','Mobile','Fee Status','Pending','Details'],monthFiltered.map(x=>[x.student.name||'—',x.student.className||'—',x.student.fatherName||'—',x.student.phone||x.student.whatsapp||'—',x.detail.missingStructure?<span style={{color:'#b45309',fontWeight:700}}>Fee Setup Missing</span>:x.detail.grand>0?<span style={{color:'#b91c1c',fontWeight:700}}>Pending</span>:<span style={{color:'#15803d',fontWeight:700}}>Fully Paid</span>,money(x.detail.grand),<button style={primary} onClick={()=>setDuesStudentId(x.student.id)}>View Details</button>]))}</div>
    {chosen&&chosenDetail&&<div className="finance-card"><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 5px'}}>{chosen.name}</h3><div className="muted">{chosen.className} · Father: {chosen.fatherName||'—'} · Mobile: {chosen.phone||chosen.whatsapp||'—'}</div></div><button style={secondary} onClick={()=>setDuesStudentId('')}>Close</button></div><label style={{...labelStyle,marginTop:14}}>Academic Year<select style={inputStyle} value={year} onChange={e=>setYear(e.target.value)}>{['2026-27','2025-26','2024-25','2023-24'].map(x=><option key={x}>{x}</option>)}</select></label>{chosenDetail.missingStructure?<p style={{color:'#b45309',fontWeight:700}}>Fee Setup Missing for {year}. Please check this student's Admission Form Fee Setup or add a Fee Structure for this class and academic year.</p>:<><h4>Month-wise Fee Status · {year}</h4><p className="muted">हर महीने के नीचे जमा फीस हरे रंग में, बाकी फीस लाल रंग में और आने वाले महीनों में खाली दिखेगी।</p>{renderTable(['Month','Fee Name','Status','Amount'],chosenMonthlyStatus.map(row=>[row.month,row.feeName,row.status==='Paid'?<span style={{color:'#15803d',fontWeight:700}}>Paid ✓</span>:row.status==='Remaining'?<span style={{color:'#b91c1c',fontWeight:700}}>Remaining</span>:<span style={{color:'#94a3b8'}}>—</span>,row.status==='Remaining'?money(row.amount):row.status==='Paid'?'Paid':'—']))}<h4>Annual / One-time Pending Fees</h4>{renderTable(['Fee Name','Pending Amount'],chosenDetail.lines.filter(l=>l.month==='Annual / One-time').map(l=>[l.type,money(l.amount)]))}{chosenDetail.grand===0&&<p style={{color:'#15803d',fontWeight:700}}>No pending fee. This student is Fully Paid for the selected session.</p>}<h4>Category-wise Total Pending</h4>{renderTable(['Fee Category','Total Pending'],Object.entries(chosenDetail.totals).map(([k,v])=>[k,money(v)]))}<div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:12,padding:12,background:'#fff1f2',borderRadius:8}}><b>Grand Total Due</b><strong style={{fontSize:22,color:chosenDetail.grand>0?'#be123c':'#15803d'}}>{money(chosenDetail.grand)}</strong></div></>}</div>}
    <p className="muted">Automatic dues use the selected session's saved student Fee Setup first, then the class Fee Structure as fallback. Monthly School/Van fees are calculated from April through the current month. One-time fees are included only when configured. Aadhaar search uses the stored Aadhaar field or last four digits; keep full Aadhaar masked and protected.</p>
   </div>;
  }
  if(active==='Student Ledger')return <><label style={labelStyle}>Select Student<select style={inputStyle} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select Student</option>{students.map(s=><option value={s.id}>{s.name} · {s.className}</option>)}</select></label>{studentId&&<>{renderTable(['Date','Fee Type','Amount','Mode','Receipt'],studentPayments.map(p=>[p.paymentDate,p.feeType,money(p.amount),p.paymentMode,p.receiptNo]))}<b>Total Paid: {money(studentPaid)}</b>{actions('Student Ledger',table(['Date','Fee Type','Amount','Mode','Receipt'],studentPayments.map(p=>[p.paymentDate,p.feeType,money(p.amount),p.paymentMode,p.receiptNo])))}</>}</>;
  if(active==='Fee Receipts')return <><input style={{...inputStyle,maxWidth:380}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search receipt / student"/>{renderTable(['Receipt','Date','Student','Fee Type','Amount','View'],activePayments.filter(p=>`${p.receiptNo} ${p.studentName}`.toLowerCase().includes(search.toLowerCase())).map(p=>[p.receiptNo,p.paymentDate,p.studentName,p.feeType,money(p.amount),<button style={secondary} onClick={()=>setViewReceipt(p)}>View / PDF</button>]))}{viewReceipt&&<div style={{border:'1px solid #cbd5e1',borderRadius:10,padding:14,marginTop:12}}><h3>Fee Receipt</h3><p><b>{schoolName||'School'}</b></p><p>Receipt: {viewReceipt.receiptNo}</p><p>Student: {viewReceipt.studentName} · {viewReceipt.className}</p><p>Date: {viewReceipt.paymentDate}</p><p>Fee: {viewReceipt.feeType} · {viewReceipt.months||'—'}</p><h3>Paid: {money(viewReceipt.amount)}</h3><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={primary} onClick={()=>printDoc('Fee Receipt',`<p>Receipt: ${viewReceipt.receiptNo}</p><p>Student: ${viewReceipt.studentName}</p><p>Class: ${viewReceipt.className}</p><p>Date: ${viewReceipt.paymentDate}</p><p>Fee: ${viewReceipt.feeType}</p><p>Months: ${viewReceipt.months||'—'}</p><h2>Paid: ${money(viewReceipt.amount)}</h2>`)}>PDF / Print</button><button style={secondary} onClick={()=>shareReport('Fee Receipt',`Receipt ${viewReceipt.receiptNo}; Student ${viewReceipt.studentName}; Paid ${money(viewReceipt.amount)}`)}>Share / Send</button><button style={secondary} onClick={()=>setViewReceipt(null)}>Close</button></div></div>}{actions('Fee Receipts',table(['Receipt','Date','Student','Fee Type','Amount'],activePayments.map(p=>[p.receiptNo,p.paymentDate,p.studentName,p.feeType,money(p.amount)])))}</>;
  if(active==='Discount & Scholarship')return <><form onSubmit={saveDiscount} style={formGrid}><label style={labelStyle}>Student<select style={inputStyle} value={discountStudent} onChange={e=>setDiscountStudent(e.target.value)}><option value="">Select Student</option>{students.map(s=><option value={s.id}>{s.name}</option>)}</select></label><label style={labelStyle}>Discount Amount<input style={inputStyle} type="number" min="1" required value={discountAmount} onChange={e=>setDiscountAmount(e.target.value)}/></label><label style={labelStyle}>Reason<input style={inputStyle} value={discountReason} onChange={e=>setDiscountReason(e.target.value)}/></label><button style={primary}>Save Discount</button></form>{renderTable(['Student','Amount','Reason','Session'],discounts.map(x=>[x.studentName,money(x.amount),x.reason,x.academicYear]))}</>;
  if(active==='Expenses')return <><form onSubmit={saveExpense} style={formGrid}><label style={labelStyle}>Expense Name<input style={inputStyle} required value={expenseTitle} onChange={e=>setExpenseTitle(e.target.value)}/></label><label style={labelStyle}>Amount<input style={inputStyle} type="number" min="1" required value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/></label><label style={labelStyle}>Date<input style={inputStyle} type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/></label><button style={primary}>Save Expense</button></form>{renderTable(['Date','Expense','Amount'],expenses.map(x=>[x.expenseDate,x.title,money(x.amount)]))}</>;
  return <><label style={labelStyle}>Report Year<select style={inputStyle} value={year} onChange={e=>setYear(e.target.value)}>{['2026-27','2025-26','2024-25','2023-24','All Years'].map(x=><option>{x}</option>)}</select></label><div style={statsGrid}><div className="stat"><small>Total Collected</small><strong>{money(year==='All Years'?allPaid:paid)}</strong></div><div className="stat"><small>Recorded Expenses</small><strong>{money(expenses.filter(x=>year==='All Years'||x.academicYear===year).reduce((a,x)=>a+Number(x.amount||0),0))}</strong></div><div className="stat"><small>Payment Entries</small><strong>{(year==='All Years'?activePayments:rows).length}</strong></div></div><input style={{...inputStyle,maxWidth:380,marginTop:12}} value={reportSearch} onChange={e=>setReportSearch(e.target.value)} placeholder="Search payments"/>{renderTable(['Date','Student','Class','Fee Type','Amount','Receipt'],reportRows.filter(p=>year==='All Years'||inYear(p.paymentDate)).map(p=>[p.paymentDate,p.studentName,p.className,p.feeType,money(p.amount),p.receiptNo]))}{actions('Financial Report',table(['Date','Student','Class','Fee Type','Amount','Receipt'],reportRows.map(p=>[p.paymentDate,p.studentName,p.className,p.feeType,money(p.amount),p.receiptNo])))}</>;
 };
 const formGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,alignItems:'end',margin:'14px 0'};
 const statsGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,margin:'14px 0'};
 if(!schoolId)return <section className="workspace"><h2>{active}</h2><p>Please select one school from the top menu to manage its finance records.</p></section>;
 return <section className="workspace"><button className="back" onClick={onBack||(()=>window.dispatchEvent(new CustomEvent('smp-back-dashboard')))}>← Dashboard</button><div className="section-head"><div><h2>{active}</h2><p>{schoolName} · Academic Session {year}</p></div><span>{loading?'Loading…':''}</span></div>{error&&<p style={{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8}}>{error}</p>}{message&&<p style={{color:'#166534',background:'#dcfce7',padding:10,borderRadius:8}}>{message}</p>}{panelBody()}</section>;
}
