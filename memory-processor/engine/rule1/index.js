/**
 * Rule 1 orchestrator — extract + stages 1.3–1.7.
 */
(function (root) {
  const { extractEventModel } = root.MemoryEngineRule1;
  const { runStages } = root.MemoryEngineRule1;

  function runRule1(memoryText, logger) {
    const extraction = extractEventModel(memoryText, logger);
    if (!extraction.supported) {
      return { supported: false, reason: extraction.reason, language: extraction.language };
    }
    const result = runStages(extraction.eventModel, logger);
    return {
      supported: true,
      result,
      extractor: extraction.extractor,
      confidence: extraction.confidence || 'high',
    };
  }

  root.MemoryEngineRule1.runRule1 = runRule1;
  root.MemoryEngine = root.MemoryEngine || {};
  root.MemoryEngine.runRule1 = runRule1;
})(typeof globalThis !== 'undefined' ? globalThis : window);
