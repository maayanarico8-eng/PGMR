/**
 * Pre-built test sentences for pictogram bank testing (no AI).
 * Each entry lists representative words to resolve against pictograms/bank/.
 */
(function (root) {
  root.MemoryEngineTestSentences = [
    {
      id: 'ts01',
      label: 'סבא + עיתון',
      text: 'סבא קרא לי עיתון.',
      words: ['סבא', 'עיתון'],
    },
    {
      id: 'ts02',
      label: 'סבתא + נדנדה',
      text: 'סבתא דחפה את הילדה על נדנדה.',
      words: ['סבתא', 'ילדה', 'נדנדה'],
    },
    {
      id: 'ts03',
      label: 'טיול ביער',
      text: 'נסענו לטיול ביער.',
      words: ['נסענו', 'טיול', 'יער'],
    },
    {
      id: 'ts04',
      label: 'אוטובוס לבית ספר',
      text: 'בבוקר נסענו באוטובוס לבית ספר.',
      words: ['בוקר', 'נסענו', 'אוטובוס', 'בית ספר'],
    },
    {
      id: 'ts05',
      label: 'מתנה ליום הולדת',
      text: 'קיבלתי מתנה ביום הולדת.',
      words: ['מתנה', 'יום הולדת'],
    },
    {
      id: 'ts06',
      label: 'סבא + אוניה',
      text: 'סבא נסע באוניה.',
      words: ['סבא', 'אוניה'],
    },
    {
      id: 'ts07',
      label: 'מעורב — יש ואין',
      text: 'סבא נסע באוטובוס עם חתול.',
      words: ['סבא', 'אוטובוס', 'חתול'],
    },
    {
      id: 'ts08',
      label: 'הכל חסר (X)',
      text: 'אמא לקחה את הכלב לפארק.',
      words: ['אמא', 'כלב', 'פארק'],
    },
    {
      id: 'ts10',
      label: 'קיץ + בריכה + גלידה',
      text: 'בקיץ סבא היה לוקח אותי לבריכה וקונה לי גלידה',
      words: ['בקיץ', 'סבא', 'בריכה', 'גלידה'],
    },
  ];

  function findByText(text) {
    const n = (text || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
    return (
      root.MemoryEngineTestSentences.find((s) => {
        const t = s.text.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
        return t === n || t === n + '.' || s.text.trim() === text.trim();
      }) || null
    );
  }

  root.MemoryEngineTestSentencesApi = { findByText, all: () => root.MemoryEngineTestSentences };
})(typeof globalThis !== 'undefined' ? globalThis : window);
