/* =========================================================================
   commun.js — socle partagé par toutes les pages
   - décode data/donnees.js en tableau de clients (objets JavaScript)
   - formats de nombres à la française (d3.formatLocale)
   - thème clair / sombre et lecture des couleurs (variables CSS)
   - cadre de graphique responsive (ResizeObserver) avec transitions D3
   - infobulle accessible (souris, tactile et clavier), légendes, filtres,
     contrôles segmentés et vue « tableau » de chaque graphique
   ========================================================================= */
/* ---------- Bouton de thème (indépendant des données, utile sur toutes les pages) ---------- */
(function () {
  "use strict";
  const html = document.documentElement;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const courant = () => html.dataset.theme || (mq.matches ? "dark" : "light");
  const emit = () => document.dispatchEvent(new CustomEvent("themechange"));
  if (mq.addEventListener) mq.addEventListener("change", () => { if (!html.dataset.theme) emit(); });
  const init = () => {
    const btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    const label = () => btn.setAttribute("aria-label", courant() === "dark" ? "Passer au thème clair" : "Passer au thème sombre");
    label();
    btn.addEventListener("click", () => {
      const next = courant() === "dark" ? "light" : "dark";
      html.dataset.theme = next;
      try { localStorage.setItem("cc-theme", next); } catch (e) { /* stockage indisponible */ }
      label();
      emit();
    });
    document.addEventListener("themechange", label);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

(function () {
  "use strict";

  const D = window.DONNEES;
  if (document.body && document.body.hasAttribute("data-sans-donnees")) return;
  if (!D || !window.d3) {
    document.addEventListener("DOMContentLoaded", () => {
      const p = document.createElement("p");
      p.style.cssText = "max-width:40rem;margin:40px auto;padding:16px 20px;border-radius:10px;background:#fdecea;color:#7a1a1a;font:16px/1.5 system-ui";
      p.textContent = "Les données (data/donnees.js) ou la bibliothèque D3 (assets/js/d3.v7.min.js) n'ont pas pu être chargées. Vérifiez que le dossier du projet a bien été décompressé en entier.";
      document.body.prepend(p);
    });
    return;
  }

  const App = (window.App = {});
  const M = D.meta;
  App.meta = M;
  App.N = M.n;
  App.CARTES = M.cartes;
  App.PROFESSIONS = M.professions;
  App.GENRES = M.genres;
  App.CATEGORIES = M.categories;
  App.AGES = M.tranchesAge.map(([a, b]) => `${a}–${b} ans`);
  App.CONNEXIONS = M.tranchesConnexion.map(([a, b]) => `${a}–${b}`);
  App.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Données : colonnes -> objets ---------- */
  const trancheIndex = (bornes, max) => {
    const t = new Int8Array(max + 1).fill(-1);
    bornes.forEach(([lo, hi], i) => { for (let v = lo; v <= hi; v++) t[v] = i; });
    return t;
  };
  const AB = trancheIndex(M.tranchesAge, 120);
  const LQ = trancheIndex(M.tranchesConnexion, 200);

  const C = D.clients;
  const rows = new Array(C.age.length);
  for (let i = 0; i < rows.length; i++) {
    const age = C.age[i], login = C.login[i];
    rows[i] = {
      i, age, ab: AB[age], g: C.g[i], occ: C.occ[i], card: C.card[i],
      inc: C.inc[i] * 1000, spend: C.spend[i], login, lq: LQ[login],
      util: C.util[i] / 100, pay: C.pay[i] / 100, score: C.score[i], bal: C.bal[i] * 1000,
    };
  }
  const E = D.echantillon;
  for (let i = 0; i < E.tx.length; i++) {
    Object.assign(rows[i], {
      tx: E.tx[i], ticket: E.ticket[i], intl: E.intl[i], cash: E.cash[i] * 1000,
      emi: E.emi[i], cage: E.cage[i], lim: E.lim[i] * 1000, ech: true,
    });
  }
  App.clients = rows;
  App.echantillon = rows.slice(0, E.tx.length);
  App.cube = D.cube.lignes.map((l) => {
    const o = {};
    D.cube.champs.forEach((k, j) => { o[k] = l[j]; });
    return o;
  });
  App.correlations = D.correlations;
  App.modeles = D.modeles;
  App.structure = D.structure;

  /** Prédicat de filtre : f = { g, ab, occ, card } ; -1 (ou absent) = tous. */
  App.match = (f) => {
    const keys = Object.keys(f).filter((k) => f[k] != null && f[k] >= 0);
    return (r) => keys.every((k) => r[k] === f[k]);
  };

  /* ---------- 2. Formats français ---------- */
  // Séparateur de milliers : espace insécable (U+00A0) ; avant « % » : espace fine insécable.
  const L = d3.formatLocale({
    decimal: ",", thousands: " ", grouping: [3], currency: ["", ""],
    minus: "−", percent: " %",
  });
  const fmt = (App.fmt = {
    int: L.format(",.0f"),
    dec1: L.format(",.1f"),
    dec2: L.format(",.2f"),
    pct0: L.format(".0%"),
    pct1: L.format(".1%"),
    signed0: L.format("+,.0f"),
    signed1: L.format("+,.1f"),
    r: L.format("+.2f"),
    pts: L.format("+,.1f"),
  });
  /** Montant compact : 850 · 7,4 k · 74 k · 1,48 M */
  fmt.k = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return L.format(a >= 1e7 ? ",.1~f" : ",.2~f")(v / 1e6) + " M";
    if (a >= 1e4) return L.format(",.0f")(v / 1e3) + " k";
    if (a >= 1e3) return L.format(",.1~f")(v / 1e3) + " k";
    return L.format(",.0f")(v);
  };
  fmt.clients = (n) => `${fmt.int(n)} client${n > 1 ? "s" : ""}`;

  /* ---------- 3. Thème et couleurs ---------- */
  const html = document.documentElement;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  App.theme = () => html.dataset.theme || (mq.matches ? "dark" : "light");

  App.css = (name) => getComputedStyle(html).getPropertyValue(name).trim();
  App.colors = () => {
    const c = App.css;
    return {
      page: c("--page"), plane: c("--plane"), ink: c("--ink"), ink2: c("--ink-2"), muted: c("--muted"),
      hair: c("--hair"), axis: c("--axis"), accent: c("--accent"), mesure: c("--mesure"), critical: c("--critical"),
      cards: [0, 1, 2, 3, 4].map((i) => c(`--card-${i}`)),
      cats: [0, 1, 2, 3, 4, 5, 6].map((i) => c(`--cat-${i}`)),
      div: ["--div-lo", "--div-lo-2", "--div-lo-3", "--div-mid", "--div-hi-3", "--div-hi-2", "--div-hi"].map(c),
      divMidDot: c("--div-mid-dot"),
    };
  };
  /** Échelle divergente du score : rouge (faible) ↔ gris (≈ moyenne) ↔ bleu (élevé). */
  App.SCORE_DOMAINE = [480, 630, 780];
  App.scoreScale = (pourPoints) => {
    const k = App.colors();
    const stops = k.div.slice();
    if (pourPoints) stops[3] = k.divMidDot;
    return d3.scaleDiverging(d3.piecewise(d3.interpolateLab, stops)).domain(App.SCORE_DOMAINE).clamp(true);
  };
  /** Encre lisible (claire ou foncée) sur un fond coloré. */
  const luminance = (col) => {
    const c = d3.rgb(col);
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  };
  App.contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  /** Encre la plus contrastée (foncée ou blanche) sur un fond coloré. */
  App.inkOn = (fill) => (App.contrast(fill, "#141a33") >= App.contrast(fill, "#ffffff") ? "#141a33" : "#ffffff");

  /* ---------- 4. Infobulle ---------- */
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("aria-hidden", "true");
  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  function fillTip(c) {
    tip.replaceChildren();
    if (c.title) tip.append(mk("div", "t-title", c.title));
    if (c.sub) tip.append(mk("div", "t-sub", c.sub));
    (c.rows || []).forEach((r) => {
      const row = mk("div", "t-row" + (r.color ? "" : " no-key"));
      if (r.color) {
        const key = mk("span", "t-key");
        key.style.background = r.color;
        row.append(key);
      }
      row.append(mk("span", "t-label", r.label), mk("span", "t-val", r.value));
      tip.append(row);
    });
    if (c.note) tip.append(mk("div", "t-note", c.note));
  }
  function placeTip(x, y) {
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 16, top = y + 16;
    if (left + w > window.innerWidth - 8) left = x - w - 16;
    if (top + h > window.innerHeight - 8) top = y - h - 16;
    tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  }
  App.tip = {
    show(ev, content) { fillTip(content); tip.classList.add("on"); placeTip(ev.clientX, ev.clientY); },
    showAt(node, content) {
      fillTip(content); tip.classList.add("on");
      const b = node.getBoundingClientRect();
      placeTip(b.left + b.width / 2, b.top + Math.min(b.height / 2, 30));
    },
    hide() { tip.classList.remove("on"); },
  };
  if (document.body) document.body.appendChild(tip);
  else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));
  window.addEventListener("scroll", () => App.tip.hide(), { passive: true });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") App.tip.hide(); });

  const tipText = (c) => [c.title, c.sub, ...(c.rows || []).map((r) => `${r.label} : ${r.value}`), c.note].filter(Boolean).join(". ");

  /**
   * Infobulle sur des marques SVG (survol, toucher, focus clavier).
   * content(d, node) -> { title, sub, rows: [{ label, value, color }], note }
   */
  App.hover = (sel, content, opts = {}) => {
    sel.classed("mark", true)
      .on("pointerenter.tip pointermove.tip", function (ev, d) {
        App.tip.show(ev, content(d, this));
        this.classList.add("is-hover");
        if (opts.enter) opts.enter(d, this);
      })
      .on("pointerleave.tip", function (ev, d) {
        App.tip.hide();
        this.classList.remove("is-hover");
        if (opts.leave) opts.leave(d, this);
      });
    if (opts.focus !== false) {
      sel.attr("tabindex", 0)
        .attr("aria-label", function (d) { return tipText(content(d, this)); })
        .on("focus.tip", function (ev, d) {
          App.tip.showAt(this, content(d, this));
          if (opts.enter) opts.enter(d, this);
        })
        .on("blur.tip", function (ev, d) {
          App.tip.hide();
          if (opts.leave) opts.leave(d, this);
        });
    }
    if (opts.click) {
      sel.style("cursor", "pointer")
        .on("click.sel", function (ev, d) { opts.click(d, this); })
        .on("keydown.sel", function (ev, d) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); opts.click(d, this); }
        });
    }
    return sel;
  };

  /* ---------- 5. Cadre de graphique ---------- */
  /** Calque unique (créé une fois, réutilisé à chaque rendu). */
  App.layer = (parent, cls, tag = "g") =>
    parent.selectAll(`:scope > ${tag}.${cls.trim().split(/\s+/).join(".")}`).data([null]).join(tag).attr("class", cls);

  /**
   * Graphique responsive.
   * opts : { label, height: n | (w) => n, margin: {t,r,b,l} | (w) => {...}, draw(ctx) }
   * ctx  : { svg, plot, w, h, iw, ih, m, colors, animate, tr(sel) }
   * chart.update() redessine avec transition (après un filtre) ;
   * un redimensionnement ou un changement de thème redessine sans transition.
   */
  App.chart = (container, opts) => {
    const node = typeof container === "string" ? document.querySelector(container) : container;
    const root = d3.select(node);
    root.selectAll("svg").remove();
    const svg = root.append("svg").attr("role", "img").attr("aria-label", opts.label || "");
    let lastW = 0, timer = null;
    const chart = {
      svg, node,
      render(animate) {
        const w = Math.floor(node.clientWidth);
        if (!w) return;
        lastW = w;
        const m = typeof opts.margin === "function" ? opts.margin(w) : opts.margin;
        const h = Math.round(typeof opts.height === "function" ? opts.height(w) : opts.height);
        svg.attr("width", w).attr("height", h).attr("viewBox", [0, 0, w, h]);
        const ctx = {
          svg, w, h, m, iw: Math.max(10, w - m.l - m.r), ih: Math.max(10, h - m.t - m.b),
          animate: !!animate && !App.reduced, colors: App.colors(),
        };
        ctx.plot = App.layer(svg, "plot").attr("transform", `translate(${m.l},${m.t})`);
        const T = ctx.animate ? d3.transition().duration(opts.duration || 650).ease(d3.easeCubicOut) : null;
        ctx.T = T;
        ctx.tr = (sel) => (T ? sel.transition(T) : sel);
        opts.draw(ctx);
      },
      update() { chart.render(true); },
    };
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => {
        const w = Math.floor(node.clientWidth);
        if (w && Math.abs(w - lastW) > 1) {
          clearTimeout(timer);
          timer = setTimeout(() => chart.render(false), 80);
        }
      }).observe(node);
    } else {
      window.addEventListener("resize", () => chart.render(false));
    }
    document.addEventListener("themechange", () => chart.render(false));
    chart.render(false);
    return chart;
  };

  /** Message « aucune donnée » au centre du graphique ; renvoie true si vide. */
  App.empty = (ctx, isEmpty, message) => {
    const g = App.layer(ctx.plot, "empty-layer");
    g.selectAll("text").data(isEmpty ? [message] : []).join("text")
      .attr("class", "empty-msg").attr("text-anchor", "middle")
      .attr("x", ctx.iw / 2).attr("y", ctx.ih / 2).text((d) => d);
    return isEmpty;
  };

  /**
   * Barre dont seule l'extrémité « données » est arrondie (r px), carrée côté ligne de base.
   * La structure du chemin est toujours la même (arcs de rayon éventuellement nul),
   * ce qui permet des transitions fluides de l'attribut d.
   */
  App.barPath = (x, y, w, h, r = 4, side = "right") => {
    w = Math.max(0, w); h = Math.max(0, h);
    if (side === "right" || side === "left") r = Math.max(0, Math.min(r, w, h / 2));
    else r = Math.max(0, Math.min(r, h, w / 2));
    if (side === "right") {
      return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}Z`;
    }
    if (side === "left") {
      return `M${x + w},${y}v${h}h${-(w - r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}Z`;
    }
    // side === "top" : barre verticale, base en bas
    return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}Z`;
  };

  /* ---------- 6. Mise en évidence par catégorie ----------
     Une « clé » (ex. "card" pour le type de carte, "cat" pour la catégorie de dépense)
     est partagée par tous les graphiques d'une page : survoler une carte dans un
     graphique ou dans une légende la fait ressortir partout. Un clic la garde en
     évidence ; un second clic, ou la touche Échap, la relâche. */
  const canaux = {};
  const canal = (cle) => canaux[cle] || (canaux[cle] = { fixe: null, survol: null, fns: [] });
  const emettre = (cle) => {
    const c = canal(cle);
    const v = c.survol != null ? c.survol : c.fixe;
    c.fns.forEach((fn) => fn(v, c.fixe));
  };
  App.surlignage = {
    /** Catégorie en évidence (survol prioritaire sur la sélection), ou null. */
    valeur(cle) { const c = canal(cle); return c.survol != null ? c.survol : c.fixe; },
    fixe(cle) { return canal(cle).fixe; },
    survoler(cle, v) { const c = canal(cle); if (c.survol === v) return; c.survol = v; emettre(cle); },
    basculer(cle, v) { const c = canal(cle); c.fixe = c.fixe === v ? null : v; c.survol = null; emettre(cle); },
    effacer(cle) { const c = canal(cle); c.fixe = null; c.survol = null; emettre(cle); },
    /** fn(valeur, fixe) est appelée à chaque changement. */
    ecouter(cle, fn) { canal(cle).fns.push(fn); },
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") Object.keys(canaux).forEach((cle) => { if (canal(cle).fixe != null) App.surlignage.effacer(cle); });
  });
  /** Atténue les marques dont la catégorie n'est pas celle mise en évidence. */
  App.attenuer = (sel, cle, categorie) => {
    const v = App.surlignage.valeur(cle);
    sel.classed("is-faded", (d) => v != null && categorie(d) !== v);
  };

  /* ---------- 7. Légendes, contrôles, filtres ---------- */
  /**
   * items : [{ label, color (ex. "var(--card-0)"), type: "" | "line" | "dot" | "zone", v }]
   * opts.cle : légende interactive ; chaque élément ayant une valeur v devient un bouton
   * qui met sa catégorie en évidence (survol, focus clavier, clic pour la garder).
   */
  App.legend = (container, items, opts = {}) => {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;
    const cle = opts.cle;
    const boutons = [];
    el.replaceChildren(...items.map((it) => {
      const interactif = cle && it.v != null;
      const k = mk(interactif ? "button" : "span", "key");
      if (it.ramp) {
        // échelle continue : « avant [dégradé] après », insécable
        k.style.whiteSpace = "nowrap";
        const sw = mk("i", "ramp");
        sw.style.background = `linear-gradient(90deg, ${it.ramp.stops.join(", ")})`;
        k.append(document.createTextNode(it.ramp.before), sw, document.createTextNode(it.ramp.after));
        return k;
      }
      const sw = mk("i", "sw" + (it.type ? " " + it.type : ""));
      if (it.color) sw.style.background = it.color;
      k.append(sw, document.createTextNode(it.label));
      if (interactif) {
        k.type = "button";
        k.setAttribute("aria-pressed", "false");
        k.title = `Mettre en évidence : ${it.label}`;
        const on = () => App.surlignage.survoler(cle, it.v);
        const off = () => App.surlignage.survoler(cle, null);
        k.addEventListener("pointerenter", on);
        k.addEventListener("pointerleave", off);
        k.addEventListener("focus", on);
        k.addEventListener("blur", off);
        k.addEventListener("click", () => App.surlignage.basculer(cle, it.v));
        boutons.push({ k, v: it.v });
      }
      return k;
    }));
    if (cle && boutons.length) {
      el.classList.add("interactive");
      el.append(mk("span", "astuce", opts.astuce || "Survolez une catégorie pour la faire ressortir, cliquez pour la garder."));
      const maj = (v, fixe) => boutons.forEach(({ k, v: bv }) => {
        k.setAttribute("aria-pressed", String(fixe === bv));
        k.classList.toggle("is-faded", v != null && v !== bv);
      });
      App.surlignage.ecouter(cle, maj);
    }
  };
  /** Dégradé de l'échelle divergente du score (variables CSS : suit le thème). */
  App.DIV_STOPS = ["--div-lo", "--div-lo-2", "--div-lo-3", "--div-mid", "--div-hi-3", "--div-hi-2", "--div-hi"].map((v) => `var(${v})`);

  /** Contrôle segmenté : options [{ value, label }] */
  App.segmented = (container, options, value, onChange, label) => {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    el.classList.add("seg");
    el.setAttribute("role", "group");
    if (label) el.setAttribute("aria-label", label);
    const buttons = options.map((o) => {
      const b = mk("button", "", o.label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(o.value === value));
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-pressed") === "true") return;
        buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        onChange(o.value);
      });
      return b;
    });
    el.replaceChildren(...buttons);
    return {
      set(v) { buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i].value === v))); },
    };
  };

  App.OPTIONS = {
    g: { label: "Genre", options: [{ value: -1, label: "Tous" }, ...M.genres.map((l, i) => ({ value: i, label: l }))] },
    ab: { label: "Âge", options: [{ value: -1, label: "Tous âges" }, ...App.AGES.map((l, i) => ({ value: i, label: l }))] },
    occ: { label: "Profession", options: [{ value: -1, label: "Toutes" }, ...M.professions.map((l, i) => ({ value: i, label: l }))] },
    card: { label: "Carte", options: [{ value: -1, label: "Toutes" }, ...M.cartes.map((l, i) => ({ value: i, label: l }))] },
  };

  /**
   * Barre de filtres unique au-dessus des graphiques.
   * keys : liste parmi "g", "ab", "occ", "card" ; onChange(state, key)
   */
  App.filterBar = (container, keys, onChange) => {
    const inner = (typeof container === "string" ? document.querySelector(container) : container);
    const state = {};
    const selects = {};
    keys.forEach((key) => {
      const def = App.OPTIONS[key];
      state[key] = -1;
      const lab = mk("label", "filter");
      lab.append(document.createTextNode(def.label));
      const s = document.createElement("select");
      def.options.forEach((o) => s.add(new Option(o.label, o.value)));
      s.value = "-1";
      s.addEventListener("change", () => { state[key] = +s.value; sync(); onChange(state, key); });
      lab.append(s);
      inner.append(lab);
      selects[key] = s;
    });
    const reset = mk("button", "btn-link", "Réinitialiser");
    reset.type = "button";
    reset.hidden = true;
    reset.addEventListener("click", () => {
      keys.forEach((k) => { state[k] = -1; selects[k].value = "-1"; });
      sync();
      onChange(state, null);
    });
    inner.append(reset);
    const count = mk("span", "count");
    count.setAttribute("aria-live", "polite");
    inner.append(count);
    function sync() { reset.hidden = keys.every((k) => state[k] === -1); }
    return {
      state,
      set(key, v) { state[key] = v; selects[key].value = String(v); sync(); onChange(state, key); },
      count(n) {
        count.replaceChildren();
        const s = mk("strong", "", fmt.int(n));
        count.append(s, document.createTextNode(n > 1 ? " clients sélectionnés" : " client sélectionné"));
        if (n < App.N) count.append(document.createTextNode(` (${fmt.pct1(n / App.N)})`));
      },
      describe() {
        const parts = keys.filter((k) => state[k] >= 0).map((k) => App.OPTIONS[k].options.find((o) => o.value === state[k]).label);
        return parts.length ? parts.join(", ") : "tous les clients";
      },
    };
  };

  /* ---------- 8. Vue tableau (équivalent accessible de chaque graphique) ---------- */
  const tables = {};
  function renderTable(det, t) {
    const body = det.querySelector(".body");
    if (!body) return;
    const wrap = mk("div", "table-wrap");
    const table = mk("table", "data");
    if (t.caption) {
      const cap = mk("caption", "sr-only", t.caption);
      table.append(cap);
    }
    const thead = mk("thead");
    const trh = mk("tr");
    t.columns.forEach((c) => { const th = mk("th", "", c.label); th.scope = "col"; trh.append(th); });
    thead.append(trh);
    const tbody = mk("tbody");
    t.rows.forEach((r) => {
      const tr = mk("tr");
      t.columns.forEach((c, j) => {
        const v = c.value(r);
        const cell = mk(j === 0 ? "th" : "td", "", c.format ? c.format(v) : v);
        if (j === 0) cell.scope = "row";
        tr.append(cell);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    wrap.append(table);
    body.replaceChildren(wrap);
    if (t.note) body.append(mk("p", "", t.note));
  }
  /** Mémorise le contenu du tableau ; l'affiche si le volet est ouvert. */
  App.table = (id, columns, rows, extra = {}) => {
    tables[id] = { columns, rows, ...extra };
    const det = document.querySelector(`details[data-table="${id}"]`);
    if (det && det.open) renderTable(det, tables[id]);
  };
  document.addEventListener("toggle", (ev) => {
    const det = ev.target;
    if (det.matches && det.matches("details[data-table]") && det.open && tables[det.dataset.table]) {
      renderTable(det, tables[det.dataset.table]);
    }
  }, true);

  /* ---------- 9. Statistiques ---------- */
  App.stats = {
    /** Boîte à moustaches (Tukey) à partir de valeurs triées. */
    box(sorted) {
      const q1 = d3.quantileSorted(sorted, 0.25), med = d3.quantileSorted(sorted, 0.5), q3 = d3.quantileSorted(sorted, 0.75);
      const iqr = q3 - q1;
      const lo = sorted.find((v) => v >= q1 - 1.5 * iqr);
      let hi = q3;
      for (let i = sorted.length - 1; i >= 0; i--) { if (sorted[i] <= q3 + 1.5 * iqr) { hi = sorted[i]; break; } }
      return { q1, med, q3, lo, hi, n: sorted.length, mean: d3.mean(sorted), min: sorted[0], max: sorted[sorted.length - 1] };
    },
    /** Corrélation de Pearson. */
    pearson(xs, ys) {
      const n = xs.length;
      if (n < 3) return NaN;
      const mx = d3.mean(xs), my = d3.mean(ys);
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
      return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
    },
  };

})();
