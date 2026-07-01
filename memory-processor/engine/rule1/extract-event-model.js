/**
 * Stage 1.1–1.2: language detection + Event Model extraction from written memory.
 * Returns { supported: true, eventModel } or { supported: false, reason }.
 */
(function (root) {
  const { normalizeMemoryText } = root.MemoryEngineConfig;

  function detectLanguage(text) {
    const he = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const en = (text.match(/[a-zA-Z]/g) || []).length;
    if (he && en) return 'Mixed';
    if (he) return 'Hebrew';
    return 'English';
  }

  /** Curated extractor — built-in example memory */
  function extractSaturdayGrandfather(text) {
    const n = normalizeMemoryText(text);
    const key = 'בשבת בבוקר, סבא היה קורא לי עיתון ושרנו ביחד';
    if (n !== key && n !== key + '.') return null;

    return {
      memoryLanguage: 'Hebrew',
      coreNarrative: 'בשבת בבוקר, סבא קרא לנכד/ה עיתון ושרו ביחד.',
      memoryFrame: {
        location: null,
        temporalContext: 'recurring',
        recurrencePattern: 'כל שבת בבוקר',
        period: null,
        temporalReferent: 'שבת בבוקר',
        temporalReferentSource: 'בשבת בבוקר',
        habitualAnnotation: 'היה קורא',
      },
      events: [
        {
          id: 'e_01',
          nucleus: { type: 'activity', description: 'קריאת עיתון לנכד/ה' },
          participants: [
            { referent: 'סבא', canonicalReferent: 'grandfather', role: 'agent', isNarrator: false, sourceText: 'סבא' },
            { referent: 'מספר/ת', canonicalReferent: 'narrator', role: 'recipient', isNarrator: true, sourceText: 'לי' },
          ],
          objects: [{ referent: 'עיתון', canonicalReferent: 'newspaper', sourceText: 'עיתון' }],
          actionPhrase: 'קורא לי עיתון',
          actionField: 'קריאת עיתון',
          actionCanonical: 'reading newspaper',
          specificLocation: null,
          purpose: null,
        },
        {
          id: 'e_02',
          nucleus: { type: 'activity', description: 'שירה משותפת' },
          participants: [
            { referent: 'סבא', canonicalReferent: 'grandfather', role: 'co-agent', isNarrator: false, sourceText: 'סבא' },
            { referent: 'מספר/ת', canonicalReferent: 'narrator', role: 'co-agent', isNarrator: true, sourceText: 'שרנו' },
          ],
          actionPhrase: 'שרנו ביחד',
          actionField: 'שירה ביחד',
          actionCanonical: 'singing together',
          specificLocation: null,
          purpose: null,
        },
      ],
    };
  }

  /** General Hebrew heuristic extractor — limited coverage */
  function extractHeuristicHebrew(text) {
    const trimmed = text.trim();
    if (!/[\u0590-\u05FF]/.test(trimmed)) return null;

    const habitual = /\bהיה\s+[\u0590-\u05FF]+/.test(trimmed);
    const temporalMatch = trimmed.match(/(?:ב|כל\s+)([\u0590-\u05FF\s]+?)(?=,|\s+[\u0590-\u05FF]{2,}\s)/);
    const temporalReferent = temporalMatch ? temporalMatch[0].replace(/^כל\s+/, '').trim() : null;

    const events = [];
    const clauses = trimmed.split(/[,;]|(?:\s+ו)(?=[\u0590-\u05FF])/).map((c) => c.trim()).filter(Boolean);

    clauses.forEach((clause, i) => {
      const verbMatch = clause.match(/([\u0590-\u05FF]+(?:\s+[\u0590-\u05FF]+){0,4})/);
      if (!verbMatch) return;
      const participants = [];
      if (/לי|אותי|אליו|אליה/.test(clause)) {
        participants.push({
          referent: 'מספר/ת',
          canonicalReferent: 'narrator',
          role: 'recipient',
          isNarrator: true,
          sourceText: clause.match(/לי|אותי/)?.[0] || 'לי',
        });
      }
      const personMatch = clause.match(/סבא|סבתא|אמא|אבא|אח|אחות|נכד|ילד/);
      if (personMatch) {
        participants.push({
          referent: personMatch[0],
          canonicalReferent: personMatch[0] === 'סבא' ? 'grandfather' : personMatch[0],
          role: participants.length ? 'agent' : 'co-agent',
          isNarrator: false,
          sourceText: personMatch[0],
        });
      }
      if (participants.length) {
        events.push({
          id: `e_${String(i + 1).padStart(2, '0')}`,
          nucleus: { type: 'activity', description: clause.slice(0, 40) },
          participants,
          actionPhrase: clause,
          actionCanonical: clause,
          specificLocation: null,
          purpose: null,
        });
      }
    });

    if (!events.length) return null;

    return {
      memoryLanguage: 'Hebrew',
      coreNarrative: trimmed.replace(/\s+/g, ' ').slice(0, 120),
      memoryFrame: {
        location: null,
        temporalContext: habitual ? 'habitual' : temporalReferent ? 'recurring' : 'singular',
        recurrencePattern: temporalReferent ? `כל ${temporalReferent.replace(/^ב/, '')}` : null,
        period: null,
        temporalReferent,
        temporalReferentSource: temporalReferent,
        habitualAnnotation: habitual ? 'היה' : null,
      },
      events,
      heuristic: true,
    };
  }

  function extractEventModel(memoryText, logger) {
    const text = (memoryText || '').trim();
    const STAGES = root.MemoryEngineLogger?.STAGES || { EXTRACT: '1.2' };
    if (!text) {
      if (logger) logger.log(STAGES.EXTRACT, 'EXTRACTOR_UNSUPPORTED', { reason: 'empty memory' }, 'Workflow_Grammar:1.2');
      return { supported: false, reason: 'empty memory' };
    }

    const curated = extractSaturdayGrandfather(text);
    if (curated) {
      if (logger) {
        logger.log(STAGES.EXTRACT, 'EXTRACTOR_SELECTED', {
          extractor: 'curated:saturday-grandfather',
          confidence: 'high',
          eventCount: curated.events?.length || 0,
          language: curated.memoryLanguage,
        }, 'Workflow_Grammar:1.2');
        curated.events?.forEach((ev) => {
          logger.log(STAGES.EXTRACT, 'EVENT_PARSED', {
            eventId: ev.id,
            participants: ev.participants?.map((p) => p.referent),
            actionPhrase: ev.actionPhrase,
          }, 'Workflow_Grammar:1.2');
        });
      }
      return { supported: true, eventModel: curated, extractor: 'curated:saturday-grandfather' };
    }

    const lang = detectLanguage(text);
    if (lang === 'Hebrew' || lang === 'Mixed') {
      const heuristic = extractHeuristicHebrew(text);
      if (heuristic) {
        const confidence = heuristic.heuristic ? 'low' : 'high';
        if (logger) {
          logger.log(STAGES.EXTRACT, 'EXTRACTOR_SELECTED', {
            extractor: 'heuristic:hebrew',
            confidence,
            eventCount: heuristic.events?.length || 0,
            language: lang,
          }, 'Workflow_Grammar:1.2');
          heuristic.events?.forEach((ev) => {
            logger.log(STAGES.EXTRACT, 'EVENT_PARSED', {
              eventId: ev.id,
              participants: ev.participants?.map((p) => p.referent),
              actionPhrase: ev.actionPhrase,
            }, 'Workflow_Grammar:1.2');
          });
        }
        return {
          supported: true,
          eventModel: heuristic,
          extractor: 'heuristic:hebrew',
          confidence,
        };
      }
    }

    const reason = 'No local extractor matched this memory. Add a curated pattern or improve the Hebrew heuristic.';
    if (logger) {
      logger.log(STAGES.EXTRACT, 'EXTRACTOR_UNSUPPORTED', { reason, language: lang }, 'Workflow_Grammar:1.2');
    }
    return { supported: false, reason, language: lang };
  }

  root.MemoryEngineRule1 = root.MemoryEngineRule1 || {};
  root.MemoryEngineRule1.extractEventModel = extractEventModel;
  root.MemoryEngineRule1.detectLanguage = detectLanguage;
})(typeof globalThis !== 'undefined' ? globalThis : window);
