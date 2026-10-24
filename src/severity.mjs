/** @typedef {'low' | 'medium' | 'high' | 'critical'} Severity */

/** Severities from least to most serious. */
export const SEVERITIES = /** @type {const} */ (['low', 'medium', 'high', 'critical']);

/**
 * Numeric rank of a severity (low = 1 ... critical = 4).
 * @param {string} severity
 * @returns {number}
 */
export function rank(severity) {
  return SEVERITIES.indexOf(/** @type {Severity} */ (severity)) + 1;
}

/**
 * Whether a severity meets a `--fail-on` threshold. `none` never fails.
 * @param {string} severity
 * @param {string} threshold
 * @returns {boolean}
 */
export function meets(severity, threshold) {
  if (threshold === 'none') {
    return false;
  }
  return rank(severity) >= rank(threshold);
}
