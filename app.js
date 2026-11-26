// Shared Lists app logic
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
import { initializeFirestore, persistentLocalCache, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot as fsSnap } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { t, lang, isAr, dateLocale, itemsCount, itemsAdded, setLang, applyStatic } from "./i18n.js?v=28";
import { TYPES, TYPE_IDS, TYPE_TEXT, SHOP_SUG } from "./types.js?v=28";
import { CATS, parseItemText, findOpenDuplicate, guessCat as guessCatFor, groupBySection, byName, sortLists, sortMyLists, sortTrips, mergeRecent, roleOn, roleCanEdit, sharesWithMe, isEmail, listBase, dayKey, normQ, matches } from "./logic.js?v=28";
applyStatic();
const CAT = Object.fromEntries(CATS.map(c=>[c.id,c]));
// ---- list types: each type has its own sections and suggestions ----
const tl = (key, vars) => { const s=(TYPE_TEXT[lang]||TYPE_TEXT.en)[key] ?? TYPE_TEXT.en[key]; return s==null ? t(key,vars) : (vars ? s.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'') : s); };
// a word that depends on the type: summary_todo, tabTick_packing… falling back to the shopping wording
const tw = (key, vars) => { const ty=curType(); if (ty!=='shopping'){ const k=key+'_'+ty; if ((TYPE_TEXT.en)[k]!=null) return tl(k,vars); } return t(key,vars); };
const curType = () => { const l=allLists().find(x=>x.id===listId); return l && TYPES[l.type] ? l.type : 'shopping'; };
const curCats = () => curType()==='shopping' ? CATS : TYPES[curType()].cats;
const catOf = id => curCats().find(c=>c.id===id) || curCats().find(c=>c.id==='other');
const catLabel = c => curType()==='shopping' ? t('cat_'+c.id) : (curType()==='general' ? tl('cat_general_other') : (c.id==='other' ? t('cat_other') : tl('cat_'+c.id)));
const typeSuggestions = () => { const ty=curType(); const src = ty==='shopping' ? SHOP_SUG : (TYPES[ty].sug||{}); return src[lang] || src.en || []; };
const guessCat = name => guessCatFor(name, curType());

// ---- state ----
let db=null, user=null, me=null, items=new Map(), recent=[], mode='plan', pickedCat=null, offline=false;
const names = {}; // id -> display name
let editing=null, editCat=null, trips=[];
const $ = id=>document.getElementById(id);

try{ mode = localStorage.getItem('listsMode')||'plan'; if (mode==='shop') mode='tick'; }catch(e){}

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
// access is per list: the owner decides, list by list, who can view or edit it
function myRoleOn(o, lid){ return roleOn(sharedWithMe, uid, o, lid===undefined?listId:lid); }
function canEdit(){ return roleCanEdit(myRoleOn(owner)); }
function viewOnly(){ setStatus(t('viewOnlyMsg'), true); }

