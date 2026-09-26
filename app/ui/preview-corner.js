/* KEFE — move the fullscreen button into the transport row right end. */
(function(){
  "use strict";
  if (window.__kefePreviewCorner) return;
  window.__kefePreviewCorner = true;
  function move(){
    var focus = document.getElementById("previewFocusButton");
    var t = document.querySelector(".transport");
    if (!focus || !t) return;
    if (focus.parentElement !== t) t.appendChild(focus);
    focus.classList.add("preview-focus-button");
  }
  setInterval(move, 300);
  move();
})();
