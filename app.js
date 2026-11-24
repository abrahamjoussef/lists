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
import { t, lang, isAr, dateLocale, itemsCount, itemsAdded, setLang, applyStatic, normDigits, AR_KEYWORDS } from "./i18n.js?v=17";
applyStatic();
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
const catLabel = c => t('cat_'+c.id);
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
  // Arabic: match a word that starts with the keyword, with or without "ال"
  const words = w.split(/\s+/).map(x=>x.replace(/^(و|ب|ل)?ال/, ''));
  for (const [cat, list] of Object.entries(AR_KEYWORDS)){
    for (const k of list.split(' ')) if (k && words.some(x=>x.startsWith(k.replace(/^ال/,'')))) return cat;
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
  path = curBase+path;
  const prev = queues[path]||Promise.resolve();
  const p = prev.then(fn).catch(err=>{ handleWriteError(err); });
  queues[path]=p; return p;
}
function handleWriteError(err){
  const code = err && err.code;
  if (code==='permission-denied') setStatus(t('errPerm'), true);
  else setStatus(t('errSave'), true);
}
function setStatus(msg, warn){ const s=$('status'); s.textContent=msg||''; s.className='status'+(warn?' warn':''); }

// local fallback (no sync) so the page still works
function localOnly(){ return !db; }

// ---- permissions: can this person change the list they're looking at? ----
function myRoleOn(o){ if(!o || o===uid) return 'owner'; const p=sharedWithMe.find(x=>x.uid===o); return (p && p.role==='view') ? 'view' : 'edit'; }
function canEdit(){ return myRoleOn(owner)!=='view'; }
function viewOnly(){ setStatus(t('viewOnlyMsg'), true); }

async function addItem(raw){
  if(!canEdit()) return viewOnly();
  let text = normDigits(raw).trim(); if(!text) return;
  let desc = '';
  const dm = text.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dm){ text = dm[1].trim(); desc = dm[2].trim().slice(0,120); }
  let qty = 1;
  const m = text.match(/^(\d+)\s*[x×]?\s+(.+)$/i) || text.match(/^(.+?)\s+[x×]?\s*(\d+)$/i);
  if (m){ if (/^\d+$/.test(m[1])){ qty=+m[1]; text=m[2]; } else { text=m[1]; qty=+m[2]; } }
  text = text.charAt(0).toUpperCase()+text.slice(1);
  const existing = [...items.values()].find(i=>!i.done && i.name.toLowerCase()===text.toLowerCase());
  if (existing){
    if (desc && !existing.note){ items.set(existing.id,{...existing,note:desc}); if(!localOnly()) write('items/'+existing.id, ()=>db.doc('items/'+existing.id).update({note:desc})); }
    return changeQty(existing.id, existing.qty+qty);
  }
  const cat = pickedCat || guessCat(text);
  const data = {name:text, qty, cat, note:desc, done:false, addedBy:me||null, doneBy:null, createdAt:Date.now()};
  if (localOnly()){ const id='l'+Date.now(); items.set(id,{id,...data}); render(); return; }
  const ref = db.collection('items').doc();
  items.set(ref.id,{id:ref.id,...data}); render();
  write('items/'+ref.id, ()=>ref.set(data));
}
function toggle(id){
  if(!canEdit()) return viewOnly();
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
  if(!canEdit()) return;
  const today = dayKey(Date.now());
  const old = [...items.values()].filter(i=>i.done && i.doneAt && dayKey(i.doneAt)!==today);
  if (!old.length) return;
  remember(old);
  for (const it of old){ items.delete(it.id); write('items/'+it.id, ()=>db.doc('items/'+it.id).delete()); }
}
function changeQty(id, q){
  if(!canEdit()) return viewOnly();
  const it = items.get(id); if(!it) return;
  if (q<1) return removeItem(id);
  items.set(id,{...it,qty:q}); render();
  if (!localOnly()) write('items/'+id, ()=>db.doc('items/'+id).update({qty:q}));
}
function removeItem(id){
  if(!canEdit()) return viewOnly();
  const it = items.get(id); if(!it) return;
  remember([it]);
  items.delete(id); render();
  if (!localOnly()) write('items/'+id, ()=>db.doc('items/'+id).delete());
}
function remember(list){
  if(!canEdit()) return;
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
  if(!canEdit()) return viewOnly();
  const done = [...items.values()].filter(i=>i.done);
  if(!done.length) return;
  remember(done);
  for (const it of done){ items.delete(it.id); if(!localOnly()) write('items/'+it.id, ()=>db.doc('items/'+it.id).delete()); }
  render();
}