async function addItem(raw){
  if (!hasList()) return;
  if(!canEdit()) return viewOnly();
  const parsed = parseItemText(raw); if(!parsed) return;
  const text = parsed.name, qty = parsed.qty, desc = parsed.note;
  const existing = findOpenDuplicate(items.values(), text);
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
  const changed = list.length>0;
  recent = mergeRecent(recent, list);
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
  for (const c of curCats()){
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
  if (it.qty>1 && mode==='tick'){ nm.append(' '); nm.appendChild(el('span','badge','×'+it.qty)); }
  body.appendChild(nm);
  if (it.note) body.appendChild(el('div','desc',it.note));
  const meta = el('div','meta');
  if (mode==='plan' && it.addedBy && names[it.addedBy]) { const w=el('span','who',initials(it.addedBy)); w.title=t('addedBy',{name:names[it.addedBy]}); meta.appendChild(w); }
  if (it.done && it.doneBy && names[it.doneBy]) meta.appendChild(el('span',null,'✓ '+(it.doneBy===me?t('you'):names[it.doneBy].split(' ')[0])));
  if (meta.childNodes.length) body.appendChild(meta);
  if (!ro) body.onclick = ()=> mode==='tick' ? toggle(it.id) : openEdit(it.id);
  row.append(chk, body);
  if (mode==='plan' && !it.done && !ro && TYPES[curType()].qty){
    const q = el('div','qty');
    const minus = el('button',null,'−'); minus.onclick=()=>changeQty(it.id,it.qty-1);
    const plus = el('button',null,'+'); plus.onclick=()=>changeQty(it.id,it.qty+1);
    q.append(minus, el('span',null,String(it.qty)), plus);
    row.appendChild(q);
  }
  return row;
}

function renderNoLists(){
  const ro=!canEdit(), mine=owner===uid;
  $('summary').textContent = t('noListsSummary');
  $('bar').style.width='0';
  $('addbar').classList.add('hidden');
  document.body.style.paddingBottom='calc(env(safe-area-inset-bottom) + 24px)';
  const main=$('main'); main.innerHTML=''; main.className='';
  const e=el('div','empty no-lists'); e.innerHTML='<b>📋</b>';
  e.appendChild(el('div','nl-title', mine ? t('noListsTitle') : t('noListsOther',{name:(sharedWithMe.find(x=>x.uid===owner)||{}).name||''})));
  if (!ro){
    e.appendChild(el('div','nl-text', t('noListsText')));
    const b=el('button','btn btn-primary nl-create',t('createFirstList')); b.type='button'; b.id='createFirstList'; b.onclick=()=>openListSheet(null);
    e.appendChild(b);
  }
  main.appendChild(e);
}
// ---- search ----
let itemQuery='', listQuery='', listSearchOpen=false;
// forgiving match: ignores case, Arabic vowel marks and the common letter variants (أ إ آ ا, ة ه, ى ي)
function itemMatches(i){ return !itemQuery || matches(i.name+' '+(i.note||''), itemQuery); }
function renderSearchBar(){
  const btn=$('searchBtn'); if(btn) btn.classList.toggle('hidden', !hasList());
  if (!hasList() && itemSearchOn){ itemSearchOn=false; itemQuery=''; const i=$('itemSearch'); if(i) i.value=''; if(btn){ btn.classList.remove('on'); btn.setAttribute('aria-expanded','false'); } }
  const bar=$('itemSearchBar'); if(!bar) return;
  bar.classList.toggle('hidden', !hasList() || !searchOpen());
}
// ---- the item search also looks in the other lists you can open ----
let otherHits=null, otherSeq=0, otherCache=null, otherTimer=0;
async function loadOtherItems(){
  const others=allLists().filter(l=>l.id!==listId), key=owner+'|'+listId+'|'+others.map(l=>l.id).join(',');
  if (otherCache && otherCache.key===key && Date.now()-otherCache.at<30000) return otherCache.data;
  const data=new Map();
  await Promise.all(others.map(async l=>{
    try{ const s=await getDocs(collection(fs, listBase(owner,l.id)+'items')); data.set(l.id, s.docs.map(d=>d.data()||{})); }catch(e){}
  }));
  otherCache={key, at:Date.now(), data}; return data;
}
function updateOtherHits(){
  clearTimeout(otherTimer);
  const q=itemQuery, seq=++otherSeq;
  if (!q || !hasList()){ otherHits=null; return; }
  otherTimer=setTimeout(async ()=>{
    const data=await loadOtherItems(); if (seq!==otherSeq || q!==itemQuery) return;
    const hits=[];
    for (const l of allLists()){
      if (l.id===listId) continue;
      const n=(data.get(l.id)||[]).filter(i=>matches(String(i.name||'')+' '+String(i.note||''), q)).length;
      const byName=matches(l.name+' '+(l.description||''), q);
      if (n || byName) hits.push({l, n});
    }
    otherHits={q, hits}; render();
  }, 250);
}
function otherHitsEl(){
  if (!itemQuery || !otherHits || otherHits.q!==itemQuery || !otherHits.hits.length) return null;
  const w=el('div','also-in'); w.appendChild(el('span','also-h',t('alsoIn')));
  for (const {l,n} of otherHits.hits){
    const b=el('button','chip also-chip'); b.type='button'; b.dataset.list=l.id;
    b.append(el('span','em',l.emoji), document.createTextNode(' '+l.name+(n?' · '+n:'')));
    b.onclick=()=>openListWithSearch(l.id);
    w.appendChild(b);
  }
  return w;
}
function openListWithSearch(id){
  const q=itemQuery; openList(owner, id);
  itemSearchOn=true; itemQuery=q; const i=$('itemSearch'); if(i) i.value=q;
  const b=$('searchBtn'); if(b){ b.classList.add('on'); b.setAttribute('aria-expanded','true'); }
  renderSearchBar(); render(); updateOtherHits();
}
const searchOpen = () => itemSearchOn;
let itemSearchOn=false;
function toggleItemSearch(on){
  itemSearchOn = on===undefined ? !itemSearchOn : on;
  if (!itemSearchOn){ itemQuery=''; otherHits=null; const i=$('itemSearch'); if(i) i.value=''; }
  else otherCache=null;   // fresh look at the other lists each time search opens
  const b=$('searchBtn'); if(b){ b.classList.toggle('on', itemSearchOn); b.setAttribute('aria-expanded', itemSearchOn?'true':'false'); }
  renderSearchBar(); render();
  if (itemSearchOn) setTimeout(()=>{ const i=$('itemSearch'); if(i) i.focus(); },30);
}
function render(){
  renderSearchBar();
  if (!hasList()) return renderNoLists();
  if ($('catPick').dataset.type!==curType()) renderCatPick();
  const every = [...items.values()];
  const all = itemQuery ? every.filter(itemMatches) : every;
  const todo = all.filter(i=>!i.done), done = all.filter(i=>i.done);
  const allTodo = every.filter(i=>!i.done), allDone = every.filter(i=>i.done);
  $('summary').textContent = every.length ? tw('summary',{todo:allTodo.length, done:allDone.length}) : t('nothingYet');
  $('mTick').textContent = tw('tabTick'); $('addInput').placeholder = tw('addPlaceholder');
  $('bar').style.width = every.length ? (allDone.length/every.length*100)+'%' : '0';
  $('mPlan').classList.toggle('on', mode==='plan');
  $('mTick').classList.toggle('on', mode==='tick');
  $('mHist').classList.toggle('on', mode==='trips');
  const ro = !canEdit();
  $('addbar').classList.toggle('hidden', mode!=='plan' || ro);
  document.body.style.paddingBottom = (mode!=='plan' || ro) ? 'calc(env(safe-area-inset-bottom) + 24px)' : '';

  const main = $('main'); main.innerHTML=''; main.className = mode==='tick'?'tick':'';
  if (ro){ const v=el('div','viewonly'); v.appendChild(el('b',null,t('viewOnlyTitle'))); v.appendChild(document.createTextNode(t('viewOnlyText',{list:ownerName(owner)}))); main.appendChild(v); }
  if (mode==='trips'){ renderHistory(main); return; }
  if (itemQuery){
    main.appendChild(el('div','label search-count', t('searchCount',{n:all.length, q:itemQuery})));
    const oh=otherHitsEl(); if(oh) main.appendChild(oh);
    if (!all.length){ const e=el('div','empty'); e.innerHTML='<b>🔍</b>'; e.appendChild(document.createTextNode(t('noMatches'))); main.appendChild(e); return; }
  }

  if (mode==='plan' && !ro && !itemQuery){
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
    // suggested items for this kind of list (hidden once the list is well under way)
    const shown = new Set([...inList, ...quick.map(r=>r.name.toLowerCase())]);
    const sug = typeSuggestions().filter(([n])=>!shown.has(n.toLowerCase())).slice(0,10);
    if (sug.length && todo.length<8){
      main.appendChild(el('div','label',tl('suggestions')));
      const chips = el('div','chips sug');
      for (const [n,c] of sug){
        const b=el('button','chip','+ '+n);
        b.onclick=()=>{ const keep=pickedCat; pickedCat=c; addItem(n); pickedCat=keep; };
        chips.appendChild(b);
      }
      main.appendChild(chips);
    }
  }

  if (!all.length){
    const e = el('div','empty'); e.innerHTML='<b>🧺</b>';
    e.appendChild(document.createTextNode(ro ? t('emptyRo') : mode==='tick' ? t('emptyTick') : t('emptyPlan')));
    main.appendChild(e); return;
  }

  if (todo.length){
    for (const {cat:c, items:list} of groupBySection(todo, curCats(), lang)){
      const g = el('div','group');
      const gh = el('div','gh', c.e+' '+catLabel(c)); gh.appendChild(el('span','n',String(list.length)));
      g.appendChild(gh);
      list.forEach(i=>g.appendChild(itemRow(i)));
      main.appendChild(g);
    }
  } else if (mode==='tick' && !itemQuery){
    const e = el('div','empty'); e.innerHTML='<b>🎉</b>'; e.appendChild(document.createTextNode(tw('allDone')));
    main.appendChild(e);
  }

  if (done.length){
    main.appendChild(el('div','label',tw('inCart',{n:done.length})));
    const g = el('div','group');
    done.sort(byName(lang)).forEach(i=>g.appendChild(itemRow(i)));
    main.appendChild(g);
    const clr = el('button','clear',t('clearChecked')); clr.onclick=clearDone;
    if (!ro && !itemQuery) main.appendChild(clr);
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
  stats.append(st(String(trips.filter(x=>x.items.length).length),tw('statTrips')), st(String(thisMonth),t('statMonth')), st(top?top.name:'—',tw('statTop')));
  main.appendChild(stats);

  const shownTrips = itemQuery ? trips.map(x=>({...x, items:x.items.filter(itemMatches)})).filter(x=>x.items.length) : trips.filter(x=>x.items.length);
  if (itemQuery){
    main.appendChild(el('div','label search-count', t('searchCountHist',{n:shownTrips.length, q:itemQuery})));
    const oh=otherHitsEl(); if(oh) main.appendChild(oh);
    if (!shownTrips.length){ const e=el('div','empty'); e.innerHTML='<b>🔍</b>'; e.appendChild(document.createTextNode(t('noMatches'))); main.appendChild(e); return; }
  }
  for (const tr of shownTrips.slice(0,60)){
    const {day,time} = fmtDate(tr.at);
    const open = !!itemQuery;
    const card = document.createElement('details'); card.className='trip'; if (open) card.open=true;
    const sum = document.createElement('summary');
    const dt = el('div','date'); dt.appendChild(el('b',null,day));
    const who = [...new Set(tr.items.map(i=>i.by).filter(Boolean))].map(n=>n===me?t('you'):n);
    dt.appendChild(el('span',null, time + (who.length ? t('by')+who.join(t('and')) : '')));
    sum.append(dt, el('span','count', itemsCount(tr.items.length)), el('span','chev','›'));
    card.appendChild(sum);
    const rows = el('div','rows');
    for (const i of tr.items){
      const r = el('div','hrow');
      r.appendChild(el('span',null,catOf(i.cat).e));
      const n = el('span','n', i.name + (i.qty>1?' ×'+i.qty:''));
      if (i.note){ n.appendChild(document.createElement('br')); n.appendChild(el('small',null,i.note)); }
      r.appendChild(n);
      if (canEdit()){ const b = el('button',null,t('addOne')); b.onclick=()=>readd([i]); r.appendChild(b); }
      rows.appendChild(r);
    }
    const again = el('button','again',t('addAll',{n:tr.items.length}));
    again.onclick=()=>{ readd(tr.items); mode='plan'; try{localStorage.setItem('listsMode',mode)}catch(e){} render(); };
    if (canEdit()) rows.appendChild(again);
    card.appendChild(rows);
    main.appendChild(card);
  }
}

function renderCatPick(){
  const box=$('catPick'), cats=curCats(), ty=curType(); box.innerHTML='';
  if (box.dataset.type!==ty){ box.dataset.type=ty; if (!cats.some(c=>c.id===pickedCat)) pickedCat=null; }
  if (cats.length<2){ box.classList.add('hidden'); return; } box.classList.remove('hidden');
  const auto=el('button','chip'+(pickedCat===null?' on':''),t('auto'));
  auto.onclick=()=>{pickedCat=null; renderCatPick();}; box.appendChild(auto);
  for (const c of cats){
    const b=el('button','chip'+(pickedCat===c.id?' on':''), c.e+' '+catLabel(c));
    b.type='button'; b.onclick=()=>{pickedCat=c.id; renderCatPick();};
    box.appendChild(b);
  }
}

$('addForm').addEventListener('submit', e=>{ e.preventDefault(); const v=$('addInput').value; $('addInput').value=''; addItem(v); pickedCat=null; renderCatPick(); $('addInput').focus(); });
$('mPlan').onclick=()=>{mode='plan'; try{localStorage.setItem('listsMode',mode)}catch(e){} render();};
$('mTick').onclick=()=>{mode='tick'; try{localStorage.setItem('listsMode',mode)}catch(e){} render();};
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
// invited: the email from an invite link (?invite=name@example.com), or '' when not invited
function showLanding(invited){
  $('inviteNote').classList.toggle('hidden', !invited);
  setAuthMode(store('listsRegistered') && !invited ? 'signin' : 'register');
  if (invited && !$('aEmail').value) $('aEmail').value = invited;
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
    store('listsRegistered','1');
  }catch(err){ window._pendingName = null; $('aErr').textContent=authMsg(err); }
  $('aGo').disabled=false;
});

