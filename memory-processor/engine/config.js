/**
 * Engine configuration — hybrid: local rules first, Anthropic fallback when unsupported.
 */
(function (root) {
  const ENGINE_MODES = {
    mock: 'mock',
    local: 'local',
    aiWords: 'ai-words',
    hybrid: 'hybrid',
    anthropic: 'anthropic',
  };

  /** Memories with hand-tuned extractors (Stage 1.2). */
  const CURATED_MEMORY_KEYS = [
    'בשבת בבוקר, סבא היה קורא לי עיתון ושרנו ביחד.',
    'בשבת בבוקר, סבא היה קורא לי עיתון ושרנו ביחד',
  ];

  function normalizeMemoryText(text) {
    return (text || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  }

  function isCuratedMemory(text) {
    const n = normalizeMemoryText(text);
    return CURATED_MEMORY_KEYS.some((k) => normalizeMemoryText(k) === n);
  }

  root.MemoryEngineConfig = {
    ENGINE_MODES,
    CURATED_MEMORY_KEYS,
    normalizeMemoryText,
    isCuratedMemory,
    /** hybrid: local first, then minimal AI word extraction */
    shouldFallbackToAnthropic(mode, localResult) {
      if (mode === ENGINE_MODES.anthropic) return true;
      if (mode === ENGINE_MODES.local) return false;
      if (mode === ENGINE_MODES.aiWords) return true;
      if (mode === ENGINE_MODES.hybrid) return !localResult?.supported || localResult?.confidence === 'low';
      return false;
    },
    usesMinimalAiExtraction(mode) {
      return mode === ENGINE_MODES.aiWords || mode === ENGINE_MODES.hybrid;
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
