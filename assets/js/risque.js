/* =========================================================================
   Chapitre 3 — Qui présente un risque ?
   A. Utilisation × remboursement : points ou carte de chaleur du score,
      zone à risque réglable (seuils ou frontière diagonale), sélection.
   B. Modèle linéaire : effets des variables + simulateur de score.
   C. Matrice de corrélation (cliquable) + nuage de la paire choisie,
      puis score moyen par carte, observé et à comportement égal.
   ========================================================================= */
(function () {
  "use strict";
  const { clients, CARTES, PROFESSIONS, fmt } = App;
  const M2 = App.modeles.m2.coefs, M6 = App.modeles.m6.coefs;
  const BAS = App.meta.seuils.mauvaisScore;
  const pred2 = (u, p) => M2[0] + M2[1] * p + M2[2] * u;
  const MOYENNE = d3.mean(clients, (r) => r.score);
  const ICONE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="currentColor"/><path d="M8 6v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="#fff"/></svg>';

  const filtres = App.filterBar("#filtres", ["card", "occ", "g"], () => majTout());
  const st = filtres.state;
  let rows = clients;
  const filtrer = () => { rows = clients.filter(App.match(st)); };

  /* ======================= A. Zone à risque ======================= */
  const A = { vue: "points", frontiere: "carre", u: 0.6, p: 0.5, s: 550, sel: null };
  let dernier = null; // échelles et données du dernier rendu (pour survol, zone, sélection)

  App.segmented("#vue-a", [{ value: "points", label: "Clients" }, { value: "chaleur", label: "Score moyen" }], A.vue,
    (v) => { A.vue = v; chartA.update(); }, "Vue");
  App.segmented("#frontiere", [{ value: "carre", label: "Seuils" }, { value: "diag", label: "Diagonale" }], A.frontiere,
    (v) => { A.frontiere = v; syncCtl(); dessinerZone(true); panneau(); }, "Frontière de la zone à risque");

  const ctl = (id, out, cle, conv, aff) => {
    const inp = document.getElementById(id), o = document.getElementById(out);
    inp.addEventListener("input", () => { A[cle] = conv(+inp.value); o.textContent = aff(+inp.value); dessinerZone(false); panneau(); });
  };
  ctl("seuil-u", "out-u", "u", (v) => v / 100, (v) => `${v} %`);
  ctl("seuil-p", "out-p", "p", (v) => v / 100, (v) => `${v} %`);
  ctl("seuil-s", "out-s", "s", (v) => v, (v) => String(v));
  function syncCtl() {
    const diag = A.frontiere === "diag";
    document.getElementById("ctl-u").hidden = diag;
    document.getElementById("ctl-p").hidden = diag;
    document.getElementById("ctl-s").hidden = !diag;
  }

  const dansZone = (r) => (A.frontiere === "carre" ? r.util > A.u + 1e-9 && r.pay < A.p - 1e-9 : pred2(r.util, r.pay) < A.s);

  App.legend("#leg-a", [
    { ramp: { before: "Score 480", after: "780", stops: App.DIV_STOPS } },
    { label: "gris : proche de la moyenne (629)" },
    { label: "Zone à risque", type: "zone" },
    { label: "Score prédit constant (modèle)", color: "var(--ink-2)", type: "line" },
  ]);
  const legGris = document.querySelectorAll("#leg-a .key")[1];
  if (legGris) legGris.querySelector("i").remove();

  const jitter = (i, k) => ((((i * 9301 + 49297 * k) % 233280) / 233280) - 0.5) * 0.008;
  const CELL = 0.05;
  const binU = (u) => Math.min(16, Math.floor((Math.round(u * 100) - 10) / 5));
  const binP = (p) => Math.min(17, Math.floor((Math.round(p * 100) - 10) / 5));

  const chartA = App.chart("#chart-a", {
    label: "Nuage de points ou carte de chaleur : utilisation du plafond en abscisse, taux de remboursement en ordonnée, couleur selon le score de crédit, avec la zone à risque.",
    height: (w) => (w < 640 ? 420 : 540),
    margin: (w) => ({ t: 12, r: w < 640 ? 12 : 20, b: 46, l: 66 }),
    duration: 700,
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const x = d3.scaleLinear([0.1, 0.95], [0, iw]);
      const y = d3.scaleLinear([0.1, 1.0], [ih, 0]);
      const clip = App.layer(ctx.svg, "defs", "defs").selectAll("clipPath").data([0]).join("clipPath").attr("id", "clip-a");
      clip.selectAll("rect").data([0]).join("rect").attr("width", iw).attr("height", ih);

      App.layer(plot, "grid gx").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(8).tickSize(-ih).tickFormat(""));
      App.layer(plot, "grid gy").call(d3.axisLeft(y).ticks(9).tickSize(-iw).tickFormat(""));
      App.layer(plot, "axis ax").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(iw < 500 ? 5 : 8).tickFormat(fmt.pct0).tickSizeOuter(0));
      App.layer(plot, "axis ay").call(d3.axisLeft(y).ticks(9).tickFormat(fmt.pct0).tickSizeOuter(0));
      App.layer(plot, "axis-title xt", "text").attr("class", "axis-title xt").attr("x", iw).attr("y", ih + 38).attr("text-anchor", "end").text("Utilisation du plafond");
      App.layer(plot, "axis-title yt", "text").attr("class", "axis-title yt").attr("transform", "rotate(-90)").attr("x", 0).attr("y", -54).attr("text-anchor", "end").text("Taux de remboursement de la facture");

      // --- Carte de chaleur : score moyen par case de 5 × 5 points (tous les clients retenus)
      const cases = new Map();
      for (const r of rows) {
        const k = binU(r.util) * 100 + binP(r.pay);
        let c = cases.get(k);
        if (!c) { c = { ui: binU(r.util), pi: binP(r.pay), n: 0, s: 0, bas: 0 }; cases.set(k, c); }
        c.n++; c.s += r.score; if (r.score < BAS) c.bas++;
      }
      const grille = [...cases.values()].map((c) => ({ ...c, moy: c.s / c.n, id: c.ui * 100 + c.pi }));
      const colorCell = App.scoreScale(false);
      const heat = App.layer(plot, "heat").attr("clip-path", "url(#clip-a)");
      const rc = heat.selectAll("rect").data(A.vue === "chaleur" ? grille : [], (d) => d.id)
        .join(
          (e) => e.append("rect").attr("opacity", 0),
          (u) => u,
          (e) => (ctx.T ? e.transition(ctx.T).attr("opacity", 0).remove() : e.remove()),
        )
        .attr("x", (d) => x(0.1 + d.ui * CELL) + 1).attr("width", (d) => x(0.1 + (d.ui + 1) * CELL) - x(0.1 + d.ui * CELL) - 2)
        .attr("y", (d) => y(0.1 + (d.pi + 1) * CELL) + 1).attr("height", (d) => y(0.1 + d.pi * CELL) - y(0.1 + (d.pi + 1) * CELL) - 2)
        .attr("rx", 2);
      ctx.tr(rc).attr("fill", (d) => colorCell(d.moy)).attr("opacity", (d) => (d.n < 10 ? 0.45 : 1));

      // --- Points : 4 000 clients au plus (les lignes sont déjà mélangées : tirage aléatoire)
      const echant = (rows.length > 4000 ? rows.slice(0, 4000) : rows).slice().sort((a, b) => b.bal - a.bal);
      const rTaille = d3.scaleSqrt([0, d3.max(echant, (d) => d.bal) || 1], [1.4, 7.5]);
      const colorPt = App.scoreScale(true);
      const px = (d) => x(d.util + jitter(d.i, 1)), py = (d) => y(d.pay + jitter(d.i, 2));
      const pts = App.layer(plot, "pts").attr("clip-path", "url(#clip-a)");
      const pc = pts.selectAll("circle").data(A.vue === "points" ? echant : [], (d) => d.i)
        .join(
          (e) => e.append("circle").attr("r", 0).attr("cx", px).attr("cy", py),
          (u) => u,
          (e) => (ctx.T ? e.transition(ctx.T).attr("r", 0).remove() : e.remove()),
        )
        .order()
        .attr("fill", (d) => colorPt(d.score)).attr("fill-opacity", 0.85)
        .attr("stroke", colors.page).attr("stroke-width", 0.6);
      ctx.tr(pc).attr("r", (d) => rTaille(d.bal)).attr("cx", px).attr("cy", py);

      // --- Lignes d'iso-score du modèle (score = b0 + b1 × remboursement + b2 × utilisation)
      const isoS = [500, 550, 600, 650, 700];
      const pDe = (S, u) => (S - M2[0] - M2[2] * u) / M2[1];
      const iso = App.layer(plot, "isos").attr("clip-path", "url(#clip-a)");
      iso.selectAll("line").data(isoS).join("line").attr("class", "iso")
        .attr("x1", x(0.1)).attr("y1", (S) => y(pDe(S, 0.1))).attr("x2", x(0.95)).attr("y2", (S) => y(pDe(S, 0.95)));
      const sortie = (S) => {
        const uHaut = (S - M2[0] - M2[1] * 1.0) / M2[2];
        if (uHaut >= 0.1 && uHaut <= 0.95) return { x: x(uHaut) - 4, y: 14, anchor: "end" };
        return { x: iw - 6, y: y(pDe(S, 0.95)) - 6, anchor: "end" };
      };
      App.layer(plot, "iso-labels").selectAll("text").data(isoS).join("text").attr("class", "iso-label halo")
        .attr("x", (S) => sortie(S).x).attr("y", (S) => sortie(S).y).attr("text-anchor", (S) => sortie(S).anchor)
        .text((S) => `score ${S}`);

      dernier = { ctx, x, y, echant, delaunay: d3.Delaunay.from(echant, px, py), px, py, cases, colorCell, colorPt };
      dessinerZone(ctx.animate);

      // --- Sélection à la souris (d3.brush) et survol (point le plus proche ou case)
      const brush = d3.brush().extent([[0, 0], [iw, ih]])
        .on("start brush end", (ev) => {
          App.tip.hide();
          if (ev.selection) {
            const [[x0, y0], [x1, y1]] = ev.selection;
            A.sel = { u0: x.invert(x0), u1: x.invert(x1), p0: y.invert(y1), p1: y.invert(y0) };
          } else {
            A.sel = null;
          }
          surligner();
          if (ev.type !== "brush" || !ev.sourceEvent) panneau(); else panneauThrottle();
        });
      const gB = App.layer(plot, "brush").call(brush);
      if (A.sel) gB.call(brush.move, [[x(A.sel.u0), y(A.sel.p1)], [x(A.sel.u1), y(A.sel.p0)]]);
      else gB.call(brush.move, null);
      gB.selectAll(".overlay, .selection")
        .on("pointermove.tip", survolA)
        .on("pointerleave.tip", () => { App.tip.hide(); App.layer(plot, "focus-pt", "circle").attr("opacity", 0); });
      App.layer(plot, "focus-pt", "circle").attr("class", "focus-pt").attr("r", 6).attr("fill", "none")
        .attr("stroke", colors.ink).attr("stroke-width", 2).style("pointer-events", "none").attr("opacity", 0);
      surligner();
      App.empty(ctx, rows.length === 0, "Aucun client ne correspond à ces filtres.");

      App.table("t-a", [
        { label: "Utilisation", value: (d) => `${10 + d.ui * 5}–${15 + d.ui * 5} %` },
        { label: "Remboursement", value: (d) => `${10 + d.pi * 5}–${d.pi === 17 ? 100 : 15 + d.pi * 5} %` },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "Score moyen", value: (d) => d.moy, format: fmt.int },
        { label: "Scores < 550", value: (d) => d.bas / d.n, format: fmt.pct1 },
      ], grille.slice().sort((a, b) => a.ui - b.ui || a.pi - b.pi), { note: "Cases de 5 points de pourcentage sur 5 ; tous les clients retenus par les filtres." });
    },
  });

  function survolA(ev) {
    if (!dernier) return;
    const { ctx, x, y, echant, delaunay, px, py, cases } = dernier;
    const [mx, my] = d3.pointer(ev, ctx.plot.node());
    const focus = App.layer(ctx.plot, "focus-pt", "circle");
    if (A.vue === "points") {
      const i = echant.length ? delaunay.find(mx, my) : -1;
      const d = echant[i];
      if (!d || Math.hypot(px(d) - mx, py(d) - my) > 22) { focus.attr("opacity", 0); App.tip.hide(); return; }
      focus.attr("opacity", 1).attr("cx", px(d)).attr("cy", py(d));
      App.tip.show(ev, {
        title: `Score ${d.score}`, sub: `Client ${CARTES[d.card]}, ${PROFESSIONS[d.occ].toLowerCase()}`,
        rows: [
          { label: "Utilisation du plafond", value: fmt.pct0(d.util) },
          { label: "Remboursement", value: fmt.pct0(d.pay) },
          { label: "Solde impayé", value: fmt.k(d.bal) },
          { label: "Score prédit (modèle)", value: fmt.int(pred2(d.util, d.pay)) },
        ],
        note: dansZone(d) ? "Dans la zone à risque" : null,
      });
    } else {
      const u = x.invert(mx), p = y.invert(my);
      const c = cases.get(binU(Math.max(0.1, Math.min(0.949, u))) * 100 + binP(Math.max(0.1, Math.min(1, p))));
      focus.attr("opacity", 0);
      if (!c) { App.tip.hide(); return; }
      App.tip.show(ev, {
        title: `Score moyen ${fmt.int(c.s / c.n)}`,
        sub: `Utilisation ${10 + c.ui * 5}–${15 + c.ui * 5} %, remboursement ${10 + c.pi * 5}–${c.pi === 17 ? 100 : 15 + c.pi * 5} %`,
        rows: [
          { label: "Clients", value: fmt.int(c.n) },
          { label: "Scores inférieurs à 550", value: fmt.pct0(c.bas / c.n) },
        ],
      });
    }
  }

  /** Zone à risque : rectangle (seuils) ou région sous la droite d'iso-score (diagonale). */
  function dessinerZone(animate) {
    if (!dernier) return;
    const { ctx, x, y } = dernier;
    const { plot, iw, ih } = ctx;
    let fill, bord;
    if (A.frontiere === "carre") {
      const X = x(A.u), Y = y(A.p);
      fill = `M${X},${Y}H${iw}V${ih}H${X}Z`;
      bord = `M${X},${ih}V${Y}H${iw}`;
    } else {
      const us = d3.range(0.1, 0.9501, 0.0125);
      const pt = (u) => [x(u), y(Math.max(0.1, Math.min(1, (A.s - M2[0] - M2[2] * u) / M2[1])))];
      const ligne = us.map(pt);
      fill = `M${ligne.map((p) => p.join(",")).join("L")}L${x(0.95)},${ih}L${x(0.1)},${ih}Z`;
      bord = `M${ligne.map((p) => p.join(",")).join("L")}`;
    }
    const g = App.layer(plot, "zone").attr("clip-path", "url(#clip-a)");
    g.selectAll("path.zf").data([fill]).join("path").attr("class", "zf").attr("fill", "var(--critical-wash)").attr("d", (d) => d);
    g.selectAll("path.zb").data([bord]).join("path").attr("class", "zb").attr("fill", "none").attr("stroke", "var(--critical)").attr("stroke-width", 1.6).attr("d", (d) => d);
    const lab = App.layer(plot, "zone-label");
    lab.attr("transform", `translate(${iw - 10},${ih - 12})`);
    lab.selectAll("text").data([0]).join("text").attr("class", "val-label halo").attr("text-anchor", "end").text("Zone à risque");
    lab.selectAll("path").data([0]).join("path").attr("d", "M0,-11 L6.5,0 L-6.5,0 Z").attr("fill", "var(--critical)")
      .attr("transform", function () {
        const w = lab.select("text").node().getComputedTextLength();
        return `translate(${-w - 12},-1)`;
      });
    // la zone doit rester sous la sélection mais au-dessus des points
    const order = ["heat", "pts", "isos", "zone", "iso-labels", "zone-label", "focus-pt", "brush"];
    order.forEach((cls) => { const n = plot.select(`:scope > .${cls}`).node(); if (n) plot.node().appendChild(n); });
  }

  /** Atténue les marques hors de la sélection. */
  function surligner() {
    if (!dernier) return;
    const s = A.sel;
    const dedans = (u, p) => !s || (u >= s.u0 && u <= s.u1 && p >= s.p0 && p <= s.p1);
    dernier.ctx.plot.select(".pts").selectAll("circle").classed("is-dim", (d) => !dedans(d.util, d.pay));
    dernier.ctx.plot.select(".heat").selectAll("rect").classed("is-dim", (d) => !dedans(0.1 + (d.ui + 0.5) * CELL, 0.1 + (d.pi + 0.5) * CELL));
  }

  let tPanel = null;
  const panneauThrottle = () => { if (!tPanel) tPanel = setTimeout(() => { tPanel = null; panneau(); }, 60); };

  /** Panneau latéral : statistiques de la zone, ou de la sélection à la souris. */
  function panneau() {
    const el = document.getElementById("panel-a");
    const n = rows.length;
    el.replaceChildren();
    const h = document.createElement("h3");
    const big = document.createElement("div");
    big.className = "big";
    const sub = document.createElement("div");
    const lignes = document.createElement("div");
    lignes.style.marginTop = "12px";
    const ligne = (lab, val) => {
      const r = document.createElement("div");
      r.className = "row";
      const a = document.createElement("span"), b = document.createElement("span");
      a.textContent = lab; b.textContent = val;
      r.append(a, b);
      lignes.append(r);
    };
    const hint = document.createElement("p");
    hint.className = "hint";
    if (!n) {
      h.textContent = "Aucun client";
      el.append(h);
      return;
    }
    if (A.sel) {
      const s = A.sel;
      const sel = rows.filter((r) => r.util >= s.u0 && r.util <= s.u1 && r.pay >= s.p0 && r.pay <= s.p1);
      h.textContent = "Sélection";
      big.textContent = fmt.pct1(sel.length / n);
      sub.textContent = `des clients retenus (${fmt.int(sel.length)})`;
      if (sel.length) {
        ligne("Score moyen", fmt.int(d3.mean(sel, (r) => r.score)));
        ligne("Scores inférieurs à 550", fmt.pct1(d3.mean(sel, (r) => (r.score < BAS ? 1 : 0))));
        ligne("Utilisation moyenne", fmt.pct0(d3.mean(sel, (r) => r.util)));
        ligne("Remboursement moyen", fmt.pct0(d3.mean(sel, (r) => r.pay)));
        const mix = CARTES.map((c, i) => sel.filter((r) => r.card === i).length / sel.length);
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", "Répartition par carte : " + CARTES.map((c, i) => `${c} ${fmt.pct0(mix[i])}`).join(", "));
        mix.forEach((m, i) => { if (m > 0) { const s2 = document.createElement("i"); s2.style.width = `${m * 100}%`; s2.style.background = `var(--card-${i})`; bar.append(s2); } });
        const cap = document.createElement("div");
        cap.style.cssText = "font-size:13px;margin-top:10px";
        cap.textContent = "Répartition par carte";
        lignes.append(cap, bar);
      }
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "btn-link";
      clear.textContent = "Effacer la sélection";
      clear.addEventListener("click", () => {
        A.sel = null;
        chartA.render(false);
        panneau();
      });
      hint.append(clear);
    } else {
      let nz = 0, sz = 0, so = 0, nb = 0, nbz = 0;
      for (const r of rows) {
        const z = dansZone(r);
        if (z) { nz++; sz += r.score; } else so += r.score;
        if (r.score < BAS) { nb++; if (z) nbz++; }
      }
      h.innerHTML = `<span class="status">${ICONE}</span> Zone à risque`;
      big.textContent = fmt.pct1(nz / n);
      sub.textContent = `des clients retenus (${fmt.int(nz)})`;
      ligne("Score moyen dans la zone", nz ? fmt.int(sz / nz) : "–");
      ligne("Score moyen hors zone", n - nz ? fmt.int(so / (n - nz)) : "–");
      ligne("Scores faibles captés", nb ? fmt.pct1(nbz / nb) : "–");
      ligne("Part de scores faibles dans la zone", nz ? fmt.pct1(nbz / nz) : "–");
      hint.textContent = A.frontiere === "carre"
        ? "Un score « faible » est inférieur à 550. Essayez la frontière « Diagonale » : elle suit les lignes grises du modèle."
        : "La diagonale suit une ligne d'iso-score du modèle : elle capte bien plus de scores faibles qu'un carré.";
    }
    el.append(h, big, sub, lignes, hint);
  }

  /* ======================= B. Modèle et simulateur ======================= */
  const [, bPay, bUtil, bCash, bEmi, bCage, bIntl] = M6;
  const effets = [
    { lab: "+10 points de remboursement", v: bPay / 10 },
    { lab: "+10 points d'utilisation", v: bUtil / 10 },
    { lab: "Avances d'espèces", v: bCash },
    { lab: "+1 mensualité (EMI)", v: bEmi },
    { lab: "+1 an d'ancienneté", v: bCage },
    { lab: "+1 transaction internationale", v: bIntl },
  ];
  document.getElementById("r2").textContent =
    `R² = ${App.modeles.m2.r2.toFixed(3).replace(".", ",")} avec le remboursement et l'utilisation seuls, ${App.modeles.m6.r2.toFixed(3).replace(".", ",")} avec les six variables. L'erreur type du modèle complet est de ${fmt.int(App.modeles.m6.sd)} points de score.`;

  App.chart("#chart-b", {
    label: "Barres divergentes : effet de chaque variable sur le score de crédit, en points.",
    height: (w) => (w < 560 ? effets.length * 58 + 34 : effets.length * 46 + 34),
    margin: (w) => (w < 560 ? { t: 4, r: 44, b: 30, l: 10 } : { t: 4, r: 46, b: 30, l: 200 }),
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const etroit = ctx.w < 560;
      const x = d3.scaleLinear([-30, 30], [0, iw]);
      const y = d3.scaleBand(d3.range(effets.length), [0, ih]).padding(etroit ? 0.12 : 0.42);
      const bh = etroit ? 16 : Math.min(22, y.bandwidth());
      const yb = (i) => (etroit ? y(i) + y.bandwidth() - bh - 4 : y(i) + (y.bandwidth() - bh) / 2);
      App.layer(plot, "grid gx").call(d3.axisBottom(x).ticks(5).tickSize(ih).tickFormat(""));
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat((v) => (v === 0 ? "0" : fmt.signed0(v))).tickSize(0).tickPadding(10));
      App.layer(plot, "zero", "line").attr("class", "zero baseline").attr("x1", x(0)).attr("x2", x(0)).attr("y1", -2).attr("y2", ih);
      App.layer(plot, "names").selectAll("text").data(effets).join("text")
        .attr("x", etroit ? 0 : -12).attr("text-anchor", etroit ? "start" : "end").attr("dy", etroit ? "0.9em" : "0.35em")
        .style("font-size", "13.5px").style("fill", "var(--ink-2)")
        .attr("y", (d, i) => (etroit ? y(i) : y(i) + y.bandwidth() / 2)).text((d) => d.lab);
      const bars = App.layer(plot, "bars").selectAll("path").data(effets).join("path")
        .attr("fill", (d) => (d.v >= 0 ? colors.div[5] : colors.div[1]))
        .attr("d", (d, i) => (d.v >= 0
          ? App.barPath(x(0), yb(i), x(d.v) - x(0), bh, 4, "right")
          : App.barPath(x(d.v), yb(i), x(0) - x(d.v), bh, 4, "left")));
      App.hover(bars, (d) => ({ title: d.lab, rows: [{ label: "Effet sur le score", value: `${fmt.pts(d.v)} points` }] }));
      App.layer(plot, "vals").selectAll("text").data(effets).join("text").attr("class", "val-label").attr("dy", "0.35em")
        .attr("y", (d, i) => yb(i) + bh / 2)
        .attr("x", (d) => (d.v >= 0 ? x(d.v) + 8 : x(d.v) - 8)).attr("text-anchor", (d) => (d.v >= 0 ? "start" : "end"))
        .text((d) => fmt.pts(d.v));
      App.table("t-b", [
        { label: "Variation", value: (d) => d.lab },
        { label: "Effet sur le score (points)", value: (d) => d.v, format: fmt.pts },
      ], effets, { note: `Constante du modèle : ${fmt.dec1(M6[0])}. R² = ${App.modeles.m6.r2.toFixed(3).replace(".", ",")} (six variables), ${App.modeles.m2.r2.toFixed(3).replace(".", ",")} (remboursement et utilisation seuls).` });
    },
  });

  // --- Simulateur
  const scoresTries = Float64Array.from(clients, (r) => r.score).sort();
  const SIM = { pay: 84, util: 40, emi: 2, age: 4, intl: 0, cash: false };
  const champs = [
    { cle: "pay", lab: "Remboursement de la facture", min: 10, max: 100, unite: " %" },
    { cle: "util", lab: "Utilisation du plafond", min: 10, max: 95, unite: " %" },
    { cle: "emi", lab: "Mensualités en cours (EMI)", min: 0, max: 6, unite: "" },
    { cle: "age", lab: "Ancienneté de la carte (ans)", min: 0, max: 20, unite: "" },
    { cle: "intl", lab: "Transactions internationales", min: 0, max: 14, unite: "" },
  ];
  const zoneCtl = document.getElementById("sim-controls");
  champs.forEach((c) => {
    const lab = document.createElement("label");
    lab.className = "control";
    lab.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) 130px 3.4em;gap:10px";
    const t = document.createElement("span");
    t.textContent = c.lab;
    const inp = document.createElement("input");
    inp.type = "range"; inp.min = c.min; inp.max = c.max; inp.step = 1; inp.value = SIM[c.cle];
    inp.style.width = "100%";
    const out = document.createElement("output");
    out.textContent = `${SIM[c.cle]}${c.unite}`;
    inp.addEventListener("input", () => { SIM[c.cle] = +inp.value; out.textContent = `${inp.value}${c.unite}`; majSim(); });
    lab.append(t, inp, out);
    zoneCtl.append(lab);
  });
  const cb = document.createElement("label");
  cb.className = "control";
  cb.innerHTML = '<input type="checkbox"> <span>A recours aux avances d’espèces</span>';
  cb.querySelector("input").addEventListener("change", (e) => { SIM.cash = e.target.checked; majSim(); });
  zoneCtl.append(cb);

  const scoreSim = () => M6[0] + M6[1] * (SIM.pay / 100) + M6[2] * (SIM.util / 100) + M6[3] * (SIM.cash ? 1 : 0) + M6[4] * SIM.emi + M6[5] * SIM.age + M6[6] * SIM.intl;
  const chartSim = App.chart("#chart-sim", {
    label: "Distribution des scores des 50 000 clients et position du score simulé.",
    height: 118,
    margin: { t: 26, r: 10, b: 24, l: 10 },
    duration: 250,
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const x = d3.scaleLinear([360, 800], [0, iw]);
      const bins = d3.bin().domain([360, 800]).thresholds(d3.range(360, 800, 10))(scoresTries);
      const y = d3.scaleLinear([0, d3.max(bins, (b) => b.length)], [ih, 0]);
      App.layer(plot, "bas", "rect").attr("class", "bas").attr("x", 0).attr("width", x(BAS)).attr("y", 0).attr("height", ih).attr("fill", "var(--critical-wash)");
      App.layer(plot, "bins").selectAll("rect").data(bins).join("rect")
        .attr("x", (b) => x(b.x0) + 0.5).attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
        .attr("y", (b) => y(b.length)).attr("height", (b) => ih - y(b.length)).attr("fill", colors.axis);
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).tickValues([400, 500, 550, 600, 700, 800]).tickSize(0).tickPadding(8));
      const s = Math.max(360, Math.min(800, scoreSim()));
      const m = App.layer(plot, "marker");
      ctx.tr(m).attr("transform", `translate(${x(s)},0)`);
      m.selectAll("line").data([0]).join("line").attr("y1", -4).attr("y2", ih).attr("stroke", colors.ink).attr("stroke-width", 2);
      m.selectAll("text").data([0]).join("text").attr("class", "val-label halo").attr("y", -10)
        .attr("text-anchor", x(s) < 40 ? "start" : x(s) > iw - 40 ? "end" : "middle").text("ce client");
    },
  });
  function majSim() {
    const s = scoreSim();
    document.getElementById("sim-score").textContent = fmt.int(s);
    const rang = d3.bisectLeft(scoresTries, s) / scoresTries.length;
    document.getElementById("sim-rang").textContent = `meilleur que ${fmt.pct0(rang)} des clients`;
    const stat = document.getElementById("sim-statut");
    if (s < BAS) stat.innerHTML = `<span class="status">${ICONE} Score faible : profil à risque.</span>`;
    else stat.textContent = s < MOYENNE ? `Score sous la moyenne des clients (${fmt.int(MOYENNE)}).` : `Score au-dessus de la moyenne des clients (${fmt.int(MOYENNE)}).`;
    chartSim.update();
  }
  majSim();

  /* ======================= C. Corrélations ======================= */
  const VARS = App.meta.variablesCorr;
  const NV = VARS.length;
  const COURT = { pay: "Remboursement", util: "Utilisation", bal: "Solde impayé", cage: "Ancienneté", intl: "Transactions intl.", cash: "Avances d'espèces", emi: "Mensualités", spend: "Dépense", inc: "Revenu", score: "Score" };
  let paire = [NV - 1, 0]; // ligne Score × colonne Remboursement
  const rIdx = (a, b) => a * (2 * NV - a - 1) / 2 + (b - a - 1);
  const rDe = (entry, i, j) => (i === j ? 1 : entry.r[rIdx(Math.min(i, j), Math.max(i, j))]);
  const cleCorr = () => `${st.card},${st.occ},${st.g}`;

  App.legend("#leg-c", [{ ramp: { before: "Corrélation −1", after: "+1", stops: App.DIV_STOPS } }]);

  const chartC = App.chart("#chart-c", {
    label: "Matrice de corrélation (triangle inférieur) entre dix variables financières, dont le score de crédit.",
    height: (w) => {
      const lw = w < 560 ? 118 : 178;
      const cs = Math.max(22, Math.min(50, (w - lw - 10) / NV));
      return cs * NV + 110;
    },
    margin: (w) => ({ t: 104, r: 10, b: 6, l: w < 560 ? 118 : 178 }),
    draw(ctx) {
      const { plot, iw, colors } = ctx;
      const entry = App.correlations[cleCorr()];
      const cs = Math.max(22, Math.min(50, iw / NV));
      const color = d3.scaleDiverging(d3.piecewise(d3.interpolateLab, colors.div)).domain([-1, 0, 1]);
      const ok = entry && entry.r;
      const cellules = [];
      if (ok) for (let i = 0; i < NV; i++) for (let j = 0; j <= i; j++) cellules.push({ i, j, r: rDe(entry, i, j), id: `${i}-${j}` });

      App.layer(plot, "row-labels").selectAll("text").data(VARS).join("text")
        .attr("x", -10).attr("y", (d, i) => i * cs + cs / 2).attr("dy", "0.35em").attr("text-anchor", "end")
        .style("font-size", cs < 30 ? "12px" : "13.5px")
        .style("fill", (d, i) => (i === NV - 1 ? "var(--ink)" : "var(--ink-2)")).style("font-weight", (d, i) => (i === NV - 1 ? 650 : null))
        .text((d) => (cs < 30 ? COURT[d.cle] : d.nom));
      App.layer(plot, "col-labels").selectAll("text").data(VARS).join("text")
        .attr("transform", (d, j) => `translate(${j * cs + cs / 2},${j * cs - 6}) rotate(-45)`)
        .style("font-size", "12.5px").style("fill", (d, j) => (j === NV - 1 ? "var(--ink)" : "var(--ink-2)"))
        .text((d) => COURT[d.cle]);

      const g = App.layer(plot, "cells").selectAll("g").data(cellules, (d) => d.id)
        .join((e) => { const k = e.append("g"); k.append("rect"); k.append("text").attr("text-anchor", "middle").attr("dy", "0.35em"); return k; })
        .attr("transform", (d) => `translate(${d.j * cs},${d.i * cs})`);
      g.select("rect").attr("x", 1).attr("y", 1).attr("width", cs - 2).attr("height", cs - 2).attr("rx", 3)
        .attr("fill", (d) => (d.i === d.j ? colors.plane : color(d.r)))
        .attr("stroke", (d) => (d.i === paire[0] && d.j === paire[1] ? colors.ink : "none")).attr("stroke-width", 2);
      g.select("text").attr("x", cs / 2).attr("y", cs / 2).style("font-size", "11.5px").style("font-variant-numeric", "tabular-nums")
        .style("fill", (d) => (d.i === d.j ? "var(--muted)" : App.inkOn(color(d.r))))
        .text((d) => (cs < 34 ? "" : d.i === d.j ? "" : fmt.dec2(d.r)));
      // cadre de la ligne « Score »
      App.layer(plot, "row-frame", "rect").attr("class", "row-frame").attr("x", -0.5).attr("y", (NV - 1) * cs - 0.5)
        .attr("width", NV * cs + 1).attr("height", cs + 1).attr("rx", 4).attr("fill", "none")
        .attr("stroke", ok ? colors.ink2 : "none").attr("stroke-width", 1);
      App.hover(g.filter((d) => d.i !== d.j), (d) => ({
        title: `${VARS[d.i].nom} × ${VARS[d.j].nom}`,
        rows: [{ label: "Corrélation", value: fmt.r(d.r) }, { label: "Clients", value: fmt.int(entry.n) }],
        note: "Cliquer pour afficher le nuage de points",
      }), { click: (d) => { paire = [d.i, d.j]; chartC.render(false); chartPaire.update(); } });
      App.empty(ctx, !ok, entry ? `Trop peu de clients (${entry.n}) pour des corrélations fiables.` : "Aucun client.");

      if (ok) {
        App.table("t-c", [
          { label: "Variable", value: (d) => VARS[d.i].nom },
          { label: "Avec", value: (d) => VARS[d.j].nom },
          { label: "Corrélation", value: (d) => d.r, format: fmt.r },
        ], cellules.filter((d) => d.i !== d.j).sort((a, b) => Math.abs(b.r) - Math.abs(a.r)), { note: `Coefficients de Pearson calculés sur ${fmt.int(entry.n)} clients.` });
      }
    },
  });

  const chartPaire = App.chart("#chart-pair", {
    label: "Nuage de points de la paire de variables choisie dans la matrice, avec la droite de régression.",
    height: (w) => Math.min(340, Math.max(240, w * 0.85)),
    margin: { t: 10, r: 22, b: 40, l: 54 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const [i, j] = paire;
      const vy = VARS[i].cle, vx = VARS[j].cle;
      const pts = App.echantillon.filter(App.match(st));
      const entry = App.correlations[cleCorr()];
      const rTous = entry && entry.r ? rDe(entry, i, j) : NaN;
      const rEch = App.stats.pearson(pts.map((d) => d[vx]), pts.map((d) => d[vy]));
      document.getElementById("pair-title").textContent = `${VARS[i].nom} selon ${VARS[j].nom.toLowerCase()}`;
      document.getElementById("pair-sub").textContent = `r = ${isNaN(rTous) ? "–" : fmt.r(rTous)} sur les clients retenus ; ${fmt.int(pts.length)} points de l'échantillon (r = ${isNaN(rEch) ? "–" : fmt.r(rEch)}).`;
      const discret = (v) => ["emi", "intl"].includes(v);
      const jit = (d, v, k) => (discret(v) ? jitter(d.i, k) * 45 : 0);
      const fmtAxe = (v) => (["pay", "util"].includes(v) ? fmt.pct0 : ["bal", "cash", "spend", "inc"].includes(v) ? fmt.k : fmt.int);
      const ex = d3.extent(pts, (d) => d[vx]), ey = d3.extent(pts, (d) => d[vy]);
      const x = d3.scaleLinear(ex[0] === undefined ? [0, 1] : ex, [0, iw]).nice();
      const y = d3.scaleLinear(ey[0] === undefined ? [0, 1] : ey, [ih, 0]).nice();
      App.layer(plot, "grid gy").call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
      App.layer(plot, "axis ax").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(4).tickFormat(fmtAxe(vx)).tickSizeOuter(0));
      App.layer(plot, "axis ay").call(d3.axisLeft(y).ticks(5).tickFormat(fmtAxe(vy)).tickSizeOuter(0));
      App.layer(plot, "axis-title xt", "text").attr("class", "axis-title xt").attr("x", iw).attr("y", ih + 34).attr("text-anchor", "end").text(VARS[j].nom);
      const c = App.layer(plot, "pts").selectAll("circle").data(pts, (d) => d.i)
        .join((e) => e.append("circle").attr("r", 2.2).attr("cx", (d) => x(d[vx] + jit(d, vx, 1))).attr("cy", (d) => y(d[vy] + jit(d, vy, 2))))
        .attr("fill", colors.mesure).attr("fill-opacity", 0.38);
      ctx.tr(c).attr("cx", (d) => x(d[vx] + jit(d, vx, 1))).attr("cy", (d) => y(d[vy] + jit(d, vy, 2)));
      // droite des moindres carrés (échantillon)
      const mx = d3.mean(pts, (d) => d[vx]), my = d3.mean(pts, (d) => d[vy]);
      const sxx = d3.sum(pts, (d) => (d[vx] - mx) ** 2), sxy = d3.sum(pts, (d) => (d[vx] - mx) * (d[vy] - my));
      const pente = sxx ? sxy / sxx : 0;
      const [x0, x1] = x.domain();
      const fit = pts.length > 2 ? [[x0, my + pente * (x0 - mx)], [x1, my + pente * (x1 - mx)]] : [];
      const ln = App.layer(plot, "fit").attr("clip-path", null).selectAll("line").data(fit.length ? [fit] : []).join("line")
        .attr("stroke", colors.ink).attr("stroke-width", 2).attr("stroke-linecap", "round");
      ctx.tr(ln).attr("x1", (d) => x(d[0][0])).attr("y1", (d) => y(Math.max(y.domain()[0], Math.min(y.domain()[1], d[0][1]))))
        .attr("x2", (d) => x(d[1][0])).attr("y2", (d) => y(Math.max(y.domain()[0], Math.min(y.domain()[1], d[1][1]))));
      App.empty(ctx, pts.length === 0, "Aucun client de l'échantillon ne correspond à ces filtres.");
    },
  });

  /* ---------- C2. Score par carte : observé vs à comportement égal ---------- */
  App.legend("#leg-c2", [
    { label: "Score moyen observé", color: "transparent", type: "dot" },
    { label: "À comportement égal", color: "var(--card-3)", type: "dot" },
  ]);
  const legC2 = document.querySelector("#leg-c2 .key .sw");
  if (legC2) legC2.style.boxShadow = "inset 0 0 0 2px var(--ink-2)";
  const SC = App.modeles.scoreParCarte;
  App.chart("#chart-c2", {
    label: "Diagramme en haltères : score moyen observé et score à comportement égal pour chaque type de carte.",
    height: SC.length * 44 + 46,
    margin: { t: 20, r: 26, b: 30, l: 84 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const x = d3.scaleLinear([620, 642], [0, iw]);
      const y = d3.scaleBand(d3.range(SC.length), [0, ih]).padding(0.5);
      const yc = (i) => y(i) + y.bandwidth() / 2;
      App.layer(plot, "grid gx").call(d3.axisBottom(x).ticks(5).tickSize(ih).tickFormat(""));
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(5).tickFormat(fmt.int).tickSize(0).tickPadding(10));
      App.layer(plot, "moy", "line").attr("class", "moy baseline").attr("x1", x(MOYENNE)).attr("x2", x(MOYENNE)).attr("y1", -8).attr("y2", ih);
      App.layer(plot, "moy-label", "text").attr("class", "moy-label axis-title").attr("x", x(MOYENNE)).attr("y", -10).attr("text-anchor", "middle").text(`moyenne ${fmt.int(MOYENNE)}`);
      App.layer(plot, "names").selectAll("text").data(SC).join("text").attr("x", -12).attr("y", (d, i) => yc(i)).attr("dy", "0.35em")
        .attr("text-anchor", "end").style("font-size", "13.5px").style("fill", "var(--ink-2)").text((d) => d.carte);
      App.layer(plot, "links").selectAll("line").data(SC).join("line").attr("stroke", colors.axis).attr("stroke-width", 2)
        .attr("x1", (d) => x(d.brut)).attr("x2", (d) => x(d.ajuste)).attr("y1", (d, i) => yc(i)).attr("y2", (d, i) => yc(i));
      App.layer(plot, "brut").selectAll("circle").data(SC).join("circle").attr("r", 5.5).attr("fill", colors.page)
        .attr("stroke", colors.ink2).attr("stroke-width", 2).attr("cx", (d) => x(d.brut)).attr("cy", (d, i) => yc(i));
      const aj = App.layer(plot, "ajuste").selectAll("circle").data(SC).join("circle").attr("r", 6.5).attr("fill", (d, i) => colors.cards[i])
        .attr("stroke", colors.page).attr("stroke-width", 2).attr("cx", (d) => x(d.ajuste)).attr("cy", (d, i) => yc(i));
      App.hover(aj, (d) => ({
        title: `Carte ${d.carte}`,
        rows: [
          { label: "Score moyen observé", value: fmt.dec1(d.brut) },
          { label: "À comportement égal", value: fmt.dec1(d.ajuste) },
          { label: "Transactions intl. (moyenne)", value: fmt.dec2(d.intl) },
        ],
      }));
      App.layer(plot, "vals").selectAll("text").data(SC).join("text").attr("class", "val-label soft").attr("dy", "0.35em")
        .attr("y", (d, i) => yc(i))
        .attr("x", (d) => (d.brut > d.ajuste ? x(d.brut) + 10 : x(d.brut) - 10))
        .attr("text-anchor", (d) => (d.brut > d.ajuste ? "start" : "end"))
        .text((d) => fmt.dec1(d.brut));
      App.table("t-c2", [
        { label: "Carte", value: (d) => d.carte },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "Score moyen observé", value: (d) => d.brut, format: fmt.dec1 },
        { label: "À comportement égal", value: (d) => d.ajuste, format: fmt.dec1 },
        { label: "Transactions intl. (moyenne)", value: (d) => d.intl, format: fmt.dec2 },
      ], SC);
    },
  });

  function majTout() {
    filtrer();
    filtres.count(rows.length);
    A.sel = null;
    chartA.update();
    panneau();
    chartC.update();
    chartPaire.update();
  }
  filtrer();
  filtres.count(rows.length);
  syncCtl();
  panneau();
})();
