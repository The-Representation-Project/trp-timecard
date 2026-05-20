/**
 * TRP Headline-i: enforce TRP's signature typographic move where
 * all-caps headlines preserve the lowercase "i" — e.g. THE REPRESENTATiON PROJECT.
 *
 * Walks the DOM, finds text nodes whose nearest element has
 * `text-transform: uppercase` (computed), and rewrites the text:
 *   - uppercase every letter EXCEPT the letter "i" (any case),
 *     which is forced to lowercase "i".
 *
 * Re-runs on DOM mutations so dynamically rendered React content is covered.
 *
 * Idempotent: walking the same node twice produces the same result.
 *
 * Drop into any TRP page with:
 *   <script src="path/to/trp-headline-i.js"></script>
 */
(function () {
  // Inject the override stylesheet FIRST — even if the helper has already run
  // earlier, we want this stylesheet present on the page.
  if (!document.querySelector("style[data-trp-i-styles]")) {
    const style = document.createElement("style");
    style.setAttribute("data-trp-i-styles", "");
    style.textContent = "[data-trp-i]{text-transform:none !important;}";
    (document.head || document.documentElement).appendChild(style);
  }

  if (window.__TRP_HEADLINE_I__) return;
  window.__TRP_HEADLINE_I__ = true;

  function rewriteString(s) {
    return s.toUpperCase().replace(/I/g, "i");
  }

  function isUppercaseElement(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      return getComputedStyle(el).textTransform === "uppercase";
    } catch (e) {
      return false;
    }
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    const parent = node.parentElement;
    if (!parent) return;
    if (parent.closest("[data-trp-no-i]")) return;
    if (!isUppercaseElement(parent)) return;
    const original = node.nodeValue;
    if (!original || !original.trim()) return;
    const rewritten = rewriteString(original);
    if (rewritten !== original) node.nodeValue = rewritten;
    // Tag the parent so our stylesheet kills text-transform on it.
    if (!parent.hasAttribute("data-trp-i")) {
      parent.setAttribute("data-trp-i", "");
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== 1) return;
    // TreeWalker for performance
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = tw.nextNode())) processTextNode(n);
  }

  function run() {
    walk(document.body);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }

  // Re-process on DOM changes (React renders, route changes, etc.)
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const added of m.addedNodes) walk(added);
      if (m.type === "characterData") processTextNode(m.target);
    }
  });
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