// ---- people: own list + lists shared with me ----
let sharedLoaded=false, fs=null, uid=null, myEmail='', owner=null, unsubs=[], sharedWithMe=[], myMembers={}, memberEmails={}, myAccess={}, myInvites={};
// what others share with me = their sharedWithMe docs + invites sent to my email before I had an account
let swDocs=[], invDocs=[], swLoaded=false, invLoaded=false, swCache=false, invCache=false, openInvite=false;
// several lists per person: 'main' lives at ulists/{owner}/, the rest at ulists/{owner}/lists/{id}/
let listId='main', lists=[], tripIds=[], curBase='', listsLoaded=false, mainInfo={name:'', emoji:'🛒', description:'', createdAt:0, deleted:false}, mainDateFixed=false;
const pendingLists = new Set();
const mainCustom = () => !!(mainInfo.name || mainInfo.emoji!=='🛒' || (mainInfo.type && mainInfo.type!=='shopping'));
const mainEntry = () => ({id:'main', name:mainInfo.name||t('mainList'), emoji:mainInfo.emoji||'🛒', description:mainInfo.description||'', type:mainInfo.type||'shopping', createdAt:mainInfo.createdAt||0});
const fmtCreated = ts => { if(!ts) return ''; const d=new Date(ts); return t('createdOn',{date:d.toLocaleDateString(dateLocale,{day:'numeric', month:'long', year:'numeric'}), time:d.toLocaleTimeString(dateLocale,{hour:'numeric', minute:'2-digit'})}); };
const curList = () => listId==='main' ? (mainCustom() ? mainEntry() : null) : (lists.find(l=>l.id===listId) || null);
// the main list can be deleted too; 'none' means the person has no lists at all
const mainAlive = () => !mainInfo.deleted;
const allLists = () => (mainAlive() ? [mainEntry()] : []).concat(lists);
const firstListId = () => { const a=allLists(); return a.length ? a[0].id : 'none'; };
const hasList = () => listId!=='none';
function ownerName(o){ if(o===uid) return t('myList'); const p=sharedWithMe.find(x=>x.uid===o); return p ? t('listOf',{name:p.name}) : t('list'); }
function renderSwitcher(){
  const box=$('switcher'); if(!box) return; box.innerHTML='';
  const all=[{uid, name:me}, ...sharedWithMe.filter(sharesWithMe).map(p=>({uid:p.uid, name:p.name}))];
  for (const p of all){
    const on = p.uid===owner, mine = p.uid===uid;
    const b=el('button','person'+(on?' on':'')); b.type='button'; b.dataset.uid=p.uid;
    b.setAttribute('aria-pressed', on?'true':'false');
    const av=el('span','av',initialsOf(p.name)); av.style.background=avatarColor(p.uid); av.setAttribute('aria-hidden','true');
    b.append(av, el('span','pn', mine ? t('me') : p.name));
    b.onclick=()=>{ if(!on) openList(p.uid); };
    box.appendChild(b);
  }
  box.appendChild(el('span','grow'));
  const share=el('button','person share'); share.type='button'; share.id='shareBtn'; share.setAttribute('aria-haspopup','dialog'); share.setAttribute('aria-label', t('sharingBtn'));
  const ic=el('span','av'); ic.innerHTML=ICON.people; share.append(ic, el('span','pn',t('sharingBtn')));
  const n=sharePeople().length; if(n) share.appendChild(el('span','count',String(n)));
  share.onclick=openSharing; box.appendChild(share);
  updateTitle();
}
function updateTitle(){
  const op = sharedWithMe.find(x=>x.uid===owner);
  const l = curList();
  if (l) $('title').textContent = l.emoji + ' ' + (owner===uid || !op ? l.name : t('listNameOf',{list:l.name, name:op.name}));
  else $('title').textContent = '📋 ' + (owner===uid || !op ? t('myLists') : t('listsOf',{name:op.name}));
}
function renderListDesc(){
  const d=$('listDesc'); if(!d) return;
  const l = allLists().find(x=>x.id===listId);
  const txt = l && l.description ? l.description : '', when = l ? fmtCreated(l.createdAt) : '';
  d.innerHTML='';
  if (txt) d.appendChild(el('div','ld-text',txt));
  if (when) d.appendChild(el('div','ld-date',when));
  d.classList.toggle('hidden', !txt && !when);
}
function closeListSearch(){ listSearchOpen=false; listQuery=''; renderLists(); }
function filterListTabs(){
  const box=$('listbar'); if(!box) return; let n=0;
  for (const b of box.querySelectorAll('.ltab[data-list]')){
    const l=allLists().find(x=>x.id===b.dataset.list); const ok=!listQuery || (l && matches(l.name+' '+(l.description||''), listQuery));
    b.classList.toggle('hide', !ok); if(ok) n++;
    const nx=b.nextElementSibling; if(nx && nx.id==='editListBtn') nx.classList.toggle('hide', !ok);
  }
  const none=box.querySelector('.ls-none'); if(none) none.classList.toggle('hidden', n>0);
}
function renderLists(){
  renderListDesc();
  const box=$('listbar'); if(!box) return; box.innerHTML='';
  const ed = owner===uid;   // only the owner creates, edits or deletes lists
  const all = allLists();
  if (!ed && !all.length){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  // search the lists
  const hadFocus = document.activeElement && document.activeElement.id==='listSearch';
  if (all.length){
    if (listSearchOpen){
      const w=el('div','lsearch'); const i=document.createElement('input'); i.id='listSearch'; i.type='text'; i.enterKeyHint='search'; i.value=listQuery;
      i.placeholder=t('searchLists'); i.setAttribute('aria-label',t('searchLists')); i.autocomplete='off';
      i.oninput=()=>{ listQuery=i.value; filterListTabs(); };
      i.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const f=box.querySelector('.ltab[data-list]:not(.hide)'); if(f) f.click(); } if(e.key==='Escape'){ e.preventDefault(); closeListSearch(); } };
      const x=el('button','ls-x','✕'); x.type='button'; x.setAttribute('aria-label',t('close')); x.onclick=closeListSearch;
      w.append(i,x); box.appendChild(w);
    } else {
      const sb=el('button','ltab ls-btn','🔍'); sb.type='button'; sb.id='listSearchBtn'; sb.setAttribute('aria-label',t('searchLists'));
      sb.onclick=()=>{ listSearchOpen=true; renderLists(); setTimeout(()=>{ const i=$('listSearch'); if(i) i.focus(); },30); };
      box.appendChild(sb);
    }
  } else { listSearchOpen=false; listQuery=''; }
  for (const l of all){
    const on = l.id===listId;
    const b=el('button','ltab'+(on?' on':'')); b.type='button'; b.dataset.list=l.id;
    b.setAttribute('aria-current', on?'true':'false');
    b.append(el('span','em',l.emoji), el('span','ln',l.name));
    if (!ed && myRoleOn(owner,l.id)==='view') b.appendChild(el('span','tag',t('viewOnly')));
    if (l.createdAt) b.title = fmtCreated(l.createdAt);
    b.onclick=()=>{
      const searching=listSearchOpen; if (searching){ listSearchOpen=false; listQuery=''; }   // picking a result closes the list search
      if (!on) openList(owner, l.id); else if (searching) renderLists(); else if (ed) openListSheet(l);
    };
    box.appendChild(b);
    if (on && ed){
      const e=document.createElement('button'); e.type='button'; e.className='ltab-edit'; e.id='editListBtn';
      e.setAttribute('aria-label', t('editListAria',{name:l.name})); e.innerHTML=ICON.pencil;
      e.onclick=()=>openListSheet(l); box.appendChild(e);
    }
  }
  if (listSearchOpen){ box.appendChild(el('span','ls-none hidden',t('noListMatches'))); filterListTabs(); }
  if (ed){ const n=el('button','ltab new',t('newList')); n.type='button'; n.id='newListBtn'; n.onclick=()=>openListSheet(null); box.appendChild(n); }
  const act = box.querySelector('.ltab.on'); if (!listSearchOpen && act && act.scrollIntoView) try{ act.scrollIntoView({block:'nearest', inline:'nearest'}); }catch(e){}
  if (listSearchOpen && hadFocus){ const i=$('listSearch'); if(i){ i.focus(); try{ i.setSelectionRange(i.value.length, i.value.length); }catch(e){} } }
}

