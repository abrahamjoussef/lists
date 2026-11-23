// Shopping list app logic
// Firebase project settings (Firebase console → Project settings → Your apps → Web app)
const firebaseConfig = {
  apiKey: "AIzaSyBme9LUlSJIZ9zogsrJst4THDI9XcTUV84",
  authDomain: "family-shopping-list-dd093.firebaseapp.com",
  projectId: "family-shopping-list-dd093",
  storageBucket: "family-shopping-list-dd093.firebasestorage.app",
  messagingSenderId: "819867077057",
  appId: "1:819867077057:web:47ea1b536de3f39f078740"
};
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, persistentLocalCache, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot as fsSnap } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const CATS = [
  {id:'produce', label:'Fruit & Veg', e:'🥬'},
  {id:'dairy', label:'Dairy & Eggs', e:'🥛'},
  {id:'meat', label:'Meat & Fish', e:'🍗'},
  {id:'bakery', label:'Bakery', e:'🍞'},
  {id:'pantry', label:'Pantry', e:'🥫'},
  {id:'frozen', label:'Frozen', e:'🧊'},
  {id:'drinks', label:'Drinks', e:'🧃'},
  {id:'snacks', label:'Snacks', e:'🍫'},
  {id:'household', label:'Household', e:'🧻'},
  {id:'personal', label:'Personal care', e:'🧴'},
  {id:'baby', label:'Baby', e:'🍼'},
  {id:'other', label:'Other', e:'📦'},
];
const CAT = Object.fromEntries(CATS.map(c=>[c.id,c]));
const KEYWORDS = {
  produce:'apple banana orange lemon lime tomato potato onion garlic cucumber lettuce carrot pepper spinach parsley mint coriander cilantro fruit veg vegetable grape mango avocado zucchini eggplant date dates berries strawberr watermelon melon herbs ginger',
  dairy:'milk laban yogurt yoghurt cheese butter cream egg eggs labneh halloumi feta',
  meat:'chicken beef lamb meat mince fish shrimp salmon tuna steak sausage turkey camel',
  bakery:'bread bun buns pita samoon croissant cake tortilla toast muffin',
  pantry:'rice pasta flour sugar salt oil olive spice spices cumin tea coffee beans lentil lentils sauce ketchup mayo honey jam cereal oats vinegar tahini hummus noodles',
  frozen:'frozen ice cream icecream peas nuggets fries',
  drinks:'water juice soda cola pepsi drink drinks',
  snacks:'chips chocolate biscuit biscuits cookies nuts snack snacks candy popcorn',
  household:'tissue tissues toilet paper detergent soap dish bleach bag bags foil cleaner sponge napkins',
  personal:'shampoo toothpaste toothbrush deodorant lotion conditioner razor',
  baby:'diaper diapers nappies wipes formula baby',
};
function guessCat(name){
  const w = name.toLowerCase();
  for (const [cat, list] of Object.entries(KEYWORDS)){
    for (const k of list.split(' ')) if (k && new RegExp('\\b'+k).test(w)) return cat;
  }
  return 'other';
}

// ---- state ----
let db=null, user=null, me=null, items=new Map(), recent=[], mode='plan', pickedCat=null, offline=false;
const names = {}; // id -> display name
let editing=null, editCat=null, trips=[];
const $ = id=>document.getElementById(id);

try{ mode = localStorage.getItem('shopMode')||'plan'; }catch(e){}

// ---- writes: one at a time per doc ----
const queues = {};
function write(path, fn){
  path = (owner||'')+':'+path;
  const prev = queues[path]||Promise.resolve();
  const p = prev.then(fn).catch(err=>{ handleWriteError(err); });
  queues[path]=p; return p;
}
function handleWriteError(err){
  const code = err && err.code;
  if (code==='permission-denied') setStatus("This phone isn't allowed to change the list. Check the Firestore rules in the setup guide.", true);
  else setStatus("Couldn't save that change. Check your connection and try again.", true);
}
function setStatus(msg, warn){ const s=$('status'); s.textContent=msg||''; s.className='status'+(warn?' warn':''); }

// local fallback (no sync) so the page still works
function localOnly(){ return !db; }

