import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const inputStyle={width:'100%',padding:11,border:'1px solid #cbd5e1',borderRadius:8,boxSizing:'border-box',fontSize:14,background:'#fff'};
const labelStyle={display:'block',fontWeight:600,fontSize:13,color:'#334155',marginBottom:6};
const primary={background:'#2457d6',color:'#fff',border:0,borderRadius:8,padding:'10px 15px',fontWeight:700,cursor:'pointer'};
const secondary={background:'#eef2ff',color:'#1e40af',border:0,borderRadius:8,padding:'10px 13px',fontWeight:600,cursor:'pointer'};
export default function FinanceModule({active,schoolId,schoolName,students,profile,onBack}){
 const [payments,setPayments]=useState([]),[structures,setStructures]=useState([]),[discounts,setDiscounts]=useState([]),[expenses,setExpenses]=useState([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[paymentSaving,setPaymentSaving]=useState(false);
 const paymentSavingRef=useRef(false);
 const [search,setSearch]=useState(''),[studentSearch,setStudentSearch]=useState(''),[year,setYear]=useState('2026-27'),[studentId,setStudentId]=useState(''),[feeType,setFeeType]=useState('Monthly School Fee'),[amount,setAmount]=useState(''),[paymentDate,setPaymentDate]=useState(new Date().toISOString().slice(0,10)),[method,setMethod]=useState('Cash'),[months,setMonths]=useState([]),[notes,setNotes]=useState('');
 const [className,setClassName]=useState(''),[collectionClass,setCollectionClass]=useState(''),[monthlyFee,setMonthlyFee]=useState(''),[admissionFee,setAdmissionFee]=useState(''),[vanFee,setVanFee]=useState(''),[renewalFee,setRenewalFee]=useState(''),[examFee,setExamFee]=useState(''),[otherFee,setOtherFee]=useState('');
 const [expenseTitle,setExpenseTitle]=useState(''),[expenseAmount,setExpenseAmount]=useState(''),[expenseDate,setExpenseDate]=useState(new Date().toISOString().slice(0,10));
 const [expenseDrafts,setExpenseDrafts]=useState([{title:'',amount:'',category:'Other'}]),[expenseSearch,setExpenseSearch]=useState(''),[expensePeriod,setExpensePeriod]=useState('All Time'),[expenseMonth,setExpenseMonth]=useState('All Months'),[expenseDay,setExpenseDay]=useState(new Date().toISOString().slice(0,10)),[expenseYear,setExpenseYear]=useState('All Years');
 const [discountStudent,setDiscountStudent]=useState(''),[discountAmount,setDiscountAmount]=useState(''),[discountReason,setDiscountReason]=useState('');
 const [reportSearch,setReportSearch]=useState(''),[reportClass,setReportClass]=useState('All Classes'),[reportMonth,setReportMonth]=useState('All Months'),[reportFeeType,setReportFeeType]=useState('All Fee Types'),[reportMode,setReportMode]=useState('All Modes');
 const [viewReceipt,setViewReceipt]=useState(null),[includeRemainingFees,setIncludeRemainingFees]=useState(false),[includeVanTogether,setIncludeVanTogether]=useState(false),[vanMonths,setVanMonths]=useState([]);
 const todayLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const [receiptPeriod,setReceiptPeriod]=useState('Daily'),[receiptDay,setReceiptDay]=useState(todayLocal()),[receiptMonth,setReceiptMonth]=useState(todayLocal().slice(0,7)),[receiptYear,setReceiptYear]=useState(year),[receiptClass,setReceiptClass]=useState('All Classes');
 const [duesClass,setDuesClass]=useState('All Classes'),[duesMonth,setDuesMonth]=useState('All Months'),[duesStudentId,setDuesStudentId]=useState(''),[duesSummaryMode,setDuesSummaryMode]=useState('Class-wise');
 const [ledgerClass,setLedgerClass]=useState('All Classes'),[ledgerSearch,setLedgerSearch]=useState(''),[ledgerStudentId,setLedgerStudentId]=useState('');
 const [newSession,setNewSession]=useState('2027-28'),[promotionPreview,setPromotionPreview]=useState(false),[feeUpdateClass,setFeeUpdateClass]=useState(''),[bulkSchoolFee,setBulkSchoolFee]=useState(''),[feeUpdateRoute,setFeeUpdateRoute]=useState(''),[bulkVanFee,setBulkVanFee]=useState(''),[sessionBusy,setSessionBusy]=useState(false);
 useEffect(()=>{
  if(!schoolId){setLoading(false);return;}
  setLoading(true);setError('');
  const refs=[['feePayments',setPayments],['feeStructures',setStructures],['feeDiscounts',setDiscounts],['schoolExpenses',setExpenses]];
  const unsubs=refs.map(([name,setter])=>onSnapshot(query(collection(db,name),where('schoolId','==',schoolId)),snap=>setter(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>setError(e.message)));
  setLoading(false);return()=>unsubs.forEach(u=>u());
 },[schoolId]);
 const isFinanceActiveStudent=s=>!s.passedOut&&!['passed out','transferred','inactive','left','deleted'].includes(String(s.status||'').trim().toLowerCase())&&s.isActive!==false;
 const activeStudents=students.filter(isFinanceActiveStudent);
 const collectionClasses=[...new Set(activeStudents.map(s=>String(s.className||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const collectionStudents=activeStudents.filter(s=>String(s.className||'').trim()===collectionClass);
 const searchableCollectionStudents=collectionStudents.filter(s=>`${s.name||''} ${s.admissionNo||''} ${s.penNumber||''} ${s.rollNo||''} ${s.rollNumber||''} ${s.fatherName||''} ${s.phone||''} ${s.whatsapp||''} ${s.aadhaarLast4||s.aadhaar||''}`.toLowerCase().includes(studentSearch.toLowerCase().trim()));
 const selectedStudent=students.find(s=>s.id===studentId && String(s.className||'').trim()===collectionClass);
 const activePayments=payments.filter(p=>p.status!=='cancelled');
 const inYear=d=>{const dt=String(d||'');const y=Number(String(year).slice(0,4));return Number.isFinite(y)&&dt>=`${y}-04-01`&&dt<=`${y+1}-03-31`;};
 const paymentInSelectedYear=p=>year==='All Years'||(p.academicYear?String(p.academicYear)===String(year):inYear(p.paymentDate));
 const paid=activePayments.filter(paymentInSelectedYear).reduce((a,p)=>a+Number(p.amount||0),0);
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
 const getStudentConfig=st=>st?.feeConfig||{};
 const studentHasVan=st=>{const c=getStudentConfig(st);return Boolean(c.transportOpted===true||c.transportOpted==='Yes')&&Number(c.monthlyVanFee||st?.monthlyVanFee||0)>0;};
 const monthIndex=m=>monthNames.indexOf(m);
 const vanStartMonthFor=st=>{const c=getStudentConfig(st);const d=c.vanStartDate||st?.vanStartDate||st?.admissionDate||'';if(!d)return 'April';const dt=new Date(`${String(d).slice(0,10)}T00:00:00`);if(Number.isNaN(dt.getTime()))return 'April';const mi=(dt.getMonth()+9)%12;return monthNames[mi]||'April';};
 const feeAmountFor=(st,type)=>{const c=getStudentConfig(st);if(type==='Monthly School Fee')return Number(c.monthlySchoolFee??st?.monthlySchoolFee??0);if(type==='Monthly Van Fee')return Number(c.monthlyVanFee??st?.monthlyVanFee??0);if(type==='Admission Fee'||type==='Renewal Fee')return Number(c.admissionFee??st?.admissionFee??st?.renewalFee??0);if(type==='Exam Fee')return Number(c.examFee??st?.examFee??0);if(type==='Other Fee')return Number(c.otherFeeAmount??st?.otherFeeAmount??0);return 0;};
 const changeStudent=value=>{const st=students.find(x=>x.id===value);const nextType=feeType==='Monthly Van Fee'&&!studentHasVan(st)?'Monthly School Fee':feeType;setStudentId(value);setFeeType(nextType);setMonths([]);setVanMonths([]);setIncludeVanTogether(false);setAmount(st?String(feeAmountFor(st,nextType)||''):'');setError('');};
 const changeFeeType=value=>{setFeeType(value);setMonths([]);setVanMonths([]);setIncludeVanTogether(false);setAmount(selectedStudent?String(feeAmountFor(selectedStudent,value)||''):'');};
 const changeYear=value=>{setYear(value);setMonths([]);};
 const paidMonthsFor=(sid,type,session)=>activePayments.filter(p=>p.studentId===sid&&p.feeType===type&&p.academicYear===session).flatMap(p=>String(p.months||'').split(',').map(x=>x.trim()).filter(Boolean));
 const monthsDueThrough=(session,student)=>{
  const start=Number(String(session).slice(0,4));
  const now=new Date();
  const sessionEnd=new Date(start+1,2,31,23,59,59);
  const cutoff=now>sessionEnd?12:now<new Date(start,3,1)?0:Math.min(12,Math.max(0,(now.getFullYear()-start)*12+now.getMonth()-3+1));
  return monthNames.slice(0,cutoff);
 };
 const vanStartMonth=vanStartMonthFor(selectedStudent);
 const currentSessionMonth=monthsDueThrough(year,selectedStudent||{}).slice(-1)[0]||'';
 const eligibleMonths=feeType==='Monthly Van Fee'?monthNames.filter(m=>monthIndex(m)>=monthIndex(vanStartMonth)&&monthIndex(m)<=monthIndex(currentSessionMonth)):monthNames.filter(m=>monthIndex(m)<=monthIndex(currentSessionMonth));
 const eligibleVanMonths=monthNames.filter(m=>monthIndex(m)>=monthIndex(vanStartMonth)&&monthIndex(m)<=monthIndex(currentSessionMonth));
 const vanPaidMonths=paidMonthsFor(studentId,'Monthly Van Fee',year);
 const feeDueDetails=(st,session=year)=>{
  const saved=st.feeConfig||{};
  const structure=structures.find(x=>x.className===st.className&&x.academicYear===session);
  const matchesSaved=String(saved.academicYear||st.academicYear||'')===String(session);
  const feeSource=matchesSaved?{monthlyFee:saved.monthlySchoolFee,vanFee:saved.transportOpted?saved.monthlyVanFee:0,admissionFee:saved.admissionType==='New Admission'?saved.admissionFee:0,renewalFee:saved.admissionType==='Renewal'?saved.admissionFee:0,examFee:saved.examFee,otherFee:saved.otherFeeAmount,otherFeeName:saved.otherFeeName,admissionFeeStatus:saved.admissionFeeStatus,examFeeStatus:saved.examFeeStatus}:structure;
  if(!feeSource)return {lines:[],totals:{},grand:0,missingStructure:true};
  const transportOpted=Boolean(saved.transportOpted===true||saved.transportOpted==='Yes'||st.transportOpted===true||st.transportOpted==='Yes');
  const normalizedFeeSource={...feeSource,vanFee:transportOpted?Number(feeSource.vanFee||0):0};
  const dueMonths=monthsDueThrough(session,st);
  const paidFor=(type)=>activePayments.filter(p=>p.studentId===st.id&&p.academicYear===session&&p.feeType===type);
  const paidMonthSet=(type)=>new Set(paidFor(type).flatMap(p=>String(p.months||'').split(',').map(x=>x.trim()).filter(Boolean)));
  const lines=[];
  const addMonthly=(type,label,rate)=>{const paidSet=paidMonthSet(type);const eligible=type==='Monthly Van Fee'?dueMonths.filter(m=>monthIndex(m)>=monthIndex(vanStartMonthFor(st))):dueMonths;eligible.forEach(m=>{if(!paidSet.has(m)&&Number(rate||0)>0)lines.push({month:m,type:label,amount:Number(rate||0)});});};
  addMonthly('Monthly School Fee','Monthly School Fee',normalizedFeeSource.monthlyFee);
  addMonthly('Monthly Van Fee','Van Fee',normalizedFeeSource.vanFee);
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
   const vanStart=vanStartMonthFor(st);
   const vanUnpaid=dueMonthNames.filter(m=>monthIndex(m)>=monthIndex(vanStart)&&!vanPaid.includes(m)).length;
   const balance=schoolUnpaid*Number(structure.monthlyFee||0)+vanUnpaid*Number(structure.vanFee||0);
   if(isSelected)currentDue+=balance; else if(sy<sessionStart)previousDue+=balance;
  });
  const history=activePayments.filter(p=>p.studentId===st.id).sort((a,b)=>String(b.paymentDate||'').localeCompare(String(a.paymentDate||'')));
  const totalPaid=history.reduce((sum,p)=>sum+Number(p.amount||0),0);
  return {currentDue,previousDue,totalDue:currentDue+previousDue,totalPaid,history};
 };
 const rows=activePayments.filter(paymentInSelectedYear);
 const reportRows=activePayments.filter(p=>paymentInSelectedYear(p)&&`${p.studentName||''} ${p.className||''} ${p.receiptNo||''} ${p.admissionNo||''} ${p.feeType||''} ${p.paymentMode||''} ${p.months||''}`.toLowerCase().includes(reportSearch.toLowerCase().trim()));
 const printDoc=(title,body)=>{const w=window.open('','_blank');if(!w){alert('Please allow pop-ups to print or save PDF.');return;}w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;padding:24px;color:#111}h1,h2{margin:0 0 12px}table{border-collapse:collapse;width:100%;margin-top:15px}td,th{border:1px solid #bbb;padding:8px;text-align:left}.muted{color:#555;font-size:12px}@media print{button{display:none}}</style></head><body><h1>${schoolName||'School Manager Pro'}</h1><h2>${title}</h2><p class="muted">Academic Session: ${year} · Generated: ${new Date().toLocaleString()}</p>${body}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();};
 const table=(headers,items)=>`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${items.map(row=>`<tr>${row.map(v=>`<td>${String(v??'—').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const renderTable=(headers,items)=><div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{items.length?items.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v??'—'}</td>)}</tr>):<tr><td colSpan={headers.length}>No records found.</td></tr>}</tbody></table></div>;
 const shareReport=(title,body)=>{const txt=`${schoolName||'School'}\n${title}\n${body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,2500)}`;if(navigator.share)navigator.share({title,text:txt}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>setMessage('Report copied. You can share it now.'));else setMessage('Use Print / PDF to save this report.');};
 const actions=(title,body)=><div style={{display:'flex',gap:7,flexWrap:'wrap',margin:'12px 0'}}><button style={secondary} onClick={()=>shareReport(title,body)}>Share</button><button style={secondary} onClick={()=>shareReport(title,body)}>Send</button><button style={secondary} onClick={()=>printDoc(title,body)}>PDF</button><button style={secondary} onClick={()=>printDoc(title,body)}>Print</button></div>;
 const escapeHtml=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const receiptRemaining=p=>{
  const st=students.find(x=>x.id===p.studentId);
  if(!st)return {groups:[],grand:0};
  const d=feeDueDetails(st,p.academicYear||year);
  const groups=[];
  d.lines.forEach(line=>{let g=groups.find(x=>x.type===line.type);if(!g){g={type:line.type,months:[],amount:0};groups.push(g);}g.months.push(line);g.amount+=Number(line.amount||0);});
  return {groups,grand:d.grand};
 };
 const receiptItems=p=>Array.isArray(p.items)&&p.items.length?p.items:[{feeType:p.feeType,months:p.months,amount:p.amount}];
 const groupedReceiptPayments=rows=>{
  const map=new Map();
  rows.forEach(p=>{const key=p.receiptNo||p.id;if(!map.has(key))map.set(key,{...p,items:[],amount:0});const g=map.get(key);g.items.push({feeType:p.feeType,months:p.months,amount:p.amount});g.amount+=Number(p.amount||0);});
  return [...map.values()].sort((a,b)=>String(b.paymentDate||'').localeCompare(String(a.paymentDate||'')));
 };
 const receiptTotal=p=>receiptItems(p).reduce((a,x)=>a+Number(x.amount||0),0);
 const receiptText=(p,includeRemaining=false)=>{
  const base=[schoolName||'School Manager Pro','FEE PAYMENT RECEIPT',`Receipt No: ${p.receiptNo||'—'}`,`Student: ${p.studentName||'—'}`,`Admission No: ${p.admissionNo||'—'}`,`Class: ${p.className||'—'}`,`Academic Session: ${p.academicYear||year}`,`Payment Date: ${p.paymentDate||'—'}`,'PAYMENT DETAILS',...receiptItems(p).map(x=>`${x.feeType}: ${x.months||'—'} — ${money(x.amount)}`),`Amount Received: ${money(receiptTotal(p))}`,`Payment Mode: ${p.paymentMode||'—'}`,`Notes: ${p.notes||'—'}`];
  if(includeRemaining){const d=receiptRemaining(p);base.push('REMAINING FEES');if(d.groups.length)d.groups.forEach(g=>{base.push(`${g.type}: ${money(g.amount)}`);if(g.months.length)base.push(g.months.map(x=>`${x.month} ${money(x.amount)}`).join(' · '));});else base.push('No remaining fee recorded.');base.push(`Total Remaining: ${money(d.grand)}`);}
  base.push('Thank you.');return base.join('\n');
 };
 const receiptHtml=(p,includeRemaining=false)=>{
  const d=includeRemaining?receiptRemaining(p):{groups:[],grand:0};
  const remainingBlock=includeRemaining?`<h3>Remaining Fee Details</h3>${d.groups.length?d.groups.map(g=>`<div class="due-line"><b>${escapeHtml(g.type)} — ${money(g.amount)}</b><div class="months">${g.months.map(x=>`${escapeHtml(x.month)} ${money(x.amount)}`).join(' · ')}</div></div>`).join(''):'<p>No remaining fee recorded.</p>'}<div class="total"><span>Total Remaining</span><strong>${money(d.grand)}</strong></div>`:'';
  return `<div class="receipt"><div class="top"><div><div class="school">${escapeHtml(schoolName||'School Manager Pro')}</div><div class="tag">OFFICIAL FEE RECEIPT</div></div><div class="stamp">PAID</div></div><div class="meta"><span><b>Receipt No.</b><br>${escapeHtml(p.receiptNo)}</span><span><b>Payment Date</b><br>${escapeHtml(p.paymentDate)}</span><span><b>Academic Session</b><br>${escapeHtml(p.academicYear||year)}</span></div><h3>Student Details</h3><div class="details"><span><b>Student Name</b><br>${escapeHtml(p.studentName)}</span><span><b>Admission No.</b><br>${escapeHtml(p.admissionNo)}</span><span><b>Class</b><br>${escapeHtml(p.className)}</span></div><h3>Payment Details</h3><table><thead><tr><th>Fee Description</th><th>Month(s)</th><th>Amount</th></tr></thead><tbody>${receiptItems(p).map(x=>`<tr><td>${escapeHtml(x.feeType)}</td><td>${escapeHtml(x.months||'—')}</td><td>${money(x.amount)}</td></tr>`).join('')}</tbody></table><div class="total"><span>Amount Received</span><strong>${money(receiptTotal(p))}</strong></div>${remainingBlock}<div class="details small"><span><b>Payment Mode</b><br>${escapeHtml(p.paymentMode)}</span><span><b>Notes</b><br>${escapeHtml(p.notes||'—')}</span></div><div class="foot"><span>Computer generated receipt</span><span>Authorized Signature</span></div></div>`;
 };
 const receiptPrint=(p,includeRemaining=false)=>{
  const w=window.open('','_blank');
  if(!w){alert('Please allow pop-ups to print or save PDF.');return;}
  const html=receiptHtml(p,includeRemaining);
  w.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fee Receipt ${escapeHtml(p.receiptNo||'')}</title>
  <style>
  *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111;background:#eef2f7}
  .toolbar{position:sticky;top:0;z-index:5;background:#172554;color:white;padding:10px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px}
  .toolbar button,.toolbar select{padding:8px 10px;border:0;border-radius:6px;font-weight:600}
  .sheet{width:210mm;min-height:0;margin:16px auto;background:#fff;padding:7mm;box-shadow:0 2px 14px #0002}
  .receipt{width:100%;max-width:none;margin:0;border:1.4px solid #1e3a8a;border-radius:8px;padding:5mm;overflow-wrap:anywhere}
  .top,.meta,.details,.total,.foot{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .school{font-size:20px;font-weight:800;color:#1e3a8a}.tag{font-size:9px;letter-spacing:1.2px;color:#64748b;margin-top:3px}
  .stamp{border:1.5px solid #15803d;color:#15803d;padding:5px 12px;border-radius:6px;font-weight:800;font-size:11px}
  .meta,.details{background:#f8fafc;padding:7px;margin:8px 0;font-size:10px;gap:8px}
  .receipt h3{font-size:11px;color:#1e3a8a;margin:9px 0 4px}
  .receipt table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;margin:5px 0}
  .receipt th,.receipt td{border:1px solid #cbd5e1;padding:5px;vertical-align:top;overflow-wrap:anywhere}
  .receipt th{background:#eff6ff}
  .total{align-items:center;background:#eff6ff;padding:7px;margin-top:7px;border-radius:5px;font-size:12px}
  .total strong{font-size:16px;color:#1e3a8a}.due-line{padding:3px 0;border-bottom:1px solid #e2e8f0;font-size:10px}
  .months{font-size:9px;color:#64748b;margin-top:1px}.small{font-size:10px}
  .foot{border-top:1px dashed #94a3b8;padding-top:12px;margin-top:14px;color:#64748b;font-size:9px}
  @page{size:A4 portrait;margin:5mm}
  @media print{body{background:white}.toolbar{display:none!important}.sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.receipt{break-inside:avoid;page-break-inside:avoid}}
  @media screen and (max-width:800px){.sheet{width:100%;padding:10px;margin:0}.toolbar{position:relative}}
  </style></head><body>
  <div class="toolbar"><b>Receipt Print Setup</b><label>Paper <select id="paper"><option value="A4">A4</option><option value="Letter">Letter</option></select></label><label>Size <select id="scale"><option value="100">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option><option value="60">60%</option><option value="50">50%</option><option value="45">45%</option><option value="40">40%</option></select></label><button id="fit">Fit on One Page</button><button id="print">Print / Save PDF</button></div>
  <div class="sheet" id="sheet">${html}</div>
  <script>
  const sheet=document.getElementById('sheet'),receipt=sheet.querySelector('.receipt'),scale=document.getElementById('scale'),paper=document.getElementById('paper');
  function apply(){receipt.style.zoom=(Number(scale.value)||100)/100;document.documentElement.style.setProperty('--paper',paper.value);}
  scale.addEventListener('change',apply);
  paper.addEventListener('change',()=>{document.querySelector('style').textContent=document.querySelector('style').textContent.replace(/@page\\{size:[^;]+;/,'@page{size:'+paper.value+' portrait;');});
  document.getElementById('fit').onclick=()=>{receipt.style.zoom='1';const available=paper.value==='A4'?1040:930;const ratio=Math.min(1,available/receipt.offsetHeight);const pct=Math.max(40,Math.floor(ratio*100));scale.value=String([100,90,80,70,60,50,45,40].reduce((best,v)=>Math.abs(v-pct)<Math.abs(best-pct)?v:best,60));apply();};
  document.getElementById('print').onclick=()=>window.print();
  window.addEventListener('load',()=>{document.getElementById('fit').click();});
  </script></body></html>`);
  w.document.close();
 };
 const shareReceipt=async(p,includeRemaining=false)=>{const txt=receiptText(p,includeRemaining);if(navigator.share){try{await navigator.share({title:`Fee Receipt ${p.receiptNo}`,text:txt});}catch(_){}}else if(navigator.clipboard){try{await navigator.clipboard.writeText(txt);setMessage('Receipt details copied. You can paste and share them.');}catch(_){setMessage('Copy not available on this browser.');}}else setMessage('Sharing is not supported on this browser.');};
 const copyReceipt=async(p,includeRemaining=false)=>{try{await navigator.clipboard.writeText(receiptText(p,includeRemaining));setMessage('Receipt copied successfully.');}catch(_){setMessage('Copy is not available. Please use Share or Print.');}};
 const receiptCard=p=>p&&<div style={{border:'2px solid #1e3a8a',borderRadius:14,padding:16,margin:'16px 0',background:'#fff',boxShadow:'0 8px 24px rgba(15,23,42,.08)'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><div style={{fontSize:22,fontWeight:800,color:'#1e3a8a'}}>{schoolName||'School Manager Pro'}</div><div style={{fontSize:12,letterSpacing:1.5,color:'#64748b'}}>OFFICIAL FEE RECEIPT</div></div><span style={{padding:'7px 16px',border:'2px solid #16a34a',borderRadius:8,color:'#15803d',fontWeight:800}}>PAID</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8,background:'#f8fafc',padding:12,borderRadius:8,marginTop:14,fontSize:13}}><div><b>Receipt No.</b><br/>{p.receiptNo}</div><div><b>Date</b><br/>{p.paymentDate}</div><div><b>Session</b><br/>{p.academicYear||year}</div></div><h4 style={{margin:'16px 0 8px',color:'#1e3a8a'}}>Student Details</h4><div style={{fontSize:14,lineHeight:1.8}}><b>{p.studentName}</b><br/>Admission No: {p.admissionNo||'—'} · Class: {p.className||'—'}</div><h4 style={{margin:'14px 0 8px',color:'#1e3a8a'}}>Payment Details</h4><div style={{width:'100%',overflow:'hidden'}}><div style={{fontSize:12}}>{renderTable(['Fee Description','Month(s)','Payment Mode','Amount'],receiptItems(p).map(x=>[x.feeType,x.months||'—',p.paymentMode,money(x.amount)]))}</div></div><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#eff6ff',padding:14,borderRadius:8,marginTop:12}}><b>Amount Received</b><strong style={{fontSize:24,color:'#1e3a8a'}}> {money(receiptTotal(p))}</strong></div>{includeRemainingFees&&<div style={{marginTop:12}}><h4 style={{color:'#1e3a8a',marginBottom:6}}>Remaining Fee Details</h4>{receiptRemaining(p).groups.map(g=><div style={{padding:'5px 0',borderBottom:'1px solid #e2e8f0',fontSize:13}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><b>{g.type}</b><b>{money(g.amount)}</b></div><div style={{fontSize:12,color:'#64748b',marginTop:2}}>{g.months.map(x=>`${x.month} ${money(x.amount)}`).join(' · ')}</div></div>)}<div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontWeight:800}}>Total Remaining <span>{money(receiptRemaining(p).grand)}</span></div></div>}{p.notes&&<p style={{fontSize:13,color:'#475569'}}>Notes: {p.notes}</p>}<label style={{display:'flex',alignItems:'center',gap:8,marginTop:16,padding:10,background:'#f8fafc',borderRadius:8,fontWeight:700}}><input type="checkbox" checked={includeRemainingFees} onChange={e=>setIncludeRemainingFees(e.target.checked)}/> Parents को Remaining Fees भी भेजें (बकाया फीस शामिल करें)</label><div style={{fontSize:12,color:'#64748b',marginTop:4}}>OFF: Parents को केवल जमा फीस जाएगी। ON: जमा फीस के साथ वर्तमान बाकी फीस और महीनों का विवरण भी जाएगा। यह विकल्प Share, Send, PDF, Print और Copy सभी पर लागू है।</div><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><button style={secondary} onClick={()=>receiptPrint(p,includeRemainingFees)}>Download PDF</button><button style={secondary} onClick={()=>receiptPrint(p,includeRemainingFees)}>Print</button><button style={secondary} onClick={()=>shareReceipt(p,includeRemainingFees)}>Share with Parents</button><button style={secondary} onClick={()=>copyReceipt(p,includeRemainingFees)}>Copy for Parents</button></div></div>;
 const savePayment=async e=>{
  e.preventDefault();
  if(paymentSavingRef.current)return;
  if(!schoolId||!collectionClass)return setError('Select a class first.');
  if(!selectedStudent)return setError('Select a student from the selected class.');
  const n=Number(amount);
  if(!(n>0))return setError('Enter a valid amount.');
  if(feeType==='Monthly Van Fee'&&!studentHasVan(selectedStudent))return setError('This student has no transport service in Admission Form.');
  if(monthlyFeeType&&!months.length)return setError('Select at least one eligible unpaid month.');
  if(monthlyFeeType&&months.some(m=>!eligibleMonths.includes(m)))return setError('Selected month is outside the fee period.');
  if(months.some(m=>paidMonths.includes(m)))return setError('A selected month is already paid.');
  if(includeVanTogether){
   if(feeType!=='Monthly School Fee')return setError('Choose Monthly School Fee to collect School Fee and Van Fee together.');
   if(!studentHasVan(selectedStudent))return setError('This student has no transport service in Admission Form.');
   if(!vanMonths.length)return setError('Select Van Fee month(s), or turn off combined collection.');
   if(vanMonths.some(m=>!eligibleVanMonths.includes(m)||vanPaidMonths.includes(m)))return setError('One or more selected Van Fee months are not eligible or already paid.');
  }
  paymentSavingRef.current=true;setPaymentSaving(true);
  try{
   setError('');
   // Refresh this school's payment records from Firestore before saving, so stale UI data cannot silently allow a repeated monthly payment.
   const freshSnapshot=await getDocs(query(collection(db,'feePayments'),where('schoolId','==',schoolId)));
   const freshPayments=freshSnapshot.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.status!=='cancelled'&&p.studentId===selectedStudent.id&&String(p.academicYear||'')===String(year));
   const itemsToCheck=[{feeType,months:months.join(', ')}];
   if(includeVanTogether)itemsToCheck.push({feeType:'Monthly Van Fee',months:vanMonths.join(', ')});
   for(const item of itemsToCheck){
    if(item.feeType!=='Monthly School Fee'&&item.feeType!=='Monthly Van Fee')continue;
    const alreadyPaid=new Set(freshPayments.filter(p=>p.feeType===item.feeType).flatMap(p=>String(p.months||'').split(',').map(x=>x.trim()).filter(Boolean)));
    const duplicateMonths=String(item.months||'').split(',').map(x=>x.trim()).filter(m=>m&&alreadyPaid.has(m));
    if(duplicateMonths.length)throw new Error(`${item.feeType}: ${duplicateMonths.join(', ')} already paid. Refresh the page and select unpaid months only.`);
   }
   const receiptNo=`R-${Date.now()}`;
   const common={schoolId,studentId:selectedStudent.id,studentName:selectedStudent.name||'',admissionNo:selectedStudent.admissionNo||'',className:selectedStudent.className||'',paymentDate,academicYear:year,paymentMode:method,notes:notes.trim(),receiptNo,status:'paid',createdBy:profile?.displayName||profile?.email||''};
   const items=[{feeType,amount:n,months:months.join(', ')}];
   if(includeVanTogether)items.push({feeType:'Monthly Van Fee',amount:vanMonths.length*feeAmountFor(selectedStudent,'Monthly Van Fee'),months:vanMonths.join(', ')});
   const records=items.map(x=>({...common,...x}));
   const savedDocs=await Promise.all(records.map(record=>addDoc(collection(db,'feePayments'),{...record,createdAt:serverTimestamp()})));
   const receipt={...common,feeType:items.map(x=>x.feeType).join(' + '),months:'',amount:items.reduce((a,x)=>a+Number(x.amount||0),0),items,id:savedDocs[0].id};
   setViewReceipt(receipt);setIncludeRemainingFees(false);setIncludeVanTogether(false);setVanMonths([]);setAmount('');setMonths([]);setNotes('');
   setMessage(`Payment saved successfully. One combined receipt: ${receiptNo}`);
  }catch(e){setError(e.message);}
  finally{paymentSavingRef.current=false;setPaymentSaving(false);}
 };
 const paymentActor=profile?.displayName||profile?.email||'School Admin';
 const correctPayment=async p=>{
  if(!p?.id)return setError('Payment record ID not found.');
  const nextAmount=window.prompt(`Correct amount for ${p.receiptNo||'payment'} (current ₹${Number(p.amount||0)}):`,String(p.amount||0));
  if(nextAmount===null)return;
  const amountValue=Number(nextAmount);
  if(!(amountValue>0))return setError('Enter a valid amount greater than zero.');
  const nextMonths=window.prompt('Correct month(s), comma separated. Leave blank if not applicable:',p.months||'');
  if(nextMonths===null)return;
  const reason=window.prompt('Reason for correction (required):','Wrong amount / month entered');
  if(!reason?.trim())return setError('Correction reason is required.');
  if(!window.confirm(`Confirm correction?\nOld amount: ₹${Number(p.amount||0)}\nNew amount: ₹${amountValue}\nThis will be saved in audit history.`))return;
  try{
   await addDoc(collection(db,'feePaymentAudit'),{schoolId,action:'EDIT',paymentId:p.id,receiptNo:p.receiptNo||'',studentId:p.studentId||'',studentName:p.studentName||'',before:{amount:Number(p.amount||0),months:p.months||'',feeType:p.feeType||'',paymentDate:p.paymentDate||'',paymentMode:p.paymentMode||''},after:{amount:amountValue,months:nextMonths.trim(),feeType:p.feeType||'',paymentDate:p.paymentDate||'',paymentMode:p.paymentMode||''},reason:reason.trim(),changedBy:paymentActor,changedAt:serverTimestamp()});
   await updateDoc(doc(db,'feePayments',p.id),{amount:amountValue,months:nextMonths.trim(),corrected:true,correctedAt:serverTimestamp(),correctedBy:paymentActor,correctionReason:reason.trim()});
   setMessage('Payment corrected. Original values are saved in audit history.');
  }catch(e){setError(`Correction failed: ${e.message}`);}
 };
 const cancelPayment=async p=>{
  if(!p?.id)return setError('Payment record ID not found.');
  const reason=window.prompt('Cancellation reason (required):','Wrong payment entry');
  if(!reason?.trim())return setError('Cancellation reason is required.');
  if(!window.confirm(`Cancel payment ${p.receiptNo||''} of ₹${Number(p.amount||0)}? It will no longer count as paid.`))return;
  try{
   await addDoc(collection(db,'feePaymentAudit'),{schoolId,action:'CANCEL',paymentId:p.id,receiptNo:p.receiptNo||'',studentId:p.studentId||'',studentName:p.studentName||'',before:{amount:Number(p.amount||0),months:p.months||'',status:p.status||'paid'},reason:reason.trim(),changedBy:paymentActor,changedAt:serverTimestamp()});
   await updateDoc(doc(db,'feePayments',p.id),{status:'cancelled',cancelledAt:serverTimestamp(),cancelledBy:paymentActor,cancellationReason:reason.trim()});
   setMessage('Payment cancelled. It will be excluded from paid totals.');
  }catch(e){setError(`Cancellation failed: ${e.message}`);}
 };
 const addRefund=async p=>{
  const refundText=window.prompt(`Refund amount (max ₹${Number(p.amount||0)}):`,'');
  if(refundText===null)return;
  const refundAmount=Number(refundText);
  if(!(refundAmount>0)||refundAmount>Number(p.amount||0))return setError('Enter a valid refund amount not exceeding the payment amount.');
  const reason=window.prompt('Refund reason (required):','Fee refunded to parent');
  if(!reason?.trim())return setError('Refund reason is required.');
  if(!window.confirm(`Record refund of ₹${refundAmount}? This will reduce net paid amount.`))return;
  try{
   await addDoc(collection(db,'feePaymentAudit'),{schoolId,action:'REFUND',paymentId:p.id,receiptNo:p.receiptNo||'',studentId:p.studentId||'',studentName:p.studentName||'',refundAmount,reason:reason.trim(),changedBy:paymentActor,changedAt:serverTimestamp()});
   await addDoc(collection(db,'feePayments'),{schoolId,studentId:p.studentId,studentName:p.studentName||'',admissionNo:p.admissionNo||'',className:p.className||'',paymentDate:new Date().toISOString().slice(0,10),academicYear:p.academicYear||year,paymentMode:'Refund',feeType:`Refund - ${p.feeType||'Fee'}`,amount:-refundAmount,months:p.months||'',receiptNo:`RF-${Date.now()}`,status:'paid',refundForPaymentId:p.id,notes:reason.trim(),createdBy:paymentActor,createdAt:serverTimestamp()});
   setMessage('Refund entry saved. Net paid total has been reduced.');
  }catch(e){setError(`Refund failed: ${e.message}`);}
 };
 const classOrder=['Nursery','LKG','UKG',...Array.from({length:10},(_,i)=>String(i+1))];
 const nextClassOf=c=>{const i=classOrder.indexOf(String(c||'').trim());return i>=0&&i<classOrder.length-1?classOrder[i+1]:i===classOrder.length-1?'Passed Out':c;};
 const currentSessionStart=Number(String(year).slice(0,4))||2026;
 const suggestedNextSession=`${currentSessionStart+1}-${String(currentSessionStart+2).slice(-2)}`;
 const activeForPromotion=students.filter(st=>isFinanceActiveStudent(st)&&classOrder.includes(String(st.className||'').trim())&&String(st.sessionPromotion?.to||'')!==newSession);
 const routeNames=[...new Set(students.map(st=>st.feeConfig?.vanRoute||st.vanRoute).filter(Boolean))].sort();
 const writeInChunks=async operations=>{for(let i=0;i<operations.length;i+=400){const batch=writeBatch(db);operations.slice(i,i+400).forEach(op=>op(batch));await batch.commit();}};
 const createNextSession=async()=>{
  if(!/^\d{4}-\d{2}$/.test(newSession)||Number(newSession.slice(0,4))<=currentSessionStart)return setError('Enter a valid next session, for example 2027-28.');
  if(!window.confirm(`Create ${newSession} and promote ${activeForPromotion.length} students? Class 10 students will be marked Passed Out. Old session records will be kept.`))return;
  setSessionBusy(true);setError('');setMessage('');
  try{
   const oldStructures=structures.filter(x=>x.academicYear===year);
   const newStructures=structures.filter(x=>x.academicYear===newSession);
   const ops=[];
   const sessionKey=`${schoolId}_${newSession}`.replace(/[^a-zA-Z0-9_-]/g,'_');
   const sessionRef=doc(db,'academicSessions',sessionKey);
   const existing=await getDoc(sessionRef);
   if(existing.exists())throw new Error('This academic session already exists. Do not create it twice.');
   oldStructures.forEach(old=>{
    if(!newStructures.some(x=>x.className===old.className)){
     const id=`${schoolId}_${newSession}_${old.className}`.replace(/[^a-zA-Z0-9_-]/g,'_');
     ops.push(batch=>batch.set(doc(db,'feeStructures',id),{schoolId,className:old.className,monthlyFee:Number(old.monthlyFee||0),admissionFee:Number(old.admissionFee||0),vanFee:Number(old.vanFee||0),renewalFee:Number(old.renewalFee||0),examFee:Number(old.examFee||0),otherFee:Number(old.otherFee||0),academicYear:newSession,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
    }
   });
   activeForPromotion.forEach(st=>{
    const promoted=nextClassOf(st.className);
    const oldConfig=st.feeConfig||{};
    const route=oldConfig.vanRoute||st.vanRoute||'';
    const matchingOld=oldStructures.find(x=>x.className===promoted)||oldStructures.find(x=>x.className===st.className);
    const newConfig={...oldConfig,academicYear:newSession,monthlySchoolFee:Number(matchingOld?.monthlyFee??oldConfig.monthlySchoolFee??st.monthlySchoolFee??0),monthlyVanFee:Number(oldConfig.monthlyVanFee??st.monthlyVanFee??matchingOld?.vanFee??0),vanRoute:route};
    const isPassed=promoted==='Passed Out';
    const historyId=`${schoolId}_${st.id}_${year}`.replace(/[^a-zA-Z0-9_-]/g,'_');
    ops.push(batch=>batch.set(doc(db,'studentSessionHistory',historyId),{schoolId,studentId:st.id,studentName:st.name||'',admissionNo:st.admissionNo||'',className:st.className||'',academicYear:year,feeConfig:oldConfig,vanRoute:route,createdAt:serverTimestamp()}));
    ops.push(batch=>batch.update(doc(db,'students',st.id),{className:promoted,passedOut:isPassed,status:isPassed?'Passed Out':'Active',academicYear:newSession,feeConfig:{...newConfig,academicYear:newSession},sessionPromotion:{from:year,to:newSession,fromClass:st.className||'',toClass:promoted,at:serverTimestamp()}}));
   });
   ops.push(batch=>batch.set(sessionRef,{schoolId,academicYear:newSession,previousSession:year,status:'Active',createdAt:serverTimestamp(),promotedCount:activeForPromotion.length,passedOutCount:activeForPromotion.filter(st=>String(st.className)==='10').length}));
   await writeInChunks(ops);
   setMessage(`${newSession} created. ${activeForPromotion.length} students promoted; Class 10 moved to Passed Out. Old session history retained.`);
   setYear(newSession);setPromotionPreview(false);
  }catch(e){setError(e.message||'Session creation failed.');}
  finally{setSessionBusy(false);}
 };
 const bulkUpdateClassFee=async e=>{
  e.preventDefault();if(year!==`${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(-2)}`&&year!==suggestedNextSession)return setError('Bulk fee updates are allowed only for the current or next academic session. Old sessions are protected.');if(!feeUpdateClass||bulkSchoolFee===''||Number(bulkSchoolFee)<0)return setError('Select a class and enter the new monthly fee.');
  const targets=students.filter(st=>String(st.className||'').trim()===feeUpdateClass&&isFinanceActiveStudent(st));
  if(!window.confirm(`Update Monthly School Fee for ${targets.length} students in Class ${feeUpdateClass} to ${money(bulkSchoolFee)} for ${year}? Previous session records will not be changed.`))return;
  setSessionBusy(true);setError('');
  try{
   const old=structures.find(x=>x.className===feeUpdateClass&&x.academicYear===year);
   const data={schoolId,className:feeUpdateClass,monthlyFee:Number(bulkSchoolFee),admissionFee:Number(old?.admissionFee||0),vanFee:Number(old?.vanFee||0),renewalFee:Number(old?.renewalFee||0),examFee:Number(old?.examFee||0),otherFee:Number(old?.otherFee||0),academicYear:year,updatedAt:serverTimestamp()};
   if(old)await updateDoc(doc(db,'feeStructures',old.id),data);else await addDoc(collection(db,'feeStructures'),{...data,createdAt:serverTimestamp()});
   const eligible=targets.filter(st=>String(st.feeConfig?.academicYear||st.academicYear||'')===year);const ops=eligible.map(st=>batch=>{const cfg=st.feeConfig||{};batch.update(doc(db,'students',st.id),{feeConfig:{...cfg,monthlySchoolFee:Number(bulkSchoolFee)}});});
   await writeInChunks(ops);setMessage(`Class ${feeUpdateClass}: fee structure saved for ${year}; ${eligible.length} matching student fee records updated. If this is a new session, run promotion first, then apply the bulk update.`);setBulkSchoolFee('');
  }catch(e){setError(e.message||'Class fee update failed.');}finally{setSessionBusy(false);}
 };
 const bulkUpdateRouteFee=async e=>{
  e.preventDefault();if(year!==`${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(-2)}`&&year!==suggestedNextSession)return setError('Bulk fee updates are allowed only for the current or next academic session. Old sessions are protected.');if(!feeUpdateRoute||bulkVanFee===''||Number(bulkVanFee)<0)return setError('Select a route and enter the new van fee.');
  const targets=students.filter(st=>(st.feeConfig?.vanRoute||st.vanRoute)===feeUpdateRoute&&(st.feeConfig?.transportOpted===true||st.feeConfig?.transportOpted==='Yes'||st.transportOpted===true||st.transportOpted==='Yes')&&isFinanceActiveStudent(st)&&String(st.feeConfig?.academicYear||st.academicYear||'')===year);
  if(!window.confirm(`Update Van Fee for ${targets.length} students on route ${feeUpdateRoute} to ${money(bulkVanFee)} per month for ${year}? Previous session records will not be changed.`))return;
  setSessionBusy(true);setError('');
  try{
   const ops=targets.map(st=>batch=>{const cfg=st.feeConfig||{};batch.update(doc(db,'students',st.id),{feeConfig:{...cfg,academicYear:year,monthlyVanFee:Number(bulkVanFee)}});});
   await writeInChunks(ops);setMessage(`Route ${feeUpdateRoute}: ${targets.length} students updated for ${year}.`);setBulkVanFee('');
  }catch(e){setError(e.message||'Route fee update failed.');}finally{setSessionBusy(false);}
 };
 const saveStructure=async e=>{e.preventDefault();if(!schoolId||!className)return setError('Select class.');try{const old=structures.find(x=>x.className===className&&x.academicYear===year);const data={schoolId,className,monthlyFee:Number(monthlyFee||0),admissionFee:Number(admissionFee||0),vanFee:Number(vanFee||0),renewalFee:Number(renewalFee||0),examFee:Number(examFee||0),otherFee:Number(otherFee||0),academicYear:year,updatedAt:serverTimestamp()};if(old)await updateDoc(doc(db,'feeStructures',old.id),data);else await addDoc(collection(db,'feeStructures'),{...data,createdAt:serverTimestamp()});setMessage('Fee structure saved.');}catch(e){setError(e.message);}};
 const addExpenseDraft=()=>setExpenseDrafts(old=>[...old,{title:'',amount:'',category:'Other'}]);
 const updateExpenseDraft=(i,key,value)=>setExpenseDrafts(old=>old.map((x,n)=>n===i?{...x,[key]:value}:x));
 const removeExpenseDraft=i=>setExpenseDrafts(old=>old.length===1?[{title:'',amount:'',category:'Other'}]:old.filter((_,n)=>n!==i));
 const saveExpense=async e=>{e.preventDefault();const valid=expenseDrafts.filter(x=>x.title.trim()&&Number(x.amount)>0);if(!valid.length)return setError('At least one expense with name and valid amount is required.');if(valid.length!==expenseDrafts.length)return setError('Please complete or remove every empty expense row.');try{const batchReceipt=`EXB-${Date.now()}`;const saved=[];for(let i=0;i<valid.length;i++){const x=valid[i],receiptNo=`EX-${Date.now()}-${i+1}`;const ref=await addDoc(collection(db,'schoolExpenses'),{schoolId,title:x.title.trim(),category:x.category||'Other',amount:Number(x.amount),expenseDate,academicYear:year,receiptNo,batchReceipt,status:'active',createdBy:profile?.displayName||profile?.email||'School Admin',createdAt:serverTimestamp()});saved.push({id:ref.id,...x,amount:Number(x.amount),receiptNo,batchReceipt,expenseDate});}setExpenseDrafts([{title:'',amount:'',category:'Other'}]);setMessage(`${saved.length} expense(s) saved. Individual receipts created. Batch receipt: ${batchReceipt}`);setExpenseSearch('');}catch(e){setError(e.message);}};
 const activeExpenses=expenses.filter(x=>x.status!=='cancelled');
 const expenseMatches=activeExpenses.filter(x=>{const q=expenseSearch.toLowerCase().trim();const matchText=!q||`${x.title||''} ${x.category||''} ${x.receiptNo||''} ${x.batchReceipt||''} ${x.amount||''} ${x.expenseDate||''}`.toLowerCase().includes(q);const d=String(x.expenseDate||'');const matchPeriod=expensePeriod==='All Time'||(expensePeriod==='Daily'&&d===expenseDay)||(expensePeriod==='Monthly'&&d.slice(0,7)===expenseMonth)||(expensePeriod==='Yearly'&&(expenseYear==='All Years'||(x.academicYear?String(x.academicYear)===expenseYear:d.slice(0,4)===String(expenseYear).slice(0,4))));return matchText&&matchPeriod;}).sort((a,b)=>String(b.expenseDate||'').localeCompare(String(a.expenseDate||'')));
 const expenseReceiptBody=x=>`<p><b>${schoolName||'School'}</b></p><p>Expense Receipt: ${x.receiptNo||'—'}</p><p>Date: ${x.expenseDate||'—'}</p><p>Expense: ${x.title||'—'} · Category: ${x.category||'Other'}</p><h2>Amount: ${money(x.amount)}</h2><p>Academic Session: ${x.academicYear||'—'}</p>`;
 const editExpense=async x=>{const title=window.prompt('Expense name:',x.title||'');if(title===null)return;const amountText=window.prompt('Correct amount:',String(x.amount||''));if(amountText===null)return;const amountValue=Number(amountText);if(!title.trim()||!(amountValue>0))return setError('Enter a valid expense name and amount.');const reason=window.prompt('Reason for correction (required):','Wrong expense details');if(!reason?.trim())return setError('Correction reason is required.');if(!window.confirm(`Save correction? Old: ${money(x.amount)} · New: ${money(amountValue)}`))return;try{await addDoc(collection(db,'schoolExpenseAudit'),{schoolId,expenseId:x.id,receiptNo:x.receiptNo||'',action:'EDIT',before:{title:x.title,amount:Number(x.amount||0)},after:{title:title.trim(),amount:amountValue},reason:reason.trim(),changedBy:profile?.displayName||profile?.email||'School Admin',changedAt:serverTimestamp()});await updateDoc(doc(db,'schoolExpenses',x.id),{title:title.trim(),amount:amountValue,corrected:true,correctionReason:reason.trim(),updatedAt:serverTimestamp()});setMessage('Expense corrected. Old values are saved in audit history.');}catch(err){setError(`Expense correction failed: ${err.message}`);}};
 const cancelExpense=async x=>{const reason=window.prompt('Cancellation reason (required):','Wrong expense entry');if(!reason?.trim())return;if(!window.confirm(`Cancel ${x.receiptNo||'expense'} for ${money(x.amount)}?`))return;try{await addDoc(collection(db,'schoolExpenseAudit'),{schoolId,expenseId:x.id,receiptNo:x.receiptNo||'',action:'CANCEL',before:{title:x.title,amount:Number(x.amount||0)},reason:reason.trim(),changedBy:profile?.displayName||profile?.email||'School Admin',changedAt:serverTimestamp()});await updateDoc(doc(db,'schoolExpenses',x.id),{status:'cancelled',cancelledAt:serverTimestamp(),cancellationReason:reason.trim()});setMessage('Expense cancelled. It is excluded from totals.');}catch(err){setError(`Expense cancellation failed: ${err.message}`);}};
 const saveDiscount=async e=>{e.preventDefault();const st=students.find(s=>s.id===discountStudent);if(!st)return setError('Select student.');try{await addDoc(collection(db,'feeDiscounts'),{schoolId,studentId:st.id,studentName:st.name||'',amount:Number(discountAmount),reason:discountReason,academicYear:year,createdAt:serverTimestamp()});setMessage('Discount saved.');setDiscountAmount('');setDiscountReason('');}catch(e){setError(e.message);}};
 const duesStudentText=(st,detail,monthly,session)=>{
  const lines=[schoolName||'School Manager Pro','FEE DUES STATEMENT',`Student: ${st.name||'—'}`,`Class: ${st.className||'—'}`,`Father: ${st.fatherName||'—'}`,`Mobile: ${st.phone||st.whatsapp||'—'}`,`Academic Session: ${session}`,'MONTH-WISE FEE STATUS'];
  monthly.forEach(r=>lines.push(`${r.month} | ${r.feeName} | ${r.status||'—'} | ${r.status==='Remaining'?money(r.amount):r.status==='Paid'?'Paid':'—'}`));
  lines.push('ANNUAL / ONE-TIME PENDING FEES');
  detail.lines.filter(x=>x.month==='Annual / One-time').forEach(x=>lines.push(`${x.type}: ${money(x.amount)}`));
  lines.push('CATEGORY-WISE TOTAL PENDING');
  Object.entries(detail.totals||{}).forEach(([k,v])=>lines.push(`${k}: ${money(v)}`));
  lines.push(`GRAND TOTAL DUE: ${money(detail.grand)}`);
  return lines.join('\\n');
 };
 const duesStudentHtml=(st,detail,monthly,session)=>{
  const esc=escapeHtml;
  return `<h2>FEE DUES STATEMENT</h2><div class="meta"><b>Student:</b> ${esc(st.name)} &nbsp; <b>Class:</b> ${esc(st.className)}<br/><b>Father:</b> ${esc(st.fatherName||'—')} &nbsp; <b>Mobile:</b> ${esc(st.phone||st.whatsapp||'—')}<br/><b>Academic Session:</b> ${esc(session)}</div><h3>Month-wise Fee Status</h3><table><thead><tr><th>Month</th><th>Fee Name</th><th>Status</th><th>Amount</th></tr></thead><tbody>${monthly.map(r=>`<tr><td>${esc(r.month)}</td><td>${esc(r.feeName)}</td><td>${esc(r.status||'—')}</td><td>${r.status==='Remaining'?money(r.amount):r.status==='Paid'?'Paid':'—'}</td></tr>`).join('')}</tbody></table><h3>Annual / One-time Pending Fees</h3><table><thead><tr><th>Fee Name</th><th>Pending Amount</th></tr></thead><tbody>${detail.lines.filter(x=>x.month==='Annual / One-time').map(x=>`<tr><td>${esc(x.type)}</td><td>${money(x.amount)}</td></tr>`).join('')}</tbody></table><h3>Category-wise Total Pending</h3><table><thead><tr><th>Fee Category</th><th>Total Pending</th></tr></thead><tbody>${Object.entries(detail.totals||{}).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join('')}</tbody></table><div class="total"><b>Grand Total Due</b><strong>${money(detail.grand)}</strong></div>`;
 };
 const duesPrint=(st,detail,monthly,session)=>{
  const w=window.open('','_blank');if(!w){alert('Please allow pop-ups to print or save PDF.');return;}
  w.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fee Dues ${escapeHtml(st.name)}</title><style>
  *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111;background:#eef2f7}.toolbar{position:sticky;top:0;background:#172554;color:white;padding:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px}.toolbar button,.toolbar select{padding:8px;border:0;border-radius:6px}.sheet{width:210mm;margin:14px auto;background:#fff;padding:7mm;box-shadow:0 2px 14px #0002}.report{border:1.3px solid #1e3a8a;border-radius:8px;padding:5mm}.meta{font-size:10px;background:#f8fafc;padding:7px;line-height:1.7}h1{font-size:19px;color:#1e3a8a;margin:0 0 4px}h2{font-size:13px;color:#1e3a8a;margin:8px 0}h3{font-size:11px;color:#1e3a8a;margin:8px 0 4px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;margin:4px 0}th,td{border:1px solid #cbd5e1;padding:4px;overflow-wrap:anywhere;text-align:left}th{background:#eff6ff}.total{display:flex;justify-content:space-between;background:#fff1f2;padding:8px;margin-top:8px;font-size:12px}.total strong{color:#be123c;font-size:16px}@page{size:A4 portrait;margin:5mm}@media print{body{background:white}.toolbar{display:none!important}.sheet{width:auto;margin:0;padding:0;box-shadow:none}.report{break-inside:avoid;page-break-inside:avoid}}@media(max-width:800px){.sheet{width:100%;margin:0;padding:10px}}</style></head><body><div class="toolbar"><b>Page Setup</b><label>Paper <select id="paper"><option>A4</option><option>Letter</option></select></label><label>Size <select id="scale"><option>100</option><option>90</option><option>80</option><option>70</option><option>60</option><option>50</option><option>45</option><option>40</option></select></label><button id="fit">Fit on One Page</button><button id="print">Print / Save PDF</button></div><div class="sheet"><div class="report" id="report"><h1>${escapeHtml(schoolName||'School Manager Pro')}</h1>${duesStudentHtml(st,detail,monthly,session)}</div></div><script>const r=document.getElementById('report'),sc=document.getElementById('scale'),paper=document.getElementById('paper');paper.onchange=()=>{const st=document.querySelector('style');st.textContent=st.textContent.replace(/@page\\\\{size:[^;]+;/,'@page{size:'+paper.value+' portrait;')};document.getElementById('fit').onclick=()=>{let ratio=Math.min(1,(paper.value==='A4'?1000:920)/r.offsetHeight);let pct=Math.max(40,Math.floor(ratio*100));sc.value=String([100,90,80,70,60,50,45,40].reduce((a,b)=>Math.abs(b-pct)<Math.abs(a-pct)?b:a,40));r.style.zoom=Number(sc.value)/100};sc.onchange=()=>r.style.zoom=Number(sc.value)/100;document.getElementById('print').onclick=()=>window.print();window.onload=()=>document.getElementById('fit').click();</script></body></html>`);
  w.document.close();
 };
 const ledgerYears=[...new Set([year,...activePayments.map(p=>p.academicYear).filter(Boolean),...structures.map(x=>x.academicYear).filter(Boolean)])].sort((a,b)=>String(b).localeCompare(String(a)));
 const ledgerStudent=students.find(s=>s.id===ledgerStudentId);
 const ledgerCandidates=activeStudents.filter(st=>(ledgerClass==='All Classes'||String(st.className||'')===ledgerClass)&&`${st.name||''} ${st.admissionNo||''} ${st.rollNo||''} ${st.rollNumber||''} ${st.fatherName||''} ${st.phone||''} ${st.whatsapp||''} ${st.penNumber||''} ${st.aadhaarLast4||String(st.aadhaar||'').slice(-4)}`.toLowerCase().includes(ledgerSearch.toLowerCase().trim()));
 const ledgerPayments=ledgerStudent?activePayments.filter(p=>p.studentId===ledgerStudent.id&&p.academicYear===year).sort((a,b)=>String(b.paymentDate||'').localeCompare(String(a.paymentDate||''))):[];
 const ledgerAllPayments=ledgerStudent?activePayments.filter(p=>p.studentId===ledgerStudent.id).sort((a,b)=>String(b.paymentDate||'').localeCompare(String(a.paymentDate||''))):[];
 const ledgerDue=ledgerStudent?feeDueDetails(ledgerStudent,year):null;
 const ledgerMonthlyStatus=ledgerStudent&&!ledgerDue?.missingStructure?(()=>{const saved=ledgerStudent.feeConfig||{};const matchesSaved=String(saved.academicYear||ledgerStudent.academicYear||'')===String(year);const structure=structures.find(x=>x.className===ledgerStudent.className&&x.academicYear===year);const source=matchesSaved?{monthlyFee:saved.monthlySchoolFee,vanFee:saved.transportOpted?saved.monthlyVanFee:0}:structure;if(!source)return [];const dueMonths=new Set(monthsDueThrough(year,ledgerStudent));const schoolPaid=new Set(paidMonthsFor(ledgerStudent.id,'Monthly School Fee',year));const vanPaid=new Set(paidMonthsFor(ledgerStudent.id,'Monthly Van Fee',year));const vanStart=vanStartMonthFor(ledgerStudent);const out=[];monthNames.forEach(month=>{const schoolRate=Number(source.monthlyFee||0);if(schoolRate>0){const status=schoolPaid.has(month)?'Paid':dueMonths.has(month)?'Remaining':'';out.push({month,feeName:'School Fee',status,amount:status==='Remaining'?schoolRate:0});}const vanRate=Number(source.vanFee||0);if(vanRate>0&&monthIndex(month)>=monthIndex(vanStart)){const status=vanPaid.has(month)?'Paid':dueMonths.has(month)?'Remaining':'';out.push({month,feeName:'Van Fee',status,amount:status==='Remaining'?vanRate:0});}});return out;})():[];
 const ledgerText=()=>{if(!ledgerStudent)return '';const lines=[schoolName||'School Manager Pro','STUDENT LEDGER',`Student: ${ledgerStudent.name||'—'}`,`Admission No: ${ledgerStudent.admissionNo||'—'}`,`Class: ${ledgerStudent.className||'—'}`,`Father: ${ledgerStudent.fatherName||'—'}`,`Mobile: ${ledgerStudent.phone||ledgerStudent.whatsapp||'—'}`,`Academic Session: ${year}`,`Total Paid This Session: ${money(ledgerPayments.reduce((a,p)=>a+Number(p.amount||0),0))}`,`Remaining This Session: ${money(ledgerDue?.grand||0)}`,'MONTH-WISE STATUS'];ledgerMonthlyStatus.forEach(x=>lines.push(`${x.month} | ${x.feeName} | ${x.status||'—'} | ${x.status==='Remaining'?money(x.amount):x.status==='Paid'?'Paid':'—'}`));lines.push('PAYMENT HISTORY');ledgerPayments.forEach(x=>lines.push(`${x.paymentDate||'—'} | ${x.feeType||'—'} | ${money(x.amount)} | ${x.paymentMode||'—'} | ${x.receiptNo||'—'}`));return lines.join('\n');};
 const ledgerShare=async()=>{const text=ledgerText();if(!text)return;if(navigator.share){try{await navigator.share({title:`Student Ledger - ${ledgerStudent.name}`,text});}catch(_){}}else{try{await navigator.clipboard.writeText(text);setMessage('Student Ledger copied. You can share it now.');}catch(_){setMessage('Sharing is not available in this browser.');}}};
 const ledgerCopy=async()=>{try{await navigator.clipboard.writeText(ledgerText());setMessage('Student Ledger copied successfully.');}catch(_){setMessage('Copy is not available in this browser.');}};
 const ledgerPrint=()=>{if(!ledgerStudent)return;const esc=escapeHtml;const history=ledgerPayments.map(p=>`<tr><td>${esc(p.paymentDate)}</td><td>${esc(p.feeType)}</td><td>${money(p.amount)}</td><td>${esc(p.paymentMode)}</td><td>${esc(p.receiptNo)}</td></tr>`).join('');const monthly=ledgerMonthlyStatus.map(x=>`<tr><td>${esc(x.month)}</td><td>${esc(x.feeName)}</td><td>${esc(x.status||'—')}</td><td>${x.status==='Remaining'?money(x.amount):x.status==='Paid'?'Paid':'—'}</td></tr>`).join('');const body=`<div class="meta"><b>Student:</b> ${esc(ledgerStudent.name)} &nbsp; <b>Class:</b> ${esc(ledgerStudent.className)}<br><b>Admission No:</b> ${esc(ledgerStudent.admissionNo||'—')} &nbsp; <b>Father:</b> ${esc(ledgerStudent.fatherName||'—')}<br><b>Mobile:</b> ${esc(ledgerStudent.phone||ledgerStudent.whatsapp||'—')} &nbsp; <b>Session:</b> ${esc(year)}</div><div class="total"><span>Total Paid</span><b>${money(ledgerPayments.reduce((a,p)=>a+Number(p.amount||0),0))}</b><span>Remaining</span><b>${money(ledgerDue?.grand||0)}</b></div><h3>Month-wise Fee Status</h3><table><tr><th>Month</th><th>Fee</th><th>Status</th><th>Amount</th></tr>${monthly}</table><h3>Payment History</h3><table><tr><th>Date</th><th>Fee Type</th><th>Amount</th><th>Mode</th><th>Receipt</th></tr>${history}</table>`;const w=window.open('','_blank');if(!w){alert('Please allow pop-ups to print or save PDF.');return;}w.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Student Ledger</title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;color:#111;background:#eef2f7}.toolbar{position:sticky;top:0;background:#172554;color:white;padding:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px}.toolbar button,.toolbar select{padding:8px;border:0;border-radius:6px}.sheet{width:210mm;margin:14px auto;background:white;padding:7mm}.report{border:1px solid #1e3a8a;border-radius:8px;padding:5mm}.meta{font-size:10px;background:#f8fafc;padding:7px;line-height:1.7}h1{font-size:19px;color:#1e3a8a;margin:0 0 5px}h3{font-size:11px;color:#1e3a8a;margin:9px 0 4px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;margin:4px 0}th,td{border:1px solid #cbd5e1;padding:4px;overflow-wrap:anywhere;text-align:left}th{background:#eff6ff}.total{display:flex;justify-content:space-between;gap:8px;background:#eff6ff;padding:8px;margin-top:8px;font-size:11px}@page{size:A4 portrait;margin:5mm}@media print{body{background:white}.toolbar{display:none!important}.sheet{width:auto;margin:0;padding:0}.report{break-inside:avoid;page-break-inside:avoid}}@media(max-width:800px){.sheet{width:100%;margin:0;padding:10px}}</style></head><body><div class="toolbar"><b>Page Setup</b><label>Paper <select id="paper"><option>A4</option><option>Letter</option></select></label><label>Size <select id="scale"><option>100</option><option>90</option><option>80</option><option>70</option><option>60</option><option>50</option><option>45</option><option>40</option></select></label><button id="fit">Fit on One Page</button><button id="print">Print / Save PDF</button></div><div class="sheet"><div class="report" id="report"><h1>${esc(schoolName||'School Manager Pro')}</h1>${body}</div></div><script>const r=document.getElementById('report'),sc=document.getElementById('scale'),paper=document.getElementById('paper');paper.onchange=()=>{document.querySelector('style').textContent=document.querySelector('style').textContent.replace(/@page\\{size:[^;]+;/,'@page{size:'+paper.value+' portrait;')};document.getElementById('fit').onclick=()=>{let ratio=Math.min(1,(paper.value==='A4'?1000:920)/r.offsetHeight);let pct=Math.max(40,Math.floor(ratio*100));sc.value=String([100,90,80,70,60,50,45,40].reduce((a,b)=>Math.abs(b-pct)<Math.abs(a-pct)?b:a,40));r.style.zoom=Number(sc.value)/100};sc.onchange=()=>r.style.zoom=Number(sc.value)/100;document.getElementById('print').onclick=()=>window.print();window.onload=()=>document.getElementById('fit').click();</script></body></html>`);w.document.close();};
 const duesShare=async(st,detail,monthly,session)=>{const text=duesStudentText(st,detail,monthly,session);if(navigator.share){try{await navigator.share({title:`Fee Dues - ${st.name}`,text});}catch(_){}}else{try{await navigator.clipboard.writeText(text);setMessage('Fee Dues copied. You can paste and share with parents.');}catch(_){setMessage('Sharing is not available in this browser.');}}};
 const duesCopy=async(st,detail,monthly,session)=>{try{await navigator.clipboard.writeText(duesStudentText(st,detail,monthly,session));setMessage('Fee Dues copied successfully.');}catch(_){setMessage('Copy is not available on this browser.');}};
 const panelBody=()=>{
  if(active==='Fee Collection'){
   const feeSummary=selectedStudent?getStudentFeeSummary(selectedStudent):null;
   return <>
    <form onSubmit={savePayment} style={formGrid}>
     <label style={labelStyle}>Class<select style={inputStyle} required value={collectionClass} onChange={e=>changeCollectionClass(e.target.value)}><option value="">Select Class</option>{collectionClasses.map(c=><option value={c} key={c}>{c}</option>)}</select></label>
     <label style={labelStyle}>Search Student<input style={inputStyle} value={studentSearch} disabled={!collectionClass} onChange={e=>{setStudentSearch(e.target.value);setStudentId('');setMonths([]);}} placeholder="Name / Roll No. / Admission / Father / Mobile / PEN"/></label>
     <label style={labelStyle}>Select Student<select style={inputStyle} required disabled={!collectionClass} value={studentId} onChange={e=>changeStudent(e.target.value)}><option value="">{collectionClass?'Select Student':'First Select Class'}</option>{searchableCollectionStudents.map(s=><option value={s.id} key={s.id}>{s.name} · Adm: {s.admissionNo||'—'} · Roll: {s.rollNo||s.rollNumber||'—'} · Father: {s.fatherName||'—'} · Mobile: {s.whatsapp||s.phone||'—'}</option>)}</select></label>
     <label style={labelStyle}>Fee Type<select style={inputStyle} value={feeType} onChange={e=>changeFeeType(e.target.value)}>{['Admission Fee','Renewal Fee','Monthly School Fee',...(studentHasVan(selectedStudent)?['Monthly Van Fee']:[]),'Exam Fee','Other Fee'].map(x=><option key={x}>{x}</option>)}</select></label>
     <label style={labelStyle}>Amount (₹)<input style={inputStyle} type="number" min="1" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
     <label style={labelStyle}>Payment Date<input style={inputStyle} type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label>
     <label style={labelStyle}>Academic Session<input style={inputStyle} value={year} onChange={e=>changeYear(e.target.value)}/></label>
     <label style={labelStyle}>Payment Mode<select style={inputStyle} value={method} onChange={e=>setMethod(e.target.value)}>{['Cash','UPI','Bank','Online'].map(x=><option key={x}>{x}</option>)}</select></label>
     {monthlyFeeType&&<div style={{gridColumn:'1/-1'}}><div style={labelStyle}>{feeType==='Monthly School Fee'?'School Fee Months':`Van Fee Months (starts ${vanStartMonth})`} (Paid months cannot be selected)</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(105px,1fr))',gap:8}}>{eligibleMonths.map(m=>{const locked=paidMonths.includes(m);const checked=months.includes(m);return <label key={m} style={{display:'flex',alignItems:'center',gap:6,padding:9,border:'1px solid #cbd5e1',borderRadius:8,background:locked?'#ecfdf5':checked?'#eff6ff':'#fff',opacity:locked ? 0.7 : 1}}><input type="checkbox" disabled={locked} checked={locked||checked} onChange={()=>toggleMonth(m)}/><span>{m}{locked?' ✓ Paid':''}</span></label>})}</div></div>}
     {feeType==='Monthly School Fee'&&studentHasVan(selectedStudent)&&<div style={{gridColumn:'1/-1',border:'1px solid #cbd5e1',borderRadius:9,padding:10}}><label style={{display:'flex',gap:8,alignItems:'center',fontWeight:700}}><input type="checkbox" checked={includeVanTogether} onChange={e=>{setIncludeVanTogether(e.target.checked);setVanMonths([]);}}/> Collect Van Fee together in the same receipt</label>{includeVanTogether&&<div style={{marginTop:10}}><div style={labelStyle}>Van Fee Months (starts {vanStartMonth}; already-paid months cannot be selected)</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(105px,1fr))',gap:7}}>{eligibleVanMonths.map(m=>{const locked=vanPaidMonths.includes(m);const checked=vanMonths.includes(m);return <label key={m} style={{display:'flex',alignItems:'center',gap:6,padding:8,border:'1px solid #cbd5e1',borderRadius:8,background:locked?'#ecfdf5':checked?'#eff6ff':'#fff',opacity:locked ? 0.7 : 1}}><input type="checkbox" disabled={locked} checked={locked||checked} onChange={()=>setVanMonths(old=>old.includes(m)?old.filter(x=>x!==m):[...old,m])}/><span>{m}{locked?' ✓ Paid':''}</span></label>})}</div><div style={{fontSize:12,color:'#64748b',marginTop:7}}>Van Fee: {money(feeAmountFor(selectedStudent,'Monthly Van Fee'))} per month · Selected: {vanMonths.length} month(s) · {money(vanMonths.length*feeAmountFor(selectedStudent,'Monthly Van Fee'))}</div></div>}</div>}
     <label style={labelStyle}>Notes<input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <button type="submit" style={{...primary,opacity:paymentSaving?0.65:1}} disabled={paymentSaving}>{paymentSaving?'Saving Payment...':'Save Payment & Create Receipt'}</button>
    </form>
    {viewReceipt&&receiptCard(viewReceipt)}
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

  if(active==='Fee Structure')return <><h3>Current Session Fee Structure</h3><form onSubmit={saveStructure} style={formGrid}><label style={labelStyle}>Class<select style={inputStyle} required value={className} onChange={e=>setClassName(e.target.value)}><option value="">Select Class</option>{['Nursery','LKG','UKG',...Array.from({length:10},(_,i)=>String(i+1))].map(x=><option key={x}>{x}</option>)}</select></label>{[['Monthly School Fee',monthlyFee,setMonthlyFee],['Admission Fee',admissionFee,setAdmissionFee],['Monthly Van Fee',vanFee,setVanFee],['Renewal Fee',renewalFee,setRenewalFee],['Exam Fee (annual)',examFee,setExamFee],['Other Annual Fee',otherFee,setOtherFee]].map(([l,v,f])=><label key={l} style={labelStyle}>{l}<input style={inputStyle} type="number" min="0" value={v} onChange={e=>f(e.target.value)}/></label>)}<button style={primary}>Save Fee Structure</button></form>{renderTable(['Class','School / Month','Admission','Van / Month','Renewal','Exam','Other','Session'],structures.map(x=>[x.className,money(x.monthlyFee),money(x.admissionFee),money(x.vanFee),money(x.renewalFee),money(x.examFee),money(x.otherFee),x.academicYear]))}
 <div style={{border:'1px solid #cbd5e1',borderRadius:12,padding:14,marginTop:18}}><h3 style={{marginTop:0}}>Annual Class-wise & Route-wise Fee Update</h3><p style={{fontSize:13,color:'#64748b'}}>Updates apply only to the selected session. Confirm before updating all matching students.</p><label style={labelStyle}>Academic Session<select style={inputStyle} value={year} onChange={e=>setYear(e.target.value)}>{[...new Set([year,...structures.map(x=>x.academicYear).filter(Boolean)])].sort().reverse().map(y=><option key={y}>{y}</option>)}</select></label><form onSubmit={bulkUpdateClassFee} style={formGrid}><label style={labelStyle}>Select Class<select style={inputStyle} value={feeUpdateClass} onChange={e=>setFeeUpdateClass(e.target.value)}><option value="">Select Class</option>{['Nursery','LKG','UKG',...Array.from({length:10},(_,i)=>String(i+1))].map(x=><option key={x}>{x}</option>)}</select></label><label style={labelStyle}>New Monthly School Fee<input style={inputStyle} type="number" min="0" value={bulkSchoolFee} onChange={e=>setBulkSchoolFee(e.target.value)} placeholder="Enter amount"/></label><button style={primary} disabled={sessionBusy}>Update All Students of Class</button></form><form onSubmit={bulkUpdateRouteFee} style={formGrid}><label style={labelStyle}>Select Van Route<select style={inputStyle} value={feeUpdateRoute} onChange={e=>setFeeUpdateRoute(e.target.value)}><option value="">Select Route</option>{routeNames.map(x=><option key={x}>{x}</option>)}</select></label><label style={labelStyle}>New Monthly Van Fee<input style={inputStyle} type="number" min="0" value={bulkVanFee} onChange={e=>setBulkVanFee(e.target.value)} placeholder="Enter amount"/></label><button style={primary} disabled={sessionBusy}>Update All Students of Route</button></form></div>
 <div style={{border:'1px solid #cbd5e1',borderRadius:12,padding:14,marginTop:18}}><h3 style={{marginTop:0}}>Academic Session & Student Promotion</h3><p style={{fontSize:13,color:'#64748b'}}>Create next session once. Students move to the next class; Class 10 moves to Passed Out. Old session data is saved in studentSessionHistory.</p><label style={labelStyle}>New Academic Session<input style={inputStyle} value={newSession} onChange={e=>setNewSession(e.target.value)} placeholder={suggestedNextSession}/></label><button style={primary} disabled={sessionBusy} onClick={()=>setPromotionPreview(true)}>Preview Student Promotion</button>{promotionPreview&&<div style={{marginTop:12}}><b>Promotion Preview · {newSession}</b>{renderTable(['Current Class','Next Class','Students'],classOrder.map(c=>[c,nextClassOf(c),activeForPromotion.filter(st=>String(st.className).trim()===c).length]).filter(r=>r[2]>0))}<p style={{fontSize:13,color:'#b45309'}}>Class 10 students will be marked Passed Out. Review counts before confirming.</p><button style={{...primary,background:'#15803d'}} disabled={sessionBusy} onClick={createNextSession}>Confirm & Create New Session</button><button style={secondary} onClick={()=>setPromotionPreview(false)}>Cancel</button></div>}</div>
 <div style={{border:'1px solid #cbd5e1',borderRadius:12,padding:14,marginTop:18}}><h3 style={{marginTop:0}}>Passed Out Students</h3><p style={{fontSize:13,color:'#64748b'}}>Class 10 students moved out during session promotion are stored separately here. Their historical student and fee records remain preserved.</p>{renderTable(['Student','Admission No.','Last Class','Passed Out Session'],students.filter(st=>st.passedOut||st.status==='Passed Out').map(st=>[st.name,st.admissionNo,st.sessionPromotion?.fromClass||'10',st.sessionPromotion?.to||'Passed Out']))}</div></>;
  if(active==='Fee Dues'){
   const normalize=value=>String(value??'').toLowerCase().replace(/\s+/g,' ').trim();
   const digits=value=>String(value??'').replace(/\D/g,'');
   const queryText=normalize(search);
   const queryDigits=digits(search);
   const yearStudents=students.filter(st=>!st.passedOut&&st.status!=='Passed Out'&&(duesClass==='All Classes'||String(st.className||'').trim()===String(duesClass).trim()));
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
    const vanStart=vanStartMonthFor(chosen);
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
     if(monthIndex(month)>=monthIndex(vanStart))add('Van Fee',feeSource.vanFee,vanPaid);
    });
    return rows;
   })():[];
   const summaryClasses=duesClass==='All Classes'?collectionClasses:[duesClass];
   const classSummary=summaryClasses.map(c=>{
    const list=activeStudents.filter(st=>String(st.className||'').trim()===String(c).trim()).map(st=>({st,d:forSelectedMonth(feeDueDetails(st,year))}));
    const due=list.filter(x=>x.d.grand>0);
    return {className:c,totalStudents:list.length,count:due.length,total:due.reduce((a,x)=>a+x.d.grand,0)};
   }).filter(x=>x.totalStudents>0);
   // Monthly aggregates are calculated from each student's actual outstanding lines.
   // Paid months are absent from feeDueDetails; future months are not generated.
   const monthlySummaryStudents=activeStudents.filter(st=>duesClass==='All Classes'||String(st.className||'').trim()===String(duesClass).trim());
   const monthlySummary=monthNames.map(month=>{
    const byType={'Monthly School Fee':0,'Van Fee':0};
    let total=0,studentCount=0;
    monthlySummaryStudents.forEach(st=>{
     const d=feeDueDetails(st,year);
     const lines=d.lines.filter(line=>line.month===month);
     const due=lines.reduce((a,line)=>a+Number(line.amount||0),0);
     if(due>0){total+=due;studentCount++;}
     lines.forEach(line=>{byType[line.type]=(byType[line.type]||0)+Number(line.amount||0);});
    });
    return {month,total,studentCount,school:byType['Monthly School Fee']||0,van:byType['Van Fee']||0};
   }).filter(x=>x.total>0);
   const wholeSchoolMonthTotal=monthlySummary.reduce((a,x)=>a+x.total,0);
   return <div style={{display:'grid',gap:14}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
     <label style={labelStyle}>Academic Year<select style={inputStyle} value={year} onChange={e=>{setYear(e.target.value);setDuesStudentId('');}}>{['2026-27','2025-26','2024-25','2023-24'].map(x=><option key={x}>{x}</option>)}</select></label>
     <label style={labelStyle}>Class<select style={inputStyle} value={duesClass} onChange={e=>{setDuesClass(e.target.value);setDuesStudentId('');}}><option>All Classes</option>{collectionClasses.map(c=><option key={c}>{c}</option>)}</select></label>
     <label style={labelStyle}>Summary View<select style={inputStyle} value={duesSummaryMode} onChange={e=>setDuesSummaryMode(e.target.value)}><option>Class-wise</option><option>Monthly (All Students)</option></select></label>
     <label style={labelStyle}>Month Filter<select style={inputStyle} value={duesMonth} onChange={e=>setDuesMonth(e.target.value)}><option>All Months</option>{monthNames.map(m=><option key={m}>{m}</option>)}</select></label>
    </div>
    <input style={inputStyle} placeholder="Search Name / Mobile / Aadhaar Last 4 Digits / Admission No. / Roll No. / PEN / Father Name" value={search} onChange={e=>setSearch(e.target.value)}/>
    {duesSummaryMode==='Monthly (All Students)'?
     <div className="finance-card"><h3 style={{marginTop:0}}>Whole School Monthly Pending Summary · {year}</h3><p className="muted">पूरे स्कूल (या चुनी हुई Class) के हर महीने के वास्तविक बकाया School Fee और Van Fee का जोड़। Paid और भविष्य के महीने शामिल नहीं हैं।</p>{renderTable(['Month','School Fee Pending','Van Fee Pending','Students with Due','Total Pending'],monthlySummary.filter(x=>duesMonth==='All Months'||x.month===duesMonth).map(x=>[x.month,money(x.school),money(x.van),x.studentCount,money(x.total)]))}<div style={{display:'flex',justifyContent:'flex-end',padding:12,background:'#eff6ff',borderRadius:8,fontWeight:800}}>Selected Period Total: {money(monthlySummary.filter(x=>duesMonth==='All Months'||x.month===duesMonth).reduce((a,x)=>a+x.total,0))}</div></div>
     :
     <div className="finance-card"><h3 style={{marginTop:0}}>{duesClass==='All Classes'?'Class-wise Fee Summary':'Month-wise Pending Summary · '+duesClass} · {year}</h3>{duesClass==='All Classes'?renderTable(['Class','Total Students','Students with Due','Total Pending'],classSummary.map(x=>[<button style={secondary} onClick={()=>{setDuesClass(x.className);setDuesStudentId('');setDuesMonth('All Months');}}>{x.className}</button>,x.totalStudents,x.count,money(x.total)])):renderTable(['Month','School Fee Pending','Van Fee Pending','Total Pending'],monthlySummary.filter(x=>duesMonth==='All Months'||x.month===duesMonth).map(x=>[x.month,money(x.school),money(x.van),money(x.total)]))}</div>}
    <div className="finance-card"><h3 style={{marginTop:0}}>Student-wise Fee Status · {duesMonth}</h3><p className="muted">नाम या अन्य विवरण से विद्यार्थी खोजें। View Details में केवल उस विद्यार्थी की पूरी साल की Pending Fees और month-wise status दिखेगा।</p>{renderTable(['Student','Class','Father','Mobile','Fee Status','Pending','Details'],monthFiltered.map(x=>[x.student.name||'—',x.student.className||'—',x.student.fatherName||'—',x.student.phone||x.student.whatsapp||'—',x.detail.missingStructure?<span style={{color:'#b45309',fontWeight:700}}>Fee Setup Missing</span>:x.detail.grand>0?<span style={{color:'#b91c1c',fontWeight:700}}>Pending</span>:<span style={{color:'#15803d',fontWeight:700}}>Fully Paid</span>,money(x.detail.grand),<button style={primary} onClick={()=>setDuesStudentId(x.student.id)}>View Details</button>]))}</div>
    {chosen&&chosenDetail&&<div className="finance-card"><div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><div><h3 style={{margin:'0 0 5px'}}>{chosen.name}</h3><div className="muted">{chosen.className} · Father: {chosen.fatherName||'—'} · Mobile: {chosen.phone||chosen.whatsapp||'—'}</div></div><button style={secondary} onClick={()=>setDuesStudentId('')}>Close</button></div><label style={{...labelStyle,marginTop:14}}>Academic Year<select style={inputStyle} value={year} onChange={e=>setYear(e.target.value)}>{['2026-27','2025-26','2024-25','2023-24'].map(x=><option key={x}>{x}</option>)}</select></label>{chosenDetail.missingStructure?<p style={{color:'#b45309',fontWeight:700}}>Fee Setup Missing for {year}. Please check this student's Admission Form Fee Setup or add a Fee Structure for this class and academic year.</p>:<><h4>Month-wise Fee Status · {year}</h4><p className="muted">हर महीने के नीचे जमा फीस हरे रंग में, बाकी फीस लाल रंग में और आने वाले महीनों में खाली दिखेगी।</p>{renderTable(['Month','Fee Name','Status','Amount'],chosenMonthlyStatus.map(row=>[row.month,row.feeName,row.status==='Paid'?<span style={{color:'#15803d',fontWeight:700}}>Paid ✓</span>:row.status==='Remaining'?<span style={{color:'#b91c1c',fontWeight:700}}>Remaining</span>:<span style={{color:'#94a3b8'}}>—</span>,row.status==='Remaining'?money(row.amount):row.status==='Paid'?'Paid':'—']))}<h4>Annual / One-time Pending Fees</h4>{renderTable(['Fee Name','Pending Amount'],chosenDetail.lines.filter(l=>l.month==='Annual / One-time').map(l=>[l.type,money(l.amount)]))}{chosenDetail.grand===0&&<p style={{color:'#15803d',fontWeight:700}}>No pending fee. This student is Fully Paid for the selected session.</p>}<h4>Category-wise Total Pending</h4>{renderTable(['Fee Category','Total Pending'],Object.entries(chosenDetail.totals).map(([k,v])=>[k,money(v)]))}<div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:12,padding:12,background:'#fff1f2',borderRadius:8}}><b>Grand Total Due</b><strong style={{fontSize:22,color:chosenDetail.grand>0?'#be123c':'#15803d'}}>{money(chosenDetail.grand)}</strong></div><div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:12}}><button style={secondary} onClick={()=>duesShare(chosen,chosenDetail,chosenMonthlyStatus,year)}>Share with Parents</button><button style={secondary} onClick={()=>duesCopy(chosen,chosenDetail,chosenMonthlyStatus,year)}>Copy</button><button style={secondary} onClick={()=>duesPrint(chosen,chosenDetail,chosenMonthlyStatus,year)}>PDF / Print</button></div></>}</div>}
    <p className="muted">Automatic dues use the selected session's saved student Fee Setup first, then the class Fee Structure as fallback. Monthly School/Van fees are calculated from April through the current month. One-time fees are included only when configured. Aadhaar search uses the stored Aadhaar field or last four digits; keep full Aadhaar masked and protected.</p>
   </div>;
  }
  if(active==='Student Ledger')return <div style={{display:'grid',gap:12}}>
   <div style={formGrid}>
    <label style={labelStyle}>Academic Year<select style={inputStyle} value={year} onChange={e=>{setYear(e.target.value);setLedgerStudentId('');}}>{ledgerYears.map(y=><option key={y}>{y}</option>)}</select></label>
    <label style={labelStyle}>Class<select style={inputStyle} value={ledgerClass} onChange={e=>{setLedgerClass(e.target.value);setLedgerStudentId('');}}><option>All Classes</option>{collectionClasses.map(c=><option key={c}>{c}</option>)}</select></label>
    <label style={labelStyle}>Search Student<input style={inputStyle} value={ledgerSearch} onChange={e=>{const value=e.target.value;setLedgerSearch(value);const q=value.toLowerCase().trim();const matches=q?activeStudents.filter(st=>(ledgerClass==='All Classes'||String(st.className||'')===ledgerClass)&&`${st.name||''} ${st.admissionNo||''} ${st.rollNo||''} ${st.rollNumber||''} ${st.fatherName||''} ${st.phone||''} ${st.whatsapp||''} ${st.penNumber||''} ${st.aadhaarLast4||String(st.aadhaar||'').slice(-4)}`.toLowerCase().includes(q)):[];setLedgerStudentId(matches.length===1?matches[0].id:'');}} placeholder="Name / Admission No. / Roll No. / Father / Mobile / PEN / Aadhaar last 4"/><small className="muted">{ledgerSearch.trim()?`${ledgerCandidates.length} matching student(s). ${ledgerCandidates.length===1?'Student automatically selected.':'Select the correct student from the list.'}`:'Type student details to search.'}</small></label>
    <label style={labelStyle}>Select Student<select style={inputStyle} value={ledgerStudentId} onChange={e=>setLedgerStudentId(e.target.value)}><option value="">Select Student</option>{ledgerCandidates.map(st=><option key={st.id} value={st.id}>{st.name} · {st.className} · Adm: {st.admissionNo||'—'} · Father: {st.fatherName||'—'}</option>)}</select></label>
   </div>
   {ledgerStudent&&<div className="finance-card" style={{display:'grid',gap:10}}>
    <div><h3 style={{margin:'0 0 5px'}}>{ledgerStudent.name}</h3><div className="muted">Class: {ledgerStudent.className||'—'} · Admission No: {ledgerStudent.admissionNo||'—'} · Roll No: {ledgerStudent.rollNo||ledgerStudent.rollNumber||'—'}<br/>Father: {ledgerStudent.fatherName||'—'} · Mobile: {ledgerStudent.phone||ledgerStudent.whatsapp||'—'}</div></div>
    <div style={statsGrid}><div className="stat"><small>Total Paid · {year}</small><strong>{money(ledgerPayments.reduce((a,p)=>a+Number(p.amount||0),0))}</strong></div><div className="stat"><small>Remaining · {year}</small><strong>{money(ledgerDue?.grand||0)}</strong></div><div className="stat"><small>Payment Entries · {year}</small><strong>{ledgerPayments.length}</strong></div></div>
    {ledgerDue?.missingStructure?<p style={{color:'#b45309',fontWeight:700}}>Fee Setup Missing for {year}. Payment history is still available below.</p>:<><h4 style={{margin:'5px 0'}}>Month-wise Fee Status · {year}</h4>{renderTable(['Month','Fee Name','Status','Amount'],ledgerMonthlyStatus.map(x=>[x.month,x.feeName,x.status==='Paid'?<span style={{color:'#15803d',fontWeight:700}}>Paid ✓</span>:x.status==='Remaining'?<span style={{color:'#b91c1c',fontWeight:700}}>Remaining</span>:<span style={{color:'#94a3b8'}}>—</span>,x.status==='Remaining'?money(x.amount):x.status==='Paid'?'Paid':'—']))}<h4 style={{margin:'5px 0'}}>Annual / One-time Pending Fees</h4>{renderTable(['Fee Name','Pending Amount'],ledgerDue.lines.filter(x=>x.month==='Annual / One-time').map(x=>[x.type,money(x.amount)]))}<b>Grand Total Remaining: {money(ledgerDue.grand)}</b></>}
    <h4 style={{margin:'5px 0'}}>Payment History · {year}</h4><p className="muted">Edit, Cancel and Refund require a reason and confirmation. Cancelled entries are excluded from paid totals. Refunds are stored as separate negative payment entries. Original values are retained in feePaymentAudit.</p>{renderTable(['Date','Fee Type','Months','Amount','Mode','Receipt','Correction'],ledgerPayments.map(p=>[p.paymentDate,p.feeType,p.months||'—',money(p.amount),p.paymentMode,p.receiptNo,<div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{p.status==='cancelled'?<span style={{color:'#b91c1c',fontWeight:700}}>CANCELLED</span>:<><button style={secondary} onClick={()=>correctPayment(p)}>Edit</button><button style={secondary} onClick={()=>cancelPayment(p)}>Cancel</button><button style={secondary} onClick={()=>addRefund(p)}>Refund</button></>}</div>]))}
    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button style={secondary} onClick={ledgerShare}>Share</button><button style={secondary} onClick={ledgerCopy}>Copy</button><button style={secondary} onClick={ledgerPrint}>PDF Download / Page Setup</button><button style={secondary} onClick={ledgerPrint}>Print</button></div>
    <details><summary style={{cursor:'pointer',fontWeight:700}}>All Previous Sessions Payment History ({ledgerAllPayments.length})</summary>{renderTable(['Session','Date','Fee Type','Months','Amount','Mode','Receipt','Status'],ledgerAllPayments.map(p=>[p.academicYear||'—',p.paymentDate,p.feeType,p.months||'—',money(p.amount),p.paymentMode,p.receiptNo]))}</details>
   </div>}
  </div>;
  if(active==='Fee Receipts'){
   const receiptYears=[...new Set([year,...activePayments.map(p=>p.academicYear).filter(Boolean)])].sort((a,b)=>String(b).localeCompare(String(a)));
   const receiptClasses=['All Classes',...new Set([...students.map(s=>String(s.className||'').trim()),...activePayments.map(p=>String(p.className||'').trim())].filter(Boolean))].sort((a,b)=>a==='All Classes'?-1:a.localeCompare(b,undefined,{numeric:true}));
   const receiptRows=groupedReceiptPayments(activePayments).filter(p=>{
    const st=students.find(s=>s.id===p.studentId)||{};const cls=String(p.className||st.className||'').trim();
    const date=String(p.paymentDate||'').slice(0,10);
    const periodOK=receiptPeriod==='Daily'?date===receiptDay:receiptPeriod==='Monthly'?date.startsWith(receiptMonth):String(p.academicYear||'')===String(receiptYear)||(!p.academicYear&&date>=`${String(receiptYear).slice(0,4)}-04-01`&&date<=`${Number(String(receiptYear).slice(0,4))+1}-03-31`);
    const classOK=receiptClass==='All Classes'||cls===receiptClass;
    const hay=[p.receiptNo,p.studentName,p.admissionNo,p.rollNo,p.rollNumber,p.fatherName,p.phone,p.mobile,p.whatsapp,p.penNumber,p.aadhaarLast4,p.aadhaar,st.name,st.admissionNo,st.rollNo,st.rollNumber,st.fatherName,st.phone,st.mobile,st.whatsapp,st.penNumber,st.aadhaarLast4,st.aadhaar,cls,receiptItems(p).map(x=>x.feeType).join(' ')].join(' ').toLowerCase();
    return periodOK&&classOK&&hay.includes(search.toLowerCase().trim());
   });
   const receiptCollectionTotal=receiptRows.reduce((sum,p)=>sum+receiptTotal(p),0);
   const receiptExport=table(['Receipt','Date','Student','Class','Fee Type','Amount'],receiptRows.map(p=>[p.receiptNo,p.paymentDate,p.studentName,p.className||students.find(s=>s.id===p.studentId)?.className||'—',receiptItems(p).map(x=>x.feeType).join(' + '),money(receiptTotal(p))]));
   return <div style={{display:'grid',gap:12}}>
    <div className="finance-card" style={{display:'grid',gap:10}}><h3 style={{margin:0}}>Fee Receipts</h3>
     <div style={formGrid}><label style={labelStyle}>View By<select style={inputStyle} value={receiptPeriod} onChange={e=>setReceiptPeriod(e.target.value)}>{['Daily','Monthly','Yearly'].map(x=><option key={x}>{x}</option>)}</select></label>
      {receiptPeriod==='Daily'&&<label style={labelStyle}>Date<input style={inputStyle} type="date" value={receiptDay} onChange={e=>setReceiptDay(e.target.value)}/></label>}
      {receiptPeriod==='Monthly'&&<label style={labelStyle}>Month<input style={inputStyle} type="month" value={receiptMonth} onChange={e=>setReceiptMonth(e.target.value)}/></label>}
      {receiptPeriod==='Yearly'&&<label style={labelStyle}>Academic Year<select style={inputStyle} value={receiptYear} onChange={e=>setReceiptYear(e.target.value)}>{receiptYears.map(y=><option key={y} value={y}>{y}</option>)}</select></label>}
      <label style={labelStyle}>Class<select style={inputStyle} value={receiptClass} onChange={e=>setReceiptClass(e.target.value)}>{receiptClasses.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
     </div>
     <label style={labelStyle}>Search Receipt / Student<input style={inputStyle} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Receipt No. / Name / Admission No. / Roll No. / Father / Mobile / Aadhaar last 4 / PEN"/></label>
     <div style={statsGrid}><div className="stat"><small>Total Collection</small><strong>{money(receiptCollectionTotal)}</strong></div><div className="stat"><small>Total Receipts</small><strong>{receiptRows.length}</strong></div></div>
    </div>
    {renderTable(['Receipt','Date','Student','Class','Fee Type','Amount','View'],receiptRows.map(p=>[p.receiptNo,p.paymentDate,p.studentName,p.className||students.find(s=>s.id===p.studentId)?.className||'—',receiptItems(p).map(x=>x.feeType).join(' + '),money(receiptTotal(p)),<button style={secondary} onClick={()=>{setViewReceipt(p);setIncludeRemainingFees(false);}}>View Receipt</button>]))}
    {viewReceipt&&receiptCard(viewReceipt)}
    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button type="button" style={secondary} onClick={()=>shareReport('Fee Receipts',receiptExport)}>Share / Send All</button><button type="button" style={secondary} onClick={()=>navigator.clipboard?.writeText(receiptExport).then(()=>setMessage('Fee receipts copied.'))}>Copy All</button><button type="button" style={secondary} onClick={()=>printDoc('Fee Receipts',receiptExport)}>PDF / Print All</button></div>
   </div>;
  }
  if(active==='Discount & Scholarship')return <><form onSubmit={saveDiscount} style={formGrid}><label style={labelStyle}>Student<select style={inputStyle} value={discountStudent} onChange={e=>setDiscountStudent(e.target.value)}><option value="">Select Student</option>{students.map(s=><option value={s.id}>{s.name}</option>)}</select></label><label style={labelStyle}>Discount Amount<input style={inputStyle} type="number" min="1" required value={discountAmount} onChange={e=>setDiscountAmount(e.target.value)}/></label><label style={labelStyle}>Reason<input style={inputStyle} value={discountReason} onChange={e=>setDiscountReason(e.target.value)}/></label><button style={primary}>Save Discount</button></form>{renderTable(['Student','Amount','Reason','Session'],discounts.map(x=>[x.studentName,money(x.amount),x.reason,x.academicYear]))}</>;
  if(active==='Expenses')return <div style={{display:'grid',gap:12}}>
   <div className="finance-card" style={{display:'grid',gap:10}}><h3 style={{margin:0}}>Expense History & Receipts</h3><input style={inputStyle} value={expenseSearch} onChange={e=>setExpenseSearch(e.target.value)} placeholder="Search expense / category / receipt no. / batch receipt / amount"/><div style={formGrid}><label style={labelStyle}>Period<select style={inputStyle} value={expensePeriod} onChange={e=>setExpensePeriod(e.target.value)}>{['All Time','Daily','Monthly','Yearly'].map(x=><option key={x}>{x}</option>)}</select></label>{expensePeriod==='Daily'&&<label style={labelStyle}>Date<input style={inputStyle} type="date" value={expenseDay} onChange={e=>setExpenseDay(e.target.value)}/></label>}{expensePeriod==='Monthly'&&<label style={labelStyle}>Month<input style={inputStyle} type="month" value={expenseMonth==='All Months'?'':expenseMonth} onChange={e=>setExpenseMonth(e.target.value)}/></label>}{expensePeriod==='Yearly'&&<label style={labelStyle}>Academic Year<select style={inputStyle} value={expenseYear} onChange={e=>setExpenseYear(e.target.value)}>{[...new Set(['All Years',year,...expenses.map(x=>x.academicYear).filter(Boolean)])].map(y=><option key={y}>{y}</option>)}</select></label>}</div><b>Total Expenses: {money(expenseMatches.reduce((a,x)=>a+Number(x.amount||0),0))}</b>
    {renderTable(['Date','Expense','Category','Amount','Receipt No.','Receipt / Actions'],expenseMatches.map(x=>[x.expenseDate,x.title,x.category||'Other',money(x.amount),x.receiptNo||'—',<div style={{display:'flex',gap:5,flexWrap:'wrap'}}><button type="button" style={secondary} onClick={()=>shareReport('Expense Receipt',expenseReceiptBody(x))}>Share / Send</button><button type="button" style={secondary} onClick={()=>navigator.clipboard?.writeText(`${schoolName||'School'}\nExpense Receipt: ${x.receiptNo}\n${x.title}\n${money(x.amount)}\nDate: ${x.expenseDate}`).then(()=>setMessage('Expense receipt copied.'))}>Copy</button><button type="button" style={secondary} onClick={()=>printDoc('Expense Receipt',expenseReceiptBody(x))}>PDF / Print</button><button type="button" style={secondary} onClick={()=>editExpense(x)}>Edit</button><button type="button" style={secondary} onClick={()=>cancelExpense(x)}>Cancel</button></div>]))}
    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button type="button" style={secondary} onClick={()=>shareReport('Expense Report',table(['Date','Expense','Category','Amount','Receipt'],expenseMatches.map(x=>[x.expenseDate,x.title,x.category||'Other',money(x.amount),x.receiptNo])))}>Share / Send All</button><button type="button" style={secondary} onClick={()=>printDoc('Expense Report',table(['Date','Expense','Category','Amount','Receipt'],expenseMatches.map(x=>[x.expenseDate,x.title,x.category||'Other',money(x.amount),x.receiptNo])))}>PDF / Print All</button></div>
   </div>
   <form onSubmit={saveExpense} style={{display:'grid',gap:12}}>
    <div style={formGrid}><label style={labelStyle}>Expense Date<input style={inputStyle} type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/></label><div style={{alignSelf:'end'}}><button type="button" style={secondary} onClick={addExpenseDraft}>+ Add Another Expense</button></div></div>
    {expenseDrafts.map((x,i)=><div key={i} className="finance-card" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:9,alignItems:'end'}}><label style={labelStyle}>Expense Name<input style={inputStyle} required value={x.title} onChange={e=>updateExpenseDraft(i,'title',e.target.value)} placeholder="e.g. Electricity Bill"/></label><label style={labelStyle}>Category<select style={inputStyle} value={x.category} onChange={e=>updateExpenseDraft(i,'category',e.target.value)}>{['Salary','Electricity','Water','Rent','Stationery','Repair & Maintenance','Transport / Fuel','Cleaning','Computer','Other'].map(c=><option key={c}>{c}</option>)}</select></label><label style={labelStyle}>Amount<input style={inputStyle} type="number" min="1" required value={x.amount} onChange={e=>updateExpenseDraft(i,'amount',e.target.value)} placeholder="₹ Amount"/></label><button type="button" style={secondary} onClick={()=>removeExpenseDraft(i)}>Remove</button></div>)}
    <button style={primary}>Save {expenseDrafts.length>1?'All Expenses':'Expense'} & Create Receipt(s)</button>
   </form>
  </div>;
  const reportExpenses=expenses.filter(x=>x.status!=='cancelled'&&(year==='All Years'||(x.academicYear?String(x.academicYear)===String(year):inYear(x.expenseDate))));
  const reportFiltered=reportRows.filter(p=>(reportClass==='All Classes'||String(p.className||'')===reportClass)&&(reportFeeType==='All Fee Types'||p.feeType===reportFeeType)&&(reportMode==='All Modes'||p.paymentMode===reportMode)&&(reportMonth==='All Months'||String(p.months||'').split(',').map(m=>m.trim()).includes(reportMonth)));
  const expenseTotal=reportExpenses.reduce((a,x)=>a+Number(x.amount||0),0);
  const netBalance=paid-expenseTotal;
  const byType=['Monthly School Fee','Monthly Van Fee','Admission Fee','Renewal Fee','Exam Fee','Other Fee'].map(t=>[t,money(reportFiltered.filter(p=>p.feeType===t).reduce((a,p)=>a+Number(p.amount||0),0))]);
  const byMode=['Cash','UPI','Bank','Online','Cheque'].map(m=>[m,money(reportFiltered.filter(p=>String(p.paymentMode||'').toLowerCase().includes(m.toLowerCase())).reduce((a,p)=>a+Number(p.amount||0),0))]);
  const byClass=collectionClasses.map(c=>[c,money(reportFiltered.filter(p=>p.className===c).reduce((a,p)=>a+Number(p.amount||0),0))]);
  const monthlyRows=monthNames.map(m=>[m,money(reportFiltered.filter(p=>String(p.months||'').split(',').map(x=>x.trim()).includes(m)).reduce((a,p)=>a+Number(p.amount||0),0))]);
  const pendingStudents=year==='All Years'?[]:activeStudents.map(st=>({st,d:feeDueDetails(st,year)})).filter(x=>!x.d.missingStructure);
  const totalPending=pendingStudents.reduce((a,x)=>a+Number(x.d.grand||0),0);
  const reportTableHtml=table(['Date','Student','Class','Admission No.','Fee Type','Months','Amount','Mode','Receipt'],reportFiltered.map(p=>[p.paymentDate,p.studentName,p.className,p.admissionNo,p.feeType,p.months||'—',money(p.amount),p.paymentMode,p.receiptNo]));
  return <div style={{display:'grid',gap:12}}>
   <label style={labelStyle}>Report Year<select style={inputStyle} value={year} onChange={e=>{setYear(e.target.value);setReportSearch('');}}>{[...new Set(['2026-27','2025-26','2024-25','2023-24',...activePayments.map(p=>p.academicYear).filter(Boolean),'All Years'])].map(x=><option key={x}>{x}</option>)}</select></label>
   <div style={statsGrid}><div className="stat"><small>Total Collected</small><strong>{money(paid)}</strong></div><div className="stat"><small>Recorded Expenses</small><strong>{money(expenseTotal)}</strong></div><div className="stat"><small>Net Balance (Income − Expenses)</small><strong style={{color:netBalance<0?'#b91c1c':'#15803d'}}>{money(netBalance)}</strong></div><div className="stat"><small>Payment Entries</small><strong>{rows.length}</strong></div><div className="stat"><small>Pending Fees (Estimated)</small><strong>{money(totalPending)}</strong></div></div>
   <h3 style={{margin:'8px 0 0'}}>Payment Filters</h3>
   <div style={formGrid}><label style={labelStyle}>Class<select style={inputStyle} value={reportClass} onChange={e=>setReportClass(e.target.value)}><option>All Classes</option>{collectionClasses.map(c=><option key={c}>{c}</option>)}</select></label><label style={labelStyle}>Month<select style={inputStyle} value={reportMonth} onChange={e=>setReportMonth(e.target.value)}><option>All Months</option>{monthNames.map(m=><option key={m}>{m}</option>)}</select></label><label style={labelStyle}>Fee Type<select style={inputStyle} value={reportFeeType} onChange={e=>setReportFeeType(e.target.value)}><option>All Fee Types</option>{['Monthly School Fee','Monthly Van Fee','Admission Fee','Renewal Fee','Exam Fee','Other Fee'].map(t=><option key={t}>{t}</option>)}</select></label><label style={labelStyle}>Payment Mode<select style={inputStyle} value={reportMode} onChange={e=>setReportMode(e.target.value)}><option>All Modes</option>{['Cash','UPI','Bank','Online','Cheque'].map(m=><option key={m}>{m}</option>)}</select></label></div>
   <input style={{...inputStyle,maxWidth:520}} value={reportSearch} onChange={e=>setReportSearch(e.target.value)} placeholder="Search student / admission / receipt / class / fee type / mode / month"/>
   <h3>Class-wise Collection</h3>{renderTable(['Class','Collected'],byClass)}
   <h3>Month-wise Collection</h3>{renderTable(['Month','Collected'],monthlyRows)}
   <h3>Fee Category-wise Collection</h3>{renderTable(['Fee Category','Collected'],byType)}
   <h3>Payment Mode-wise Collection</h3>{renderTable(['Payment Mode','Collected'],byMode)}
   <h3>Pending Fees by Student · {year}</h3>{year==='All Years'?<p className="muted">Pending fees are shown per academic session. Select one session to view estimated dues.</p>:renderTable(['Student','Class','Pending'],pendingStudents.filter(x=>x.d.grand>0).map(x=>[x.st.name,x.st.className,money(x.d.grand)]))}
   <h3>Payment Details</h3>{renderTable(['Date','Student','Class','Fee Type','Months','Amount','Mode','Receipt'],reportFiltered.map(p=>[p.paymentDate,p.studentName,p.className,p.feeType,p.months||'—',money(p.amount),p.paymentMode,p.receiptNo]))}
   <h3>Recorded Expenses</h3>{renderTable(['Date','Expense','Amount'],reportExpenses.map(x=>[x.expenseDate,x.title,money(x.amount)]))}
   <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button style={secondary} onClick={()=>shareReport('Financial Report',reportTableHtml)}>Share</button><button style={secondary} onClick={()=>shareReport('Financial Report',reportTableHtml)}>Send</button><button style={secondary} onClick={()=>printDoc('Financial Report',`<h2>Summary</h2><p>Total Collected: ${money(paid)} · Expenses: ${money(expenseTotal)} · Net Balance: ${money(netBalance)} · Pending (estimated): ${money(totalPending)}</p>${table(['Class','Collected'],byClass)}${table(['Month','Collected'],monthlyRows)}${table(['Fee Category','Collected'],byType)}${table(['Payment Mode','Collected'],byMode)}${reportTableHtml}${table(['Date','Expense','Amount'],reportExpenses.map(x=>[x.expenseDate,x.title,money(x.amount)]))}`)}>PDF</button><button style={secondary} onClick={()=>printDoc('Financial Report',`<h2>Summary</h2><p>Total Collected: ${money(paid)} · Expenses: ${money(expenseTotal)} · Net Balance: ${money(netBalance)} · Pending (estimated): ${money(totalPending)}</p>${reportTableHtml}${table(['Date','Expense','Amount'],reportExpenses.map(x=>[x.expenseDate,x.title,money(x.amount)]))}`)}>Print</button></div>
  </div>;
 };
 const formGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,alignItems:'end',margin:'14px 0'};
 const statsGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,margin:'14px 0'};
 if(!schoolId)return <section className="workspace"><h2>{active}</h2><p>Please select one school from the top menu to manage its finance records.</p></section>;
 return <section className="workspace"><button className="back" onClick={onBack||(()=>window.dispatchEvent(new CustomEvent('smp-back-dashboard')))}>← Dashboard</button><div className="section-head"><div><h2>{active}</h2><p>{schoolName} · Academic Session {year}</p></div><span>{loading?'Loading…':''}</span></div>{error&&<p style={{color:'#b91c1c',background:'#fee2e2',padding:10,borderRadius:8}}>{error}</p>}{message&&<p style={{color:'#166534',background:'#dcfce7',padding:10,borderRadius:8}}>{message}</p>}{panelBody()}</section>;
}
