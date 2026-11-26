// List types: each type has its own sections, words used to guess a section, and suggested items.
// 'shopping' keeps the original supermarket sections (defined in app.js / i18n.js).

export const TYPES = {
  shopping: { e:'🛒', icon:'🛒', qty:true },
  todo: {
    e:'✅', icon:'✅', qty:false,
    cats:[ {id:'t_home', e:'🏠'}, {id:'t_errands', e:'🚗'}, {id:'t_work', e:'💼'}, {id:'t_calls', e:'📞'}, {id:'t_bills', e:'💳'}, {id:'other', e:'📌'} ],
    kw:{
      en:{ t_bills:'pay bill bills rent fee fees electricity internet subscription invoice installment',
           t_calls:'call phone ring book appointment doctor dentist clinic',
           t_work:'report meeting email presentation project deadline client office',
           t_errands:'buy pick drop renew registration car bank post deliver collect return shop',
           t_home:'clean tidy laundry fix repair cook wash dishes room garden ac paint organize' },
      ar:{ t_bills:'دفع ادفع فاتورة فواتير إيجار ايجار رسوم كهرباء انترنت إنترنت اشتراك قسط',
           t_calls:'اتصال اتصل كلم موعد حجز احجز دكتور طبيب عيادة اسنان أسنان',
           t_work:'تقرير اجتماع ايميل إيميل عرض مشروع دوام عميل مكتب',
           t_errands:'شراء اشتري استلام استلم توصيل وصل تجديد جدد سيارة بنك بريد استمارة رخصة',
           t_home:'تنظيف نظف ترتيب رتب غسيل اغسل تصليح صلح إصلاح صيانة طبخ غرفة حديقة مكيف' }
    },
    sug:{
      en:[['Pay the electricity bill','t_bills'],['Pay the rent','t_bills'],['Book a doctor appointment','t_calls'],['Call the plumber','t_calls'],['Renew car registration','t_errands'],['Pick up the kids','t_errands'],['Wash the car','t_errands'],['Clean the AC filters','t_home'],['Do the laundry','t_home'],['Send the weekly report','t_work']],
      ar:[['دفع فاتورة الكهرباء','t_bills'],['دفع الإيجار','t_bills'],['حجز موعد عند الطبيب','t_calls'],['الاتصال بالسبّاك','t_calls'],['تجديد استمارة السيارة','t_errands'],['استلام الأطفال من المدرسة','t_errands'],['غسيل السيارة','t_errands'],['تنظيف فلاتر المكيف','t_home'],['غسيل الملابس','t_home'],['إرسال التقرير الأسبوعي','t_work']]
    }
  },
  packing: {
    e:'🧳', icon:'🧳', qty:true,
    cats:[ {id:'p_docs', e:'🛂'}, {id:'p_clothes', e:'👕'}, {id:'p_toiletries', e:'🪥'}, {id:'p_tech', e:'🔌'}, {id:'p_meds', e:'💊'}, {id:'p_kids', e:'🧸'}, {id:'other', e:'📦'} ],
    kw:{
      en:{ p_docs:'passport id visa ticket tickets license insurance cash card wallet booking',
           p_tech:'charger phone laptop headphones earphones adapter power bank cable camera tablet ipad',
           p_toiletries:'toothbrush toothpaste shampoo soap deodorant razor perfume sunscreen comb towel',
           p_meds:'medicine medicines pills panadol bandage vitamins first aid',
           p_kids:'toys toy diapers stroller wipes bottle',
           p_clothes:'shirt shirts pants trousers jeans dress socks underwear jacket shoes thobe abaya pajamas hat swimsuit clothes sandals' },
      ar:{ p_docs:'جواز هوية تأشيرة فيزا تذكرة تذاكر رخصة تأمين نقود كاش بطاقة محفظة حجز',
           p_tech:'شاحن جوال لابتوب سماعات سماعة محول باور كيبل كاميرا ايباد',
           p_toiletries:'فرشاة معجون شامبو صابون مزيل عطر واقي مشط منشفة',
           p_meds:'دواء أدوية ادوية حبوب بنادول لاصق فيتامين إسعافات',
           p_kids:'ألعاب العاب لعبة حفاضات عربة رضاعة',
           p_clothes:'ملابس قميص بنطلون فستان جوارب شراب جاكيت حذاء جزمة ثوب ثياب عباية بيجامة شماغ غترة نعال' }
    },
    sug:{
      en:[['Passports','p_docs'],['Tickets','p_docs'],['Wallet','p_docs'],['Phone charger','p_tech'],['Power bank','p_tech'],['Toothbrush','p_toiletries'],['Perfume','p_toiletries'],['Pajamas','p_clothes'],['Shoes','p_clothes'],['Medicines','p_meds']],
      ar:[['جوازات السفر','p_docs'],['التذاكر','p_docs'],['المحفظة','p_docs'],['شاحن الجوال','p_tech'],['باور بانك','p_tech'],['فرشاة الأسنان','p_toiletries'],['العطر','p_toiletries'],['البيجامة','p_clothes'],['حذاء','p_clothes'],['الأدوية','p_meds']]
    }
  },
  event: {
    e:'🎉', icon:'🎉', qty:true,
    cats:[ {id:'e_food', e:'🍽️'}, {id:'e_drinks', e:'🥤'}, {id:'e_decor', e:'🎈'}, {id:'e_guests', e:'💌'}, {id:'e_tasks', e:'📋'}, {id:'e_gifts', e:'🎁'}, {id:'other', e:'📦'} ],
    kw:{
      en:{ e_gifts:'gift gifts wrapping present presents',
           e_guests:'invite invites invitation invitations guest guests rsvp',
           e_decor:'balloon balloons decoration decorations flowers lights candles banner tablecloth',
           e_drinks:'juice water coffee tea soda drinks qahwa',
           e_tasks:'book booking clean arrange order pick setup photographer music hall',
           e_food:'cake food dinner lunch rice kabsa sweets dessert pizza sandwiches fruit dates plates cups' },
      ar:{ e_gifts:'هدية هدايا تغليف',
           e_guests:'دعوة دعوات ضيوف ضيف',
           e_decor:'بالونات بالون زينة ورد إضاءة اضاءة شموع شمع طاولة مفرش',
           e_drinks:'عصير ماء مياه قهوة شاي مشروبات',
           e_tasks:'حجز احجز تنظيف ترتيب طلب اطلب تجهيز مصور قاعة',
           e_food:'كيك كيكة أكل اكل طعام عشاء غداء كبسة حلا حلويات بيتزا ساندوتش فواكه تمر صحون أكواب اكواب' }
    },
    sug:{
      en:[['Cake','e_food'],['Dates','e_food'],['Paper plates','e_food'],['Juice','e_drinks'],['Arabic coffee','e_drinks'],['Balloons','e_decor'],['Candles','e_decor'],['Send invitations','e_guests'],['Book the hall','e_tasks'],['Gifts','e_gifts']],
      ar:[['كيك','e_food'],['تمر','e_food'],['صحون ورقية','e_food'],['عصير','e_drinks'],['قهوة عربية','e_drinks'],['بالونات','e_decor'],['شموع','e_decor'],['إرسال الدعوات','e_guests'],['حجز القاعة','e_tasks'],['هدايا','e_gifts']]
    }
  },
  general: { e:'📝', icon:'📝', qty:true, cats:[ {id:'other', e:'📝'} ], kw:{en:{},ar:{}}, sug:{en:[],ar:[]} }
};
export const TYPE_IDS = Object.keys(TYPES);

