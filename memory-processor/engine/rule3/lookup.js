/**
 * Rule 3 — catalog lookup (local mode: no SVG synthesis).
 */
(function (root) {
  function findConsiderationRecord(rule1Result, unit) {
    const cr = rule1Result.considerationRecord || [];
    const rw = (rule1Result.representativeWords || []).find((r) => r.id === unit.unitId || r.word === unit.unit);
    if (rw) {
      const byWord = cr.find((c) => c.field === rw.word);
      if (byWord) return byWord;
    }
    return cr.find((c) => c.field === unit.unit) || null;
  }

  function englishForUnit(rule1Result, unit, cr) {
    const rw = (rule1Result.representativeWords || []).find(
      (r) => r.id === unit.unitId || r.word === unit.unit
    );
    const raw = rw?.canonicalReferent || cr?.canonicalReferent || null;
    return raw ? String(raw).toLowerCase().trim() : null;
  }

  function runCatalogLookup(vrpResult, rule1Result, catalogLookup, logger) {
    const STAGES = root.MemoryEngineLogger?.STAGES || { LOOKUP: '3.x' };
    const allVrp = vrpResult?.vrp || [];
    const lookups = [];
    let hits = 0;
    let gaps = 0;
    let skipped = 0;
    const viableUnits = [];
    const missingUnits = [];

    allVrp.forEach((u) => {
      const mode = u.phase2?.modeDecision?.mode || 'gap';
      const cr = findConsiderationRecord(rule1Result, u);
      const hebrew = u.unit || '';
      const english = englishForUnit(rule1Result, u, cr);

      if (!['independent', 'both'].includes(mode)) {
        skipped++;
        let skipReason = `VRP mode is ${mode} — library lookup runs only for Independent and Both units.`;
        if (mode === 'contextual') {
          skipReason = u.phase2?.modeDecision?.contextual?.emergenceExplanation || skipReason;
        } else if (mode === 'gap') {
          skipReason = u.phase2?.modeDecision?.gap?.gapRationale || skipReason;
        }
        const entry = {
          unitId: u.unitId,
          hebrew,
          english,
          word: hebrew,
          mode,
          outcome: 'skipped',
          skipReason,
        };
        lookups.push(entry);
        if (logger) {
          logger.log(STAGES.LOOKUP, 'LOOKUP_SKIPPED', entry, 'Workflow_Grammar:3.1');
        }
        return;
      }

      const hit = catalogLookup(hebrew) || (english ? catalogLookup(english) : null);
      if (hit) {
        hits++;
        const entry = {
          unitId: u.unitId,
          hebrew,
          english,
          word: hebrew,
          mode,
          outcome: 'hit',
          catalogId: hit.id,
          concept: hit.concept,
          catalogHebrew: hit.hebrew,
          provisional: hit.provisional,
          source: 'bank',
        };
        lookups.push(entry);
        viableUnits.push({ hebrew, english, catalogId: hit.id, concept: hit.concept });
        if (logger) {
          logger.log(STAGES.LOOKUP, 'CATALOG_HIT', entry, 'Pictogram_Catalog_Specification');
        }
      } else {
        gaps++;
        const entry = {
          unitId: u.unitId,
          hebrew,
          english,
          word: hebrew,
          mode,
          outcome: 'gap',
          canonicalReferent: english || cr?.canonicalReferent || null,
        };
        lookups.push(entry);
        missingUnits.push({ hebrew, english, canonicalReferent: english || cr?.canonicalReferent });
        if (logger) {
          logger.log(STAGES.LOOKUP, 'VISUAL_GAP', entry, 'Workflow_Grammar:3.2');
        }
      }
    });

    const lookedUp = hits + gaps;
    return {
      lookups,
      summary: { lookedUp, hits, gaps, skipped, total: allVrp.length },
      sequence: { viableUnits, missingUnits },
      _engine: { rule: 3 },
    };
  }

  root.MemoryEngineRule3 = { runCatalogLookup, findConsiderationRecord };
})(typeof globalThis !== 'undefined' ? globalThis : window);
