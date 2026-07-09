/**
 * Narrator self-reference → gendered pictogram term (man / woman).
 * Hebrew label stays לי/אני/אותי; English search uses man or woman — never me/i/narrator.
 */
(function (root) {
  const GENDER_MALE = 'male';
  const GENDER_FEMALE = 'female';

  const NARRATOR_HEBREW = new Set(['לי', 'אני', 'אותי', 'אלי']);
  const NARRATOR_ENGLISH = new Set(['me', 'i', 'myself', 'narrator']);

  function normalizeGender(gender) {
    const g = (gender || '').toString().toLowerCase().trim();
    if (g === GENDER_FEMALE || g === 'נקבה' || g === 'female' || g === 'f') return GENDER_FEMALE;
    return GENDER_MALE;
  }

  function pictogramTermForGender(gender) {
    return normalizeGender(gender) === GENDER_FEMALE ? 'woman' : 'man';
  }

  function isNarratorSelfWord(hebrew, english) {
    const h = (hebrew || '').trim();
    const e = (english || '').toLowerCase().trim();
    const hl = h.toLowerCase();
    if (NARRATOR_HEBREW.has(h)) return true;
    if (NARRATOR_ENGLISH.has(e)) return true;
    if (NARRATOR_ENGLISH.has(hl)) return true;
    return false;
  }

  function resolveEnglishForPictogram(hebrew, english, gender) {
    if (!isNarratorSelfWord(hebrew, english)) {
      return english ? String(english).toLowerCase().trim() : english;
    }
    return pictogramTermForGender(gender);
  }

  function applyToTranslation(translation, gender) {
    if (!translation) return translation;
    const hebrew = translation.hebrew;
    const prior = translation.english || translation.hint || null;
    if (!isNarratorSelfWord(hebrew, prior)) return translation;
    const english = pictogramTermForGender(gender);
    return {
      ...translation,
      english,
      narratorRedirect: true,
      originalEnglish: prior,
      source: translation.source || 'narrator-gender',
    };
  }

  function applyToTranslations(translations, gender) {
    return (translations || []).map((t) => applyToTranslation(t, gender));
  }

  root.MemoryEngineNarratorGender = {
    GENDER_MALE,
    GENDER_FEMALE,
    normalizeGender,
    pictogramTermForGender,
    isNarratorSelfWord,
    resolveEnglishForPictogram,
    applyToTranslation,
    applyToTranslations,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