async function addItem(raw){
  let text = raw.trim(); if(!text) return;
  let qty = 1;
  const m = text.match(/^(\d+)\s*[x×]?\s+(.+)$/i) || text.match(/^(.+?)\s+[x×]\s*(\d+)$/i);
  if (m){ if (/^\d+$/.test(m[1])){ qty=+m[1]; text=m[2]; } else { text=m[1]; qty=+m[2]; } }
  text = text.charAt(0).toUpperCase()+text.slice(1);
  const existing = [...items.values()].find(i=>!i.done && i.name.toLowerCase()===text.toLowerCase());
  if (existing){ return changeQty(existing.id, existing.qty+qty); }
  const cat = pickedCat || guessCat(text);
  const data = {name:text, qty, cat, note:'', done:false, addedBy:me||null, doneBy:null, createdAt:Date.now()};
  if (localOnly()){ const id='l'+Date.now(); items.set(id,{id,...data}); render(); return; }
  const ref = db.collection('items').doc();
  items.set(ref.id,{id:ref.id,...data}); render();
  write('items/'+ref.id, ()=>ref.set(data));
}
function toggle(id){
  const it = items.get(id); if(!it) return;
  const done = !it.done;
  if (navigator.vibrate) try{navigator.vibrate(12)}catch(e){}
  const doneAt = done ? Date.now() : null;
  items.set(id,{...it,done,doneBy:done?me:null,doneAt}); render();
  if (localOnly()) return;
  write('items/'+id, ()=>db.doc('items/'+id).update({done, doneBy:done?(me||null):null, doneAt}));
  logHistory(it, done, doneAt || it.doneAt);
}
// ---- automatic trips: every ticked item goes into that day's trip ----
function dayKey(t){ const d=new Date(t); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function logHistory(it, done, t){
  const key = 'd-'+dayKey(t||Date.now());
  const entry = done ? {name:it.name, qty:it.qty, cat:it.cat, note:it.note||'', by:me||null, at:t} : deleteField();
  // update local copy right away
  let trip = trips.find(h=>h.id===key);
  if (done){
    if (!trip){ trip={id:key, at:t, items:[]}; trips=[trip, ...trips]; }
    trip.items = trip.items.filter(x=>x.key!==it.id).concat([{key:it.id, name:it.name, qty:it.qty, cat:it.cat, note:it.note||'', by:me, at:t}]);
    trip.at = Math.max(trip.at, t);
  } else if (trip){ trip.items = trip.items.filter(x=>x.key!==it.id); }
  write('trips/'+key, ()=>db.doc('trips/'+key).merge({day:dayKey(t||Date.now()), at:Date.now(), items:{[it.id]:entry}}));
}
// ticked items from an earlier day are already in History: tidy them off the list
function autoClearOld(){
  const today = dayKey(Date.now());
  const old = [...items.values()].filter(i=>i.done && i.doneAt && dayKey(i.doneAt)!==today);
  if (!old.length) return;
  remember(old);
  for (const it of old){ items.delete(it.id); write('items/'+it.id, ()=>db.doc('items/'+it.id).delete()); }
}
function changeQty(id, q){
  const it = items.get(id); if(!it) return;
  if (q<1) return removeItem(id);
  items.set(id,{...it,qty:q}); render();
  if (!localOnly()) write('items/'+id, ()=>db.doc('items/'+id).update({qty:q}));
}
function removeItem(id){
  const it = items.get(id); if(!it) return;
  remember([it]);
  items.delete(id); render();
  if (!localOnly()) write('items/'+id, ()=>db.doc('items/'+id).delete());
}
function remember(list){
  let changed=false;
  for (const it of list){
    const k = it.name.toLowerCase();
    recent = recent.filter(r=>r.name.toLowerCase()!==k);
    recent.unshift({name:it.name, cat:it.cat}); changed=true;
  }
  recent = recent.slice(0,30);
  if (changed && !localOnly()){ const r=recent.slice(); write('meta/recent', ()=>db.doc('meta/recent').set({items:r})); }
}
function clearDone(){
  const done = [...items.values()].filter(i=>i.done);
  if(!done.length) return;
  remember(done);
  for (const it of done){ items.delete(it.id); if(!localOnly()) write('items/'+it.id, ()=>db.doc('items/'+it.id).delete()); }
  render();
}

// ---- edit sheet ----
function openEdit(id){
  const it = items.get(id); if(!it) return;
  editing=id; editCat=it.cat;
  $('eName').value=it.name; $('eNote').value=it.note||'';
  renderEditCats(); $('sheet').classList.remove('hidden');
}
function renderEditCats(){
  const box=$('eCats'); box.innerHTML='';
  for (const c of CATS){
    const b=document.createElement('button'); b.type='button';
    b.className='chip'+(c.id===editCat?' on':''); b.textContent=c.e+' '+c.label;
    b.onclick=()=>{editCat=c.id; renderEditCats();};
    box.appendChild(b);
  }
}
function closeEdit(){ editing=null; $('sheet').classList.add('hidden'); }
$('eCancel').onclick=closeEdit;
$('sheet').onclick=e=>{ if(e.target.id==='sheet') closeEdit(); };
$('eDel').onclick=()=>{ const id=editing; closeEdit(); removeItem(id); };
$('eSave').onclick=()=>{
  const id=editing, it=items.get(id); closeEdit(); if(!it) return;
  const name=$('eName').value.trim()||it.name, note=$('eNote').value.trim();
  if (name===it.name && note===(it.note||'') && editCat===it.cat) return;
  items.set(id,{...it,name,note,cat:editCat}); render();
  if (!localOnly()) write('items/'+id, ()=>db.doc('items/'+id).update({name,note,cat:editCat}));
};

// ---- render ----
function initials(id){
  if(!id) return '';
  const n = names[id]; if(!n) return '•';
  if (id===me) return 'Me';
  return n.split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase();
}
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function itemRow(it){
  const row = el('div','item'+(it.done?' done':''));
  const chk = el('button','check'); chk.innerHTML=CHECK_SVG; chk.setAttribute('aria-label', (it.done?'Uncheck ':'Check ')+it.name);
  chk.onclick=()=>toggle(it.id);
  const body = el('div','body');
  const nm = el('div','name'); nm.textContent = it.name;
  if (it.qty>1 && mode==='shop'){ nm.append(' '); nm.appendChild(el('span','badge','×'+it.qty)); }
  body.appendChild(nm);
  const meta = el('div','meta');
  if (it.note) meta.appendChild(el('span',null,it.note));
  if (mode==='plan' && it.addedBy && names[it.addedBy]) { const w=el('span','who',initials(it.addedBy)); w.title='Added by '+names[it.addedBy]; meta.appendChild(w); }
  if (it.done && it.doneBy && names[it.doneBy]) meta.appendChild(el('span',null,'✓ '+(it.doneBy===me?'you':names[it.doneBy].split(' ')[0])));
  if (meta.childNodes.length) body.appendChild(meta);
  body.onclick = ()=> mode==='shop' ? toggle(it.id) : openEdit(it.id);
  row.append(chk, body);
  if (mode==='plan' && !it.done){
    const q = el('div','qty');
    const minus = el('button',null,'−'); minus.onclick=()=>changeQty(it.id,it.qty-1);
    const plus = el('button',null,'+'); plus.onclick=()=>changeQty(it.id,it.qty+1);
    q.append(minus, el('span',null,String(it.qty)), plus);
    row.appendChild(q);
  }
  return row;
}

function render(){
  const all = [...items.values()];
  const todo = all.filter(i=>!i.done), done = all.filter(i=>i.done);
  $('summary').textContent = all.length ? `${todo.length} to get · ${done.length} in cart` : 'Nothing on the list yet';
  $('bar').style.width = all.length ? (done.length/all.length*100)+'%' : '0';
  $('mPlan').classList.toggle('on', mode==='plan');
  $('mShop').classList.toggle('on', mode==='shop');
  $('mHist').classList.toggle('on', mode==='trips');
  $('addbar').classList.toggle('hidden', mode!=='plan');
  document.body.style.paddingBottom = mode!=='plan' ? 'calc(env(safe-area-inset-bottom) + 24px)' : '';

  const main = $('main'); main.innerHTML=''; main.className = mode==='shop'?'shop':'';
  if (mode==='trips'){ renderHistory(main); return; }

  if (mode==='plan'){
    const inList = new Set(todo.map(i=>i.name.toLowerCase()));
    const quick = recent.filter(r=>!inList.has(r.name.toLowerCase())).slice(0,15);
    if (quick.length){
      main.appendChild(el('div','label','Add again'));
      const chips = el('div','chips');
      for (const r of quick){
        const c=el('button','chip','+ '+r.name);
        c.onclick=()=>{ const keep=pickedCat; pickedCat=r.cat; addItem(r.name); pickedCat=keep; };
        chips.appendChild(c);
      }
      main.appendChild(chips);
    }
  }

  if (!all.length){
    const e = el('div','empty'); e.innerHTML='<b>🧺</b>';
    e.appendChild(document.createTextNode(mode==='shop' ? 'The list is empty — switch to List to add items.' : 'Add your first item below. Anything you add shows up on both phones.'));
    main.appendChild(e); return;
  }

  if (todo.length){
    for (const c of CATS){
      const list = todo.filter(i=>(CAT[i.cat]?i.cat:'other')===c.id).sort((a,b)=>a.name.localeCompare(b.name));
      if (!list.length) continue;
      const g = el('div','group');
      const gh = el('div','gh', c.e+' '+c.label); gh.appendChild(el('span','n',String(list.length)));
      g.appendChild(gh);
      list.forEach(i=>g.appendChild(itemRow(i)));
      main.appendChild(g);
    }
  } else if (mode==='shop'){
    const e = el('div','empty'); e.innerHTML='<b>🎉</b>'; e.appendChild(document.createTextNode('All done! Everything is in the cart.'));
    main.appendChild(e);
  }

  if (done.length){
    main.appendChild(el('div','label','In the cart ('+done.length+')'));
    const g = el('div','group');
    done.sort((a,b)=>a.name.localeCompare(b.name)).forEach(i=>g.appendChild(itemRow(i)));
    main.appendChild(g);
    const clr = el('button','clear','Clear checked items (they stay in History)'); clr.onclick=clearDone;
    main.appendChild(clr);
  }
}

function fmtDate(t){
  const d=new Date(t), now=new Date();
  const day = d.toDateString()===now.toDateString() ? 'Today'
    : d.toDateString()===new Date(now-864e5).toDateString() ? 'Yesterday'
    : d.toLocaleDateString(undefined,{weekday:'short', day:'numeric', month:'short', year: d.getFullYear()===now.getFullYear()?undefined:'numeric'});
  return {day, time:d.toLocaleTimeString(undefined,{hour:'numeric', minute:'2-digit'})};
}
function readd(list){
  const keep=pickedCat; let n=0;
  for (const it of list){ pickedCat=it.cat; addItem((it.qty>1?it.qty+' ':'')+it.name); n++; }
  pickedCat=keep;
  setStatus(n+' item'+(n===1?'':'s')+' added to the list ✓');
}
function renderHistory(main){
  if (!trips.some(t=>t.items.length)){
    const e = el('div','empty'); e.innerHTML='<b>🧾</b>';
    e.appendChild(document.createTextNode('No trips yet. Every item you tick while shopping is saved here automatically, grouped by day.'));
    main.appendChild(e); return;
  }
  // quick stats
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const thisMonth = trips.filter(t=>t.at>=monthStart.getTime()).length;
  const counts = {};
  for (const t of trips) for (const i of t.items) { const k=i.name.toLowerCase(); counts[k]=(counts[k]||{name:i.name,n:0}); counts[k].n++; }
  const top = Object.values(counts).sort((a,b)=>b.n-a.n)[0];
  const stats = el('div','stats');
  const st=(v,l)=>{ const d=el('div','stat'); d.appendChild(el('b',null,v)); d.appendChild(el('span',null,l)); return d; };
  stats.append(st(String(trips.filter(t=>t.items.length).length),'trips'), st(String(thisMonth),'this month'), st(top?top.name:'—','most bought'));
  main.appendChild(stats);

  for (const t of trips.filter(t=>t.items.length).slice(0,60)){
    const {day,time} = fmtDate(t.at);
    const card = document.createElement('details'); card.className='trip';
    const sum = document.createElement('summary');
    const dt = el('div','date'); dt.appendChild(el('b',null,day));
    const who = [...new Set(t.items.map(i=>i.by).filter(Boolean))].map(n=>n===me?'you':n);
    dt.appendChild(el('span',null, time + (who.length ? ' · by '+who.join(' & ') : '')));
    sum.append(dt, el('span','count', t.items.length+' item'+(t.items.length===1?'':'s')), el('span','chev','›'));
    card.appendChild(sum);
    const rows = el('div','rows');
    for (const i of t.items){
      const r = el('div','hrow');
      r.appendChild(el('span',null,(CAT[i.cat]||CAT.other).e));
      const n = el('span','n', i.name + (i.qty>1?' ×'+i.qty:''));
      if (i.note){ n.appendChild(document.createElement('br')); n.appendChild(el('small',null,i.note)); }
      r.appendChild(n);
      const b = el('button',null,'+ Add'); b.onclick=()=>readd([i]);
      r.appendChild(b);
      rows.appendChild(r);
    }
    const again = el('button','again','Add all '+t.items.length+' items to the list');
    again.onclick=()=>{ readd(t.items); mode='plan'; try{localStorage.setItem('shopMode',mode)}catch(e){} render(); };
    rows.appendChild(again);
    card.appendChild(rows);
    main.appendChild(card);
  }
}

function renderCatPick(){
  const box=$('catPick'); box.innerHTML='';
  const auto=el('button','chip'+(pickedCat===null?' on':''),'✨ Auto');
  auto.onclick=()=>{pickedCat=null; renderCatPick();}; box.appendChild(auto);
  for (const c of CATS){
    const b=el('button','chip'+(pickedCat===c.id?' on':''), c.e+' '+c.label);
    b.type='button'; b.onclick=()=>{pickedCat=c.id; renderCatPick();};
    box.appendChild(b);
  }
}

$('addForm').addEventListener('submit', e=>{ e.preventDefault(); const v=$('addInput').value; $('addInput').value=''; addItem(v); pickedCat=null; renderCatPick(); $('addInput').focus(); });
$('mPlan').onclick=()=>{mode='plan'; try{localStorage.setItem('shopMode',mode)}catch(e){} render();};
$('mShop').onclick=()=>{mode='shop'; try{localStorage.setItem('shopMode',mode)}catch(e){} render();};
$('mHist').onclick=()=>{mode='trips'; render();};


// ---- Firebase adapter (same shape the app code uses) ----
function mkDb(fs, base){
  const wrapDoc = r => ({
    id: r.id,
    set: d => setDoc(r, d),
    merge: d => setDoc(r, d, {merge:true}),
    update: d => updateDoc(r, d),
    delete: () => deleteDoc(r),
    onSnapshot: (n, e) => fsSnap(r, {includeMetadataChanges:true}, s => n({exists:s.exists(), data:()=>s.data(), metadata:s.metadata}), e)
  });
  return {
    doc: p => wrapDoc(doc(fs, base + p)),
    collection: p => ({
      doc: id => wrapDoc(id ? doc(fs, base + p, id) : doc(collection(fs, base + p))),
      onSnapshot: (n, e) => fsSnap(collection(fs, base + p), {includeMetadataChanges:true},
        s => n({docs: s.docs.map(d => ({id:d.id, data:()=>d.data()})), metadata:s.metadata}), e)
    })
  };
}
function store(k, v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }

// ---- landing & registration ----
let authMode='register';
function setAuthMode(m){
  authMode=m;
  const reg = m==='register';
  $('aTitle').textContent = reg ? 'Create your account' : 'Welcome back';
  $('aHint').textContent = reg ? 'It takes 30 seconds.' : 'Sign in to open your shopping list.';
  $('nameWrap').classList.toggle('hidden', !reg);
  $('aPass').autocomplete = reg ? 'new-password' : 'current-password';
  $('aGo').textContent = reg ? 'Register' : 'Sign in';
  $('aErr').textContent=''; $('aErr').className='err';
  const sw=$('aSwitch'); sw.innerHTML='';
  sw.append(reg ? 'Already registered? ' : 'New here? ');
  const b=el('button','linkbtn', reg ? 'Sign in' : 'Create an account'); b.type='button';
  b.onclick=()=>setAuthMode(reg?'signin':'register'); sw.appendChild(b);
  if(!reg){
    sw.appendChild(document.createElement('br'));
    const f=el('button','linkbtn','Forgot password?'); f.type='button'; f.style.marginTop='8px';
    f.onclick=async()=>{
      const email=$('aEmail').value.trim();
      if(!email){ $('aErr').textContent='Type your email above first.'; return; }
      try{ await sendPasswordResetEmail(window._auth, email); $('aErr').className='ok'; $('aErr').textContent='Check your email for a reset link.'; }
      catch(e){ $('aErr').className='err'; $('aErr').textContent=authMsg(e); }
    };
    sw.appendChild(f);
  }
}
function authMsg(e){
  const c=(e&&e.code)||'';
  if(c.includes('email-already-in-use')) return 'This email is already registered — tap "Sign in" below.';
  if(c.includes('invalid-email')) return 'Please enter a valid email address.';
  if(c.includes('weak-password')) return 'Password needs at least 6 characters.';
  if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')) return 'Email or password is incorrect.';
  if(c.includes('too-many-requests')) return 'Too many attempts. Please wait a minute and try again.';
  if(c.includes('network')) return 'No internet connection. Please try again.';
  if(c.includes('operation-not-allowed')) return 'Email sign-in is not enabled yet in Firebase.';
  return 'Something went wrong. Please try again.';
}
function showLanding(invited){
  $('inviteNote').classList.toggle('hidden', !invited);
  setAuthMode(store('shopRegistered') ? 'signin' : 'register');
  $('auth').classList.remove('hidden');
}
$('authForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const auth=window._auth, name=$('aName').value.trim(), email=$('aEmail').value.trim(), pass=$('aPass').value;
  $('aErr').className='err'; $('aErr').textContent='';
  if(authMode==='register' && !name){ $('aErr').textContent='Please enter your name.'; return; }
  if(!email || !pass){ $('aErr').textContent='Please enter your email and password.'; return; }
  $('aGo').disabled=true;
  try{
    if(authMode==='register'){
      window._pendingName = name;   // set first: Firebase reports the sign-in before updateProfile runs
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, {displayName:name});
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
    store('shopRegistered','1');
  }catch(err){ window._pendingName = null; $('aErr').textContent=authMsg(err); }
  $('aGo').disabled=false;
});

