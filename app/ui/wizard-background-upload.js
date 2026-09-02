/* KEFE — background upload compatibility shim
 *
 * app.js is the single owner of #backgroundInput. This file intentionally
 * does not attach another change listener or create a second media element.
 * A duplicate listener caused standalone image/video uploads to race each
 * other, revoke object URLs, and leave the upload appearing stuck.
 */
(() => {
  'use strict';
  const input = document.getElementById('backgroundInput');
  if (!input) return;
  input.dataset.kefeMediaOwner = 'app';
})();