// ---- edit sheet ----
function openEdit(id){
  if(!canEdit()) return;
  const it = items.get(id); if(!it) return;
  editing=id; editCat=it.cat;
  $('eName').value=it.name; $('eNote').value=it.note||'';
  renderEditCats(); $('sheet').classList.remove('hidden');
}
function renderEditCats(){
  const box=$('eCats'); box.innerHTML='';
  for (const c of CATS){
    const b=document.createElement('button'); b.type='button';
    b.className='chip'+(c.id===editCat?' on':''); b.textContent=c.e+' '+catLabel(c);
    b.onclick=()=>{editCat=c.id; renderEditCats();};
    box.appendChild(b);
  }
}
function closeEdit(){ editing=null; $('sheet').classList.add('hidden'); }
$('eCancel').onclick=closeEdit;
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && listSheet) closeListSheet(); });
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
  if (id===me) return t('me');
  return n.split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase();
}
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function itemRow(it){
  const row = el('div','item'+(it.done?' done':''));
  const chk = el('button','check'); chk.innerHTML=CHECK_SVG; chk.setAttribute('aria-label', t(it.done?'uncheck':'check',{name:it.name}));
  const ro = !canEdit(); if (ro){ chk.disabled=true; row.classList.add('ro'); }
  chk.onclick=()=>toggle(it.id);
  const body = el('div','body');
  const nm = el('div','name'); nm.textContent = it.name;
  if (it.qty>1 && mode==='shop'){ nm.append(' '); nm.appendChild(el('span','badge','×'+it.qty)); }
  body.appendChild(nm);
  if (it.note) body.appendChild(el('div','desc',it.note));
  const meta = el('div','meta');
  if (mode==='plan' && it.addedBy && names[it.addedBy]) { const w=el('span','who',initials(it.addedBy)); w.title=t('addedBy',{name:names[it.addedBy]}); meta.appendChild(w); }
  if (it.done && it.doneBy && names[it.doneBy]) meta.appendChild(el('span',null,'✓ '+(it.doneBy===me?t('you'):names[it.doneBy].split(' ')[0])));
  if (meta.childNodes.length) body.appendChild(meta);
  if (!ro) body.onclick = ()=> mode==='shop' ? toggle(it.id) : openEdit(it.id);
  row.append(chk, body);
  if (mode==='plan' && !it.done && !ro){
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
  $('summary').textContent = all.length ? t('summary',{todo:todo.length, done:done.length}) : t('nothingYet');
  $('bar').style.width = all.length ? (done.length/all.length*100)+'%' : '0';
  $('mPlan').classList.toggle('on', mode==='plan');
  $('mShop').classList.toggle('on', mode==='shop');
  $('mHist').classList.toggle('on', mode==='trips');
  const ro = !canEdit();
  $('addbar').classList.toggle('hidden', mode!=='plan' || ro);
  document.body.style.paddingBottom = (mode!=='plan' || ro) ? 'calc(env(safe-area-inset-bottom) + 24px)' : '';

  const main = $('main'); main.innerHTML=''; main.className = mode==='shop'?'shop':'';
  if (ro){ const v=el('div','viewonly'); v.appendChild(el('b',null,t('viewOnlyTitle'))); v.appendChild(document.createTextNode(t('viewOnlyText',{list:ownerName(owner)}))); main.appendChild(v); }
  if (mode==='trips'){ renderHistory(main); return; }

  if (mode==='plan' && !ro){
    const inList = new Set(todo.map(i=>i.name.toLowerCase()));
    const quick = recent.filter(r=>!inList.has(r.name.toLowerCase())).slice(0,15);
    if (quick.length){
      main.appendChild(el('div','label',t('addAgain')));
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
    e.appendChild(document.createTextNode(ro ? t('emptyRo') : mode==='shop' ? t('emptyShop') : t('emptyPlan')));
    main.appendChild(e); return;
  }

  if (todo.length){
    for (const c of CATS){
      const list = todo.filter(i=>(CAT[i.cat]?i.cat:'other')===c.id).sort((a,b)=>a.name.localeCompare(b.name, lang));
      if (!list.length) continue;
      const g = el('div','group');
      const gh = el('div','gh', c.e+' '+catLabel(c)); gh.appendChild(el('span','n',String(list.length)));
      g.appendChild(gh);
      list.forEach(i=>g.appendChild(itemRow(i)));
      main.appendChild(g);
    }
  } else if (mode==='shop'){
    const e = el('div','empty'); e.innerHTML='<b>🎉</b>'; e.appendChild(document.createTextNode(t('allDone')));
    main.appendChild(e);
  }

  if (done.length){
    main.appendChild(el('div','label',t('inCart',{n:done.length})));
    const g = el('div','group');
    done.sort((a,b)=>a.name.localeCompare(b.name, lang)).forEach(i=>g.appendChild(itemRow(i)));
    main.appendChild(g);
    const clr = el('button','clear',t('clearChecked')); clr.onclick=clearDone;
    if (!ro) main.appendChild(clr);
  }
}

function fmtDate(ts){
  const d=new Date(ts), now=new Date();
  const day = d.toDateString()===now.toDateString() ? t('today')
    : d.toDateString()===new Date(now-864e5).toDateString() ? t('yesterday')
    : d.toLocaleDateString(dateLocale,{weekday:'short', day:'numeric', month:'short', year: d.getFullYear()===now.getFullYear()?undefined:'numeric'});
  return {day, time:d.toLocaleTimeString(dateLocale,{hour:'numeric', minute:'2-digit'})};
}
function readd(list){
  if(!canEdit()) return viewOnly();
  const keep=pickedCat; let n=0;
  for (const it of list){ pickedCat=it.cat; addItem((it.qty>1?it.qty+' ':'')+it.name+(it.note?' - '+it.note:'')); n++; }
  pickedCat=keep;
  setStatus(itemsAdded(n));
}
function renderHistory(main){
  if (!trips.some(t=>t.items.length)){
    const e = el('div','empty'); e.innerHTML='<b>🧾</b>';
    e.appendChild(document.createTextNode(t('noTrips')));
    main.appendChild(e); return;
  }
  // quick stats
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const thisMonth = trips.filter(x=>x.at>=monthStart.getTime()).length;
  const counts = {};
  for (const tr of trips) for (const i of tr.items) { const k=i.name.toLowerCase(); counts[k]=(counts[k]||{name:i.name,n:0}); counts[k].n++; }
  const top = Object.values(counts).sort((a,b)=>b.n-a.n)[0];
  const stats = el('div','stats');
  const st=(v,l)=>{ const d=el('div','stat'); d.appendChild(el('b',null,v)); d.appendChild(el('span',null,l)); return d; };
  stats.append(st(String(trips.filter(x=>x.items.length).length),t('statTrips')), st(String(thisMonth),t('statMonth')), st(top?top.name:'—',t('statTop')));
  main.appendChild(stats);

  for (const tr of trips.filter(x=>x.items.length).slice(0,60)){
    const {day,time} = fmtDate(tr.at);
    const card = document.createElement('details'); card.className='trip';
    const sum = document.createElement('summary');
    const dt = el('div','date'); dt.appendChild(el('b',null,day));
    const who = [...new Set(tr.items.map(i=>i.by).filter(Boolean))].map(n=>n===me?t('you'):n);
    dt.appendChild(el('span',null, time + (who.length ? t('by')+who.join(t('and')) : '')));
    sum.append(dt, el('span','count', itemsCount(tr.items.length)), el('span','chev','›'));
    card.appendChild(sum);
    const rows = el('div','rows');
    for (const i of tr.items){
      const r = el('div','hrow');
      r.appendChild(el('span',null,(CAT[i.cat]||CAT.other).e));
      const n = el('span','n', i.name + (i.qty>1?' ×'+i.qty:''));
      if (i.note){ n.appendChild(document.createElement('br')); n.appendChild(el('small',null,i.note)); }
      r.appendChild(n);
      if (canEdit()){ const b = el('button',null,t('addOne')); b.onclick=()=>readd([i]); r.appendChild(b); }
      rows.appendChild(r);
    }
    const again = el('button','again',t('addAll',{n:tr.items.length}));
    again.onclick=()=>{ readd(tr.items); mode='plan'; try{localStorage.setItem('shopMode',mode)}catch(e){} render(); };
    if (canEdit()) rows.appendChild(again);
    card.appendChild(rows);
    main.appendChild(card);
  }
}

function renderCatPick(){
  const box=$('catPick'); box.innerHTML='';
  const auto=el('button','chip'+(pickedCat===null?' on':''),t('auto'));
  auto.onclick=()=>{pickedCat=null; renderCatPick();}; box.appendChild(auto);
  for (const c of CATS){
    const b=el('button','chip'+(pickedCat===c.id?' on':''), c.e+' '+catLabel(c));
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
  $('aTitle').textContent = reg ? t('createAccount') : t('welcomeBack');
  $('aHint').textContent = reg ? t('takes30') : t('signInHint');
  $('nameWrap').classList.toggle('hidden', !reg);
  $('pass2Wrap').classList.toggle('hidden', !reg);
  $('aPass').autocomplete = reg ? 'new-password' : 'current-password';
  $('aGo').textContent = reg ? t('register') : t('signIn');
  $('aErr').textContent=''; $('aErr').className='err';
  const sw=$('aSwitch'); sw.innerHTML='';
  sw.append(reg ? t('alreadyReg') : t('newHere'));
  const b=el('button','linkbtn', reg ? t('signIn') : t('createAnAccount')); b.type='button';
  b.onclick=()=>setAuthMode(reg?'signin':'register'); sw.appendChild(b);
  if(!reg){
    sw.appendChild(document.createElement('br'));
    const f=el('button','linkbtn',t('forgot')); f.type='button'; f.style.marginTop='8px';
    f.onclick=async()=>{
      const email=$('aEmail').value.trim();
      if(!email){ $('aErr').textContent=t('typeEmailFirst'); return; }
      try{ await sendPasswordResetEmail(window._auth, email); $('aErr').className='ok'; $('aErr').textContent=t('resetSent'); }
      catch(e){ $('aErr').className='err'; $('aErr').textContent=authMsg(e); }
    };
    sw.appendChild(f);
  }
}
function authMsg(e){
  const c=(e&&e.code)||'';
  if(c.includes('email-already-in-use')) return t('errInUse');
  if(c.includes('invalid-email')) return t('errEmail');
  if(c.includes('weak-password')) return t('errWeak');
  if(c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')) return t('errCred');
  if(c.includes('too-many-requests')) return t('errMany');
  if(c.includes('network')) return t('errNet');
  if(c.includes('operation-not-allowed')) return t('errDisabled');
  return t('errGeneric');
}
function showLanding(invited){
  $('inviteNote').classList.toggle('hidden', !invited);
  setAuthMode(store('shopRegistered') ? 'signin' : 'register');
  $('auth').classList.remove('hidden');
}
$('landLang').onclick=()=>setLang(isAr?'en':'ar');
function syncSiteLang(){ try{ localStorage.setItem('siteLang', isAr?'ar':'en'); }catch(e){} }
$('heroSite').onclick=syncSiteLang;
$('heroCta').onclick=e=>{ e.preventDefault(); $('authForm').scrollIntoView({behavior:'smooth', block:'start'}); setTimeout(()=>{ const f=$('nameWrap').classList.contains('hidden')?$('aEmail'):$('aName'); try{ f.focus({preventScroll:true}); }catch(_){} },450); };
$('authForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const auth=window._auth, name=$('aName').value.trim(), email=$('aEmail').value.trim(), pass=$('aPass').value;
  $('aErr').className='err'; $('aErr').textContent='';
  if(authMode==='register' && !name){ $('aErr').textContent=t('enterName'); $('aName').focus(); return; }
  if(authMode==='register' && (name.match(/\p{L}/gu)||[]).length<3){ $('aErr').textContent=t('nameShort'); $('aName').focus(); return; }
  if(!email || !pass){ $('aErr').textContent=t('enterEmailPass'); return; }
  if(authMode==='register' && pass!==$('aPass2').value){ $('aErr').textContent=t($('aPass2').value?'passMismatch':'confirmPassNeeded'); $('aPass2').focus(); return; }
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
let fs=null, uid=null, myEmail='', owner=null, unsubs=[], sharedWithMe=[], myFamily={}, familyEmails={}, familyRoles={};
// several lists per person: 'main' lives at ulists/{owner}/, the rest at ulists/{owner}/lists/{id}/
let listId='main', lists=[], tripIds=[], curBase='', listsLoaded=false, mainInfo={name:'', emoji:'🛒', description:'', createdAt:0}, mainDateFixed=false;
const pendingLists = new Set();
const listBase = (o, l) => 'ulists/'+o+'/' + (l && l!=='main' ? 'lists/'+l+'/' : '');
const mainCustom = () => !!(mainInfo.name || mainInfo.emoji!=='🛒');
const mainEntry = () => ({id:'main', name:mainInfo.name||t('mainList'), emoji:mainInfo.emoji||'🛒', description:mainInfo.description||'', createdAt:mainInfo.createdAt||0});
const fmtCreated = ts => ts ? t('createdOn',{date:new Date(ts).toLocaleDateString(dateLocale,{day:'numeric', month:'long', year:'numeric'})}) : '';
const curList = () => listId==='main' ? (mainCustom() ? mainEntry() : null) : (lists.find(l=>l.id===listId) || null);
function ownerName(o){ if(o===uid) return t('myList'); const p=sharedWithMe.find(x=>x.uid===o); return p ? t('listOf',{name:p.name}) : t('list'); }
function renderSwitcher(){
  const box=$('switcher'); if(!box) return; box.innerHTML='';
  const all=[{uid, name:me}, ...sharedWithMe.map(p=>({uid:p.uid, name:p.name}))];
  for (const p of all){
    const on = p.uid===owner, mine = p.uid===uid;
    const b=el('button','person'+(on?' on':'')); b.type='button'; b.dataset.uid=p.uid;
    b.setAttribute('aria-pressed', on?'true':'false');
    const av=el('span','av',initialsOf(p.name)); av.style.background=avatarColor(p.uid); av.setAttribute('aria-hidden','true');
    b.append(av, el('span','pn', mine ? t('me') : p.name));
    if (!mine && myRoleOn(p.uid)==='view') b.appendChild(el('span','tag',t('viewOnly')));
    b.onclick=()=>{ if(!on) openList(p.uid); };
    box.appendChild(b);
  }
  box.appendChild(el('span','grow'));
  const fam=el('button','person fam'); fam.type='button'; fam.id='famBtn'; fam.setAttribute('aria-haspopup','dialog'); fam.setAttribute('aria-label', t('familyBtn'));
  const ic=el('span','av'); ic.innerHTML=ICON.people; fam.append(ic, el('span','pn',t('familyBtn')));
  const n=famPeople().length; if(n) fam.appendChild(el('span','count',String(n)));
  fam.onclick=openFamily; box.appendChild(fam);
  updateTitle();
}
function updateTitle(){
  const op = sharedWithMe.find(x=>x.uid===owner);
  const l = curList();
  if (l) $('title').textContent = l.emoji + ' ' + (owner===uid || !op ? l.name : t('shoppingListName',{list:l.name, name:op.name}));
  else $('title').textContent = '🛒 ' + (owner===uid || !op ? t('myShoppingList') : t('shoppingListOf',{name:op.name}));
}
function renderListDesc(){
  const d=$('listDesc'); if(!d) return;
  const l = listId==='main' ? mainEntry() : lists.find(x=>x.id===listId);
  const txt = l && l.description ? l.description : '', when = l ? fmtCreated(l.createdAt) : '';
  d.innerHTML='';
  if (txt) d.appendChild(el('div','ld-text',txt));
  if (when) d.appendChild(el('div','ld-date',when));
  d.classList.toggle('hidden', !txt && !when);
}
function renderLists(){
  renderListDesc();
  const box=$('listbar'); if(!box) return; box.innerHTML='';
  const ed = canEdit();
  if (!lists.length && !ed && !mainCustom()){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const all = [mainEntry(), ...lists];
  for (const l of all){
    const on = l.id===listId;
    const b=el('button','ltab'+(on?' on':'')); b.type='button'; b.dataset.list=l.id;
    b.setAttribute('aria-current', on?'true':'false');
    b.append(el('span','em',l.emoji), el('span','ln',l.name));
    if (l.createdAt) b.title = fmtCreated(l.createdAt);
    b.onclick=()=>{ if(!on) openList(owner, l.id); else if(ed) openListSheet(l); };
    box.appendChild(b);
    if (on && ed){
      const e=document.createElement('button'); e.type='button'; e.className='ltab-edit'; e.id='editListBtn';
      e.setAttribute('aria-label', t('editListAria',{name:l.name})); e.innerHTML=ICON.pencil;
      e.onclick=()=>openListSheet(l); box.appendChild(e);
    }
  }
  if (ed){ const n=el('button','ltab new',t('newList')); n.type='button'; n.id='newListBtn'; n.onclick=()=>openListSheet(null); box.appendChild(n); }
  const act = box.querySelector('.ltab.on'); if (act && act.scrollIntoView) try{ act.scrollIntoView({block:'nearest', inline:'nearest'}); }catch(e){}
}

// ---- create / rename / delete a list ----
const LIST_ICONS = ['🛒','🎉','💊','🏠','🍖','🧺','🎁','🌙','🏖️','👶','🧹','📦'];
let listSheet=null;
function closeListSheet(){ listSheet=null; const s=$('listSheet'); if(s) s.remove(); }
function openListSheet(l){
  if(!canEdit()) return viewOnly();
  listSheet={edit:l, name:l?l.name:'', emoji:l?l.emoji:'🛒', desc:l?(l.description||''):'', confirm:false, err:''};
  renderListSheet();
  setTimeout(()=>{ const i=$('lName'); if(i && !l) i.focus(); },150);
}
function renderListSheet(){
  if(!listSheet) return;
  const S=listSheet;
  let wrap=$('listSheet');
  if (wrap){ const i=$('lName'); if(i) S.name=i.value; const d=$('lDesc'); if(d) S.desc=d.value; }
  else { wrap=el('div','sheet list-sheet'); wrap.id='listSheet'; wrap.onclick=e=>{ if(e.target===wrap) closeListSheet(); }; document.body.appendChild(wrap); }
  wrap.innerHTML='';
  const box=el('div','box'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  box.appendChild(el('h3',null,S.edit?t('editListTitle'):t('newListTitle')));
  if(!S.edit) box.appendChild(el('p','sub',t('newListSub')));
  else if(S.edit.id==='main') box.appendChild(el('p','sub',t('editMainHint')));
  if(S.edit && S.edit.createdAt) box.appendChild(el('p','sub created-on','📅 '+fmtCreated(S.edit.createdAt)));
  const lb=el('label',null,t('listName')); lb.htmlFor='lName'; box.appendChild(lb);
  const inp=document.createElement('input'); inp.id='lName'; inp.maxLength=40; inp.value=S.name; inp.placeholder=t('listNamePh'); inp.autocomplete='off'; inp.enterKeyHint='done';
  inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); saveList(); } };
  box.appendChild(inp);
  const dl=el('label',null,t('listDesc')); dl.htmlFor='lDesc'; box.appendChild(dl);
  const ta=document.createElement('textarea'); ta.id='lDesc'; ta.maxLength=120; ta.rows=2; ta.value=S.desc||''; ta.placeholder=t('listDescPh');
  box.appendChild(ta);
  box.appendChild(el('label',null,t('listIcon')));
  const icons=el('div','chips icon-pick');
  for (const ic of LIST_ICONS){ const b=el('button','chip'+(ic===S.emoji?' on':''),ic); b.type='button'; b.onclick=()=>{ S.emoji=ic; renderListSheet(); }; icons.appendChild(b); }
  box.appendChild(icons);
  if (S.err) box.appendChild(el('div','lerr',S.err));
  if (S.confirm){
    const c=el('div','confirm list-confirm'); c.appendChild(el('div',null,t('confirmDeleteList',{name:S.edit.name})));
    const r=el('div','row2');
    const no=el('button','btn',t('cancel')); no.type='button'; no.onclick=()=>{ S.confirm=false; renderListSheet(); };
    const yes=el('button','btn btn-danger-solid',t('deleteList')); yes.type='button'; yes.id='lDelYes'; yes.onclick=()=>deleteList(S.edit);
    r.append(no,yes); c.appendChild(r); box.appendChild(c);
  } else {
    const row=el('div','row');
    if (S.edit && S.edit.id!=='main' && myRoleOn(owner)==='owner'){ const d=el('button','danger',t('delete')); d.type='button'; d.id='lDel'; d.onclick=()=>{ S.name=$('lName').value; S.confirm=true; renderListSheet(); }; row.appendChild(d); }
    const c=el('button',null,t('cancel')); c.type='button'; c.onclick=closeListSheet;
    const ok=el('button','primary',S.edit?t('save'):t('create')); ok.type='button'; ok.id='lSave'; ok.onclick=saveList;
    row.append(c,ok); box.appendChild(row);
  }
  wrap.appendChild(box);
}
function saveList(){
  const S=listSheet; if(!S) return;
  const name=($('lName').value||'').trim().slice(0,40);
  const description=(($('lDesc')||{}).value||'').trim().slice(0,120);
  if(!name){ S.err=t('enterListName'); return renderListSheet(); }
  const o=owner;
  if (S.edit && S.edit.id==='main'){
    const stored = (name===t('mainList') || name===mainEntry().name && !mainInfo.name) ? '' : name;
    mainInfo={name:stored, emoji:S.emoji, description};
    setDoc(doc(fs,'ulists/'+o+'/lists/main'), {name:stored, emoji:S.emoji, description, main:true}, {merge:true}).catch(handleWriteError);
    closeListSheet(); renderLists(); updateTitle(); return;
  }
  if (S.edit){
    const id=S.edit.id;
    lists=lists.map(l=>l.id===id?{...l,name,emoji:S.emoji,description}:l);
    setDoc(doc(fs,'ulists/'+o+'/lists/'+id), {name, emoji:S.emoji, description}, {merge:true}).catch(handleWriteError);
    closeListSheet(); renderLists(); updateTitle(); return;
  }
  const ref=doc(collection(fs,'ulists/'+o+'/lists'));
  const data={name, emoji:S.emoji, description, createdAt:Date.now(), createdBy:me||null};
  pendingLists.add(ref.id);
  setDoc(ref, data).catch(err=>{ pendingLists.delete(ref.id); handleWriteError(err); });
  lists=[...lists,{id:ref.id,...data}];
  closeListSheet();
  mode='plan'; try{localStorage.setItem('shopMode',mode)}catch(e){}
  openList(o, ref.id);
  setStatus(t('listCreated',{name}));
}
function deleteList(l){
  if (myRoleOn(owner)!=='owner' || !l || l.id==='main') return;
  const o=owner, base=listBase(o,l.id);
  const itemIds=[...items.keys()], tids=tripIds.slice();
  closeListSheet();
  lists=lists.filter(x=>x.id!==l.id);
  openList(o,'main');
  setStatus(t('listDeleted'));
  (async()=>{
    try{
      await deleteDoc(doc(fs,'ulists/'+o+'/lists/'+l.id));
      for (const id of itemIds) await deleteDoc(doc(fs, base+'items/'+id));
      for (const id of tids) await deleteDoc(doc(fs, base+'trips/'+id));
      await deleteDoc(doc(fs, base+'meta/recent'));
    }catch(e){ handleWriteError(e); }
  })();
}
function addToolbar(){
  const sw=el('div','switcher'); sw.id='switcher';
  const bar=el('div','toolbar');
  const out=el('button','chip',t('signOut'));
  out.onclick=async()=>{ try{ await signOut(window._auth); }catch(e){} try{localStorage.removeItem('shopOwner')}catch(e){} location.reload(); };
  const lg=el('button','chip lang-chip',t('langSwitch')); lg.onclick=()=>setLang(isAr?'en':'ar');
  const site=el('a','chip site-chip',t('aboutApp')); site.href='about/'; site.target='_blank'; site.rel='noopener'; site.onclick=syncSiteLang;
  bar.append(out, lg, site, el('span','who-am-i',t('hi',{name:me})));
  sw.setAttribute('aria-label', t('peopleNav'));
  const lb=el('div','listbar'); lb.id='listbar'; lb.setAttribute('aria-label', t('listsNav'));
  const ld=el('div','list-desc hidden'); ld.id='listDesc';
  const nav=el('nav','navcard'); nav.append(sw, lb, ld);
  $('status').before(nav); $('status').before(bar);
}
function openList(o, lid){
  unsubs.forEach(f=>{ try{f()}catch(e){} }); unsubs=[];
  if (o!==owner){ lists=[]; listsLoaded=false; mainInfo={name:'', emoji:'🛒', description:'', createdAt:0}; }
  owner=o; store('shopOwner', o);
  listId = lid || store('shopList:'+o) || 'main';
  if (listId!=='main' && listsLoaded && !lists.some(l=>l.id===listId)) listId='main';
  store('shopList:'+o, listId);
  items=new Map(); trips=[]; tripIds=[]; recent=[]; setStatus('');
  curBase = listBase(o, listId);
  db = mkDb(fs, curBase);
  renderSwitcher(); renderLists(); render();
  unsubs.push(fsSnap(collection(fs,'ulists/'+o+'/lists'), snap=>{
    if (o!==owner) return;
    const md = snap.docs.find(d=>d.id==='main'); const mv = md ? (md.data()||{}) : {};
    mainInfo = {name:String(mv.name||'').slice(0,40), emoji:LIST_ICONS.includes(mv.emoji)?mv.emoji:'🛒', description:String(mv.description||'').slice(0,120), createdAt:+mv.createdAt||0};
    // the main list existed before dates were recorded: date it from when the account was created
    if (!mainInfo.createdAt && o===uid && !mainDateFixed && (!snap.metadata || !snap.metadata.fromCache)){
      mainDateFixed=true;
      const cu=window._auth && window._auth.currentUser, ts=(cu && Date.parse(cu.metadata && cu.metadata.creationTime)) || Date.now();
      mainInfo.createdAt=ts;
      setDoc(doc(fs,'ulists/'+o+'/lists/main'), {createdAt:ts, main:true}, {merge:true}).catch(()=>{});
    }
    lists = snap.docs.filter(d=>d.id!=='main').map(d=>{ const v=d.data()||{}; return {id:d.id, name:String(v.name||t('list')).slice(0,40), emoji:LIST_ICONS.includes(v.emoji)?v.emoji:'🛒', description:String(v.description||'').slice(0,120), createdAt:+v.createdAt||0}; })
      .sort((a,b)=>a.createdAt-b.createdAt || a.name.localeCompare(b.name, lang));
    for (const l of lists) pendingLists.delete(l.id);
    if (!snap.metadata || !snap.metadata.fromCache) listsLoaded=true;
    if (listId!=='main' && listsLoaded && !lists.some(l=>l.id===listId) && !pendingLists.has(listId)){
      closeListSheet(); openList(o,'main'); setStatus(t('listGone'), true); return;
    }
    renderLists(); updateTitle();
  }, ()=>{}));
  const curListAt = listId;
  let reachWarn=false;
  let timer = setTimeout(()=>{ reachWarn=true; setStatus(t('cantReach'), true); }, 10000);
  unsubs.push(db.collection('items').onSnapshot(snap=>{
    if (o!==owner || listId!==curListAt) return;
    if (!snap.metadata.fromCache){ clearTimeout(timer); if(reachWarn){ reachWarn=false; setStatus(''); } }
    items = new Map(snap.docs.map(d=>{ const v=d.data()||{}; return [d.id, {id:d.id, name:String(v.name||'Item'), qty:Math.max(1,+v.qty||1), cat:CAT[v.cat]?v.cat:'other', note:String(v.note||''), done:!!v.done, addedBy:v.addedBy?String(v.addedBy):null, doneBy:v.doneBy?String(v.doneBy):null, doneAt:+v.doneAt||null, createdAt:+v.createdAt||0}]; }));
    if (!snap.metadata.fromCache) autoClearOld();
    for (const it of items.values()){ if(it.addedBy) names[it.addedBy]=it.addedBy; if(it.doneBy) names[it.doneBy]=it.doneBy; }
    if (!editing) render();
  }, err=>{ clearTimeout(timer);
    if (err.code==='permission-denied'){ setStatus(t('noAccess'), true); if(o!==uid) setTimeout(()=>openList(uid), 1500); }
    else setStatus(t('liveStopped'), true); }));
  const myList=listId;
  unsubs.push(db.collection('trips').onSnapshot(snap=>{
    if (o!==owner || myList!==listId) return;
    tripIds = snap.docs.map(d=>d.id);
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
    if (o!==owner || myList!==listId) return;
    const v = snap.exists ? snap.data() : null;
    recent = (v && Array.isArray(v.items)) ? v.items.filter(r=>r && r.name).map(r=>({name:String(r.name), cat:CAT[r.cat]?r.cat:'other'})).slice(0,30) : [];
    if (!editing) render();
  }, ()=>{}));
}

// ---- family page ----
let famOpen=false, famMsg='', famOk=false, famBusy=false, famConfirm=null, famInviteRole='edit';
const ICON = {
  close:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  mail:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  ok:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 10"/></svg>',
  err:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>',
  check:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  eye:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  pencil:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  people:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.3c2.4.1 4.3 1.8 4.8 4.7"/></svg>'
};
function iconEl(name){ const s=document.createElement('span'); s.style.display='inline-flex'; s.innerHTML=ICON[name]; return s; }
function avatarColor(seed){ let h=0; for(const ch of String(seed)) h=(h*31+ch.charCodeAt(0))>>>0; return `hsl(${h%360} 45% 42%)`; }
function initialsOf(name){ return String(name||'?').trim().split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase() || '?'; }
function famPeople(){
  const map=new Map();
  for (const [fid,fname] of Object.entries(myFamily)) map.set(fid,{uid:fid, name:String(fname||t('familyMember')), email:String(familyEmails[fid]||''), canEditMine:true, role:familyRoles[fid]==='view'?'view':'edit', sharedWithMe:false});
  for (const p of sharedWithMe){ const x=map.get(p.uid)||{uid:p.uid, name:p.name, email:'', canEditMine:false}; x.name=p.name||x.name; x.email=p.email||x.email; x.sharedWithMe=true; map.set(p.uid,x); }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name, lang));
}
function closeFamily(){ famOpen=false; famMsg=''; famConfirm=null; const s=$('famSheet'); if(s) s.remove(); document.body.style.overflow=''; document.removeEventListener('keydown', famKeys); }
function famKeys(e){ if(e.key==='Escape') closeFamily(); }
function openFamily(){ famOpen=true; famMsg=''; famConfirm=null; famInviteRole='edit'; document.body.style.overflow='hidden'; document.addEventListener('keydown', famKeys); renderFamily(); setTimeout(()=>{ const i=$('famEmail'); if(i && window.innerWidth>600) i.focus(); },250); }
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
  const h=el('h3',null,t('famTitle')); h.id='famTitle'; ttl.append(h, el('p',null,t('famSub')));
  const x=document.createElement('button'); x.className='icon-btn'; x.type='button'; x.setAttribute('aria-label',t('close')); x.innerHTML=ICON.close; x.onclick=closeFamily;
  head.append(ttl,x); panel.appendChild(head);

  const body=el('div','fam-body');

  // invite card
  const card=el('section','fam-card');
  card.appendChild(el('h4',null,t('inviteTitle')));
  card.appendChild(el('p','lead',t('inviteLead')));
  const roles=el('div','role-pick'); roles.setAttribute('role','radiogroup'); roles.setAttribute('aria-label',t('access'));
  for (const [val,title,desc] of [['edit',t('canEdit'),t('canEditDesc')],['view',t('viewOnly'),t('viewOnlyDesc')]]){
    const opt=document.createElement('button'); opt.type='button'; opt.className='role-opt'+(famInviteRole===val?' on':''); opt.dataset.role=val;
    opt.setAttribute('role','radio'); opt.setAttribute('aria-checked', famInviteRole===val?'true':'false');
    const dot=el('span','dot'); const txt=el('span','txt'); txt.appendChild(el('b',null,title)); txt.appendChild(el('small',null,desc));
    opt.append(dot,txt); opt.onclick=()=>{ famInviteRole=val; renderFamily(); };
    roles.appendChild(opt);
  }
  card.appendChild(roles);
  const form=document.createElement('form'); form.className='fam-invite'; form.noValidate=true;
  const field=el('label','fam-field'); field.appendChild(iconEl('mail'));
  const inp=document.createElement('input'); inp.id='famEmail'; inp.type='email'; inp.placeholder='name@example.com'; inp.value=keepEmail; inp.autocomplete='off'; inp.inputMode='email'; inp.setAttribute('aria-label',t('memberEmail'));
  field.appendChild(inp);
  const add=document.createElement('button'); add.type='submit'; add.className='btn btn-primary'; add.id='famAddBtn'; add.disabled=famBusy;
  if(famBusy){ add.appendChild(el('span','spin')); add.setAttribute('aria-label',t('adding')); } else add.textContent=t('add');
  form.append(field, add);
  form.onsubmit=e=>{ e.preventDefault(); if(!famBusy) addMember(inp.value); };
  card.appendChild(form);
  if(famMsg){ const a=el('div','fam-alert '+(famOk?'ok':'err')); a.setAttribute('role','status'); a.appendChild(iconEl(famOk?'ok':'err')); a.appendChild(el('span','msg',famMsg)); card.appendChild(a); }
  body.appendChild(card);

  // members
  const people=famPeople();
  const sec=el('section');
  const sh=el('div','fam-sec-head'); sh.appendChild(el('h4',null,t('members'))); if(people.length) sh.appendChild(el('span','num',String(people.length)));
  sec.appendChild(sh);
  if(!people.length){
    const e=el('div','members fam-empty'); const ic=el('div','ic'); ic.innerHTML=ICON.people; e.appendChild(ic);
    e.appendChild(el('b',null,t('noMembers'))); e.appendChild(document.createTextNode(t('noMembersHint')));
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
      const b1=el('span','badge2'+(p.canEditMine?' on':'')+(p.canEditMine&&p.role==='view'?' view':'')); if(p.canEditMine) b1.appendChild(iconEl(p.role==='view'?'eye':'check')); b1.append(!p.canEditMine?t('bNoAccess'):p.role==='view'?t('bCanView'):t('bCanEdit'));
      const b2=el('span','badge2'+(p.sharedWithMe?' on':'')); if(p.sharedWithMe) b2.appendChild(iconEl('check')); b2.append(p.sharedWithMe?t('bShared'):t('bNotShared'));
      bd.append(b1,b2); m.appendChild(bd);

      if(famConfirm===p.uid){
        const c=el('div','confirm');
        c.appendChild(el('div',null,t('confirmRemove',{name:p.name})));
        const r=el('div','row2');
        const cancel=el('button','btn',t('cancel')); cancel.type='button'; cancel.onclick=()=>{ famConfirm=null; renderFamily(); };
        const yes=el('button','btn btn-danger-solid',t('remove')); yes.type='button'; yes.onclick=()=>{ famConfirm=null; removeMember(p.uid,p.name); };
        r.append(cancel,yes); c.appendChild(r); m.appendChild(c);
      } else {
        const acts=el('div','acts');
        if(p.sharedWithMe){ const o=el('button','btn btn-soft',t('openTheirList')); o.type='button'; o.onclick=()=>{ closeFamily(); openList(p.uid); }; acts.appendChild(o); }
        if(!p.canEditMine){ const s=el('button','btn',t('shareMyList')); s.type='button'; s.onclick=()=>shareWith(p.uid,p.name,p.email,famInviteRole); acts.appendChild(s); }
        if(p.canEditMine){ const to=p.role==='view'?'edit':'view'; const ch=el('button','btn', to==='view'?t('makeViewOnly'):t('allowEditing')); ch.type='button'; ch.onclick=()=>setRole(p.uid,p.name,to); acts.appendChild(ch); }
        acts.appendChild(el('span','sp'));
        if(p.canEditMine){ const rm=el('button','btn btn-danger',t('remove')); rm.type='button'; rm.onclick=()=>{ famConfirm=p.uid; renderFamily(); }; acts.appendChild(rm); }
        m.appendChild(acts);
      }
      list.appendChild(m);
    }
    sec.appendChild(list);
  }
  body.appendChild(sec);
  body.appendChild(el('p','fam-note',t('famNote')));
  panel.appendChild(body);
  wrap.appendChild(panel);
  body.scrollTop=scroll;
}
async function addMember(email){
  email=(email||'').trim().toLowerCase();
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return renderFamily(t('errEmail'));
  if(email===myEmail) return renderFamily(t('fOwn'));
  const known=famPeople().find(p=>p.canEditMine && p.email===email);
  if(known) return renderFamily(t('fAlready',{name:known.name}), true);
  famBusy=true; renderFamily('');
  try{
    const snap=await getDoc(doc(fs,'emails/'+email));
    if(!snap.exists()){ famBusy=false; return renderFamily(t('fNoAccount')); }
    const p=snap.data();
    if(myFamily[p.uid]){ famBusy=false; return renderFamily(t('fAlready',{name:p.name||t('they')}), true); }
    famBusy=false;
    await shareWith(p.uid, p.name, email, famInviteRole);
    const i=$('famEmail'); if(i) i.value='';
  }catch(e){ famBusy=false; renderFamily(t('fAddFail')); }
}
async function shareWith(fid, fname, femail, role){
  role = role==='view' ? 'view' : 'edit';
  try{
    await setDoc(doc(fs,'users/'+uid), {family:{[fid]:String(fname||'')}, familyEmails:{[fid]:String(femail||'')}, familyRoles:{[fid]:role}}, {merge:true});
    await setDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid), {name:me, email:myEmail, at:Date.now(), role});
    renderFamily(t(role==='view'?'fSharedView':'fSharedEdit',{name:fname||t('they')}), true);
  }catch(e){ renderFamily(t('fShareFail')); }
}
async function setRole(fid, fname, role){
  try{
    await setDoc(doc(fs,'users/'+uid), {familyRoles:{[fid]:role}}, {merge:true});
    await setDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid), {role}, {merge:true});
    renderFamily(t(role==='view'?'fRoleView':'fRoleEdit',{name:fname||t('they')}), true);
  }catch(e){ renderFamily(t('fRoleFail')); }
}
async function removeMember(fid, fname){
  try{
    await setDoc(doc(fs,'users/'+uid), {family:{[fid]:deleteField()}, familyEmails:{[fid]:deleteField()}, familyRoles:{[fid]:deleteField()}}, {merge:true});
    await deleteDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid));
    renderFamily(t('fRemoved',{name:fname||t('they')}), true);
  }catch(e){ renderFamily(t('fRemoveFail')); }
}

// ---- boot ----
renderCatPick(); render();
(async ()=>{
  if (firebaseConfig.apiKey === 'PASTE_HERE'){
    setStatus(t('setupNotFinished'), true);
    $('summary').textContent=t('notSyncing'); return;
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
    fsSnap(doc(fs,'users/'+uid), s=>{ const d=s.exists()?s.data():{}; myFamily=d.family||{}; familyEmails=d.familyEmails||{}; familyRoles=d.familyRoles||{}; renderSwitcher(); if(famOpen) renderFamily(); }, ()=>{});
    fsSnap(collection(fs,'users/'+uid+'/sharedWithMe'), s=>{
      sharedWithMe = s.docs.map(d=>({uid:d.id, name:String(d.data().name||t('familyMember')), email:String(d.data().email||''), role:d.data().role==='view'?'view':'edit'}));
      renderSwitcher(); renderLists(); if(famOpen) renderFamily(); if(owner && owner!==uid && !editing) render();
    }, ()=>{});
    const last = store('shopOwner');
    openList(last && last!==uid ? last : uid);
  });
})();
