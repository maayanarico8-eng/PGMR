/**
 * Rule 2 — Visual Representation Planning (local heuristics + Test V pattern library).
 */
(function (root) {
  const ACTION_CONTEXT_PATTERNS = {
    'reading newspaper': {
      contextualPossible: true,
      independentPossible: false,
      contextualDependencies: (units) =>
        units.filter((u) => u.category === 'person' || u.category === 'object').map((u) => u.id),
      alternativeMemory: 'סבא מחזיק עיתון ללא קריאה',
      visuallyDistinguishable: true,
      relationalMechanism: 'sequencing',
      emergenceExplanation: 'סבא + עיתון בצמידות = קריאה',
    },
    'singing together': {
      contextualPossible: true,
      independentPossible: true,
      contextualDependencies: (units) => units.filter((u) => u.category === 'person').map((u) => u.id),
      alternativeMemory: 'סבא ונכד/ה יושבים ביחד ללא שירה',
      visuallyDistinguishable: false,
      relationalMechanism: 'co-presence',
      emergenceExplanation: 'שני הסוכנים + תווים = שירה ביחד',
      independentVisualConcept: 'תווים מוזיקליים',
    },
  };

  const ENTITY_NATURE = {
    person: 'person',
    object: 'object',
    action: 'action',
    place: 'place',
  };

  function catalogConstructible(unit, catalogLookup) {
    if (!catalogLookup) return true;
    const hit = catalogLookup(unit.word) || catalogLookup(unit.canonicalReferent);
    return Boolean(hit);
  }

  function decideMode(independentPossible, contextualPossible, testVConclusion) {
    if (contextualPossible && testVConclusion === 'passes') return 'contextual';
    if (contextualPossible && testVConclusion === 'fails' && independentPossible) return 'both';
    if (contextualPossible && testVConclusion === 'fails' && !independentPossible) return 'gap';
    if (!contextualPossible && independentPossible) return 'independent';
    return 'gap';
  }

  function runTestV(pattern, units) {
    if (!pattern) return { applied: false, alternativeMemory: null, visuallyDistinguishable: null, testVConclusion: 'not-applicable' };
    return {
      applied: true,
      alternativeMemory: pattern.alternativeMemory,
      visuallyDistinguishable: pattern.visuallyDistinguishable,
      testVConclusion: pattern.visuallyDistinguishable ? 'passes' : 'fails',
    };
  }

  function planUnit(unit, allUnits, catalogLookup, logger) {
    const STAGES = root.MemoryEngineLogger?.STAGES || { VRP: '2.x' };
    const nature = ENTITY_NATURE[unit.category] || 'action';
    const pattern = ACTION_CONTEXT_PATTERNS[unit.canonicalReferent];
    const isPerson = unit.category === 'person';
    const isObject = unit.category === 'object';

    let independentPossible = isPerson || isObject;
    let contextualPossible = false;
    let contextualDependencies = [];

    if (pattern) {
      independentPossible = pattern.independentPossible;
      contextualPossible = pattern.contextualPossible;
      contextualDependencies = pattern.contextualDependencies(allUnits);
    } else if (isPerson) {
      contextualPossible = false;
      independentPossible = catalogConstructible(unit, catalogLookup);
    } else if (isObject) {
      contextualPossible = false;
      independentPossible = catalogConstructible(unit, catalogLookup);
    }

    const testV = contextualPossible ? runTestV(pattern, allUnits) : { applied: false, alternativeMemory: null, visuallyDistinguishable: null, testVConclusion: 'not-applicable' };

    const mode = decideMode(independentPossible, contextualPossible, testV.testVConclusion);

    const modeDecision = {
      mode,
      modeRationale: `contextualPossible=${contextualPossible} AND testV=${testV.testVConclusion} → ${mode}`,
    };

    if (mode === 'independent' || mode === 'both') {
      modeDecision.independent = {
        visualConcept: pattern?.independentVisualConcept || (isPerson ? `דמות ${unit.word}` : unit.word),
        constructible: catalogConstructible(unit, catalogLookup),
      };
    }
    if (mode === 'contextual' || mode === 'both') {
      modeDecision.contextual = {
        expressedThrough: contextualDependencies.filter((id) => {
          const dep = allUnits.find((u) => u.id === id);
          return dep && dep.category !== 'action';
        }),
        relationalMechanism: pattern?.relationalMechanism || 'co-presence',
        emergenceExplanation: pattern?.emergenceExplanation || 'משמעות נובעת ממיקום ביחס ליחידות אחרות',
      };
    }
    if (mode === 'gap') {
      modeDecision.gap = {
        gapType: 'construction',
        gapRationale: 'לא ניתן לייצג עצמאית או הקשרית בתוך הדקדוק הוויזואלי',
        alternativeStrategy: null,
      };
    }

    if (logger) {
      if (pattern) {
        logger.log(STAGES.VRP, 'PATTERN_MATCHED', {
          unit: unit.word,
          pattern: unit.canonicalReferent,
        }, 'Workflow_Grammar:2.4');
      }
      if (testV.applied) {
        logger.log(STAGES.VRP, 'TEST_V', {
          unit: unit.word,
          alternativeMemory: testV.alternativeMemory,
          visuallyDistinguishable: testV.visuallyDistinguishable,
          conclusion: testV.testVConclusion,
        }, 'Workflow_Grammar:2.5');
      }
      logger.log(STAGES.VRP, 'VRP_MODE', {
        unitId: unit.id,
        unit: unit.word,
        mode,
        rationale: modeDecision.modeRationale,
        independentPossible,
        contextualPossible,
      }, 'Workflow_Grammar:2.6');
    }

    return {
      unitId: unit.id,
      unit: unit.word,
      phase1: {
        entityNature: nature,
        identityFeatures: isPerson ? ['נוכחות', unit.word] : isObject ? ['צורה', unit.word] : ['פעולה'],
        inherentlyVisual: unit.category !== 'action',
      },
      phase2: {
        possibilityInventory: {
          independentPossible,
          independentRationale: independentPossible ? 'ניתן לבנייה מהקטלוג או מילון הצורות' : 'פעולה מופשטת',
          contextualPossible,
          contextualRationale: contextualPossible ? 'משמעות נובעת מיחידות אחרות' : 'לא ניתן להקשרה',
          contextualDependencies,
        },
        testV,
        modeDecision,
      },
      phase3: {
        survivabilityStatus: mode === 'both' ? 'both-reinforcing' : mode === 'contextual' ? 'emergent' : 'recognized',
        independentConfidence: mode === 'contextual' ? 'n/a' : 'high',
        contextualConfidence: mode === 'independent' ? 'n/a' : 'medium',
        mutuallyReinforcing: mode === 'both' ? true : null,
        assessment: 'הערכה אוטומטית (מנוע מקומי)',
      },
      phase4: { h002Status: 'compliant', auditNote: 'none' },
    };
  }

  function runVRP(rule1Result, catalogLookup, logger) {
    const units = (rule1Result.representativeWords || []).map((rw) => ({ ...rw }));
    const vrp = units.map((u) => planUnit(u, units, catalogLookup, logger));
    const summary = {
      independent: vrp.filter((v) => v.phase2.modeDecision.mode === 'independent').length,
      contextual: vrp.filter((v) => v.phase2.modeDecision.mode === 'contextual').length,
      both: vrp.filter((v) => v.phase2.modeDecision.mode === 'both').length,
      gap: vrp.filter((v) => v.phase2.modeDecision.mode === 'gap').length,
      sequenceViability: 'full',
      sequenceComment: 'תוכנית ייצוג מקומית — Test V מבוסס ספריית דפוסים',
    };
    return {
      ensembleReasoning: 'מנוע מקומי: מצב לכל יחידה לפי טבלת החלטות ודפוסי Test V.',
      vrp,
      vrpSummary: summary,
      _engine: { rule: 2 },
    };
  }

  root.MemoryEngineRule2 = { runVRP, ACTION_CONTEXT_PATTERNS, decideMode };
  root.MemoryEngine = root.MemoryEngine || {};
  root.MemoryEngine.runVRP = runVRP;
})(typeof globalThis !== 'undefined' ? globalThis : window);