// ---- family: own list + lists shared with me ----
let fs=null, uid=null, myEmail='', owner=null, unsubs=[], sharedWithMe=[], myFamily={}, familyEmails={};
function ownerName(o){ if(o===uid) return 'My list'; const p=sharedWithMe.find(x=>x.uid===o); return p ? p.name+"'s list" : 'List'; }
function renderSwitcher(){
  const box=$('switcher'); if(!box) return; box.innerHTML='';
  const all=[uid, ...sharedWithMe.map(p=>p.uid)];
  for (const o of all){
    const b=el('button','chip'+(o===owner?' on':''), (o===uid?'🏠 ':'👤 ')+ownerName(o));
    b.onclick=()=>{ if(o!==owner) openList(o); };
    box.appendChild(b);
  }
  const fam=el('button','chip','👥 Family'); fam.onclick=openFamily; fam.setAttribute('aria-haspopup','dialog'); box.appendChild(fam);
  $('title').textContent = '🛒 ' + (owner===uid ? 'My Shopping List' : ownerName(owner).replace("'s list","'s Shopping List"));
}
function addToolbar(){
  const sw=el('div','switcher'); sw.id='switcher';
  const bar=el('div','toolbar');
  const out=el('button','chip','Sign out');
  out.onclick=async()=>{ try{ await signOut(window._auth); }catch(e){} try{localStorage.removeItem('shopOwner')}catch(e){} location.reload(); };
  bar.append(out, el('span','who-am-i','Hi, '+me));
  $('status').before(sw); $('status').before(bar);
}
function openList(o){
  unsubs.forEach(f=>{ try{f()}catch(e){} }); unsubs=[];
  owner=o; store('shopOwner', o);
  items=new Map(); trips=[]; recent=[]; setStatus('');
  db = mkDb(fs, 'ulists/'+o+'/');
  renderSwitcher(); render();
  let timer = setTimeout(()=>setStatus("Can't reach the list yet — showing what's on this phone. It will update when you're back online.", true), 10000);
  unsubs.push(db.collection('items').onSnapshot(snap=>{
    if (o!==owner) return;
    if (!snap.metadata.fromCache){ clearTimeout(timer); setStatus(''); }
    items = new Map(snap.docs.map(d=>{ const v=d.data()||{}; return [d.id, {id:d.id, name:String(v.name||'Item'), qty:Math.max(1,+v.qty||1), cat:CAT[v.cat]?v.cat:'other', note:String(v.note||''), done:!!v.done, addedBy:v.addedBy?String(v.addedBy):null, doneBy:v.doneBy?String(v.doneBy):null, doneAt:+v.doneAt||null, createdAt:+v.createdAt||0}]; }));
    if (!snap.metadata.fromCache) autoClearOld();
    for (const it of items.values()){ if(it.addedBy) names[it.addedBy]=it.addedBy; if(it.doneBy) names[it.doneBy]=it.doneBy; }
    if (!editing) render();
  }, err=>{ clearTimeout(timer);
    if (err.code==='permission-denied'){ setStatus("You no longer have access to this list.", true); if(o!==uid) setTimeout(()=>openList(uid), 1500); }
    else setStatus("Live updates stopped. Reopen the app to reconnect.", true); }));
  unsubs.push(db.collection('trips').onSnapshot(snap=>{
    if (o!==owner) return;
    trips = snap.docs.map(d=>{ const v=d.data()||{};
      const raw = Array.isArray(v.items) ? v.items.map((i,n)=>[String(n),i]) : Object.entries(v.items||{});
      const list = raw.filter(([k,i])=>i&&i.name).map(([k,i])=>({key:k, name:String(i.name), qty:Math.max(1,+i.qty||1), cat:CAT[i.cat]?i.cat:'other', note:String(i.note||''), by:i.by?String(i.by):(v.by?String(v.by):null), at:+i.at||0}))
        .sort((a,b)=>a.at-b.at);
      const last = list.reduce((m,i)=>Math.max(m,i.at), 0) || +v.at || 0;
      return {id:d.id, at:last, items:list}; })
      .filter(t=>t.items.length).sort((a,b)=>b.at-a.at);
    if (!editing && mode==='trips') render();
  }, ()=>{}));
  unsubs.push(db.doc('meta/recent').onSnapshot(snap=>{
    if (o!==owner) return;
    const v = snap.exists ? snap.data() : null;
    recent = (v && Array.isArray(v.items)) ? v.items.filter(r=>r && r.name).map(r=>({name:String(r.name), cat:CAT[r.cat]?r.cat:'other'})).slice(0,30) : [];
    if (!editing) render();
  }, ()=>{}));
}

