/**
 * Streamline API defaults — server-side (api/streamline.js, streamline-mapping.js).
 * Client mirror: memory-processor/engine/catalog/providers/streamline.js
 *
 * Download params: https://docs.streamlinehq.com/reference/downloadiconassvg
 */
const DEFAULT_FAMILY_SLUG = 'streamline-regular';

const DEFAULT_DOWNLOAD_PARAMS = {
  size: 64,
  responsive: true,
  strokeToFill: false,
  backgroundColor: '#ffffff00',
  colors: '#000000',
  strokeWidth: 0.25,
};

function buildDownloadQueryParams(overrides) {
  const p = { ...DEFAULT_DOWNLOAD_PARAMS, ...(overrides || {}) };
  const qs = new URLSearchParams({
    size: String(p.size),
    responsive: String(p.responsive),
    backgroundColor: String(p.backgroundColor),
  });
  if (p.colors != null && p.colors !== '') qs.set('colors', String(p.colors));
  if (p.strokeWidth != null && p.strokeWidth !== '') {
    qs.set('strokeWidth', String(p.strokeWidth));
  } else {
    qs.set('strokeToFill', String(p.strokeToFill));
  }
  return qs;
}

module.exports = {
  DEFAULT_FAMILY_SLUG,
  DEFAULT_DOWNLOAD_PARAMS,
  buildDownloadQueryParams,
};
