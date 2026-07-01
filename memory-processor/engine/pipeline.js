/**
 * Full pipeline — Rule 1 → Rule 2 → Rule 3 with smart logging.
 * Rule 1 can be local extractors or pre-built from minimal AI word list.
 */
(function (root) {
  function runPipelineFromRule1(rule1, options) {
    const opts = options || {};
    const logger = opts.logger || root.MemoryEngineLogger.createLogger();
    const catalog = opts.catalog || root.MemoryEngineCatalog;
    const catalogLookup = opts.catalogLookup || ((w) => catalog.lookup(w));
    const extractor = opts.extractor || rule1._engine?.source || 'unknown';
    const confidence = opts.confidence || 'high';

    const rule2 = root.MemoryEngineRule2.runVRP(rule1, catalogLookup, logger);
    const rule3 = root.MemoryEngineRule3.runCatalogLookup(rule2, rule1, catalogLookup, logger);
    const trace = logger.snapshot();
    const words = (rule1.representativeWords || []).map((w) => w.word);

    const result = {
      supported: true,
      extractor,
      confidence,
      rule1,
      rule2,
      rule3,
      words,
      trace,
    };
    result.explanation = root.MemoryEngineLogger.formatExplanation(result);
    return result;
  }

  function runPipeline(memoryText, options) {
    const opts = options || {};
    const logger = opts.logger || root.MemoryEngineLogger.createLogger();
    const catalog = opts.catalog || root.MemoryEngineCatalog;
    const catalogLookup = opts.catalogLookup || ((w) => catalog.lookup(w));

    const rule1Out = root.MemoryEngineRule1.runRule1(memoryText, logger);
    if (!rule1Out.supported) {
      const trace = logger.snapshot();
      return {
        supported: false,
        reason: rule1Out.reason,
        language: rule1Out.language,
        trace,
        explanation: root.MemoryEngineLogger.formatExplanation({
          supported: false,
          reason: rule1Out.reason,
          trace,
        }),
      };
    }

    return runPipelineFromRule1(rule1Out.result, {
      logger,
      catalog,
      catalogLookup,
      extractor: rule1Out.extractor,
      confidence: rule1Out.confidence,
    });
  }

  root.MemoryEnginePipeline = { runPipeline, runPipelineFromRule1 };
  root.MemoryEngine = root.MemoryEngine || {};
  root.MemoryEngine.runPipeline = runPipeline;
  root.MemoryEngine.runPipelineFromRule1 = runPipelineFromRule1;
})(typeof globalThis !== 'undefined' ? globalThis : window);
