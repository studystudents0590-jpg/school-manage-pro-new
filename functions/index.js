const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
admin.initializeApp();
const db=admin.firestore();
exports.createParentAccount=onCall(async(request)=>{
 const caller=request.auth;
 if(!caller)throw new HttpsError('unauthenticated','Please sign in.');
 const callerSnap=await db.collection('users').doc(caller.uid).get();
 const callerData=callerSnap.data()||{};
 if(!['schooladmin','superadmin'].includes(callerData.role))throw new HttpsError('permission-denied','Only School Admin can create Parent accounts.');
 const {email,password,studentIds,schoolId}=request.data||{};
 if(typeof email!=='string'||!email.includes('@')||typeof password!=='string'||password.length<6||!Array.isArray(studentIds)||!studentIds.length||typeof schoolId!=='string')throw new HttpsError('invalid-argument','Email, password, school and at least one child are required.');
 if(callerData.role==='schooladmin'&&callerData.schoolId!==schoolId)throw new HttpsError('permission-denied','You can manage only your own school.');
 const refs=studentIds.map(id=>db.collection('students').doc(id));
 const snaps=await Promise.all(refs.map(r=>r.get()));
 if(snaps.some(s=>!s.exists||s.data().schoolId!==schoolId))throw new HttpsError('failed-precondition','Every selected child must belong to this school.');
 let user;
 try{user=await admin.auth().createUser({email:email.trim().toLowerCase(),password, emailVerified:false});}
 catch(e){throw new HttpsError('already-exists',e.message);}
 const batch=db.batch();
 batch.set(db.collection('users').doc(user.uid),{role:'parent',schoolId,schoolName:callerData.schoolName||'',email:email.trim().toLowerCase(),displayName:'Parent',createdAt:admin.firestore.FieldValue.serverTimestamp()});
 refs.forEach(ref=>batch.update(ref,{parentUid:user.uid,parentEmail:email.trim().toLowerCase(),parentLinkedAt:admin.firestore.FieldValue.serverTimestamp()}));
 try{await batch.commit();}catch(e){await admin.auth().deleteUser(user.uid);throw new HttpsError('internal','Could not link selected children. No account was retained.');}
 return {uid:user.uid,email:user.email,linkedChildren:studentIds.length};
});