// ---- create / rename / delete a list ----
const LIST_ICONS = ['🛒','✅','🧳','📝','🎉','💊','🏠','🍖','🧺','🎁','🌙','🏖️','👶','🧹','📦'];
let listSheet=null;
function closeListSheet(){ listSheet=null; const s=$('listSheet'); if(s) s.remove(); }
function openListSheet(l){
  if(owner!==uid) return viewOnly();
  listSheet={edit:l, name:l?l.name:'', emoji:l?l.emoji:'🛒', desc:l?(l.description||''):'', type:l&&TYPES[l.type]?l.type:'shopping', iconTouched:!!l, confirm:false, err:''};
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
  if(S.edit && S.edit.createdAt) box.appendChild(el('p','sub created-on','📅 '+fmtCreated(S.edit.createdAt)));
  box.appendChild(el('label',null,tl('listType')));
  const types=el('div','chips type-pick');
  for (const ty of TYPE_IDS){ const b=el('button','chip'+(ty===S.type?' on':''),TYPES[ty].e+' '+tl('type_'+ty)); b.type='button'; b.dataset.type=ty;
    b.onclick=()=>{ S.type=ty; if(!S.iconTouched) S.emoji=TYPES[ty].icon; renderListSheet(); }; types.appendChild(b); }
  box.appendChild(types);
  const lb=el('label',null,t('listName')); lb.htmlFor='lName'; box.appendChild(lb);
  const inp=document.createElement('input'); inp.id='lName'; inp.maxLength=40; inp.value=S.name; inp.placeholder=t('listNamePh'); inp.autocomplete='off'; inp.enterKeyHint='done';
  inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); saveList(); } };
  box.appendChild(inp);
  const dl=el('label',null,t('listDesc')); dl.htmlFor='lDesc'; box.appendChild(dl);
  const ta=document.createElement('textarea'); ta.id='lDesc'; ta.maxLength=120; ta.rows=2; ta.value=S.desc||''; ta.placeholder=t('listDescPh');
  box.appendChild(ta);
  box.appendChild(el('label',null,t('listIcon')));
  const icons=el('div','chips icon-pick');
  for (const ic of LIST_ICONS){ const b=el('button','chip'+(ic===S.emoji?' on':''),ic); b.type='button'; b.onclick=()=>{ S.emoji=ic; S.iconTouched=true; renderListSheet(); }; icons.appendChild(b); }
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
    if (S.edit && myRoleOn(owner)==='owner'){ const d=el('button','danger',t('delete')); d.type='button'; d.id='lDel'; d.onclick=()=>{ S.name=$('lName').value; S.confirm=true; renderListSheet(); }; row.appendChild(d); }
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
    mainInfo={...mainInfo, name:stored, emoji:S.emoji, description, type:S.type};
    setDoc(doc(fs,'ulists/'+o+'/lists/main'), {name:stored, emoji:S.emoji, description, type:S.type, main:true}, {merge:true}).catch(handleWriteError);
    closeListSheet(); renderLists(); updateTitle(); renderCatPick(); render(); return;
  }
  if (S.edit){
    const id=S.edit.id;
    lists=lists.map(l=>l.id===id?{...l,name,emoji:S.emoji,description,type:S.type}:l);
    setDoc(doc(fs,'ulists/'+o+'/lists/'+id), {name, emoji:S.emoji, description, type:S.type}, {merge:true}).catch(handleWriteError);
    closeListSheet(); renderLists(); updateTitle(); renderCatPick(); render(); return;
  }
  const ref=doc(collection(fs,'ulists/'+o+'/lists'));
  const data={name, emoji:S.emoji, description, type:S.type, createdAt:Date.now(), createdBy:me||null};
  pendingLists.add(ref.id);
  setDoc(ref, data).catch(err=>{ pendingLists.delete(ref.id); handleWriteError(err); });
  lists=[...lists,{id:ref.id,...data}];
  closeListSheet();
  mode='plan'; try{localStorage.setItem('listsMode',mode)}catch(e){}
  openList(o, ref.id);
  setStatus(t('listCreated',{name}));
}
function deleteList(l){
  if (myRoleOn(owner)!=='owner' || !l) return;
  const o=owner, base=listBase(o,l.id), isMain=l.id==='main';
  const itemIds=[...new Set([...items.keys(), ...Object.keys(queues).filter(k=>k.startsWith(base+'items/')).map(k=>k.slice((base+'items/').length))])], tids=tripIds.slice();
  const pending=Object.keys(queues).filter(k=>k.startsWith(base)).map(k=>queues[k]);   // let edits still on their way land first
  closeListSheet();
  if (isMain) mainInfo={...mainInfo, deleted:true}; else lists=lists.filter(x=>x.id!==l.id);
  openList(o, firstListId());
  setStatus(t('listDeleted'));
  (async()=>{
    try{
      await Promise.all(pending);
      // the main list's record is kept (marked deleted) so it doesn't come back on the next visit
      dropListAccess(l.id);
      if (isMain) await setDoc(doc(fs,'ulists/'+o+'/lists/main'), {deleted:true, deletedAt:Date.now(), main:true}, {merge:true});
      else await deleteDoc(doc(fs,'ulists/'+o+'/lists/'+l.id));
      for (const id of itemIds) await deleteDoc(doc(fs, base+'items/'+id));
      for (const id of tids) await deleteDoc(doc(fs, base+'trips/'+id));
      await deleteDoc(doc(fs, base+'meta/recent'));
    }catch(e){ handleWriteError(e); }
  })();
}
function addToolbar(){
  const sw=el('div','switcher'); sw.id='switcher';
  const bar=el('div','toolbar');
  // the user button opens the user menu (profile, language, about, sign out)
  const ub=el('button','chip user-btn'); ub.type='button'; ub.id='userBtn'; ub.setAttribute('aria-haspopup','dialog');
  ub.onclick=openUserMenu;
  const lg=el('button','chip lang-chip',t('langSwitch')); lg.onclick=()=>setLang(isAr?'en':'ar');
  const sb=el('button','chip search-btn','🔍'); sb.type='button'; sb.id='searchBtn'; sb.setAttribute('aria-label',t('searchItems')); sb.setAttribute('aria-expanded','false');
  sb.onclick=()=>toggleItemSearch();
  bar.append(ub, sb, lg);
  const sr=el('div','searchbar hidden'); sr.id='itemSearchBar';
  const si=document.createElement('input'); si.id='itemSearch'; si.type='text'; si.enterKeyHint='search'; si.placeholder=t('searchItemsPh'); si.setAttribute('aria-label',t('searchItems')); si.autocomplete='off';
  si.oninput=()=>{ itemQuery=si.value.trim(); render(); updateOtherHits(); };
  si.onkeydown=e=>{ if(e.key==='Escape'){ e.preventDefault(); toggleItemSearch(false); } };
  const sx=el('button','sb-x','✕'); sx.type='button'; sx.setAttribute('aria-label',t('close')); sx.onclick=()=>toggleItemSearch(false);
  sr.append(si, sx);
  sw.setAttribute('aria-label', t('peopleNav'));
  const lb=el('div','listbar'); lb.id='listbar'; lb.setAttribute('aria-label', t('listsNav'));
  const ld=el('div','list-desc hidden'); ld.id='listDesc';
  const nav=el('nav','navcard'); nav.append(sw, lb, ld);
  // the user menu sits at the very top of the page, above the title
  bar.classList.add('topbar'); document.querySelector('header').before(bar);
  $('status').before(nav); $('status').before(sr);
  renderUserBtn();
}
function renderUserBtn(){
  const ub=$('userBtn'); if(!ub) return;
  ub.innerHTML='';
  ub.append(el('span','av',initialsOf(me)), el('span','who-am-i',t('hi',{name:me})), el('span','caret','▾'));
  ub.setAttribute('aria-label', t('userMenu'));
}
// ---- user menu: profile (editable), language, about, sign out ----
let userMenu=null;
function closeUserMenu(){ userMenu=null; const s=$('userSheet'); if(s) s.remove(); }
function openUserMenu(){ userMenu={name:me, err:'', msg:'', busy:false}; renderUserMenu(); }
function renderUserMenu(){
  if(!userMenu) return; const U=userMenu;
  let wrap=$('userSheet');
  if (wrap){ const i=$('uName'); if(i) U.name=i.value; }
  else { wrap=el('div','sheet user-sheet'); wrap.id='userSheet'; wrap.onclick=e=>{ if(e.target===wrap) closeUserMenu(); }; document.body.appendChild(wrap); }
  wrap.innerHTML='';
  const box=el('div','box'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label',t('userMenu'));
  const head=el('div','u-head'); head.append(el('span','av big',initialsOf(me)));
  const who=el('div'); who.append(el('b',null,me), el('div','sub',myEmail)); head.appendChild(who); box.appendChild(head);
  box.appendChild(el('h3',null,t('profile')));
  const lb=el('label',null,t('yourName')); lb.htmlFor='uName'; box.appendChild(lb);
  const inp=document.createElement('input'); inp.id='uName'; inp.maxLength=40; inp.value=U.name; inp.autocomplete='name';
  inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); saveProfile(); } };
  box.appendChild(inp);
  const el2=el('label',null,t('email')); box.appendChild(el2);
  const em=document.createElement('input'); em.id='uEmail'; em.value=myEmail; em.readOnly=true; em.disabled=true; box.appendChild(em);
  if (U.err) box.appendChild(el('div','lerr',U.err));
  if (U.msg) box.appendChild(el('div','umsg',U.msg));
  const save=el('button','btn btn-primary u-save',t('saveProfile')); save.type='button'; save.id='uSave'; save.disabled=U.busy; save.onclick=saveProfile; box.appendChild(save);
  const menu=el('div','u-menu');
  const reset=el('button','u-item','🔑 '+t('resetPassword')); reset.type='button'; reset.id='uReset';
  reset.onclick=async()=>{ try{ await sendPasswordResetEmail(window._auth, myEmail); U.msg=t('pwResetSent',{email:myEmail}); U.err=''; }catch(e){ U.err=t('errSave'); } renderUserMenu(); };
  const lang=el('button','u-item','🌐 '+t('langSwitch')); lang.type='button'; lang.onclick=()=>setLang(isAr?'en':'ar');
  const site=el('a','u-item',t('aboutApp')); site.href='about/'; site.target='_blank'; site.rel='noopener'; site.onclick=syncSiteLang;
  const out=el('button','u-item danger','↩ '+t('signOut')); out.type='button'; out.id='uSignOut';
  out.onclick=async()=>{ try{ await signOut(window._auth); }catch(e){} try{localStorage.removeItem('listsOwner')}catch(e){} location.reload(); };
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const inst=el('button','u-item','📲 '+t('installApp')); inst.type='button'; inst.id='uInstall';
  inst.onclick=async()=>{
    const p=window._installPrompt;
    if (p){ window._installPrompt=null; try{ await p.prompt(); await p.userChoice; }catch(e){} return closeUserMenu(); }
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    U.msg=t(ios?'installIos':'installOther'); U.err=''; renderUserMenu();
  };
  menu.append(reset, lang, ...(standalone?[]:[inst]), site, out); box.appendChild(menu);
  const close=el('button','btn u-close',t('close')); close.type='button'; close.onclick=closeUserMenu; box.appendChild(close);
  wrap.appendChild(box);
}
async function saveProfile(){
  const U=userMenu; if(!U || U.busy) return;
  const name=($('uName').value||'').trim().replace(/\s+/g,' ').slice(0,40);
  U.name=name; U.msg='';
  if(!name){ U.err=t('enterName'); return renderUserMenu(); }
  if((name.match(/\p{L}/gu)||[]).length<3){ U.err=t('nameShort'); return renderUserMenu(); }
  if(name===me){ U.err=''; U.msg=t('profileSaved'); return renderUserMenu(); }
  U.busy=true; U.err=''; renderUserMenu();
  try{
    const cu=window._auth && window._auth.currentUser;
    if (cu) await updateProfile(cu, {displayName:name});
    await setDoc(doc(fs,'users/'+uid), {name}, {merge:true});
    if (myEmail) await setDoc(doc(fs,'emails/'+myEmail), {uid, name}, {merge:true});
    // the people I share with see my new name
    for (const fid of Object.keys(myMembers||{})) { try{ await setDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid), {name}, {merge:true}); }catch(e){} }
    me=name; names[me]=me;
    U.busy=false; U.msg=t('profileSaved'); renderUserBtn(); renderSwitcher(); render(); renderUserMenu();
  }catch(e){ U.busy=false; U.err=t('errSave'); renderUserMenu(); }
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && userMenu) closeUserMenu(); });
function openList(o, lid){
  unsubs.forEach(f=>{ try{f()}catch(e){} }); unsubs=[];
  if (o!==owner){ lists=[]; listsLoaded=false; mainInfo={name:'', emoji:'🛒', description:'', createdAt:0, deleted:false}; }
  owner=o; store('listsOwner', o);
  listId = lid || store('lastList:'+o) || 'main';
  if (listsLoaded && (listId==='none' ? allLists().length : !allLists().some(l=>l.id===listId)) && !pendingLists.has(listId)) listId=firstListId();
  store('lastList:'+o, listId);
  items=new Map(); trips=[]; tripIds=[]; recent=[]; setStatus('');
  if (itemQuery || itemSearchOn) toggleItemSearch(false);
  curBase = hasList() ? listBase(o, listId) : '';
  db = hasList() ? mkDb(fs, curBase) : null;
  renderSwitcher(); renderLists(); render();
  const afterLists = ()=>{
    for (const l of lists) pendingLists.delete(l.id);
    if (listsLoaded && !pendingLists.has(listId)){
      const gone = listId==='none' ? allLists().length>0 : !allLists().some(l=>l.id===listId);
      if (gone){
        const wasReal = listId!=='none' && listId!=='main';
        closeListSheet(); openList(o, firstListId()); if (wasReal) setStatus(t('listGone'), true); return;
      }
    }
    renderLists(); updateTitle(); if (!editing) render(); if (shareOpen) renderSharing();
  };
  const parseMain = mv => ({name:String(mv.name||'').slice(0,40), emoji:LIST_ICONS.includes(mv.emoji)?mv.emoji:'🛒', description:String(mv.description||'').slice(0,120), type:TYPES[mv.type]?mv.type:'shopping', createdAt:+mv.createdAt||0, deleted:!!mv.deleted});
  const parseList = (id,v) => ({id, name:String(v.name||t('list')).slice(0,40), emoji:LIST_ICONS.includes(v.emoji)?v.emoji:'🛒', description:String(v.description||'').slice(0,120), type:TYPES[v.type]?v.type:'shopping', createdAt:+v.createdAt||0});
  if (o===uid){
    unsubs.push(fsSnap(collection(fs,'ulists/'+o+'/lists'), snap=>{
      if (o!==owner) return;
      const md = snap.docs.find(d=>d.id==='main');
      mainInfo = parseMain(md ? (md.data()||{}) : {});
      // the main list existed before dates were recorded: date it from when the account was created
      if (!mainInfo.createdAt && !mainInfo.deleted && !mainDateFixed && (!snap.metadata || !snap.metadata.fromCache)){
        mainDateFixed=true;
        const cu=window._auth && window._auth.currentUser, ts=(cu && Date.parse(cu.metadata && cu.metadata.creationTime)) || Date.now();
        mainInfo.createdAt=ts;
        setDoc(doc(fs,'ulists/'+o+'/lists/main'), {createdAt:ts, main:true}, {merge:true}).catch(()=>{});
      }
      lists = sortLists(snap.docs.filter(d=>d.id!=='main').map(d=>parseList(d.id, d.data()||{})), lang);
      if (!snap.metadata || !snap.metadata.fromCache) listsLoaded=true;
      afterLists();
    }, ()=>{}));
  } else {
    // someone else's lists: watch only the lists they shared with me, one by one
    if (!sharedLoaded){ renderLists(); return; }   // wait until I know what they share with me
    const shared = (sharedWithMe.find(x=>x.uid===o)||{}).lists || {};
    const ids = Object.keys(shared), metas = {}, seen = new Set();
    mainInfo = {...mainInfo, deleted: !shared.main};
    const rebuild = ()=>{
      if (o!==owner) return;
      if (shared.main) mainInfo = parseMain(metas.main||{});
      lists = sortLists(ids.filter(id=>id!=='main' && metas[id]).map(id=>parseList(id, metas[id])), lang);
      listsLoaded = seen.size>=ids.length;
      afterLists();
    };
    if (!ids.length){ listsLoaded=true; rebuild(); }
    for (const id of ids) unsubs.push(fsSnap(doc(fs,'ulists/'+o+'/lists/'+id), s=>{
      metas[id] = s.exists() ? (s.data()||{}) : (id==='main' ? {} : null); seen.add(id); rebuild();
    }, ()=>{ metas[id] = id==='main' ? {deleted:true} : null; seen.add(id); rebuild(); }));
  }
  if (!hasList()) return;   // no lists: only the list of lists is watched
  const curListAt = listId;
  let reachWarn=false;
  let timer = setTimeout(()=>{ reachWarn=true; setStatus(t('cantReach'), true); }, 10000);
  unsubs.push(db.collection('items').onSnapshot(snap=>{
    if (o!==owner || listId!==curListAt) return;
    if (!snap.metadata.fromCache){ clearTimeout(timer); if(reachWarn){ reachWarn=false; setStatus(''); } }
    items = new Map(snap.docs.map(d=>{ const v=d.data()||{}; return [d.id, {id:d.id, name:String(v.name||'Item'), qty:Math.max(1,+v.qty||1), cat:String(v.cat||'other'), note:String(v.note||''), done:!!v.done, addedBy:v.addedBy?String(v.addedBy):null, doneBy:v.doneBy?String(v.doneBy):null, doneAt:+v.doneAt||null, createdAt:+v.createdAt||0}]; }));
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
    trips = sortTrips(snap.docs.map(d=>{ const v=d.data()||{};
      const raw = Array.isArray(v.items) ? v.items.map((i,n)=>[String(n),i]) : Object.entries(v.items||{});
      const list = raw.filter(([k,i])=>i&&i.name).map(([k,i])=>({key:k, name:String(i.name), qty:Math.max(1,+i.qty||1), cat:String(i.cat||'other'), note:String(i.note||''), by:i.by?String(i.by):(v.by?String(v.by):null), at:+i.at||0}));
      const last = list.reduce((m,i)=>Math.max(m,i.at), 0) || +v.at || 0;
      return {id:d.id, at:last, items:list}; }));
    if (!editing && mode==='trips') render();
  }, ()=>{}));
  unsubs.push(db.doc('meta/recent').onSnapshot(snap=>{
    if (o!==owner || myList!==listId) return;
    const v = snap.exists ? snap.data() : null;
    recent = (v && Array.isArray(v.items)) ? v.items.filter(r=>r && r.name).map(r=>({name:String(r.name), cat:String(r.cat||'other')})).slice(0,30) : [];
    if (!editing) render();
  }, ()=>{}));
}

