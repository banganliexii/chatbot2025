// AGENT-13 - utils.js - Utility functions with fixes & best practice

/**
 * Get element by ID (returns null if not found)
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  if (!id || typeof id !== "string") return null;
  return document.getElementById(id);
}

/**
 * Show a toast notification (auto hides)
 * @param {string} msg
 * @param {number} duration
 */
export function showToast(msg = "", duration = 3300) {
  const toast = $("toast");
  if (!toast) {
    // FIX: fallback to alert if toast element not found
    if (msg) alert(msg);
    return;
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._timeout);
  showToast._timeout = setTimeout(
    () => toast.classList.remove("show"),
    duration
  );
}

/**
 * Safe parse JSON with fallback
 * @param {string} str
 * @param {any} fallback
 * @returns {any}
 */
export function safeParseJSON(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Utility: Clamp a number between min/max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Utility: Escape HTML entities
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
