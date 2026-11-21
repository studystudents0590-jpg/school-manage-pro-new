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
 const [className,setClassName]=useState(''),[collectionClass,setCollectionClass]=useState(''),[monthlyFee,setMonthlyFee]=useState(''),[admissionFee,setAdmissionFee]=useState(''),[vanFee,setVanFee]=useState('');
 const [expenseTitle,setExpenseTitle]=useState(''),[expenseAmount,setExpenseAmount]=useState(''),[expenseDate,setExpenseDate]=useState(new Date().toISOString().slice(0,10));
 const [discountStudent,setDiscountStudent]=useState(''),[discountAmount,setDiscountAmount]=useState(''),[discountReason,setDiscountReason]=useState('');
 const [reportSearch,setReportSearch]=useState('');
 const [viewReceipt,setViewReceipt]=useState(null);
 useEffect(()=>{
  if(!schoolId){setLoading(false);return;}
  setLoading(true);setError('');
  const refs=[['feePayments',setPayments],['feeStructures',setStructures],['feeDiscounts',setDiscounts],['schoolExpenses',setExpenses]];
  const unsubs=refs.map(([name,setter])=>onSnapshot(query(collection(db,name),where('schoolId','==',schoolId)),snap=>setter(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(e.message)));
  setLoading(false);return()=>unsubs.forEach(u=>u());
 },[schoolId]);
 const collectionClasses=[...new Set(students.map(s=>String(s.className||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const collectionStudents=students.filter(s=>String(s.className||'').trim()===collectionClass);
 const searchableCollectionStudents=collectionStudents.filter(s=>`${s.name||''} ${s.admissionNo||''} ${s.penNumber||''} ${s.rollNo||''} ${s.rollNumber||''} ${s.fatherName||''} ${s.phone||''} ${s.whatsapp||''}`.toLowerCase().includes(studentSearch.toLowerCase().trim()));
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
 const studentDue=(st)=>{const structure=structures.find(x=>x.className===st.className&&x.academicYear===year)||structures.find(x=>x.className===st.className);if(!structure)return null;const now=new Date();const start=Number(year.slice(0,4));const end=new Date(`${start+1}-03-31T23:59:59`);const isCurrent=now>=new Date(`${start}-04-01T00:00:00`)&&now<=end;const upto=isCurrent?Math.min(11,Math.max(0,(now.getFullYear()-start)*12+now.getMonth()-3)):now<new Date(`${start}-04-01`)?0:12;const dueMonths=monthNames.slice(0,upto);const schoolPaid=paidMonthsFor(st.id,'Monthly School Fee',year);const vanPaid=paidMonthsFor(st.id,'Monthly Van Fee',year);const schoolDue=Math.max(0,dueMonths.length-schoolPaid.length)*Number(structure.monthlyFee||0);const vanDue=Math.max(0,dueMonths.length-vanPaid.length)*Number(structure.vanFee||0);const otherPaid=activePayments.filter(p=>p.studentId===st.id&&p.academicYear===year&&p.feeType!=='Monthly School Fee'&&p.feeType!=='Monthly Van Fee').reduce((a,p)=>a+Number(p.amount||0),0);return Math.max(0,schoolDue+vanDue-otherPaid*0);};
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
 const saveStructure=async e=>{e.preventDefault();if(!schoolId||!className)return setError('Select class.');try{const old=structures.find(x=>x.className===className&&x.academicYear===year);const data={schoolId,className,monthlyFee:Number(monthlyFee||0),admissionFee:Number(admissionFee||0),vanFee:Number(vanFee||0),academicYear:year,updatedAt:serverTimestamp()};if(old)await updateDoc(doc(db,'feeStructures',old.id),data);else await addDoc(collection(db,'feeStructures'),{...data,createdAt:serverTimestamp()});setMessage('Fee structure saved.');}catch(e){setError(e.message);}};
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

  if(active==='Fee Structure')return <><form onSubmit={saveStructure} style={formGrid}><label style={labelStyle}>Class<select style={inputStyle} required value={className} onChange={e=>setClassName(e.target.value)}><option value="">Select Class</option>{['Nursery','LKG','UKG',...Array.from({length:12},(_,i)=>String(i+1))].map(x=><option>{x}</option>)}</select></label>{[['Monthly Fee',monthlyFee,setMonthlyFee],['Admission Fee',admissionFee,setAdmissionFee],['Van Fee',vanFee,setVanFee]].map(([l,v,f])=><label style={labelStyle}>{l}<input style={inputStyle} type="number" min="0" value={v} onChange={e=>f(e.target.value)}/></label>)}<button style={primary}>Save Fee Structure</button></form>{renderTable(['Class','Monthly','Admission','Van','Session'],structures.map(x=>[x.className,money(x.monthlyFee),money(x.admissionFee),money(x.vanFee),x.academicYear]))}</>;
  if(active==='Fee Dues')return <><input style={{...inputStyle,maxWidth:380}} placeholder="Search student / class" value={search} onChange={e=>setSearch(e.target.value)}/>{renderTable(['Student','Class','School Fee + Van Due'],students.filter(s=>`${s.name} ${s.className} ${s.admissionNo}`.toLowerCase().includes(search.toLowerCase())).map(s=>[s.name,s.className,studentDue(s)===null?'Set Fee Structure':money(studentDue(s))]))}<p style={{fontSize:12,color:'#64748b'}}>Dues are estimated from the saved class monthly school and van fees, April to current month. Admission, renewal and exam fees are not included here.</p></>;
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
