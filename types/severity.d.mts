/**
 * Numeric rank of a severity (low = 1 ... critical = 4).
 * @param {string} severity
 * @returns {number}
 */
export function rank(severity: string): number;
/**
 * Whether a severity meets a `--fail-on` threshold. `none` never fails.
 * @param {string} severity
 * @param {string} threshold
 * @returns {boolean}
 */
export function meets(severity: string, threshold: string): boolean;
/** @typedef {'low' | 'medium' | 'high' | 'critical'} Severity */
/** Severities from least to most serious. */
export const SEVERITIES: readonly ["low", "medium", "high", "critical"];
export type Severity = "low" | "medium" | "high" | "critical";
