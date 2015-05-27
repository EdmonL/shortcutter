'use strict';

(function () {

var ID_EXTENSION = chrome.i18n.getMessage('@@extension_id');

function isKeyModifier(k) {
  return (k == KeyEvent.DOM_VK_SHIFT
      || k == KeyEvent.DOM_VK_ALT
      || k == KeyEvent.DOM_VK_CONTROL
      || k == KeyEvent.DOM_VK_META);
}

/*
 * key click event
 */
(function () {
  var lastKeyDown;

  $(window).keydown(function (e) {
    lastKeyDown = e;
  });

  $(window).keyup(function (e) {
    if (lastKeyDown && !lastKeyDown.originalEvent.repeat
      && lastKeyDown.which == e.which
      && (lastKeyDown.ctrlKey == e.ctrlKey || e.which == KeyEvent.DOM_VK_CONTROL)
      && (lastKeyDown.altKey == e.altKey || e.which == KeyEvent.DOM_VK_ALT)
      && (lastKeyDown.metaKey == e.metaKey || e.which == KeyEvent.DOM_VK_META)
      && (lastKeyDown.shiftKey == e.shiftKey || e.which == KeyEvent.DOM_VK_SHIFT)) {
      lastKeyDown.type = 'keyclick';
      delete lastKeyDown.originalEvent;
      $(window).trigger(lastKeyDown);
    }
  });
})();

/*
 * search clickables
 */
(function () {
  function findElementsInViewport() {
  }

function searchClickablesInView() {
  var vpl = 2, vpr = document.documentElement.clientWidth - 2;
  var vpt = 5, vpb = document.documentElement.clientHeight - 5;
  return $('[href],[tabindex],[onclick],iframe,select,button,textarea,input[type][type!="hidden"]', $('body')).filter(function () {
    if (this.disabled) {
      return false;
    }
    var bd = this.getBoundingClientRect();
    var t = bd.top, b = bd.bottom, l = bd.left, r = bd.right;
    return b - t > 5 && r - l > 2 && b > vpt && r > vpl && l < vpr && t < vpb;
  }).filter(function() {
    var i = $(this);
    var iv = i.css('visibility');
    if (iv == 'hidden' || iv == 'collapse' || i.css('display') == 'none' || i.css('opacity') < 0.01) {
      return false;
    }
    var ts = parseInt(i.css('border-top-width'), 10) + parseInt(i.css('padding-top'), 10);
    var bs = parseInt(i.css('border-bottom-width'), 10) + parseInt(i.css('padding-bottom'), 10);
    var ls = parseInt(i.css('border-left-width'), 10) + parseInt(i.css('padding-left'), 10);
    var rs = parseInt(i.css('border-right-width'), 10) + parseInt(i.css('padding-right'), 10);
    var bd = this.getBoundingClientRect();
    var t = bd.top + ts, b = bd.bottom - bs, l = bd.left + ls, r = bd.right - rs;
    if (b - t <= 5 || r - l <= 2 || b <= vpt || r <= vpl || l >= vpr || t >= vpb) {
      return false;
    }
    i.data('contentMarginTopToBorder', ts);
    i.data('contentMarginLeftToBorder', ls);
    return true;
  });
}

/*
 * shortcuts
 */
var CLASS_SHORTCUT = ID_EXTENSION + '_insclick_shortcut';
var SELECTOR_SHORTCUTS = '.' + CLASS_SHORTCUT;

function createShortcutFilter(length) {
  return function (i, elem) {
    if (length && i < length) {
      return true;
    }
    $(elem).removeData('contentMarginTopToBorder').removeData('contentMarginLeftToBorder');
    return false;
  }
}

var getShortcutSelectorByChar = (function() {
  var PREFIX_SELECTOR_SHORTCUT = '#' + CLASS_SHORTCUT + '_';
  return function (c) {
    return PREFIX_SELECTOR_SHORTCUT + c;
  };
})();

var createShortcuts = (function () {
  var PREFIX_HTML_SHORTCUT = '<div class="' + CLASS_SHORTCUT + '" id="' + CLASS_SHORTCUT + '_'; 
  function getShortcutHtml(i, top, left, z, note) {
    var c = i < 26 ? String.fromCharCode(i + 'A'.charCodeAt(0)) : String.fromCharCode(i - 26 + '0'.charCodeAt(0));
    return PREFIX_HTML_SHORTCUT + c + '" style="position:absolute;top:' + top + 'px;left:' + left + 'px;z-index:' + z + ';">' +
      c + (note ? ' (' + note + ')' : '' ) + '</div>';
  }

  return function (clickables) {
    clickables.each(function (index) {
      var i = $(this);
      var p = $(this.parentNode);
      var bd = this.getBoundingClientRect();
      var pbd = this.parentNode.getBoundingClientRect();
      if (p.css('position') == 'static') {
        p.css({position:'relative', top:0, left:0});
      }
      var t = bd.top - pbd.top + i.data('contentMarginTopToBorder');
      var l = bd.left - pbd.left + i.data('contentMarginLeftToBorder');
      i.removeData('contentMarginTopToBorder');
      i.removeData('contentMarginLeftToBorder');
      t -= 4;
      l -= 5;
      var vt = t + pbd.top;
      var vl = l + pbd.left;
      var ob = vt + 14 - document.documentElement.clientHeight;
      var or = vl + 7 - document.documentElement.clientWidth;
      if (ob > 0) {
        t -= ob;
      }
      if (or > 0) {
        l -= or;
      }
      if (vt < 0) {
        t -= vt;
        vt = 0;
      }
      if (vl < 0) {
        l -= vl;
        vl = 0;
      }
      var topDone = false, leftDone = false;
      p = i;
      do {
        p = p.parent();
        pbd = p.get(0).getBoundingClientRect();
        if (!topDone) {
          var pbdTop = pbd.top + parseInt(p.css('border-top-width'), 10);
          if (pbdTop <= vt) {
            topDone = true;
          } else if (p.css('overflow-y') != 'visible') {
            t += pbdTop - vt;
            topDone = true;
          }
        }
        if (!leftDone) {
          var pbdLeft = pbd.left + parseInt(p.css('border-left-width'), 10);
          if (pbdLeft <= vl) {
            leftDone = true;
          } else if (p.css('overflow-x') != 'visible') {
            l += pbdLeft - vl;
            leftDone = true;
          }
        }
      } while (!topDone || !leftDone);
      i.after(getShortcutHtml(index, t, l, i.css('z-index'), i.is('frame,iframe') ? 'into frame' : undefined));
    });
  }
})();

function removeShortcuts() {
  $(SELECTOR_SHORTCUTS).remove();
}

function reShortcutting(resetHist) {
  if (state != 'shortcutting') {
    return;
  }
  removeShortcuts();
  var old = searchClickablesInView();
  var newClickables = old.not(scHist);
  old = old.not(newClickables);
  if (!newClickables.length) {
    old.filter(createShortcutFilter());
    toStart();
    return;
  }
  var lack = MAX_NUM_SHORTCUTS - newClickables.length;
  if (lack > 0) {
    newClickables = $($.merge(newClickables.get(), old.filter(createShortcutFilter(lack)).get()));
  } else {
    old.filter(createShortcutFilter());
    if (lack) {
      newClickables = newClickables.filter(createShortcutFilter(MAX_NUM_SHORTCUTS));
    }
  }
  scHist = (resetHist ? newClickables : scHist.add(newClickables));
  createShortcuts(newClickables);
}

/*
 * state management
 */
var MAX_NUM_SHORTCUTS = 36;
var state = 'start';
var scHist = $();
var internalClicking = false;

function toStart() {
  if (state == 'start') {
    return;
  }
  if (state == 'shortcutting') {
    removeShortcuts();
    scHist = $();
  }
  state = 'start';
}

function toShortCutting() {
  if (state == 'shortcutting') {
    return;
  }
  if (state == 'start') {
    scHist = searchClickablesInView().filter(createShortcutFilter(MAX_NUM_SHORTCUTS));
    if (!scHist.length) {
      return;
    }
    createShortcuts(scHist);
  }
  state = 'shortcutting';
}

/*
 * key event handlers
 */
(function () {
  function getCharFromVK(k, shiftKey) {
    if (!shiftKey && k >= KeyEvent.DOM_VK_0 && k <= KeyEvent.DOM_VK_9) {
      return String.fromCharCode(k - KeyEvent.DOM_VK_0 + '0'.charCodeAt(0));
    }
    if (!shiftKey && k >= KeyEvent.DOM_VK_NUMPAD0 && k <= KeyEvent.DOM_VK_NUMPAD9) {
      return String.fromCharCode(k - KeyEvent.DOM_VK_NUMPAD0 + '0'.charCodeAt(0));
    }
    if (k >= KeyEvent.DOM_VK_A && k <= KeyEvent.DOM_VK_Z) {
      return String.fromCharCode(k - KeyEvent.DOM_VK_A + 'A'.charCodeAt(0));
    }
    return undefined;
  }

  $('body').keydown(function (e) {
    if (isKeyModifier(e.which)) {
      return;
    }
    var consumed = false;
    if (state == 'shortcutting') {
      var action = true;
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.which == KeyEvent.DOM_VK_ESCAPE) {
          if (!e.shiftKey) {
            consumed = true;
          }
        } else if (e.which == KeyEvent.DOM_VK_TAB) {
          if (!e.shiftKey) {
            reShortcutting();
            consumed = true;
            action = false;
          }
        } else {
          var c = getCharFromVK(e.which, e.shiftKey);
          if (c) {
            var clickable = $(getShortcutSelectorByChar(c)).prev();
            clickable.focus();
            if (clickable.is('[href],[tabindex][role!="textbox"],[onclick][role!="textbox"],button,input[type="button"],input[type="checkbox"],input[type="color"],input[type="file"],input[type="radio"],input[type="reset"]')) {
              internalClicking = true;
              clickable.get(0).click();
              internalClicking = false;
              action = false;
              reShortcutting(true);
            }
            consumed = true;
          }
        }
      }
      if (action) {
        toStart();
      }
    }
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });
})();

$(window).on('keyclick', function (e) {
  if (e.ctrlKey || e.altKey || e.metaKey) {
    return;
  }
  var consumed = false;
  if (state == 'start') {
    if (e.which == KeyEvent.DOM_VK_SHIFT) {
      toShortCutting();
      consumed = true;
    }
  } else if (state == 'shortcutting') {
    if (e.which == KeyEvent.DOM_VK_SHIFT) {
      toStart();
      consumed = true;
    }
  }
  if (consumed) {
    e.preventDefault();
    e.stopPropagation();
  }
});

/*
 * viewport change event handlers
 */
(function () {
  function onViewportChange(e) {
    if (!internalClicking) {
      toStart();
    }
  }
/*
  $(window).scroll(onViewportChange);
  $(window).resize(onViewportChange);
  $(window).mousedown(onViewportChange);
  $(window).mouseup(onViewportChange);
  $(window).click(onViewportChange);
  $(window).blur(onViewportChange);*/
})();

})();
