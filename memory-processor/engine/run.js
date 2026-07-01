#!/usr/bin/env node
/**
 * CLI — run full local pipeline on a memory sentence.
 * Usage: node memory-processor/engine/run.js "בשבת בבוקר, סבא היה קורא לי עיתון ושרנו ביחד."
 *        node memory-processor/engine/run.js --json "..."
 */
const path = require('path');
const fs = require('fs');

function loadEngine() {
  const g = globalThis;
  const engineDir = path.join(__dirname);
  const files = [
    path.join(engineDir, 'logger.js'),
    path.join(engineDir, 'config.js'),
    path.join(engineDir, 'catalog', 'entries.js'),
    path.join(engineDir, 'catalog', 'index.js'),
    path.join(engineDir, 'rule1', 'extract-event-model.js'),
    path.join(engineDir, 'rule1', 'stages.js'),
    path.join(engineDir, 'rule1', 'index.js'),
    path.join(engineDir, 'rule2', 'vrp.js'),
    path.join(engineDir, 'rule3', 'lookup.js'),
    path.join(engineDir, 'pipeline.js'),
    path.join(engineDir, 'index.js'),
  ];
  files.forEach((file) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(file, 'utf8'));
  });
  return g.MemoryEngine;
}

function formatCompact(out) {
  const lines = [];
  if (!out.supported) {
    lines.push('UNSUPPORTED');
    lines.push(`Reason: ${out.reason}`);
    return lines.join('\n');
  }

  lines.push('Representative words: ' + (out.words || []).join(' → '));
  lines.push(`Extractor: ${out.extractor} | Gate: ${out.rule1?.consistencyGateStatus}`);

  lines.push('');
  lines.push('VRP modes:');
  (out.rule2?.vrp || []).forEach((u) => {
    lines.push(`  ${u.unit} → ${u.phase2?.modeDecision?.mode}`);
  });

  lines.push('');
  lines.push('Catalog:');
  (out.rule3?.lookups || []).forEach((l) => {
    if (l.outcome === 'hit') lines.push(`  ${l.word} → HIT ${l.catalogId}`);
    else if (l.outcome === 'gap') lines.push(`  ${l.word} → VISUAL_GAP`);
    else lines.push(`  ${l.word} → SKIPPED (${l.mode})`);
  });

  if (out.rule3?.sequence?.viableUnits?.length) {
    lines.push('');
    lines.push('Sequence: ' + out.rule3.sequence.viableUnits.map((v) => v.catalogId).join(' → '));
  }

  lines.push('');
  lines.push('--- Explanation ---');
  lines.push(out.explanation || '');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const sentence = args.filter((a) => a !== '--json').join(' ').trim();

  if (!sentence) {
    console.error('Usage: node memory-processor/engine/run.js [--json] "<memory sentence>"');
    process.exit(1);
  }

  const engine = loadEngine();
  const out = engine.runPipeline(sentence);

  if (jsonMode) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(formatCompact(out));
  }

  if (!out.supported) process.exit(2);
}

main();