// shopping suggestions (sections come from the shopping keywords)
export const SHOP_SUG = {
  en:[['Milk','dairy'],['Bread','bakery'],['Eggs','dairy'],['Rice','pantry'],['Chicken','meat'],['Tomatoes','produce'],['Onions','produce'],['Water','drinks'],['Laban','dairy'],['Dates','produce'],['Tea','pantry'],['Tissues','household']],
  ar:[['حليب','dairy'],['خبز','bakery'],['بيض','dairy'],['رز','pantry'],['دجاج','meat'],['طماطم','produce'],['بصل','produce'],['ماء','drinks'],['لبن','dairy'],['تمر','produce'],['شاي','pantry'],['مناديل','household']]
};

// words that change with the list type
export const TYPE_TEXT = {
  en:{
    type_shopping:'Shopping', type_todo:'To-do', type_packing:'Packing', type_event:'Event', type_general:'Other',
    listType:'List type', suggestions:'Suggestions',
    cat_t_home:'Home', cat_t_errands:'Errands', cat_t_work:'Work', cat_t_calls:'Calls & appointments', cat_t_bills:'Bills',
    cat_p_docs:'Documents & money', cat_p_clothes:'Clothes', cat_p_toiletries:'Toiletries', cat_p_tech:'Electronics', cat_p_meds:'Medicines', cat_p_kids:'Kids',
    cat_e_food:'Food', cat_e_drinks:'Drinks', cat_e_decor:'Decoration', cat_e_guests:'Guests', cat_e_tasks:'Tasks', cat_e_gifts:'Gifts',
    cat_general_other:'Items',
    summary_todo:'{todo} to do · {done} done', summary_packing:'{todo} to pack · {done} packed', summary_event:'{todo} to prepare · {done} ready', summary_general:'{todo} left · {done} done',
    tabTick_todo:'Do', tabTick_packing:'Pack', tabTick_event:'Prepare', tabTick_general:'Check',
    addPlaceholder_todo:'Add a task… e.g. Pay the rent - before the 5th', addPlaceholder_packing:'Add something to pack… e.g. 3 shirts', addPlaceholder_event:'Add something… e.g. Cake - chocolate, for 12', addPlaceholder_general:'Add an item…',
    inCart_todo:'Done ({n})', inCart_packing:'Packed ({n})', inCart_event:'Ready ({n})', inCart_general:'Done ({n})',
    allDone_todo:'All done! Nothing left to do.', allDone_packing:'All packed — have a good trip!', allDone_event:'Everything is ready!', allDone_general:'All done!',
    statTrips_todo:'days', statTrips_packing:'days', statTrips_event:'days', statTrips_general:'days',
    statTop_todo:'most done', statTop_packing:'most packed', statTop_event:'most used', statTop_general:'most added'
  },
  ar:{
    type_shopping:'تسوق', type_todo:'مهام', type_packing:'تجهيز سفر', type_event:'مناسبة', type_general:'أخرى',
    listType:'نوع القائمة', suggestions:'اقتراحات',
    cat_t_home:'البيت', cat_t_errands:'مشاوير', cat_t_work:'العمل', cat_t_calls:'اتصالات ومواعيد', cat_t_bills:'فواتير',
    cat_p_docs:'وثائق ونقود', cat_p_clothes:'ملابس', cat_p_toiletries:'أدوات العناية', cat_p_tech:'إلكترونيات', cat_p_meds:'أدوية', cat_p_kids:'الأطفال',
    cat_e_food:'أكل', cat_e_drinks:'مشروبات', cat_e_decor:'زينة', cat_e_guests:'الضيوف', cat_e_tasks:'مهام', cat_e_gifts:'هدايا',
    cat_general_other:'العناصر',
    summary_todo:'المتبقي {todo} · تم {done}', summary_packing:'المتبقي {todo} · في الشنطة {done}', summary_event:'المتبقي {todo} · جاهز {done}', summary_general:'المتبقي {todo} · تم {done}',
    tabTick_todo:'إنجاز', tabTick_packing:'تجهيز', tabTick_event:'تحضير', tabTick_general:'تحديد',
    addPlaceholder_todo:'أضف مهمة… مثال: دفع الإيجار - قبل يوم ٥', addPlaceholder_packing:'أضف شيئًا للشنطة… مثال: ٣ قمصان', addPlaceholder_event:'أضف شيئًا… مثال: كيك - شوكولاتة لـ١٢ شخص', addPlaceholder_general:'أضف عنصرًا…',
    inCart_todo:'تم ({n})', inCart_packing:'في الشنطة ({n})', inCart_event:'جاهز ({n})', inCart_general:'تم ({n})',
    allDone_todo:'تم! لا توجد مهام متبقية.', allDone_packing:'كل شيء في الشنطة — رحلة سعيدة!', allDone_event:'كل شيء جاهز!', allDone_general:'تم كل شيء!',
    statTrips_todo:'أيام', statTrips_packing:'أيام', statTrips_event:'أيام', statTrips_general:'أيام',
    statTop_todo:'الأكثر إنجازًا', statTop_packing:'الأكثر تجهيزًا', statTop_event:'الأكثر استخدامًا', statTop_general:'الأكثر إضافة'
  }
};
