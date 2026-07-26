/**
 * Archive catalog — State 1 (home) names from Figma 1386:76703.
 * Later states add body / source / params / assets per memory.
 */
(function (global) {
  const BASE = '/memory-processor/assets/archive';

  const NAMES = [
    'גן, בריכה, סבא',
    'אני, אחותי, מגדת עתידות',
    'יום הולדת, סבא, מוזיאון השעווה',
    'קיץ, חופשה, טורקיה',
    'בוקר, חדר אוכל, ביצה קשה',
    'אני, יונתן, מסעדה',
    'בוקר, טיול, כתם',
    'סבא, בית ספר, אוטובוס',
    'טוסט, חמאה, שום',
    'אני, סבא, גירים',
    'אורז, אפונה, גזר',
    'טלפון, ספורט, מדינות',
    'לא, דיבר, שואה',
    'מטפחות בד, זיעה, פנים',
    'מבוך, עץ, גולות',
    'תפוחי אדמה, עגבנייה, בצל',
    'סבא, מטפחות בד, חולצות מכופתרות',
    'לילה, מרבד, רקמה',
    'סבא, סרטים מצוירים, בית',
    'סבב, אחים, שישי',
    'שעון מחוגים, שרוכים, נעליים',
    'מכין, שיעורים בית, תשובות',
    'ארוחת ערב, כוס, ליקר',
    'סבא, אותי, כותל',
    'פטריות, שקית, אדמה',
    'לימד, שחמט, מנצח',
    'בריכה, ערסל, שרים',
    'לקרוא, בשעה 16:00, שיעורי בית',
    'סבא, בוקר, בית',
    'מדברים, צ׳כית, לא',
    'בית משרדים, מסטיקים, קופסא',
    'סוכריות, יום הולדת, לי',
    'ספסל, בית, בית ספר',
    'אומנות, מלאכת יד, ויטראז׳',
    'קיבוץ, גלידה, צידנית',
    'לעבוד, ניירת, מחשב',
    'בול, מים, אלבום',
    'בוץ, סכין, נעליים',
    'מזגן, חלונות, לנשום',
    'ארנבת, שדה, כרוב',
    'קלטות, סרטים מצוירים, מדבקה',
    'סבא, יום הולדת, פיקאצ׳ו',
    'בוקר, כורסא, שוקו',
    'יצירה, שולחן, פסיפס',
    'מטבעות, בולים, מכתבים',
    'סבא, אותי, לשחות',
    'לילה, טיול, שער',
    'רהיטים, איורים, בית בובות',
    'אותי, מתנה, קוף',
    'מטע זיתים, תצפית, ציפורים',
    'לינה שיתופית, טיול, חליבה',
    'בקבוק, שירים, סיפורים',
    'מימייה, אולר, תפוזים',
    'ג׳יפ, כספים, סבא',
    'סבא, סבתא, רמי',
    'סבא, לי, ציפורניים',
    'הייתי, כדורעף, אימונים',
    'גלידות, מהר, שאריות',
    'אפודה, אני, חזית',
    'חברות, עוגה, שתיה חמה',
  ];

  /** @type {Array<{ id: string, name: string, body?: string, source?: unknown, frequency?: number, clarity?: number, impact?: number, output?: string, icon?: string, iconTop?: number }>} */
  const MEMORIES = NAMES.map((name, i) => {
    const id = String(i + 1).padStart(3, '0');
    const entry = { id, name };
    // 001 keeps prior card assets when later states unlock — not used in State 1.
    if (id === '001') {
      // Layout placeholder data — real content will replace these later.
      entry.body = 'שהייתי בגן והלכנו לבריכה והייתי רואה את סבא וסבתא שם הייתי מבקשת ללכת אליהם הביתה. סבא תמיד הסכים.';
      /* Figma span split (1386:78234): hide non-rep in place; keep flow. */
      entry.bodySegments = [
        { text: 'ש', rep: false },
        { text: 'הייתי ', rep: true },
        { text: 'ב', rep: false },
        { text: 'גן ', rep: true },
        { text: 'והלכנו ל', rep: false },
        { text: 'בריכה', rep: true },
        { text: ' והייתי', rep: false },
        { text: ' רואה ', rep: true },
        { text: 'את ', rep: false },
        { text: 'סבא ', rep: true },
        { text: 'ו', rep: false },
        { text: 'סבתא ', rep: true },
        { text: 'שם הייתי ', rep: false },
        { text: 'מבקשת ', rep: true },
        { text: 'ללכת אליהם ', rep: false },
        { text: 'הביתה', rep: true },
        { text: '. סבא תמיד ', rep: false },
        { text: 'הסכים', rep: true },
        { text: '.', rep: false },
      ];
      /* Sequence LTR (left→right), gap 8 between SVG boxes. */
      entry.sequence = [
        { src: `${BASE}/001/sequence/yes.svg`, w: 104.36, x: 0 },
        { src: `${BASE}/001/sequence/house.svg`, w: 83.98, x: 112.36 },
        { src: `${BASE}/001/sequence/please.svg`, w: 104.52, x: 204.34 },
        { src: `${BASE}/001/sequence/grandmother.svg`, w: 96.14, x: 316.86 },
        { src: `${BASE}/001/sequence/grandfather.svg`, w: 104.76, x: 421 },
        { src: `${BASE}/001/sequence/see.svg`, w: 104.52, x: 533.76 },
        { src: `${BASE}/001/sequence/pool.svg`, w: 67.66, x: 646.28 },
        { src: `${BASE}/001/sequence/kindergarten.svg`, w: 104.605, x: 721.94 },
        { src: `${BASE}/001/sequence/girl.svg`, w: 102.285, x: 834.545 },
      ];
      entry.source = {
        type: 'מתווך',
        category: 'בן משפחה',
        kind: 'סבתא',
        name: 'מרים',
      };
      entry.frequency = 21;
      entry.clarity = 51;
      entry.impact = 57;
      entry.output = `${BASE}/001/output.svg`;
      entry.icon = `${BASE}/001/icon.svg`;
      entry.iconTop = 368.815;
    }
    return entry;
  });

  global.ArchiveMemories = MEMORIES;
})(typeof globalThis !== 'undefined' ? globalThis : window);
