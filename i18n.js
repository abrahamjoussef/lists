// Shopping list app — English / Arabic text
// To change any wording, edit it here. {name}-style placeholders are filled in by the app.

export const LANGS = ['en', 'ar'];

const EN = {
  docTitle: 'Our Shopping List',
  langSwitch: 'عربي',
  loading: 'Loading…',
  tabList: 'List', tabShop: 'Shop', tabHistory: 'History',
  addPlaceholder: 'Add an item… e.g. 2 milk - 1 L', add: 'Add', auto: '✨ Auto',
  editTitle: 'Edit item', name: 'Name', note: 'Description (brand, size, details)', optional: 'optional', descPh: 'e.g. lactose free, 1 L', listDesc: 'Description (optional)', listDescPh: 'e.g. For Friday’s dinner — budget 300 SAR', section: 'Section',
  delete: 'Delete', cancel: 'Cancel', save: 'Save', close: 'Close',

  heroTitle: "Welcome to Family Shopping List",
  heroText: "One shared shopping list for your whole family. Whoever is at home adds what the house needs, and whoever goes to the supermarket ticks it off — everyone in the family sees every change on their phone right away.",
  invited: "You've been invited to a family list 💚",
  feat1: 'Shared with family', feat2: 'Sorted by aisle', feat3: 'Tick while shopping',
  getStarted: 'Get started — it’s free',
  f1t: 'Shared with family', f1d: 'Everyone sees every change live on their phone.',
  f2t: 'Sorted by aisle', f2d: 'Items group by supermarket section by themselves.',
  f3t: 'Shop mode', f3d: 'Big tick buttons and a progress bar in the shop.',
  f4t: 'Descriptions', f4d: 'Add details like “2 milk - full fat” to items and lists.',
  f5t: 'Many lists', f5d: 'Groceries, a party, the pharmacy — each separate.',
  f6t: 'Automatic history', f6d: 'Every trip is saved — repeat it in one tap.',
  f7t: 'Can edit or view only', f7d: 'You choose what each family member can do.',
  f8t: 'Arabic & English', f8d: 'Full right-to-left layout and Arabic typing.',
  yourName: 'Your name', namePh: 'e.g. Sara', email: 'Email', emailPh: 'you@example.com',
  password: 'Password', passPh: 'At least 6 characters',
  createAccount: 'Create your account', takes30: 'It takes 30 seconds.',
  welcomeBack: 'Welcome back', signInHint: 'Sign in to open your shopping list.',
  register: 'Register', signIn: 'Sign in', alreadyReg: 'Already registered? ', newHere: 'New here? ',
  createAnAccount: 'Create an account', forgot: 'Forgot password?',
  typeEmailFirst: 'Type your email above first.', resetSent: 'Check your email for a reset link.',
  errInUse: 'This email is already registered — tap "Sign in" below.',
  errEmail: 'Please enter a valid email address.',
  errWeak: 'Password needs at least 6 characters.',
  errCred: 'Email or password is incorrect.',
  errMany: 'Too many attempts. Please wait a minute and try again.',
  errNet: 'No internet connection. Please try again.',
  errDisabled: 'Email sign-in is not enabled yet in Firebase.',
  errGeneric: 'Something went wrong. Please try again.',
  enterName: 'Please enter your name.', enterEmailPass: 'Please enter your email and password.',

  cat_produce: 'Fruit & Veg', cat_dairy: 'Dairy & Eggs', cat_meat: 'Meat & Fish', cat_bakery: 'Bakery',
  cat_pantry: 'Pantry', cat_frozen: 'Frozen', cat_drinks: 'Drinks', cat_snacks: 'Snacks',
  cat_household: 'Household', cat_personal: 'Personal care', cat_baby: 'Baby', cat_other: 'Other',

  errPerm: "This phone isn't allowed to change the list.",
  errSave: "Couldn't save that change. Check your connection and try again.",
  viewOnlyMsg: 'You have view-only access to this list.',
  me: 'Me', you: 'you', addedBy: 'Added by {name}', check: 'Check {name}', uncheck: 'Uncheck {name}',
  summary: '{todo} to get · {done} in cart', nothingYet: 'Nothing on the list yet',
  viewOnlyTitle: '👁 View only', viewOnlyText: ' You can see {list} and its History, but not change it.',
  addAgain: 'Add again',
  emptyRo: 'This list is empty right now.',
  emptyShop: 'The list is empty — switch to List to add items.',
  emptyPlan: 'Add your first item below. Anything you add shows up on both phones.',
  allDone: 'All done! Everything is in the cart.',
  inCart: 'In the cart ({n})', clearChecked: 'Clear checked items (they stay in History)',
  today: 'Today', yesterday: 'Yesterday',
  noTrips: 'No trips yet. Every item you tick while shopping is saved here automatically, grouped by day.',
  statTrips: 'trips', statMonth: 'this month', statTop: 'most bought',
  by: ' · by ', and: ' & ', addOne: '+ Add', addAll: 'Add all {n} items to the list',

  myList: 'My list', listOf: "{name}'s list", list: 'List', viewSuffix: ' · view', family: '👥 Family',
  myShoppingList: 'My Shopping List', shoppingListOf: "{name}'s Shopping List",
  signOut: 'Sign out', hi: 'Hi, {name}',
  mainList: 'Main list', newList: '+ New list', newListTitle: 'New list', editListTitle: 'Edit list',
  newListSub: 'Its own items, Shop mode and History. Your family sees it too.',
  listName: 'List name', listNamePh: 'e.g. Party, Pharmacy, Ramadan', listIcon: 'Icon', create: 'Create',
  deleteList: 'Delete list', enterListName: 'Please enter a name for the list.',
  confirmDeleteList: 'Delete “{name}” with all its items and history? This can’t be undone.',
  listCreated: '“{name}” is ready — add your first item.', listDeleted: 'List deleted.', listGone: 'That list was deleted.',
  listCreateFail: "Couldn't create the list. Please try again.", editListAria: 'Edit {name}',
  shoppingListName: '{list} · {name}',
  familyBtn: 'Family', peopleNav: 'Whose lists', listsNav: 'Lists', editMainHint: 'The main list can be renamed but not deleted.',
  cantReach: "Can't reach the list yet — showing what's on this phone. It will update when you're back online.",
  noAccess: 'You no longer have access to this list.',
  liveStopped: 'Live updates stopped. Reopen the app to reconnect.',

  famTitle: 'Family', famSub: 'Share shopping lists with the people you live with.',
  inviteTitle: 'Invite a family member',
  inviteLead: 'Enter the email they registered with, then choose what they can do with your list.',
  access: 'Access', canEdit: 'Can edit', canEditDesc: 'Add, tick and remove items',
  viewOnly: 'View only', viewOnlyDesc: 'See the list and History',
  memberEmail: "Family member's email", adding: 'Adding',
  members: 'Members', noMembers: 'No family members yet', noMembersHint: 'Add someone above to start sharing your list.',
  bNoAccess: 'No access to your list', bCanView: 'Can view your list', bCanEdit: 'Can edit your list',
  bShared: 'Shared their list with you', bNotShared: "Hasn't shared their list",
  confirmRemove: "Remove {name}'s access to your list? They won't be able to see or edit it anymore.",
  remove: 'Remove', openTheirList: 'Open their list', shareMyList: 'Share my list',
  makeViewOnly: 'Make view only', allowEditing: 'Allow editing',
  famNote: 'Only people you add can open your list. Each person keeps their own list and History.',
  fOwn: "That's your own email. Enter a family member's email instead.",
  fAlready: '{name} already has access to your list.',
  fNoAccount: 'No account uses that email yet. Ask them to register in the app first, then add them again.',
  fAddFail: "Couldn't add them. Check your connection and try again.",
  fSharedView: '{name} can now view your list.', fSharedEdit: '{name} can now see and edit your list.',
  fShareFail: "Couldn't share your list. Please try again.",
  fRoleView: '{name} can now only view your list.', fRoleEdit: '{name} can now edit your list.',
  fRoleFail: "Couldn't change their access. Please try again.",
  fRemoved: '{name} no longer has access to your list.', fRemoveFail: "Couldn't remove them. Please try again.",
  they: 'They', familyMember: 'Family member',
  setupNotFinished: 'Setup not finished: paste your Firebase config at the top of app.js.', notSyncing: 'Not syncing',
};

