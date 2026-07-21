/**
 * Archive catalog.
 *
 * Detail screens are Figma frame exports (1920×1080 PNG/SVG) — two states per memory:
 *   frames.default  — click / idle detail
 *   frames.hover    — hover memory text (representative words + pictogram strip, no chevron)
 *
 * List hover comes from the separate “Hover a Memory” Figma frame:
 *   crop → previewPictogram; read % → frequency / clarity / impact;
 *   previewPlacement 'top'|'bottom'; optional previewFigmaTop when top Y ≠ 366.72.
 *
 * To add a memory: export Click / Hover-text / Hover-a-Memory from Figma into
 *   memory-processor/assets/archive/NNN/detail-{default,hover}.{png|svg}
 *   + preview crop, then set ready:true + frames + list-hover fields below
 * (list title comes from `titles`). See archive/ADDING-MEMORIES.md.
 */
(function (global) {
  const titles = [
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

  const ARCHIVED_MEMORIES = titles.map((title, i) => {
    const id = String(i + 1).padStart(3, '0');
    const row = {
      id,
      title,
      ready: false,
      frequency: null,
      clarity: null,
      impact: null,
      previewPictogram: null,
      frames: null,
    };
    const extra = ({
      '001': {
        frequency: 9,
        clarity: 36,
        impact: 71,
        previewPictogram: '/memory-processor/assets/archive/001/preview.png',
        previewPlacement: 'top',
        ready: true,
        frames: {
          default: '/memory-processor/assets/archive/001/detail-default.svg',
          hover: '/memory-processor/assets/archive/001/detail-hover.svg',
        },
      },
      '002': {
        frequency: 100,
        clarity: 61,
        impact: 10,
        previewPictogram: '/memory-processor/assets/archive/002/preview.png',
        previewPlacement: 'bottom',
        ready: true,
        frames: {
          default: '/memory-processor/assets/archive/002/detail-default.svg',
          hover: '/memory-processor/assets/archive/002/detail-hover.svg',
        },
      },
      '003': {
        frequency: 78,
        clarity: 83,
        impact: 24,
        previewPictogram: '/memory-processor/assets/archive/003/preview.png',
        // Figma Hover a Memory — pictogram at x:1629 y:142 w:208 h:195 (top-right)
        previewPlacement: 'top',
        previewFigmaTop: 142,
        ready: true,
        frames: {
          default: '/memory-processor/assets/archive/003/detail-default.svg',
          hover: '/memory-processor/assets/archive/003/detail-hover.svg',
        },
      },
    })[id];
    if (extra) Object.assign(row, extra);
    return row;
  });

  global.ArchivedMemories = ARCHIVED_MEMORIES;
})(typeof globalThis !== 'undefined' ? globalThis : window);
