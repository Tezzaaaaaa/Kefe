(function(){
  var REQUIRED = ['audioSection','textSection','backgroundSection','visualFxSection','exportSection'];
  var originals = {};

  function capture() {
    REQUIRED.forEach(function(id){
      var el = document.getElementById(id);
      if (el && !originals[id]) originals[id] = el;
    });
  }

  function place(el, id) {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    var pos = REQUIRED.indexOf(id);
    var nextId = REQUIRED.slice(pos + 1).find(function(nid){
      return document.getElementById(nid);
    });
    var before = nextId ? document.getElementById(nextId) : null;
    if (before) sidebar.insertBefore(el, before);
    else sidebar.appendChild(el);
    console.log('[KEFE rescue] re-inserted #' + id);
  }

  function check() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    REQUIRED.forEach(function(id){
      var el = document.getElementById(id);
      if (el && el.parentElement === sidebar) return; // ok
      if (el && el.parentElement !== sidebar) {
        console.log('[KEFE rescue] #' + id + ' moved into', el.parentElement && el.parentElement.id || el.parentElement.className);
        place(el, id);
      } else if (!el && originals[id]) {
        console.log('[KEFE rescue] #' + id + ' was REMOVED — restoring');
        place(originals[id], id);
      }
    });
  }

  var observer = new MutationObserver(function(mutations){
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      for (var j = 0; j < m.removedNodes.length; j++) {
        var n = m.removedNodes[j];
        if (n.nodeType === 1 && REQUIRED.indexOf(n.id) > -1) {
          console.log('[KEFE rescue] removal detected: #' + n.id + ' removed from',
            m.target.id || m.target.className || m.target.nodeName);
        }
      }
    }
    setTimeout(check, 0);
  });

  document.addEventListener('DOMContentLoaded', function(){
    capture();
    check();
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(function(){ capture(); check(); }, 300);
    console.log('[KEFE rescue] active');
  });
})();