// ---- family page ----
let famOpen=false, famMsg='', famOk=false, famBusy=false, famConfirm=null;
const ICON = {
  close:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  mail:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  ok:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 10"/></svg>',
  err:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>',
  check:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  people:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.3c2.4.1 4.3 1.8 4.8 4.7"/></svg>'
};
function iconEl(name){ const s=document.createElement('span'); s.style.display='inline-flex'; s.innerHTML=ICON[name]; return s; }
function avatarColor(seed){ let h=0; for(const ch of String(seed)) h=(h*31+ch.charCodeAt(0))>>>0; return `hsl(${h%360} 45% 42%)`; }
function initialsOf(name){ return String(name||'?').trim().split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase() || '?'; }
function famPeople(){
  const map=new Map();
  for (const [fid,fname] of Object.entries(myFamily)) map.set(fid,{uid:fid, name:String(fname||'Family member'), email:String(familyEmails[fid]||''), canEditMine:true, sharedWithMe:false});
  for (const p of sharedWithMe){ const x=map.get(p.uid)||{uid:p.uid, name:p.name, email:'', canEditMine:false}; x.name=p.name||x.name; x.email=p.email||x.email; x.sharedWithMe=true; map.set(p.uid,x); }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function closeFamily(){ famOpen=false; famMsg=''; famConfirm=null; const s=$('famSheet'); if(s) s.remove(); document.body.style.overflow=''; document.removeEventListener('keydown', famKeys); }
function famKeys(e){ if(e.key==='Escape') closeFamily(); }
function openFamily(){ famOpen=true; famMsg=''; famConfirm=null; document.body.style.overflow='hidden'; document.addEventListener('keydown', famKeys); renderFamily(); setTimeout(()=>{ const i=$('famEmail'); if(i && window.innerWidth>600) i.focus(); },250); }
function renderFamily(msg, ok){
  if(!famOpen) return;
  if(msg!==undefined){ famMsg=msg; famOk=!!ok; }
  let wrap=$('famSheet');
  const keepEmail = wrap ? (wrap.querySelector('#famEmail')||{}).value||'' : '';
  const scroll = wrap ? (wrap.querySelector('.fam-body')||{}).scrollTop||0 : 0;
  if(!wrap){ wrap=el('div','sheet fam-sheet'); wrap.id='famSheet'; wrap.onclick=e=>{ if(e.target===wrap) closeFamily(); }; document.body.appendChild(wrap); }
  wrap.innerHTML='';
  const panel=el('div','fam-panel'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby','famTitle');
  panel.appendChild(el('div','fam-grab'));

  // header
  const head=el('div','fam-head'); const ttl=el('div','ttl');
  const h=el('h3',null,'Family'); h.id='famTitle'; ttl.append(h, el('p',null,'Share shopping lists with the people you live with.'));
  const x=document.createElement('button'); x.className='icon-btn'; x.type='button'; x.setAttribute('aria-label','Close'); x.innerHTML=ICON.close; x.onclick=closeFamily;
  head.append(ttl,x); panel.appendChild(head);

  const body=el('div','fam-body');

  // invite card
  const card=el('section','fam-card');
  card.appendChild(el('h4',null,'Invite a family member'));
  card.appendChild(el('p','lead','Enter the email they registered with. They\'ll be able to see and edit your list.'));
  const form=document.createElement('form'); form.className='fam-invite'; form.noValidate=true;
  const field=el('label','fam-field'); field.appendChild(iconEl('mail'));
  const inp=document.createElement('input'); inp.id='famEmail'; inp.type='email'; inp.placeholder='name@example.com'; inp.value=keepEmail; inp.autocomplete='off'; inp.inputMode='email'; inp.setAttribute('aria-label','Family member\'s email');
  field.appendChild(inp);
  const add=document.createElement('button'); add.type='submit'; add.className='btn btn-primary'; add.id='famAddBtn'; add.disabled=famBusy;
  if(famBusy){ add.appendChild(el('span','spin')); add.setAttribute('aria-label','Adding'); } else add.textContent='Add';
  form.append(field, add);
  form.onsubmit=e=>{ e.preventDefault(); if(!famBusy) addMember(inp.value); };
  card.appendChild(form);
  if(famMsg){ const a=el('div','fam-alert '+(famOk?'ok':'err')); a.setAttribute('role','status'); a.appendChild(iconEl(famOk?'ok':'err')); a.appendChild(el('span','msg',famMsg)); card.appendChild(a); }
  body.appendChild(card);

  // members
  const people=famPeople();
  const sec=el('section');
  const sh=el('div','fam-sec-head'); sh.appendChild(el('h4',null,'Members')); if(people.length) sh.appendChild(el('span','num',String(people.length)));
  sec.appendChild(sh);
  if(!people.length){
    const e=el('div','members fam-empty'); const ic=el('div','ic'); ic.innerHTML=ICON.people; e.appendChild(ic);
    e.appendChild(el('b',null,'No family members yet')); e.appendChild(document.createTextNode('Add someone above to start sharing your list.'));
    sec.appendChild(e);
  } else {
    const list=el('div','members');
    for(const p of people){
      const m=el('div','member'); m.dataset.uid=p.uid;
      const top=el('div','top');
      const av=el('div','avatar',initialsOf(p.name)); av.style.background=avatarColor(p.uid); av.setAttribute('aria-hidden','true');
      const who=el('div','who2'); who.appendChild(el('div','nm',p.name)); if(p.email) who.appendChild(el('div','em',p.email));
      top.append(av,who); m.appendChild(top);

      const bd=el('div','badges');
      const b1=el('span','badge2'+(p.canEditMine?' on':'')); if(p.canEditMine) b1.appendChild(iconEl('check')); b1.append(p.canEditMine?'Can edit your list':'No access to your list');
      const b2=el('span','badge2'+(p.sharedWithMe?' on':'')); if(p.sharedWithMe) b2.appendChild(iconEl('check')); b2.append(p.sharedWithMe?'Shared their list with you':'Hasn\'t shared their list');
      bd.append(b1,b2); m.appendChild(bd);

      if(famConfirm===p.uid){
        const c=el('div','confirm');
        c.appendChild(el('div',null,`Remove ${p.name}'s access to your list? They won't be able to see or edit it anymore.`));
        const r=el('div','row2');
        const cancel=el('button','btn','Cancel'); cancel.type='button'; cancel.onclick=()=>{ famConfirm=null; renderFamily(); };
        const yes=el('button','btn btn-danger-solid','Remove'); yes.type='button'; yes.onclick=()=>{ famConfirm=null; removeMember(p.uid,p.name); };
        r.append(cancel,yes); c.appendChild(r); m.appendChild(c);
      } else {
        const acts=el('div','acts');
        if(p.sharedWithMe){ const o=el('button','btn btn-soft','Open their list'); o.type='button'; o.onclick=()=>{ closeFamily(); openList(p.uid); }; acts.appendChild(o); }
        if(!p.canEditMine){ const s=el('button','btn','Share my list'); s.type='button'; s.onclick=()=>shareWith(p.uid,p.name,p.email); acts.appendChild(s); }
        acts.appendChild(el('span','sp'));
        if(p.canEditMine){ const rm=el('button','btn btn-danger','Remove'); rm.type='button'; rm.onclick=()=>{ famConfirm=p.uid; renderFamily(); }; acts.appendChild(rm); }
        m.appendChild(acts);
      }
      list.appendChild(m);
    }
    sec.appendChild(list);
  }
  body.appendChild(sec);
  body.appendChild(el('p','fam-note','Only people you add can open your list. Each person keeps their own list and History.'));
  panel.appendChild(body);
  wrap.appendChild(panel);
  body.scrollTop=scroll;
}
async function addMember(email){
  email=(email||'').trim().toLowerCase();
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return renderFamily('Please enter a valid email address.');
  if(email===myEmail) return renderFamily("That's your own email. Enter a family member's email instead.");
  if(Object.keys(myFamily).length && famPeople().some(p=>p.canEditMine && p.email===email)) return renderFamily('They can already edit your list.', true);
  famBusy=true; renderFamily('');
  try{
    const snap=await getDoc(doc(fs,'emails/'+email));
    if(!snap.exists()){ famBusy=false; return renderFamily('No account uses that email yet. Ask them to register in the app first, then add them again.'); }
    const p=snap.data();
    if(myFamily[p.uid]){ famBusy=false; return renderFamily((p.name||'They')+' can already edit your list.', true); }
    famBusy=false;
    await shareWith(p.uid, p.name, email);
    const i=$('famEmail'); if(i) i.value='';
  }catch(e){ famBusy=false; renderFamily("Couldn't add them. Check your connection and try again."); }
}
async function shareWith(fid, fname, femail){
  try{
    await setDoc(doc(fs,'users/'+uid), {family:{[fid]:String(fname||'')}, familyEmails:{[fid]:String(femail||'')}}, {merge:true});
    await setDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid), {name:me, email:myEmail, at:Date.now()});
    renderFamily((fname||'They')+' can now see and edit your list.', true);
  }catch(e){ renderFamily("Couldn't share your list. Please try again."); }
}
async function removeMember(fid, fname){
  try{
    await setDoc(doc(fs,'users/'+uid), {family:{[fid]:deleteField()}, familyEmails:{[fid]:deleteField()}}, {merge:true});
    await deleteDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid));
    renderFamily((fname||'They')+' no longer has access to your list.', true);
  }catch(e){ renderFamily("Couldn't remove them. Please try again."); }
}