const AR = {
  docTitle: 'قائمة تسوقنا',
  langSwitch: 'English',
  loading: 'جارٍ التحميل…',
  tabList: 'القائمة', tabShop: 'التسوق', tabHistory: 'السجل',
  addPlaceholder: 'أضف غرضًا… مثال: ٢ حليب - ١ لتر', add: 'إضافة', auto: '✨ تلقائي',
  editTitle: 'تعديل الغرض', name: 'الاسم', note: 'الوصف (الماركة، الحجم، التفاصيل)', optional: 'اختياري', descPh: 'مثال: خالي اللاكتوز، ١ لتر', listDesc: 'الوصف (اختياري)', listDescPh: 'مثال: لعشاء يوم الجمعة — الميزانية ٣٠٠ ريال', section: 'القسم',
  delete: 'حذف', cancel: 'إلغاء', save: 'حفظ', close: 'إغلاق',

  heroTitle: 'أهلًا بكم في قائمة تسوق العائلة',
  heroText: 'قائمة تسوق واحدة تتشاركها عائلتك كلها. من في البيت يضيف ما يحتاجه المنزل، ومن يذهب إلى السوبرماركت يحدد ما اشتراه — ويرى كل أفراد العائلة كل تغيير على جوالاتهم فورًا.',
  invited: 'تمت دعوتك إلى قائمة عائلية 💚',
  feat1: 'مشتركة مع العائلة', feat2: 'مرتبة حسب الأقسام', feat3: 'حدّد أثناء التسوق',
  getStarted: 'ابدأ الآن — مجانًا',
  f1t: 'مشتركة مع العائلة', f1d: 'الجميع يرى كل تغيير فورًا على جواله.',
  f2t: 'مرتبة حسب الأقسام', f2d: 'الأغراض تترتب تلقائيًا حسب أقسام السوبرماركت.',
  f3t: 'وضع التسوق', f3d: 'أزرار كبيرة للتحديد وشريط تقدّم داخل السوق.',
  f4t: 'الأوصاف', f4d: 'أضف تفاصيل مثل «٢ حليب - كامل الدسم» للأغراض والقوائم.',
  f5t: 'قوائم متعددة', f5d: 'مقاضي، حفلة، صيدلية — كل قائمة مستقلة.',
  f6t: 'سجل تلقائي', f6d: 'كل مشوار يُحفظ — كرّره بلمسة واحدة.',
  f7t: 'تعديل أو عرض فقط', f7d: 'أنت تختار ما يستطيع كل فرد من العائلة فعله.',
  f8t: 'عربي وإنجليزي', f8d: 'واجهة كاملة من اليمين لليسار وكتابة بالعربي.',
  yourName: 'اسمك', namePh: 'مثال: سارة', email: 'البريد الإلكتروني', emailPh: 'you@example.com',
  password: 'كلمة المرور', passPh: '٦ أحرف على الأقل',
  createAccount: 'أنشئ حسابك', takes30: 'لن يستغرق ذلك أكثر من ٣٠ ثانية.',
  welcomeBack: 'مرحبًا بعودتك', signInHint: 'سجّل الدخول لفتح قائمة التسوق.',
  register: 'تسجيل', signIn: 'تسجيل الدخول', alreadyReg: 'لديك حساب؟ ', newHere: 'جديد هنا؟ ',
  createAnAccount: 'أنشئ حسابًا', forgot: 'نسيت كلمة المرور؟',
  typeEmailFirst: 'اكتب بريدك الإلكتروني في الأعلى أولًا.', resetSent: 'تحقق من بريدك الإلكتروني، أرسلنا لك رابطًا لإعادة تعيين كلمة المرور.',
  errInUse: 'هذا البريد مسجّل مسبقًا — اضغط «تسجيل الدخول» بالأسفل.',
  errEmail: 'يرجى إدخال بريد إلكتروني صحيح.',
  errWeak: 'يجب أن تتكون كلمة المرور من ٦ أحرف على الأقل.',
  errCred: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  errMany: 'محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.',
  errNet: 'لا يوجد اتصال بالإنترنت. حاول مرة أخرى.',
  errDisabled: 'تسجيل الدخول بالبريد الإلكتروني غير مفعّل بعد في Firebase.',
  errGeneric: 'حدث خطأ ما. حاول مرة أخرى.',
  enterName: 'يرجى إدخال اسمك.', enterEmailPass: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.',

  cat_produce: 'خضار وفواكه', cat_dairy: 'ألبان وبيض', cat_meat: 'لحوم وأسماك', cat_bakery: 'مخبوزات',
  cat_pantry: 'مواد غذائية', cat_frozen: 'مجمدات', cat_drinks: 'مشروبات', cat_snacks: 'وجبات خفيفة',
  cat_household: 'أدوات منزلية', cat_personal: 'عناية شخصية', cat_baby: 'أطفال', cat_other: 'أخرى',

  errPerm: 'لا يُسمح لهذا الهاتف بتعديل القائمة.',
  errSave: 'تعذّر حفظ التغيير. تحقق من الاتصال وحاول مرة أخرى.',
  viewOnlyMsg: 'لديك صلاحية العرض فقط لهذه القائمة.',
  me: 'أنا', you: 'أنت', addedBy: 'أضافه {name}', check: 'تحديد {name}', uncheck: 'إلغاء تحديد {name}',
  summary: 'المتبقي {todo} · في السلة {done}', nothingYet: 'القائمة فارغة حاليًا',
  viewOnlyTitle: '👁 عرض فقط', viewOnlyText: ' يمكنك رؤية {list} وسجلها، لكن لا يمكنك تعديلها.',
  addAgain: 'أضف مرة أخرى',
  emptyRo: 'هذه القائمة فارغة حاليًا.',
  emptyShop: 'القائمة فارغة — انتقل إلى «القائمة» لإضافة أغراض.',
  emptyPlan: 'أضف أول غرض بالأسفل. كل ما تضيفه يظهر على هواتف العائلة.',
  allDone: 'تم! كل شيء في السلة.',
  inCart: 'في السلة ({n})', clearChecked: 'مسح الأغراض المحددة (تبقى في السجل)',
  today: 'اليوم', yesterday: 'أمس',
  noTrips: 'لا توجد رحلات تسوق بعد. كل غرض تحدده أثناء التسوق يُحفظ هنا تلقائيًا، مرتبًا حسب اليوم.',
  statTrips: 'رحلات تسوق', statMonth: 'هذا الشهر', statTop: 'الأكثر شراءً',
  by: ' · بواسطة ', and: ' و', addOne: '+ إضافة', addAll: 'أضف كل الأغراض ({n}) إلى القائمة',

  myList: 'قائمتي', listOf: 'قائمة {name}', list: 'قائمة', viewSuffix: ' · عرض', family: '👥 العائلة',
  myShoppingList: 'قائمة تسوقي', shoppingListOf: 'قائمة تسوق {name}',
  signOut: 'تسجيل الخروج', hi: 'مرحبًا، {name}',
  mainList: 'القائمة الرئيسية', newList: '+ قائمة جديدة', newListTitle: 'قائمة جديدة', editListTitle: 'تعديل القائمة',
  newListSub: 'لها أغراضها ووضع التسوق والسجل الخاص بها، وتظهر لعائلتك أيضًا.',
  listName: 'اسم القائمة', listNamePh: 'مثال: حفلة، صيدلية، رمضان', listIcon: 'الأيقونة', create: 'إنشاء',
  deleteList: 'حذف القائمة', enterListName: 'يرجى كتابة اسم للقائمة.',
  confirmDeleteList: 'حذف «{name}» مع كل أغراضها وسجلها؟ لا يمكن التراجع عن ذلك.',
  listCreated: '«{name}» جاهزة — أضف أول غرض.', listDeleted: 'تم حذف القائمة.', listGone: 'تم حذف هذه القائمة.',
  listCreateFail: 'تعذر إنشاء القائمة. يرجى المحاولة مرة أخرى.', editListAria: 'تعديل {name}',
  shoppingListName: '{list} · {name}',
  familyBtn: 'العائلة', peopleNav: 'قوائم مَن', listsNav: 'القوائم', editMainHint: 'يمكن إعادة تسمية القائمة الرئيسية لكن لا يمكن حذفها.',
  cantReach: 'لا يمكن الوصول إلى القائمة بعد — نعرض ما هو محفوظ على هذا الهاتف، وستتحدث عند عودة الاتصال.',
  noAccess: 'لم تعد لديك صلاحية الوصول إلى هذه القائمة.',
  liveStopped: 'توقفت التحديثات المباشرة. أعد فتح التطبيق لإعادة الاتصال.',

  famTitle: 'العائلة', famSub: 'شارك قوائم التسوق مع من يعيشون معك.',
  inviteTitle: 'دعوة فرد من العائلة',
  inviteLead: 'أدخل البريد الإلكتروني الذي سجّل به، ثم اختر ما يمكنه فعله في قائمتك.',
  access: 'الصلاحية', canEdit: 'يمكنه التعديل', canEditDesc: 'إضافة الأغراض وتحديدها وحذفها',
  viewOnly: 'عرض فقط', viewOnlyDesc: 'رؤية القائمة والسجل',
  memberEmail: 'البريد الإلكتروني لفرد العائلة', adding: 'جارٍ الإضافة',
  members: 'الأعضاء', noMembers: 'لا يوجد أفراد بعد', noMembersHint: 'أضف شخصًا في الأعلى لتبدأ بمشاركة قائمتك.',
  bNoAccess: 'لا صلاحية له على قائمتك', bCanView: 'يمكنه رؤية قائمتك', bCanEdit: 'يمكنه تعديل قائمتك',
  bShared: 'شارك قائمته معك', bNotShared: 'لم يشارك قائمته بعد',
  confirmRemove: 'إزالة صلاحية {name} على قائمتك؟ لن يتمكن من رؤيتها أو تعديلها بعد الآن.',
  remove: 'إزالة', openTheirList: 'فتح قائمته', shareMyList: 'مشاركة قائمتي',
  makeViewOnly: 'تحويل إلى عرض فقط', allowEditing: 'السماح بالتعديل',
  famNote: 'فقط من تضيفهم يمكنهم فتح قائمتك. لكل شخص قائمته وسجله الخاص.',
  fOwn: 'هذا بريدك أنت. أدخل بريد أحد أفراد العائلة.',
  fAlready: '{name} لديه صلاحية على قائمتك بالفعل.',
  fNoAccount: 'لا يوجد حساب بهذا البريد بعد. اطلب منه التسجيل في التطبيق أولًا، ثم أضفه مرة أخرى.',
  fAddFail: 'تعذّرت الإضافة. تحقق من الاتصال وحاول مرة أخرى.',
  fSharedView: 'يمكن لـ{name} الآن رؤية قائمتك.', fSharedEdit: 'يمكن لـ{name} الآن رؤية قائمتك وتعديلها.',
  fShareFail: 'تعذّرت مشاركة قائمتك. حاول مرة أخرى.',
  fRoleView: 'أصبح بإمكان {name} رؤية قائمتك فقط.', fRoleEdit: 'أصبح بإمكان {name} تعديل قائمتك.',
  fRoleFail: 'تعذّر تغيير الصلاحية. حاول مرة أخرى.',
  fRemoved: 'لم يعد بإمكان {name} الوصول إلى قائمتك.', fRemoveFail: 'تعذّرت الإزالة. حاول مرة أخرى.',
  they: 'الشخص', familyMember: 'فرد من العائلة',
  setupNotFinished: 'الإعداد غير مكتمل: أضف إعدادات Firebase في أعلى ملف app.js.', notSyncing: 'غير متزامن',
};

