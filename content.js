'use strict';

(function () {

var ID_EXTENSION = chrome.i18n.getMessage('@@extension_id');

function isModifierKey(k) {
  return k == KeyEvent.DOM_VK_SHIFT || k == KeyEvent.DOM_VK_ALT || k == KeyEvent.DOM_VK_CONTROL || k == KeyEvent.DOM_VK_META;
}

/*
 * key click event
 */
(function () {
  var lastKeyStroke;
  $(window).keydown(function (e) {
    if (!e.originalEvent.repeat
        && (!lastKeyStroke || isModifierKey(lastKeyStroke.which) || !isModifierKey(e.which))) {
      lastKeyStroke = e;
    }
  });
  $(window).keyup(function (e) {
    if (lastKeyStroke) {
      var ec = lastKeyStroke;
      lastKeyStroke = undefined;
      if (ec.which == e.which
          && (e.which == KeyEvent.DOM_VK_CONTROL || ec.ctrlKey == e.ctrlKey)
          && (e.which == KeyEvent.DOM_VK_ALT || ec.altKey == e.altKey)
          && (e.which == KeyEvent.DOM_VK_META || ec.metaKey == e.metaKey)
          && (e.which == KeyEvent.DOM_VK_SHIFT || ec.shiftKey == e.shiftKey)) {
        ec.type = 'keyclick';
        delete ec.originalEvent;
        $(window).trigger(ec);
      }
    }
  });
})();

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

function createShortcutFilter(length) {
  return function (i, elem) {
    if (length && i < length) {
      return true;
    }
    $(elem).removeData('contentMarginTopToBorder').removeData('contentMarginLeftToBorder');
    return false;
  }
}

function reShortcutting() {
  if (state != 'shortcutting') {
    return;
  }
  removeShortcuts();
  var all = searchClickablesInView().filter(createShortcutFilter(scHist.length + MAX_NUM_SHORTCUTS));
  var newClickables = all.not(scHist);
  all = all.not(newClickables);
  if (!newClickables.length) {
    all.filter(createShortcutFilter());
    toStart();
    return;
  }
  var lack = MAX_NUM_SHORTCUTS - newClickables.length;
  if (lack > 0) {
    newClickables = $($.merge(newClickables.get(), all.filter(createShortcutFilter(lack)).get()));
  } else {
    all.filter(createShortcutFilter());
    if (lack) {
      newClickables = newClickables.filter(createShortcutFilter(MAX_NUM_SHORTCUTS));
    }
  }
  scHist = scHist.add(newClickables);
  createShortcuts(newClickables);
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
    if (isModifierKey(e.which)) {
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
            if (clickable.prop('href') || clickable.attr('href')) {
              internalClicking = true;
              clickable.get(0).click();
              internalClicking = false;
            }
            consumed = true;
            action = false;
            reShortcutting();
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
 * search clickables
 */
function searchClickablesInView() {
  var vpl = 2, vpr = document.documentElement.clientWidth - 2;
  var vpt = 5, vpb = document.documentElement.clientHeight - 5;
  return $('[href],[onclick],iframe,select,button,textarea,input[type][type!="hidden"]', $('body')).filter(function () {
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
    var ts = parseInt(i.css('border-top'), 10) + parseInt(i.css('padding-top'), 10);
    var bs = parseInt(i.css('border-bottom'), 10) + parseInt(i.css('padding-bottom'), 10);
    var ls = parseInt(i.css('border-left'), 10) + parseInt(i.css('padding-left'), 10);
    var rs = parseInt(i.css('border-right'), 10) + parseInt(i.css('padding-right'), 10);
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
 * create shortcuts
 */
var CLASS_SHORTCUT = ID_EXTENSION + '_insclick_shortcut';

var getShortcutSelectorByChar = (function() {
  var PREFIX_SELECTOR_SHORTCUT = '#' + CLASS_SHORTCUT + '_';
  return function (c) {
    return PREFIX_SELECTOR_SHORTCUT + c;
  };
})();

var createShortcuts = (function () {
  var PREFIX_HTML_SHORTCUT = '<div class="' + CLASS_SHORTCUT + '" id="' + CLASS_SHORTCUT + '_'; 
  function getShortcutHtml(i, top, left, z) {
    var c = i < 26 ? String.fromCharCode(i + 65/*A*/) : String.fromCharCode(i - 26 + 48/*0*/);
    return PREFIX_HTML_SHORTCUT + c + '" style="position:fixed;top:' + top + 'px;left:' + left + 'px;z-index:' + z + ';">' + c + '</div>';
  }

  return function (clickables) {
    clickables.each(function (index) {
      var i = $(this);
      var bd = this.getBoundingClientRect();
      var t = bd.top + i.data('contentMarginTopToBorder');
      var l = bd.left + i.data('contentMarginLeftToBorder');
      i.removeData('contentMarginTopToBorder');
      i.removeData('contentMarginLeftToBorder');
      t -= 4;
      l -= 5;
      if (t < 0) {
        t = 0;
      }
      if (l < 0) {
        l = 0;
      }
      var ob = t + 14 - document.documentElement.clientHeight;
      var or = l + 7 - document.documentElement.clientWidth;
      if (ob > 0) {
        t -= ob;
      }
      if (or > 0) {
        l -= or;
      }
      i.after(getShortcutHtml(index, t, l, i.css('z-index')));
    });
  }
})();

/*
 * remove shortcuts
 */
var removeShortcuts = (function () {
  var SELECTOR_SHORTCUTS = '.' + CLASS_SHORTCUT;
  return function () {
    $(SELECTOR_SHORTCUTS).remove();
  };
})();

/*
 * viewport change event handlers
 */
(function () {
  function onViewportChange(e) {
    if (!internalClicking) {
      toStart();
    }
  }

  $(window).scroll(onViewportChange);
  $(window).resize(onViewportChange);
  $(window).mousedown(onViewportChange);
  $(window).mouseup(onViewportChange);
  $(window).click(onViewportChange);
  $(window).blur(onViewportChange);
})();

})();
