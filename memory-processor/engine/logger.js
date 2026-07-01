/**
 * Smart logging — structured trace for Rule 1–3 pipeline decisions.
 */
(function (root) {
  const STAGES = {
    EXTRACT: '1.2',
    SEMANTIC: '1.3',
    STRUCTURE: '1.4',
    CONSIDERATION: '1.5',
    REPRESENTATIVE: '1.6',
    COMPLIANCE: '1.7',
    VRP: '2.x',
    LOOKUP: '3.x',
  };

  function createLogger() {
    const events = [];
    let seq = 0;

    function log(stage, type, data, ruleRef) {
      events.push({
        seq: ++seq,
        stage,
        type,
        ruleRef: ruleRef || null,
        ts: Date.now(),
        ...data,
      });
    }

    function snapshot() {
      const byStage = {};
      events.forEach((e) => {
        if (!byStage[e.stage]) byStage[e.stage] = [];
        byStage[e.stage].push(e);
      });
      return {
        events: events.slice(),
        summary: {
          total: events.length,
          byStage,
          byType: events.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
          }, {}),
        },
      };
    }

    return { log, snapshot, STAGES };
  }

  function formatExplanation(pipelineResult) {
    const lines = [];
    const { supported, extractor, rule1, rule2, rule3, trace } = pipelineResult;

    if (!supported) {
      lines.push('## Engine result: unsupported');
      lines.push(`Reason: ${pipelineResult.reason || 'unknown'}`);
      if (trace?.events?.length) {
        lines.push('');
        lines.push('### Trace');
        trace.events.forEach((e) => {
          lines.push(`- [${e.stage}] ${e.type}: ${e.reason || e.message || JSON.stringify(e)}`);
        });
      }
      return lines.join('\n');
    }

    lines.push('## Representative words');
    const words = (rule1?.representativeWords || []).map((w) => w.word);
    lines.push(words.length ? words.join(' → ') : '(none)');
    lines.push(`Extractor: ${extractor}`);
    lines.push(`Consistency gate: ${rule1?.consistencyGateStatus || 'n/a'}`);
    lines.push('');

    lines.push('## Rule 1 — why each word');
    (rule1?.considerationRecord || []).forEach((cr) => {
      const included = (rule1?.representativeWords || []).some((rw) => rw.word === cr.field);
      const status = included ? 'INCLUDED' : 'EXCLUDED';
      lines.push(`- **${cr.field}** (${cr.category}) — ${status}`);
      lines.push(`  - Identity gate: ${cr.identityGate} — ${cr.identityGateReason || ''}`);
      if (cr.decision) {
        lines.push(`  - Decision: ${cr.decision} — ${cr.decisionReason || ''}`);
      }
      if (cr.category === 'temporal-pattern' && !included) {
        lines.push('  - Rule: Semantic_Methodology:D1/D2 — temporal referent is Detail, not Representative');
      }
      const sf = (rule1?.semanticFields || []).find((f) => f.id === cr.fieldId);
      if (sf?.sourceText) {
        lines.push(`  - P1 anchor: "${sf.sourceText}"`);
      }
    });
    lines.push('');

    lines.push('## Rule 2 — visual mode per word');
    (rule2?.vrp || []).forEach((u) => {
      const mode = u.phase2?.modeDecision?.mode || 'unknown';
      const rationale = u.phase2?.modeDecision?.modeRationale || '';
      const testV = u.phase2?.testV;
      lines.push(`- **${u.unit}** → ${mode}`);
      if (testV?.applied) {
        lines.push(`  - Test V: ${testV.testVConclusion} (distinguishable: ${testV.visuallyDistinguishable})`);
      }
      lines.push(`  - ${rationale}`);
    });
    if (rule2?.vrpSummary) {
      const s = rule2.vrpSummary;
      lines.push(`Summary: ${s.independent} independent, ${s.contextual} contextual, ${s.both} both, ${s.gap} gap`);
    }
    lines.push('');

    lines.push('## Rule 3 — catalog lookup');
    if (rule3) {
      lines.push(
        `Looked up: ${rule3.summary?.lookedUp || 0} · Hits: ${rule3.summary?.hits || 0} · Gaps: ${rule3.summary?.gaps || 0} · Skipped: ${rule3.summary?.skipped || 0}`
      );
      (rule3.lookups || []).forEach((l) => {
        if (l.outcome === 'hit') {
          lines.push(`- **${l.word}** → CATALOG_HIT ${l.catalogId} (${l.concept})`);
        } else if (l.outcome === 'gap') {
          lines.push(`- **${l.word}** → VISUAL_GAP (no catalog entry)`);
        } else {
          lines.push(`- **${l.word}** → LOOKUP_SKIPPED (${l.mode}) — ${l.skipReason || ''}`);
        }
      });
      if (rule3.sequence?.viableUnits?.length) {
        lines.push(`Sequence viable: ${rule3.sequence.viableUnits.map((v) => v.catalogId || v.word).join(' → ')}`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }

  root.MemoryEngineLogger = {
    createLogger,
    formatExplanation,
    STAGES,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