// ---- sharing page ----
// people I share with used to be saved as 'family'/'familyEmails' on users/{uid}; move them to 'members'/'memberEmails' once
let oldFieldsMoved=false;
function moveOldMemberFields(d){
  if (oldFieldsMoved || !(d.family || d.familyEmails)) return;
  oldFieldsMoved=true;
  setDoc(doc(fs,'users/'+uid), {members:{...(d.family||{}), ...(d.members||{})}, memberEmails:{...(d.familyEmails||{}), ...(d.memberEmails||{})}, family:deleteField(), familyEmails:deleteField()}, {merge:true}).catch(()=>{ oldFieldsMoved=false; });
}
let shareOpen=false, shareMsg='', shareOk=false, shareBusy=false, shareConfirm=null, shareInviteRole='edit', shareMail=null, myListsCache=null;
// my own lists, to choose which ones each person can open
function myOwnLists(){ return owner===uid ? allLists() : (myListsCache||[]); }
async function loadMyLists(){
  if (owner===uid) return;
  try{
    const snap = await getDocs(collection(fs,'ulists/'+uid+'/lists'));
    const md = snap.docs.find(d=>d.id==='main'), mv = md ? (md.data()||{}) : {};
    const out = mv.deleted ? [] : [{id:'main', name:mv.name||t('mainList'), emoji:LIST_ICONS.includes(mv.emoji)?mv.emoji:'🛒'}];
    for (const d of snap.docs){ if(d.id==='main') continue; const v=d.data()||{}; out.push({id:d.id, name:String(v.name||t('list')), emoji:LIST_ICONS.includes(v.emoji)?v.emoji:'🛒', createdAt:+v.createdAt||0}); }
    myListsCache = sortMyLists(out);
    if (shareOpen) renderSharing();
  }catch(e){}
}
// an email the owner can send from their own mail app to tell someone what they can open
// pending: they have no account yet, so the link opens the invite landing page with their email filled in
function mailtoFor(name, email, grants, pending){
  const app = location.origin + location.pathname.replace(/[^/]*$/, '') + (pending ? '?invite='+encodeURIComponent(email||'') : '');
  const lines = grants.map(g=>'• '+g.emoji+' '+g.name+' — '+(g.role==='view'?t('viewOnly'):t('canEdit')));
  const subject = t('mailSubject',{name:me});
  const body = t(pending ? 'mailBodyNew' : 'mailBody',{name:name||'', me, lists:lines.join('\n'), link:app, email:email||''});
  return 'mailto:'+encodeURIComponent(email||'')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
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
function sharePeople(){
  const map=new Map();
  for (const [fid,fname] of Object.entries(myMembers)) map.set(fid,{uid:fid, name:String(fname||t('someone')), email:String(memberEmails[fid]||''), canEditMine:true, access:myAccess[fid]||{}, sharedWithMe:false});
  for (const p of sharedWithMe){ if(!sharesWithMe(p) && !myMembers[p.uid]) continue; const x=map.get(p.uid)||{uid:p.uid, name:p.name, email:'', canEditMine:false, access:{}}; x.name=p.name||x.name; x.email=p.email||x.email; x.sharedWithMe=sharesWithMe(p); map.set(p.uid,x); }
  // invited by email, no account yet
  for (const [em,inv] of Object.entries(myInvites||{})){ if(!inv) continue; const id='invite:'+em; map.set(id,{uid:id, name:em, email:'', inviteEmail:em, pending:true, canEditMine:true, access:inv.lists||{}, sharedWithMe:false}); }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name, lang));
}
function closeSharing(){ shareOpen=false; shareMsg=''; shareConfirm=null; const s=$('shareSheet'); if(s) s.remove(); document.body.style.overflow=''; document.removeEventListener('keydown', shareKeys); }
function shareKeys(e){ if(e.key==='Escape') closeSharing(); }
function openSharing(){ shareOpen=true; shareMsg=''; shareConfirm=null; shareInviteRole='edit'; shareMail=null; loadMyLists(); document.body.style.overflow='hidden'; document.addEventListener('keydown', shareKeys); renderSharing(); setTimeout(()=>{ const i=$('shareEmail'); if(i && window.innerWidth>600) i.focus(); },250); }
function renderSharing(msg, ok){
  if(!shareOpen) return;
  if(msg!==undefined){ shareMsg=msg; shareOk=!!ok; }
  let wrap=$('shareSheet');
  const keepEmail = wrap ? (wrap.querySelector('#shareEmail')||{}).value||'' : '';
  const scroll = wrap ? (wrap.querySelector('.share-body')||{}).scrollTop||0 : 0;
  if(!wrap){ wrap=el('div','sheet share-sheet'); wrap.id='shareSheet'; wrap.onclick=e=>{ if(e.target===wrap) closeSharing(); }; document.body.appendChild(wrap); }
  wrap.innerHTML='';
  const panel=el('div','share-panel'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby','shareTitle');
  panel.appendChild(el('div','share-grab'));

  // header
  const head=el('div','share-head'); const ttl=el('div','ttl');
  const h=el('h3',null,t('shareTitle')); h.id='shareTitle'; ttl.append(h, el('p',null,t('shareSub')));
  const x=document.createElement('button'); x.className='icon-btn'; x.type='button'; x.setAttribute('aria-label',t('close')); x.innerHTML=ICON.close; x.onclick=closeSharing;
  head.append(ttl,x); panel.appendChild(head);

  const body=el('div','share-body');

  // invite card
  const card=el('section','share-card');
  card.appendChild(el('h4',null,t('inviteTitle')));
  card.appendChild(el('p','lead',t(owner===uid && hasList() ? 'inviteLeadList' : 'inviteLeadNone',{list:(allLists().find(l=>l.id===listId)||{}).name||''})));
  const roles=el('div','role-pick'); roles.setAttribute('role','radiogroup'); roles.setAttribute('aria-label',t('access'));
  for (const [val,title,desc] of [['edit',t('canEdit'),t('canEditDesc')],['view',t('viewOnly'),t('viewOnlyDesc')]]){
    const opt=document.createElement('button'); opt.type='button'; opt.className='role-opt'+(shareInviteRole===val?' on':''); opt.dataset.role=val;
    opt.setAttribute('role','radio'); opt.setAttribute('aria-checked', shareInviteRole===val?'true':'false');
    const dot=el('span','dot'); const txt=el('span','txt'); txt.appendChild(el('b',null,title)); txt.appendChild(el('small',null,desc));
    opt.append(dot,txt); opt.onclick=()=>{ shareInviteRole=val; renderSharing(); };
    roles.appendChild(opt);
  }
  card.appendChild(roles);
  const form=document.createElement('form'); form.className='share-invite'; form.noValidate=true;
  const field=el('label','share-field'); field.appendChild(iconEl('mail'));
  const inp=document.createElement('input'); inp.id='shareEmail'; inp.type='email'; inp.placeholder='name@example.com'; inp.value=keepEmail; inp.autocomplete='off'; inp.inputMode='email'; inp.setAttribute('aria-label',t('memberEmail'));
  field.appendChild(inp);
  const add=document.createElement('button'); add.type='submit'; add.className='btn btn-primary'; add.id='shareAddBtn'; add.disabled=shareBusy;
  if(shareBusy){ add.appendChild(el('span','spin')); add.setAttribute('aria-label',t('adding')); } else add.textContent=t('add');
  form.append(field, add);
  form.onsubmit=e=>{ e.preventDefault(); if(!shareBusy) addMember(inp.value); };
  card.appendChild(form);
  if(shareMsg){ const a=el('div','share-alert '+(shareOk?'ok':'err')); a.setAttribute('role','status'); a.appendChild(iconEl(shareOk?'ok':'err')); a.appendChild(el('span','msg',shareMsg)); card.appendChild(a); }
  if(shareMail){ const m=el('a','btn btn-soft share-mail','✉️ '+t('emailThem',{name:shareMail.name||shareMail.email})); m.id='shareMailBtn'; m.href=mailtoFor(shareMail.name, shareMail.email, shareMail.grants, shareMail.pending); m.target='_blank'; m.rel='noopener'; card.appendChild(m); }
  body.appendChild(card);

  // members
  const people=sharePeople();
  const sec=el('section');
  const sh=el('div','share-sec-head'); sh.appendChild(el('h4',null,t('members'))); if(people.length) sh.appendChild(el('span','num',String(people.length)));
  sec.appendChild(sh);
  if(!people.length){
    const e=el('div','members share-empty'); const ic=el('div','ic'); ic.innerHTML=ICON.people; e.appendChild(ic);
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
      const nAcc=Object.keys(p.access||{}).length;
      const b1=el('span','badge2'+(nAcc?' on':'')); if(nAcc) b1.appendChild(iconEl('check')); b1.append(nAcc ? t(nAcc===1?'bOneList':'bLists',{n:nAcc}) : t('bNoLists'));
      const b2=el('span','badge2'+(p.sharedWithMe?' on':'')+(p.pending?' pending':'')); if(p.sharedWithMe) b2.appendChild(iconEl('check')); b2.append(p.pending?t('bPending'):p.sharedWithMe?t('bShared'):t('bNotShared'));
      bd.append(b1,b2); m.appendChild(bd);
      // which of my lists this person can open
      if(p.canEditMine && shareConfirm!==p.uid){
        const mine=myOwnLists();
        const box=el('div','acc-lists'); box.appendChild(el('div','acc-h',t('theirAccess')));
        if(!mine.length) box.appendChild(el('div','acc-empty',t('noListsToShare')));
        for(const l of mine){
          const cur=(p.access||{})[l.id]||'';
          const row=el('div','acc-row'); row.dataset.list=l.id;
          row.appendChild(el('span','acc-ln',l.emoji+' '+l.name));
          const seg=el('div','seg'); seg.setAttribute('role','radiogroup'); seg.setAttribute('aria-label',t('accessFor',{list:l.name}));
          for(const [val,lab] of [['',t('accNone')],['view',t('accView')],['edit',t('accEdit')]]){
            const b=el('button','seg-b'+(cur===val?' on':''),lab); b.type='button'; b.dataset.role=val||'none';
            b.setAttribute('role','radio'); b.setAttribute('aria-checked',cur===val?'true':'false');
            b.onclick=()=>{ if(cur===val) return; if(p.pending) setInviteAccess(p.inviteEmail,l,val); else setListAccess(p.uid,p.name,p.email,l,val); };
            seg.appendChild(b);
          }
          row.appendChild(seg); box.appendChild(row);
        }
        if(nAcc){ const grants=mine.filter(l=>(p.access||{})[l.id]).map(l=>({name:l.name, emoji:l.emoji, role:p.access[l.id]}));
          const m2=el('a','acc-mail','✉️ '+t('emailThem',{name:p.name})); m2.href=p.pending ? mailtoFor('',p.inviteEmail,grants,true) : mailtoFor(p.name,p.email,grants); m2.target='_blank'; m2.rel='noopener'; box.appendChild(m2); }
        m.appendChild(box);
      }

      if(shareConfirm===p.uid){
        const c=el('div','confirm');
        c.appendChild(el('div',null,p.pending ? t('confirmCancelInvite',{email:p.inviteEmail}) : t('confirmRemove',{name:p.name})));
        const r=el('div','row2');
        const cancel=el('button','btn',t('cancel')); cancel.type='button'; cancel.onclick=()=>{ shareConfirm=null; renderSharing(); };
        const yes=el('button','btn btn-danger-solid',t('remove')); yes.type='button'; yes.onclick=()=>{ shareConfirm=null; if(p.pending) removeInvite(p.inviteEmail); else removeMember(p.uid,p.name); };
        r.append(cancel,yes); c.appendChild(r); m.appendChild(c);
      } else {
        const acts=el('div','acts');
        if(p.sharedWithMe){ const o=el('button','btn btn-soft',t('openTheirList')); o.type='button'; o.onclick=()=>{ closeSharing(); openList(p.uid); }; acts.appendChild(o); }
        if(!p.canEditMine){ const s=el('button','btn',t('shareMyList')); s.type='button'; s.onclick=()=>shareWith(p.uid,p.name,p.email,shareInviteRole); acts.appendChild(s); }
        acts.appendChild(el('span','sp'));
        if(p.canEditMine){ const rm=el('button','btn btn-danger',t('remove')); rm.type='button'; rm.onclick=()=>{ shareConfirm=p.uid; renderSharing(); }; acts.appendChild(rm); }
        m.appendChild(acts);
      }
      list.appendChild(m);
    }
    sec.appendChild(list);
  }
  body.appendChild(sec);
  body.appendChild(el('p','share-note',t('shareNote')));
  panel.appendChild(body);
  wrap.appendChild(panel);
  body.scrollTop=scroll;
}
async function addMember(email){
  email=(email||'').trim().toLowerCase();
  if(!email || !isEmail(email)) return renderSharing(t('errEmail'));
  if(email===myEmail) return renderSharing(t('fOwn'));
  const known=sharePeople().find(p=>p.canEditMine && p.email===email);
  if(known) return renderSharing(t('fAlready',{name:known.name}), true);
  if(myInvites[email]) return renderSharing(t('fAlreadyInvited',{email}), true);
  shareBusy=true; renderSharing('');
  try{
    const snap=await getDoc(doc(fs,'emails/'+email));
    if(!snap.exists()){ shareBusy=false; await inviteByEmail(email, shareInviteRole); const i=$('shareEmail'); if(i) i.value=''; return; }
    const p=snap.data();
    if(myMembers[p.uid]){ shareBusy=false; return renderSharing(t('fAlready',{name:p.name||t('they')}), true); }
    shareBusy=false;
    await shareWith(p.uid, p.name, email, shareInviteRole);
    const i=$('shareEmail'); if(i) i.value='';
  }catch(e){ shareBusy=false; renderSharing(t('fAddFail')); }
}
// add someone to my people; if one of my lists is open, they get it straight away
async function shareWith(fid, fname, femail, role){
  role = role==='view' ? 'view' : 'edit';
  const l = owner===uid && hasList() ? allLists().find(x=>x.id===listId) : null;
  try{
    const upd = {members:{[fid]:String(fname||'')}, memberEmails:{[fid]:String(femail||'')}};
    if (l) upd.access = {[fid]:{[l.id]:role}};
    await setDoc(doc(fs,'users/'+uid), upd, {merge:true});
    const sw = {name:me, email:myEmail, at:Date.now()}; if (l) sw.lists = {[l.id]:role};
    await setDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid), sw, {merge:true});
    shareMail = l ? {name:fname, email:femail, grants:[{name:l.name, emoji:l.emoji, role}]} : null;
    renderSharing(l ? t(role==='view'?'fListView':'fListEdit',{name:fname||t('they'), list:l.name}) : t('fAdded',{name:fname||t('they')}), true);
  }catch(e){ renderSharing(t('fShareFail')); }
}
// no account uses that email yet: save an invite. It is kept in two places:
//  users/{me}.invites[email].lists — what Firestore rules check, so they can open the lists as soon as they register
//  invites/{email}/from/{me}       — what their app reads to find out who invited them
async function inviteByEmail(email, role){
  role = role==='view' ? 'view' : 'edit';
  const l = owner===uid && hasList() ? allLists().find(x=>x.id===listId) : null;
  const lists = l ? {[l.id]:role} : {}, at = Date.now();
  try{
    await setDoc(doc(fs,'users/'+uid), {invites:{[email]:{lists, at}}}, {merge:true});
    await setDoc(doc(fs,'invites/'+email+'/from/'+uid), {name:me, email:myEmail, lists, at}, {merge:true});
    shareMail = l ? {name:'', email, grants:[{name:l.name, emoji:l.emoji, role}], pending:true} : null;
    renderSharing(l ? t('fInvited',{email, list:l.name}) : t('fInvitedNone',{email}), true);
  }catch(e){ renderSharing(t('fShareFail')); }
}
async function setInviteAccess(email, l, role){
  const v = role==='edit'||role==='view' ? role : deleteField();
  try{
    await setDoc(doc(fs,'users/'+uid), {invites:{[email]:{lists:{[l.id]:v}}}}, {merge:true});
    await setDoc(doc(fs,'invites/'+email+'/from/'+uid), {name:me, email:myEmail, lists:{[l.id]:v}}, {merge:true});
    shareMail = role ? {name:'', email, grants:[{name:l.name, emoji:l.emoji, role}], pending:true} : null;
    renderSharing(t(!role?'fListNone':role==='view'?'fListView':'fListEdit',{name:email, list:l.name}), true);
  }catch(e){ renderSharing(t('fRoleFail')); }
}
async function removeInvite(email){
  try{
    await setDoc(doc(fs,'users/'+uid), {invites:{[email]:deleteField()}}, {merge:true});
    await deleteDoc(doc(fs,'invites/'+email+'/from/'+uid));
    shareMail=null; renderSharing(t('fInviteRemoved',{email}), true);
  }catch(e){ renderSharing(t('fRemoveFail')); }
}
// once an invited person has registered, turn their invite into a normal member (same lists, same roles)
const invitesChecked = new Set();
async function settleInvites(){
  for (const [em,inv] of Object.entries(myInvites||{})){
    if (!inv || invitesChecked.has(em)) continue;
    invitesChecked.add(em);
    try{
      const s = await getDoc(doc(fs,'emails/'+em));
      const p = s.exists() ? (s.data()||{}) : null;
      if (!p || !p.uid || p.uid===uid) continue;
      const lists = inv.lists||{}, name = String(p.name||em.split('@')[0]);
      await setDoc(doc(fs,'users/'+uid), {members:{[p.uid]:name}, memberEmails:{[p.uid]:em}, access:{[p.uid]:lists}, invites:{[em]:deleteField()}}, {merge:true});
      await setDoc(doc(fs,'users/'+p.uid+'/sharedWithMe/'+uid), {name:me, email:myEmail, lists, at:Date.now()}, {merge:true});
      await deleteDoc(doc(fs,'invites/'+em+'/from/'+uid));
    }catch(e){ invitesChecked.delete(em); }
  }
}
async function setListAccess(fid, fname, femail, l, role){
  const v = role==='edit'||role==='view' ? role : deleteField();
  try{
    await setDoc(doc(fs,'users/'+uid), {access:{[fid]:{[l.id]:v}}}, {merge:true});
    await setDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid), {name:me, email:myEmail, lists:{[l.id]:v}}, {merge:true});
    shareMail = role ? {name:fname, email:femail, grants:[{name:l.name, emoji:l.emoji, role}]} : null;
    renderSharing(t(!role?'fListNone':role==='view'?'fListView':'fListEdit',{name:fname||t('they'), list:l.name}), true);
  }catch(e){ renderSharing(t('fRoleFail')); }
}
// a deleted list is taken out of everyone's access
async function dropListAccess(lid){
  for (const [fid,acc] of Object.entries(myAccess||{})){
    if (!acc || !acc[lid]) continue;
    try{
      await setDoc(doc(fs,'users/'+uid), {access:{[fid]:{[lid]:deleteField()}}}, {merge:true});
      await setDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid), {lists:{[lid]:deleteField()}}, {merge:true});
    }catch(e){}
  }
  for (const [em,inv] of Object.entries(myInvites||{})){
    if (!inv || !inv.lists || !inv.lists[lid]) continue;
    try{
      await setDoc(doc(fs,'users/'+uid), {invites:{[em]:{lists:{[lid]:deleteField()}}}}, {merge:true});
      await setDoc(doc(fs,'invites/'+em+'/from/'+uid), {lists:{[lid]:deleteField()}}, {merge:true});
    }catch(e){}
  }
}
async function removeMember(fid, fname){
  try{
    await setDoc(doc(fs,'users/'+uid), {members:{[fid]:deleteField()}, memberEmails:{[fid]:deleteField()}, family:{[fid]:deleteField()}, familyEmails:{[fid]:deleteField()}, access:{[fid]:deleteField()}}, {merge:true});
    await deleteDoc(doc(fs,'users/'+fid+'/sharedWithMe/'+uid));
    shareMail=null; renderSharing(t('fRemoved',{name:fname||t('they')}), true);
  }catch(e){ renderSharing(t('fRemoveFail')); }
}

