/* =========================================================================
   Accueil : éventail des cartes, indicateurs clés, aperçus des chapitres
   et diagramme de synthèse (« deux mondes »).
   ========================================================================= */
(function () {
  "use strict";
  const { clients, CARTES, fmt } = App;
  const N = clients.length;
  const parCarte = d3.group(clients, (r) => r.card);

  /* ---------- 1. Éventail des cartes (surface ∝ nombre de clients) ---------- */
  const resume = CARTES.map((nom, i) => {
    const rs = parCarte.get(i);
    return {
      i, nom, n: rs.length, part: rs.length / N,
      revenu: d3.median(rs, (r) => r.inc),
      depense: d3.mean(rs, (r) => r.spend),
      score: d3.mean(rs, (r) => r.score),
    };
  });

  const fan = document.getElementById("fan");
  const cartes = resume.map((d) => {
    const el = document.createElement("div");
    el.className = "pcard";
    el.tabIndex = 0;
    el.setAttribute("role", "listitem");
    el.setAttribute("aria-label", `${d.nom} : ${fmt.int(d.n)} clients, ${fmt.pct1(d.part)} du total, revenu médian ${fmt.k(d.revenu)}`);
    el.innerHTML = '<div><div class="tier"></div><div class="chip"></div></div><div class="count"><span class="c"></span><small></small></div>';
    el.querySelector(".tier").textContent = d.nom;
    el.querySelector(".c").textContent = fmt.int(d.n);
    el.querySelector("small").textContent = fmt.pct1(d.part);
    fan.appendChild(el);
    const contenu = () => ({
      title: `Carte ${d.nom}`,
      rows: [
        { label: "Clients", value: fmt.int(d.n) },
        { label: "Part du total", value: fmt.pct1(d.part) },
        { label: "Revenu annuel médian", value: fmt.k(d.revenu) },
        { label: "Dépense mensuelle moyenne", value: fmt.k(d.depense) },
        { label: "Score de crédit moyen", value: fmt.int(d.score) },
      ],
    });
    const lift = (on) => {
      el.style.setProperty("--lift", on ? "-16px" : "0px");
      el.style.zIndex = on ? 10 : d.i + 1;
    };
    el.addEventListener("pointerenter", (ev) => { lift(true); App.tip.show(ev, contenu()); });
    el.addEventListener("pointermove", (ev) => App.tip.show(ev, contenu()));
    el.addEventListener("pointerleave", () => { lift(false); App.tip.hide(); });
    el.addEventListener("focus", () => { lift(true); App.tip.showAt(el, contenu()); });
    el.addEventListener("blur", () => { lift(false); App.tip.hide(); });
    return el;
  });

  let premiereFois = true;
  function placerCartes() {
    const W = fan.clientWidth, H = fan.clientHeight;
    if (!W) return;
    const couleurs = App.colors().cards;
    const maxPart = d3.max(resume, (d) => d.part);
    const wMax = Math.min(W * 0.42, (H - 40) * 1.586, 300);
    const largeurs = resume.map((d) => wMax * Math.sqrt(d.part / maxPart));
    const etroit = W < 520;
    const angles = etroit ? [-5, -2.5, 0, 2.5, 5] : [-9, -4.5, 0, 4.5, 9];
    const x0 = largeurs[0] / 2 + 10, x1 = W - largeurs[4] / 2 - (etroit ? 20 : 14);
    resume.forEach((d, i) => {
      const el = cartes[i];
      const w = largeurs[i], h = w / 1.586;
      const cx = x0 + ((x1 - x0) * i) / 4;
      const bas = H - 16 - (i - 2) * (i - 2) * 5;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = couleurs[i];
      el.classList.toggle("light-ink", App.inkOn(couleurs[i]) !== "#ffffff");
      el.classList.toggle("dark-ink", App.inkOn(couleurs[i]) === "#ffffff");
      el.style.zIndex = i + 1;
      el.style.fontSize = `${Math.max(9.5, Math.min(17, w * 0.066))}px`;
      // le nom de la carte doit tenir dans sa largeur (Archivo large : ~0,68 em par caractère)
      const tailleNom = Math.min(Math.max(9.5, Math.min(21, w * 0.08)), (w * 0.86) / (d.nom.length * 0.68));
      el.querySelector(".tier").style.fontSize = `${tailleNom}px`;
      el.querySelector(".chip").style.display = w < 150 ? "none" : "";
      el.style.setProperty("--x", `${cx - w / 2}px`);
      el.style.setProperty("--y", `${bas - h}px`);
      el.style.setProperty("--a", `${angles[i]}deg`);
      if (!el.style.getPropertyValue("--lift")) el.style.setProperty("--lift", "0px");
      el.style.transform = "translate(var(--x), calc(var(--y) + var(--lift))) rotate(var(--a))";
    });
    if (premiereFois && !App.reduced) {
      // Un seul moment animé : les cartes se déploient en éventail au chargement.
      premiereFois = false;
      cartes.forEach((el, i) => {
        el.style.transition = "none";
        el.style.opacity = "0";
        el.style.transform = `translate(${W / 2 - parseFloat(el.style.width) / 2}px, ${H - 18 - parseFloat(el.style.height)}px) rotate(0deg) scale(0.92)`;
      });
      fan.getBoundingClientRect();
      cartes.forEach((el, i) => {
        el.style.transition = `transform 0.9s cubic-bezier(.2,.75,.2,1) ${0.08 * i}s, opacity 0.5s ease ${0.08 * i}s, box-shadow .35s`;
        el.style.opacity = "1";
        el.style.transform = "translate(var(--x), calc(var(--y) + var(--lift))) rotate(var(--a))";
      });
      setTimeout(() => cartes.forEach((el) => { el.style.transition = ""; }), 1500);
    }
    premiereFois = false;
  }
  placerCartes();
  if ("ResizeObserver" in window) new ResizeObserver(() => placerCartes()).observe(fan);
  document.addEventListener("themechange", placerCartes);

  /* ---------- 2. Indicateurs clés (avec distribution miniature) ---------- */
  const S = App.meta.seuils;
  const depenses = clients.map((r) => r.spend);
  const kpis = [
    { label: "Clients", value: fmt.int(N), note: "30 variables, aucune valeur manquante" },
    {
      label: "Dépense mensuelle", value: fmt.int(d3.mean(depenses)),
      note: `moyenne ; médiane ${fmt.int(d3.median(depenses))}`,
      spark: { values: depenses.map(Math.log10), domain: [3.3, 5.9] },
    },
    {
      label: "Utilisation du plafond", value: fmt.pct1(d3.mean(clients, (r) => r.util)),
      note: "moyenne des 50 000 clients",
      spark: { values: clients.map((r) => Math.round(r.util * 100)), domain: [10, 95], pas: 5 },
    },
    {
      label: "Score de crédit", value: fmt.int(d3.mean(clients, (r) => r.score)),
      note: `moyenne ; de ${d3.min(clients, (r) => r.score)} à ${d3.max(clients, (r) => r.score)}`,
      spark: { values: clients.map((r) => r.score), domain: [360, 800], pas: 16 },
    },
    {
      label: "Zone à risque", alert: true,
      value: fmt.pct1(d3.mean(clients, (r) => (r.util > S.utilisation && r.pay < S.remboursement ? 1 : 0))),
      note: "utilisation > 60 % et remboursement < 50 %",
    },
  ];
  const kpiBox = document.getElementById("kpis");
  kpis.forEach((k) => {
    const el = document.createElement("div");
    el.className = "kpi";
    const lab = document.createElement("div");
    lab.className = "label";
    if (k.alert) {
      lab.innerHTML = '<span class="status"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="currentColor"/><path d="M8 6v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="#fff"/></svg></span> ';
    }
    lab.append(document.createTextNode(k.label));
    const val = document.createElement("div");
    val.className = "value";
    val.textContent = k.value;
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = k.note;
    el.append(lab, val, note);
    if (k.spark) {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("class", "spark");
      s.setAttribute("aria-hidden", "true");
      el.append(s);
      k.sparkEl = s;
    }
    kpiBox.append(el);
  });
  function dessinerSparks() {
    kpis.filter((k) => k.spark).forEach((k) => {
      const svg = d3.select(k.sparkEl);
      const w = k.sparkEl.clientWidth || 160, h = 30;
      svg.attr("viewBox", [0, 0, w, h]);
      const x = d3.scaleLinear(k.spark.domain, [0, w]);
      const seuils = k.spark.pas ? d3.range(k.spark.domain[0], k.spark.domain[1], k.spark.pas) : x.ticks(28);
      const bins = d3.bin().domain(k.spark.domain).thresholds(seuils)(k.spark.values);
      const y = d3.scaleLinear([0, d3.max(bins, (b) => b.length)], [0, h]);
      svg.selectAll("rect").data(bins).join("rect")
        .attr("x", (b) => x(b.x0) + 0.5).attr("width", (b) => Math.max(0.5, x(b.x1) - x(b.x0) - 1.5))
        .attr("y", (b) => h - y(b.length)).attr("height", (b) => y(b.length))
        .attr("rx", 1).attr("fill", "var(--axis)");
    });
  }
  dessinerSparks();
  if ("ResizeObserver" in window) new ResizeObserver(dessinerSparks).observe(kpiBox);

  /* ---------- 3. Aperçus des chapitres ---------- */
  function mini(id, draw) {
    const svg = d3.select(`#${id}`);
    const render = () => {
      const w = svg.node().clientWidth || 150, h = svg.node().clientHeight || 112;
      svg.attr("viewBox", [0, 0, w, h]).selectAll("*").remove();
      draw(svg, w, h, App.colors());
    };
    render();
    document.addEventListener("themechange", render);
    if ("ResizeObserver" in window) new ResizeObserver(render).observe(svg.node());
  }

  // Profil : part de chaque carte par profession (barres empilées à 100 %)
  mini("mini-profil", (svg, w, h, k) => {
    const occs = d3.range(App.PROFESSIONS.length);
    const y = d3.scaleBand(occs, [0, h]).padding(0.38);
    occs.forEach((o) => {
      const rs = clients.filter((r) => r.occ === o);
      let x = 0;
      CARTES.forEach((_, c) => {
        const part = rs.filter((r) => r.card === c).length / rs.length;
        if (part > 0) {
          svg.append("rect").attr("x", x * w).attr("y", y(o)).attr("width", Math.max(0, part * w - 1.5))
            .attr("height", y.bandwidth()).attr("fill", k.cards[c]);
        }
        x += part;
      });
    });
  });

  // Dépenses : structure des dépenses par carte (identique d'une carte à l'autre)
  mini("mini-depenses", (svg, w, h, k) => {
    const x = d3.scaleBand(d3.range(5), [0, w]).padding(0.32);
    CARTES.forEach((_, c) => {
      const cells = App.cube.filter((r) => r.card === c);
      const tot = d3.range(7).map((j) => d3.sum(cells, (r) => r[`c${j}`]));
      const s = d3.sum(tot);
      let y = h;
      tot.forEach((v, j) => {
        const hh = (v / s) * h;
        svg.append("rect").attr("x", x(c)).attr("width", x.bandwidth()).attr("y", y - hh + 0.75)
          .attr("height", Math.max(0, hh - 1.5)).attr("fill", k.cats[j]);
        y -= hh;
      });
    });
  });

  // Risque : score moyen selon utilisation (x) et remboursement (y)
  mini("mini-risque", (svg, w, h) => {
    const nx = 12, ny = 9;
    const color = App.scoreScale(false);
    const grid = d3.rollup(clients, (v) => d3.mean(v, (r) => r.score),
      (r) => Math.min(nx - 1, Math.floor(((r.util - 0.1) / 0.85) * nx)),
      (r) => Math.min(ny - 1, Math.floor(((r.pay - 0.1) / 0.9) * ny)));
    const cw = w / nx, ch = h / ny;
    grid.forEach((col, i) => col.forEach((v, j) => {
      svg.append("rect").attr("x", i * cw + 0.75).attr("y", h - (j + 1) * ch + 0.75)
        .attr("width", cw - 1.5).attr("height", ch - 1.5).attr("rx", 1.5).attr("fill", color(v));
    }));
  });

  // Engagement : dépense médiane par quintile de connexions
  mini("mini-engagement", (svg, w, h, k) => {
    const med = d3.range(5).map((q) => d3.median(clients.filter((r) => r.lq === q), (r) => r.spend));
    const x = d3.scaleBand(d3.range(5), [0, w]).padding(0.38);
    const y = d3.scaleLinear([0, d3.max(med)], [0, h - 4]);
    med.forEach((v, q) => {
      svg.append("path").attr("d", App.barPath(x(q), h - y(v), x.bandwidth(), y(v), 3, "top")).attr("fill", k.mesure);
    });
  });

  /* ---------- 4. Diagramme de synthèse ---------- */
  const rang = (vals) => {
    // rangs moyens (ex aequo) pour la corrélation de Spearman
    const idx = d3.range(vals.length).sort((a, b) => vals[a] - vals[b]);
    const r = new Float64Array(vals.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && vals[idx[j + 1]] === vals[idx[i]]) j++;
      const moy = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k]] = moy;
      i = j + 1;
    }
    return r;
  };
  const col = (f) => clients.map(f);
  const P = App.stats.pearson;
  const spearman = (a, b) => P(rang(a), rang(b));
  const eta = (() => {
    // rapport de corrélation : part de la variance du revenu expliquée par la profession
    const m = d3.mean(clients, (r) => r.inc);
    const sst = d3.sum(clients, (r) => (r.inc - m) ** 2);
    const ssb = d3.sum(d3.rollups(clients, (v) => v.length * (d3.mean(v, (r) => r.inc) - m) ** 2, (r) => r.occ), (d) => d[1]);
    return Math.sqrt(ssb / sst);
  })();
  const ech = App.echantillon;
  const liens = [
    { a: "profession", b: "revenu", r: eta, mesure: "Rapport de corrélation η" },
    { a: "revenu", b: "carte", r: spearman(col((r) => r.inc), col((r) => r.card)), mesure: "Corrélation de Spearman (rangs)" },
    { a: "revenu", b: "plafond", r: P(ech.map((r) => r.inc), ech.map((r) => r.lim)), mesure: "Pearson (échantillon de 3 000)" },
    { a: "revenu", b: "depense", r: P(col((r) => r.inc), col((r) => r.spend)), mesure: "Pearson" },
    { a: "carte", b: "connexions", r: spearman(col((r) => r.card), col((r) => r.login)), mesure: "Corrélation de Spearman (rangs)" },
    { a: "remboursement", b: "score", r: P(col((r) => r.pay), col((r) => r.score)), mesure: "Pearson" },
    { a: "utilisation", b: "score", r: P(col((r) => r.util), col((r) => r.score)), mesure: "Pearson" },
    { a: "revenu", b: "score", r: P(col((r) => r.inc), col((r) => r.score)), mesure: "Pearson", faible: true },
  ];
  const noms = {
    profession: "Profession", revenu: "Revenu", carte: "Carte", plafond: "Plafond", depense: "Dépense",
    connexions: "Connexions", remboursement: "Remboursement", utilisation: "Utilisation", score: "Score",
  };
  App.table("t-diagramme", [
    { label: "Lien", value: (d) => `${noms[d.a]} – ${noms[d.b]}` },
    { label: "Force", value: (d) => d.r, format: (v) => fmt.r(v) },
    { label: "Mesure", value: (d) => d.mesure },
  ], liens);

  // Positions normalisées (0–1) : version large et version étroite (mobile)
  const LARGE = {
    profession: [0.07, 0.44], revenu: [0.25, 0.44], carte: [0.45, 0.16], plafond: [0.45, 0.44],
    depense: [0.45, 0.72], connexions: [0.625, 0.16], remboursement: [0.815, 0.22], utilisation: [0.815, 0.66], score: [0.948, 0.44],
    mondes: [[0, 0.02, 0.692, 0.86, "Ce que le client est"], [0.718, 0.02, 0.282, 0.86, "Ce qu'il fait de son crédit"]],
    bas: 0.955,
  };
  const ETROIT = {
    profession: [0.17, 0.09], revenu: [0.62, 0.09], carte: [0.2, 0.3], plafond: [0.5, 0.3],
    depense: [0.8, 0.3], connexions: [0.2, 0.48], remboursement: [0.27, 0.75], utilisation: [0.73, 0.75], score: [0.5, 0.92],
    mondes: [[0, 0.0, 1, 0.57, "Ce que le client est"], [0, 0.62, 1, 0.38, "Ce qu'il fait de son crédit"]],
    bas: null,
  };

  App.chart("#diagramme", {
    label: "Diagramme des liens entre variables : profession, revenu, carte, plafond, dépense et connexions d'un côté ; remboursement, utilisation et score de l'autre ; lien revenu–score quasi nul.",
    height: (w) => (w < 620 ? 560 : 340),
    margin: { t: 6, r: 6, b: 6, l: 6 },
    draw(ctx) {
      const { plot, iw, ih } = ctx;
      plot.selectAll("*").remove();
      const L = iw < 608 ? ETROIT : LARGE;
      const pos = (k) => [L[k][0] * iw, L[k][1] * ih];
      const epaisseur = d3.scaleLinear([0, 1], [1, 7]);

      plot.selectAll("rect.world-box").data(L.mondes).join("rect").attr("class", "world-box")
        .attr("x", (d) => d[0] * iw).attr("y", (d) => d[1] * ih).attr("width", (d) => d[2] * iw).attr("height", (d) => d[3] * ih).attr("rx", 14);
      plot.selectAll("text.world-label").data(L.mondes).join("text").attr("class", "world-label")
        .attr("x", (d) => d[0] * iw + 14).attr("y", (d) => d[1] * ih + 22).text((d) => d[4]);

      const chemin = (l) => {
        const [x1, y1] = pos(l.a), [x2, y2] = pos(l.b);
        if (l.faible && L.bas) {
          const yb = L.bas * ih;
          return `M${x1},${y1 + 14}C${x1},${yb} ${x1 + 60},${yb} ${(x1 + x2) / 2},${yb}S${x2},${yb} ${x2},${y2 + 14}`;
        }
        if (l.faible) return `M${x1 + 34},${y1}C${iw * 0.97},${y1} ${iw * 0.97},${y2} ${x2 + 26},${y2}`;
        return `M${x1},${y1}L${x2},${y2}`;
      };
      plot.selectAll("path.edge").data(liens).join("path")
        .attr("class", (d) => "edge" + (d.faible ? " weak" : ""))
        .attr("d", chemin).attr("stroke-width", (d) => epaisseur(Math.abs(d.r)));

      // Étiquettes des liens (valeur de la corrélation)
      // Étiquettes des liens : valeur placée au milieu du tracé, sur fond de page
      const milieu = (d) => {
        const tmp = plot.append("path").attr("d", chemin(d)).attr("visibility", "hidden");
        const pt = tmp.node().getPointAtLength(tmp.node().getTotalLength() / 2);
        tmp.remove();
        return pt;
      };
      const lab = plot.selectAll("g.edge-lab").data(liens).join("g").attr("class", "edge-lab")
        .attr("transform", (d) => { const p = milieu(d); return `translate(${p.x},${p.y})`; });
      lab.selectAll("rect").data((d) => [d]).join("rect").attr("class", "edge-label-bg")
        .attr("x", -19).attr("y", -10).attr("width", 38).attr("height", 20).attr("rx", 4);
      lab.selectAll("text").data((d) => [d]).join("text").attr("class", "edge-label")
        .attr("text-anchor", "middle").attr("dy", "0.35em")
        .text((d) => fmt.dec2(d.r));

      const noeuds = Object.keys(noms).map((k) => ({ k, nom: noms[k], p: pos(k) }));
      const g = plot.selectAll("g.node").data(noeuds).join("g")
        .attr("class", (d) => "node" + (d.k === "score" ? " target" : ""))
        .attr("transform", (d) => `translate(${d.p[0]},${d.p[1]})`);
      g.selectAll("text").data((d) => [d]).join("text").attr("text-anchor", "middle").attr("dy", "0.36em").text((d) => d.nom);
      g.each(function () {
        const t = d3.select(this).select("text").node().getBBox();
        d3.select(this).selectAll("rect").data([0]).join("rect").lower()
          .attr("x", t.x - 11).attr("y", -15).attr("width", t.width + 22).attr("height", 30).attr("rx", 15);
      });
    },
  });
})();