const DICT = { en: EN, ar: AR };

function detect(){
  try { const s = localStorage.getItem('shopLang'); if (LANGS.includes(s)) return s; } catch(e){}
  const n = (navigator.language || 'en').toLowerCase();
  return n.startsWith('ar') ? 'ar' : 'en';
}
export const lang = detect();
export const isAr = lang === 'ar';
export const dateLocale = isAr ? 'ar-u-ca-gregory-nu-latn' : undefined;

export function t(key, vars){
  let s = DICT[lang][key] ?? EN[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

// counted phrases ("3 items", "1 item added")
export function itemsCount(n){
  if (!isAr) return n === 1 ? '1 item' : n + ' items';
  if (n === 1) return 'غرض واحد';
  if (n === 2) return 'غرضان';
  if (n >= 3 && n <= 10) return n + ' أغراض';
  return n + ' غرضًا';
}
export function itemsAdded(n){
  if (!isAr) return n + ' item' + (n === 1 ? '' : 's') + ' added to the list ✓';
  return (n === 1 ? 'تمت إضافة غرض واحد' : n === 2 ? 'تمت إضافة غرضين' : 'تمت إضافة ' + itemsCount(n)) + ' إلى القائمة ✓';
}

export function setLang(l){
  try { localStorage.setItem('shopLang', l); } catch(e){}
  location.reload();
}

// fill the fixed text in index.html (elements marked data-i18n / data-i18n-ph)
export function applyStatic(){
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.title = t('docTitle');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}

// Arabic and Persian digits → 0-9, so "٢ خبز" works like "2 bread"
export function normDigits(s){
  return String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

// Arabic words used to guess the aisle of an item
export const AR_KEYWORDS = {
  produce: 'تفاح موز برتقال ليمون طماطم طماط بندورة بطاطس بطاطا بصل ثوم خيار خس جزر فلفل سبانخ بقدونس نعناع كزبرة فواكه فاكهة خضار خضروات عنب مانجو مانجا أفوكادو كوسا باذنجان تمر بلح فراولة بطيخ شمام زنجبيل رمان',
  dairy: 'حليب لبن زبادي روب جبن جبنة زبدة زبده قشطة كريمة بيض لبنة حلوم',
  meat: 'دجاج فراخ لحم لحمة غنم خروف بقر عجل سمك روبيان جمبري سلمون تونة نقانق سجق ديك مفروم',
  bakery: 'خبز صامولي عيش كعك كيك كرواسون توست تميس شابورة',
  pantry: 'رز أرز ارز مكرونة معكرونة دقيق طحين سكر ملح زيت زيتون بهارات كمون شاي قهوة فول عدس صلصة كاتشب مايونيز عسل مربى شوفان كورن خل طحينة حمص نودلز',
  frozen: 'مجمد مجمدة آيس ايسكريم بازلاء ناجتس',
  drinks: 'ماء مياه موية عصير مشروب مشروبات بيبسي كولا',
  snacks: 'شيبس شوكولاتة شوكولاته بسكويت كوكيز مكسرات حلويات حلاوة فشار',
  household: 'مناديل محارم ورق منظف صابون كلور أكياس اكياس قصدير اسفنج إسفنج معطر',
  personal: 'شامبو معجون فرشاة مزيل لوشن بلسم شفرات',
  baby: 'حفاضات حفاض حفايض',
};