// combine what people shared with me directly and what they invited my email to before I registered
function applyShared(){
  const key = o => JSON.stringify(((sharedWithMe.find(x=>x.uid===o)||{}).lists)||{});
  const before = owner && owner!==uid ? key(owner) : null;
  const all = new Map();
  for (const x of invDocs) all.set(x.uid, x);
  for (const x of swDocs){ const i=all.get(x.uid); all.set(x.uid, i ? {...x, lists:{...i.lists, ...x.lists}} : x); }
  sharedWithMe = [...all.values()];
  if (!swLoaded || !invLoaded) return;   // wait for both
  sharedLoaded = true;
  if (openInvite && invDocs.length && !swCache && !invCache){
    // just arrived from an invite link: open the list they were invited to
    openInvite = false;
    const p = invDocs[0], lid = p.lists.main ? 'main' : Object.keys(p.lists)[0];
    if (owner!==p.uid) openList(p.uid, lid);
  } else if (owner && owner!==uid){
    const p = sharedWithMe.find(x=>x.uid===owner);
    if (!sharesWithMe(p)){ if (!swCache && !invCache){ openList(uid); setStatus(t('noAccess'), true); } }
    else if (key(owner)!==before) openList(owner, listId);   // what they share with me changed
  }
  renderSwitcher(); renderLists(); if(shareOpen) renderSharing(); if(owner && owner!==uid && !editing) render();
}