// ---- boot ----
renderCatPick(); render();
(async ()=>{
  if (firebaseConfig.apiKey === 'PASTE_HERE'){
    setStatus('Setup not finished: paste your Firebase config at the top of index.html.', true);
    $('summary').textContent='Not syncing'; return;
  }
  if (location.hash) window.history.replaceState(null,'',location.pathname);
  const app = initializeApp(firebaseConfig);
  fs = initializeFirestore(app, { localCache: persistentLocalCache() });
  const auth = getAuth(app); window._auth = auth;
  let started = false;

  onAuthStateChanged(auth, async user=>{
    if (user && user.isAnonymous){ signOut(auth); return; }
    if (!user){ if(!started) showLanding(false); return; }
    if (started) return; started = true;
    $('auth').classList.add('hidden');
    uid = user.uid; myEmail = (user.email||'').toLowerCase();
    me = window._pendingName || user.displayName || myEmail.split('@')[0] || 'Me';
    names[me] = me;
    // make sure my profile + email lookup exist
    try{
      await setDoc(doc(fs,'users/'+uid), {name:me, email:myEmail}, {merge:true});
      if (myEmail) await setDoc(doc(fs,'emails/'+myEmail), {uid, name:me});
    }catch(e){}
    addToolbar();
    fsSnap(doc(fs,'users/'+uid), s=>{ const d=s.exists()?s.data():{}; myFamily=d.family||{}; familyEmails=d.familyEmails||{}; if(famOpen) renderFamily(); }, ()=>{});
    fsSnap(collection(fs,'users/'+uid+'/sharedWithMe'), s=>{
      sharedWithMe = s.docs.map(d=>({uid:d.id, name:String(d.data().name||'Family member'), email:String(d.data().email||'')}));
      renderSwitcher(); if(famOpen) renderFamily();
    }, ()=>{});
    const last = store('shopOwner');
    openList(last && last!==uid ? last : uid);
  });
})();
