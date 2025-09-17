/* eslint-disable no-unused-vars */
// Cookie utility functions

/**
 * Set a cookie with specified name, value, and expiration time
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} minutes - Expiration time in minutes
 */
function setCookie(name, value, minutes) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (minutes * 60 * 1000));
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`;
}

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

/**
 * Delete a cookie by name
 * @param {string} name - Cookie name to delete
 */
function deleteCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

/**
 * Check if a cookie exists
 * @param {string} name - Cookie name
 * @returns {boolean} True if cookie exists, false otherwise
 */
function cookieExists(name) {
  return getCookie(name) !== null;
}

/**
 * Set a session cookie (expires when browser closes)
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 */
function setSessionCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/`;
}