// ---- boot ----
renderCatPick(); render();
(async ()=>{
  if (firebaseConfig.apiKey === 'PASTE_HERE'){
    setStatus(t('setupNotFinished'), true);
    $('summary').textContent=t('notSyncing'); return;
  }
  const invitedEmail = (new URLSearchParams(location.search).get('invite')||'').trim().toLowerCase();
  if (invitedEmail) openInvite = true;
  if (location.hash || location.search) window.history.replaceState(null,'',location.pathname);
  const app = initializeApp(firebaseConfig);
  fs = initializeFirestore(app, { localCache: persistentLocalCache() });
  const auth = getAuth(app); window._auth = auth;
  let started = false;

  onAuthStateChanged(auth, async user=>{
    if (user && user.isAnonymous){ signOut(auth); return; }
    if (!user){ if(!started) showLanding(invitedEmail); return; }
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
    fsSnap(doc(fs,'users/'+uid), s=>{ const d=s.exists()?s.data():{}; myMembers={...(d.family||{}), ...(d.members||{})}; memberEmails={...(d.familyEmails||{}), ...(d.memberEmails||{})}; moveOldMemberFields(d); myAccess=d.access||{}; myInvites=d.invites||{}; renderSwitcher(); if(shareOpen) renderSharing(); settleInvites(); }, ()=>{});
    const parseShare = d => { const v=d.data()||{}; const ls={}; for (const [k,r] of Object.entries(v.lists||{})) if(r==='edit'||r==='view') ls[k]=r;
      return {uid:d.id, name:String(v.name||t('someone')), email:String(v.email||''), lists:ls}; };
    fsSnap(collection(fs,'users/'+uid+'/sharedWithMe'), s=>{ swDocs=s.docs.map(parseShare); swLoaded=true; swCache=!!(s.metadata && s.metadata.fromCache); applyShared(); }, ()=>{ swLoaded=true; applyShared(); });
    if (myEmail) fsSnap(collection(fs,'invites/'+myEmail+'/from'), s=>{ invDocs=s.docs.map(parseShare).filter(sharesWithMe); invLoaded=true; invCache=!!(s.metadata && s.metadata.fromCache); applyShared(); }, ()=>{ invDocs=[]; invLoaded=true; applyShared(); });
    else invLoaded=true;
    const last = store('listsOwner');
    openList(last && last!==uid ? last : uid);
  });
})();
