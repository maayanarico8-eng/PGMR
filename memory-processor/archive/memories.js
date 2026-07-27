/**
 * Archive catalog — static base memory 001.
 * Visitor prints are stored in IndexedDB (ArchiveStore), not here.
 */
(function (global) {
  const BASE = '/memory-processor/assets/archive';

  /** @type {Array<{ id: string, name: string, body?: string, source?: unknown, frequency?: number, clarity?: number, impact?: number, output?: string, icon?: string, iconTop?: number }>} */
  const MEMORIES = [
    {
      id: '001',
      name: 'גן, בריכה, סבא',
      body: 'שהייתי בגן והלכנו לבריכה והייתי רואה את סבא וסבתא שם הייתי מבקשת ללכת אליהם הביתה. סבא תמיד הסכים.',
      /* Figma span split (1386:78234): hide non-rep in place; keep flow. */
      bodySegments: [
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
      ],
      /* Sequence LTR (left→right), gap 8 between SVG boxes. */
      sequence: [
        { src: `${BASE}/001/sequence/yes.svg`, w: 104.36, x: 0 },
        { src: `${BASE}/001/sequence/house.svg`, w: 83.98, x: 112.36 },
        { src: `${BASE}/001/sequence/please.svg`, w: 104.52, x: 204.34 },
        { src: `${BASE}/001/sequence/grandmother.svg`, w: 96.14, x: 316.86 },
        { src: `${BASE}/001/sequence/grandfather.svg`, w: 104.76, x: 421 },
        { src: `${BASE}/001/sequence/see.svg`, w: 104.52, x: 533.76 },
        { src: `${BASE}/001/sequence/pool.svg`, w: 67.66, x: 646.28 },
        { src: `${BASE}/001/sequence/kindergarten.svg`, w: 104.605, x: 721.94 },
        { src: `${BASE}/001/sequence/girl.svg`, w: 102.285, x: 834.545 },
      ],
      source: {
        type: 'מתווך',
        category: 'בן משפחה',
        kind: 'סבתא',
        name: 'מרים',
      },
      frequency: 21,
      clarity: 51,
      impact: 57,
      output: `${BASE}/001/output.svg`,
      icon: `${BASE}/001/icon.svg`,
      iconTop: 368.815,
    },
  ];

  global.ArchiveMemories = MEMORIES;
})(typeof globalThis !== 'undefined' ? globalThis : window);
