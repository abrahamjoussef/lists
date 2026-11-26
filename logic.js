// Pure logic used by app.js: no page, no Firebase. Kept here so it can be tested (see tests/).
import { normDigits, AR_KEYWORDS } from "./i18n.js?v=27";
import { TYPES } from "./types.js?v=27";

// supermarket sections (shopping lists)
export const CATS = [
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
export const KEYWORDS = {
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

// ---- adding an item: "2 milk - full fat" → {name:'Milk', qty:2, note:'full fat'} ----
export function parseItemText(raw){
  let text = normDigits(raw).trim(); if(!text) return null;
  let note = '';
  const dm = text.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dm){ text = dm[1].trim(); note = dm[2].trim().slice(0,120); }
  let qty = 1;
  const m = text.match(/^(\d+)\s*[x×]?\s+(.+)$/i) || text.match(/^(.+?)\s+[x×]?\s*(\d+)$/i);
  if (m){ if (/^\d+$/.test(m[1])){ qty=+m[1]; text=m[2]; } else { text=m[1]; qty=+m[2]; } }
  text = text.charAt(0).toUpperCase()+text.slice(1);
  return {name:text, qty, note};
}
// an item with the same name that is not ticked yet (adding it again raises its quantity)
export const findOpenDuplicate = (items, name) => [...items].find(i=>!i.done && i.name.toLowerCase()===name.toLowerCase());

// ---- guessing the section of an item ----
// Arabic: match a word that starts with the keyword, with or without "ال" (or "وال", "بال", "لال").
// The word is also tried as typed, so a word that itself starts with those letters ("بالونات") still matches.
function arMatch(w, table){
  const words = w.split(/\s+/).flatMap(x=>[x, x.replace(/^(و|ب|ل)?ال/, '')]);
  for (const [cat, list] of Object.entries(table)){
    for (const k of list.split(' ')) if (k && words.some(x=>x.startsWith(k.replace(/^ال/,'')))) return cat;
  }
  return null;
}
function enMatch(w, table){
  for (const [cat, list] of Object.entries(table)){
    for (const k of list.split(' ')) if (k && new RegExp('\\b'+k).test(w)) return cat;
  }
  return null;
}
export function guessShopCat(name){
  const w = name.toLowerCase();
  return enMatch(w, KEYWORDS) || arMatch(w, AR_KEYWORDS) || 'other';
}
export function guessTypeCat(name, T){
  const w = name.toLowerCase(), kw=T.kw||{};
  return enMatch(w, kw.en||{}) || arMatch(w, kw.ar||{}) || 'other';
}
export const guessCat = (name, type) => (type && type!=='shopping' && TYPES[type]) ? guessTypeCat(name, TYPES[type]) : guessShopCat(name);

// ---- sorting ----
export const byName = lang => (a,b) => a.name.localeCompare(b.name, lang);
// items to do, grouped by section in the section order; unknown sections go to 'other'
export function groupBySection(todo, cats, lang){
  const known = new Set(cats.map(c=>c.id));
  return cats.map(c=>({cat:c, items: todo.filter(i=>(known.has(i.cat)?i.cat:'other')===c.id).sort(byName(lang))})).filter(g=>g.items.length);
}
// lists: oldest first, then by name
export const sortLists = (lists, lang) => lists.slice().sort((a,b)=>a.createdAt-b.createdAt || a.name.localeCompare(b.name, lang));
// my own lists on the sharing page: the main list first, then oldest first
export const sortMyLists = lists => lists.slice().sort((a,b)=>(a.id==='main'?-1:b.id==='main'?1:(a.createdAt||0)-(b.createdAt||0)));
// history: newest day first, items in a day in the order they were ticked
export function sortTrips(trips){
  return trips.map(t=>({...t, items:t.items.slice().sort((a,b)=>a.at-b.at)})).filter(t=>t.items.length).sort((a,b)=>b.at-a.at);
}

// ---- recently used items ("Add again"): newest first, no repeats, at most 30 ----
export function mergeRecent(recent, added){
  for (const it of added){
    const k = it.name.toLowerCase();
    recent = recent.filter(r=>r.name.toLowerCase()!==k);
    recent.unshift({name:it.name, cat:it.cat});
  }
  return recent.slice(0,30);
}

// ---- sharing: what may this person do on a list? ----
// sharedWithMe: [{uid, name, lists:{listId:'edit'|'view'}}] (what others shared with me)
export function roleOn(sharedWithMe, me, owner, lid){
  if (!owner || owner===me) return 'owner';
  const p = sharedWithMe.find(x=>x.uid===owner);
  const r = p && p.lists ? p.lists[lid] : null;
  return r==='edit'||r==='view' ? r : 'none';
}
export const roleCanEdit = r => r==='owner' || r==='edit';
export const sharesWithMe = p => !!(p && p.lists && Object.keys(p.lists).length);
export const isEmail = s => /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(s);
// where a list lives in Firestore ('main' is the original list)
export const listBase = (o, l) => 'ulists/'+o+'/' + (l && l!=='main' ? 'lists/'+l+'/' : '');

// ---- dates and search ----
export function dayKey(t){ const d=new Date(t); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
// search ignores case, Arabic diacritics and the common letter variants (أ/ا, ة/ه, ى/ي)
export const normQ = s => normDigits(String(s||'')).toLowerCase().replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').trim();
export const matches = (text, q) => { const n=normQ(text); return normQ(q).split(/\s+/).every(w=>n.includes(w)); };
