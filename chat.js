// "Message Eunjae": glue between the page and the chat widget.
//
// The widget (embed.js, served from WIDGET_HOST) brings its own modal and opens on
// any element with [data-message-eunjae], or on window.MessageEunjae.open().
// Its host is set in exactly one place: the commented <script src> in index.html.
//
// While that line stays commented out, or if embed.js fails or is too slow to load,
// this file answers instead: the same triggers open a small fallback dialog that
// points to email. Visiting /#message opens the chat (or the fallback) directly.
(function () {
  "use strict";

  var LOAD_TIMEOUT_MS = 8000;
  var TRIGGER = "[data-message-eunjae]";

  var dialog = document.getElementById("me-fallback");
  var launcher = document.querySelector(".launcher");
  var badge = document.querySelector(".launcher-badge");
  var embed = document.querySelector('script[src$="/embed.js"]');
  var mode = "pending"; // "widget" once embed.js has loaded, "fallback" otherwise
  var opener = null;

  // Launcher: shown only with JavaScript, hidden while the chat is open, badge for unread.
  if (launcher) launcher.hidden = false;
  window.addEventListener("message-eunjae:open", function () {
    document.documentElement.classList.add("chat-open");
  });
  window.addEventListener("message-eunjae:close", function () {
    document.documentElement.classList.remove("chat-open");
  });
  window.addEventListener("message-eunjae:unread", function (e) {
    var n = (e.detail && e.detail.count) || 0;
    if (!badge || !launcher) return;
    badge.textContent = n > 9 ? "9+" : String(n);
    badge.hidden = n === 0;
    launcher.setAttribute("aria-label", n ? "Message Eunjae, " + n + " unread" : "Message Eunjae");
  });

  // Fallback dialog ---------------------------------------------------------
  function focusables() {
    return Array.prototype.filter.call(
      dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null; }
    );
  }

  function fallbackOpen() {
    if (!dialog || dialog.open) return;
    opener = document.activeElement;
    dialog.showModal();
    var first = dialog.querySelector("[data-autofocus]") || focusables()[0];
    if (first) first.focus();
    window.dispatchEvent(new CustomEvent("message-eunjae:open"));
  }

  function fallbackClose() {
    if (dialog && dialog.open) dialog.close();
  }

  if (dialog) {
    dialog.addEventListener("close", function () {
      window.dispatchEvent(new CustomEvent("message-eunjae:close"));
      if (opener && typeof opener.focus === "function") opener.focus();
      opener = null;
    });
    // Keep Tab and Shift+Tab inside the dialog. Esc closes it natively.
    dialog.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // A click on the backdrop (outside the panel) closes it.
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) fallbackClose();
    });
    dialog.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", fallbackClose);
    });
  }

  function useFallback() {
    if (mode === "fallback") return;
    mode = "fallback";
    var stub = window.MessageEunjae || {};
    var queued = Array.isArray(stub.q) ? stub.q.slice() : [];
    window.MessageEunjae = {
      q: [],
      open: fallbackOpen,
      close: fallbackClose,
      toggle: function () { (dialog && dialog.open) ? fallbackClose() : fallbackOpen(); }
    };
    queued.forEach(function (call) {
      if (typeof window.MessageEunjae[call] === "function") window.MessageEunjae[call]();
    });
  }

  function useWidget() {
    if (mode === "pending") mode = "widget";
  }

  // Every trigger means "open the chat", never "toggle it": the page's buttons say
  // "Message me", and the floating launcher hides while the chat is open. Captured
  // here so the widget's own toggle-on-click never runs. Before embed.js has loaded
  // the call goes into the stub's queue; in fallback mode it opens the dialog.
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(TRIGGER);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    if (mode === "fallback") fallbackOpen();
    else window.MessageEunjae.open();
  }, true);

  // Decide the mode ----------------------------------------------------------
  if (!embed || window.MessageEunjaeFailed) {
    useFallback();
  } else if (window.MessageEunjaeLoaded) {
    useWidget();
  } else {
    embed.addEventListener("load", useWidget);
    embed.addEventListener("error", useFallback);
    setTimeout(function () { if (mode === "pending") useFallback(); }, LOAD_TIMEOUT_MS);
  }

  if (location.hash === "#message") {
    window.MessageEunjae.open();
  }
})();
