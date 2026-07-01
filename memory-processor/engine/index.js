/**
 * Memory Engine — public API.
 */
(function (root) {
  const { ENGINE_MODES, shouldFallbackToAnthropic } = root.MemoryEngineConfig;

  root.MemoryEngine = root.MemoryEngine || {};

  root.MemoryEngine.ENGINE_MODES = ENGINE_MODES;

  /**
   * Run Rule 1 locally. Returns { supported, result?, reason?, extractor? }.
   */
  root.MemoryEngine.runRule1Local = function (memoryText, logger) {
    return root.MemoryEngineRule1.runRule1(memoryText, logger);
  };

  root.MemoryEngine.buildRule1FromWords = function (memoryText, aiResponse, logger) {
    return root.MemoryEngineRule1.buildRule1FromWords(memoryText, aiResponse, logger);
  };

  root.MemoryEngine.RW_EXTRACT_PROMPT = root.MemoryEngineRule1.RW_EXTRACT_PROMPT;

  /**
   * Run Rule 2 locally. catalogLookup: (word) => entry|null
   */
  root.MemoryEngine.runVRPLocal = function (rule1Result, catalogLookup, logger) {
    return root.MemoryEngineRule2.runVRP(rule1Result, catalogLookup, logger);
  };

  /**
   * Run Rule 3 catalog lookup locally.
   */
  root.MemoryEngine.runCatalogLookup = function (vrpResult, rule1Result, catalogLookup, logger) {
    return root.MemoryEngineRule3.runCatalogLookup(vrpResult, rule1Result, catalogLookup, logger);
  };

  /** Rule 1 can be local extractors or minimal AI word list → Rule 2+3 always local */
  root.MemoryEngine.rule3LocalMode = {
    allowAutoRealization: false,
    message: 'Catalog lookup only (local). Rule 3 SVG synthesis disabled except in Full API mode.',
  };

  root.MemoryEngine.shouldUseAnthropic = shouldFallbackToAnthropic;
})(typeof globalThis !== 'undefined' ? globalThis : window);
