/* =========================================================================
   Chapitre 1 — Qui sont nos clients ?
   A. Flux professions → cartes (diagramme de Sankey, sélection au clic)
   B. Revenu par carte (histogramme empilé, échelle log, bornes min–max)
   C. Plafond / revenu (nuage de points log-log, échantillon)
   D. Pyramide des âges par carte + composition par âge et genre
   ========================================================================= */
(function () {
  "use strict";
  const { clients, CARTES, PROFESSIONS, GENRES, AGES, fmt } = App;
  const NB_CARTES = CARTES.length;
  // Légendes interactives : une carte survolée ou cliquée ressort dans tous les graphiques de la page
  const legendeCartes = (type) => CARTES.map((c, i) => ({ label: c, color: `var(--card-${i})`, type, v: i }));
  App.legend("#leg-b", legendeCartes(), { cle: "card" });
  App.legend("#leg-d", legendeCartes(), { cle: "card", astuce: "Survolez une carte pour voir sa couche dans la pyramide : son épaisseur reste la même à tout âge." });
  // Le diagramme de flux a ses propres couleurs : bleu, vert, jaune, orange, violet
  App.legend("#leg-a", CARTES.map((c, i) => ({ label: c, color: `var(--flux-${i})`, v: i })), {
    cle: "card", astuce: "Survolez une carte ou une profession pour suivre ses bandes. Un clic sur une profession l’isole dans toute la page.",
  });
  App.legend("#leg-c", legendeCartes("dot"), { cle: "card", astuce: "Survolez un point ou une carte de la légende pour faire ressortir tous les clients de cette carte." });

  /** Mise à jour des graphiques quand la carte mise en évidence change (sans redessiner). */
  const maj = {};
  App.surlignage.ecouter("card", () => Object.values(maj).forEach((f) => f()));
  const enEvidence = () => App.surlignage.valeur("card");

  const filtres = App.filterBar("#filtres", ["g", "ab", "occ"], () => majTout());
  const st = filtres.state;

  /** Comptage par profession × carte pour une liste de clients. */
  const compter = (rows, cleLigne, nbLignes) => {
    const t = d3.range(nbLignes).map(() => new Array(NB_CARTES).fill(0));
    for (const r of rows) t[cleLigne(r)][r.card]++;
    return t;
  };

  /* ---------- A. Flux professions → cartes (diagramme de Sankey) ----------
     Gauche : les 6 professions, du revenu médian le plus faible (en haut) au plus élevé.
     Droite : les 5 cartes, de Basic (en haut) à Signature.
     Chaque bande relie une profession à une carte ; sa largeur est proportionnelle au
     nombre de clients et sa couleur est celle de la carte d'arrivée. */
  const ruban = (x0, y0, x1, y1, w) => {
    const xm = (x0 + x1) / 2;
    return `M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}L${x1},${y1 + w}C${xm},${y1 + w} ${xm},${y0 + w} ${x0},${y0 + w}Z`;
  };
  let survolA = null; // { cote: "g" | "d", i } : nœud survolé
  const PLURIELS = ["étudiants", "retraités", "salariés du privé", "fonctionnaires", "indépendants", "chefs d'entreprise"];

  const chartA = App.chart("#chart-a", {
    label: "Diagramme de Sankey : flux des clients de leur profession, à gauche, vers leur type de carte, à droite. La largeur de chaque bande est proportionnelle au nombre de clients.",
    height: (w) => (w < 640 ? 440 : 520),
    margin: (w) => ({ t: 12, r: w < 640 ? 98 : 150, b: 12, l: w < 640 ? 118 : 170 }),
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const etroit = ctx.w < 640;
      const flux = d3.range(NB_CARTES).map((i) => App.css(`--flux-${i}`));
      const rows = clients.filter(App.match({ g: st.g, ab: st.ab }));
      const table = compter(rows, (r) => r.occ, PROFESSIONS.length);
      const occs = table.map((counts, o) => ({ o, counts, total: d3.sum(counts) }));
      const cartes = CARTES.map((nom, c) => ({ c, nom, total: d3.sum(occs, (d) => d.counts[c]) }));
      const N = d3.sum(occs, (d) => d.total);
      const sel = st.occ;

      // Échelle commune aux deux colonnes : la colonne de gauche (6 nœuds) remplit la hauteur
      const pad = etroit ? 10 : 14, nw = 14;
      const k = N ? (ih - pad * (PROFESSIONS.length - 1)) / N : 0;
      const hautD = N * k + pad * (NB_CARTES - 1);
      let y = 0;
      occs.forEach((d) => { d.y = y; d.h = d.total * k; y += d.h + pad; });
      y = (ih - hautD) / 2;
      cartes.forEach((d) => { d.y = y; d.h = d.total * k; y += d.h + pad; });

      // Bandes : à gauche, empilées par carte (Basic en haut) ; à droite, par profession
      const liens = [];
      const decalD = cartes.map(() => 0);
      occs.forEach((d) => {
        let decalG = 0;
        d.counts.forEach((v, c) => {
          const w = v * k;
          liens.push({ o: d.o, c, v, w, y0: d.y + decalG, y1: cartes[c].y + decalD[c] });
          decalG += w;
          decalD[c] += w;
        });
      });
      const x0 = nw, x1 = iw - nw;
      const actif = (l) => {
        if (survolA) return l.o === survolA.i;
        if (enEvidence() != null) return l.c === enEvidence();
        return sel < 0 || l.o === sel;
      };
      const base = App.theme() === "dark" ? 0.78 : 0.6; // sur fond sombre, des bandes plus opaques restent vives
      const opacite = (l) => (actif(l) ? (survolA || sel >= 0 || enEvidence() != null ? 0.92 : base) : 0.08);

      const gL = App.layer(plot, "liens");
      const chemins = gL.selectAll("path").data(liens, (l) => `${l.o}-${l.c}`)
        .join((e) => e.append("path").attr("d", (l) => ruban(x0, l.y0, x1, l.y1, 0)))
        .attr("fill", (l) => flux[l.c]).attr("fill-opacity", opacite);
      ctx.tr(chemins).attr("d", (l) => ruban(x0, l.y0, x1, l.y1, l.w));
      App.hover(chemins.filter((l) => l.v > 0), (l) => ({
        title: `${PROFESSIONS[l.o]} → ${CARTES[l.c]}`,
        rows: [
          { label: "Clients", value: fmt.int(l.v), color: flux[l.c] },
          { label: `Part des ${PLURIELS[l.o]}`, value: fmt.pct1(l.v / occs[l.o].total) },
          { label: `Part des cartes ${CARTES[l.c]}`, value: fmt.pct1(l.v / cartes[l.c].total) },
        ],
      }), { focus: false });

      // Nœuds : barres grises pour les professions, couleur de la carte à droite
      App.layer(plot, "noeuds-g").selectAll("rect").data(occs, (d) => d.o)
        .join((e) => e.append("rect").attr("x", 0).attr("width", nw).attr("y", (d) => d.y).attr("height", 0))
        .attr("rx", 2).attr("fill", colors.ink2).classed("is-dim", (d) => sel >= 0 && d.o !== sel)
        .call((s) => ctx.tr(s).attr("y", (d) => d.y).attr("height", (d) => Math.max(1, d.h)));
      const noeudsD = App.layer(plot, "noeuds-d").selectAll("rect").data(cartes, (d) => d.c)
        .join((e) => e.append("rect").attr("x", iw - nw).attr("width", nw).attr("y", (d) => d.y).attr("height", 0))
        .attr("x", iw - nw).attr("rx", 2).attr("fill", (d) => flux[d.c])
        .call((s) => ctx.tr(s).attr("y", (d) => d.y).attr("height", (d) => Math.max(1, d.h)));

      // Étiquettes : nom et effectif de chaque nœud
      const fs = etroit ? "12.5px" : "13.5px";
      const etiq = (cls, data, cle, x, anchor, nom, detail, dim) => {
        const t = App.layer(plot, cls).selectAll("text").data(data, cle)
          .join((e) => { const k2 = e.append("text"); k2.append("tspan").attr("class", "n"); k2.append("tspan").attr("class", "v"); return k2; })
          .attr("text-anchor", anchor).classed("is-dim", dim);
        t.select(".n").attr("x", x).attr("dy", "-0.15em").style("font-size", fs).style("fill", "var(--ink)")
          .style("font-weight", (d) => (cls === "lab-g" && d.o === sel ? 680 : 560)).text(nom);
        t.select(".v").attr("x", x).attr("dy", "1.25em").style("font-size", "12px").style("fill", "var(--ink-2)")
          .style("font-variant-numeric", "tabular-nums").text(detail);
        ctx.tr(t).attr("y", (d) => d.y + d.h / 2);
      };
      etiq("lab-g", occs, (d) => d.o, -10, "end", (d) => PROFESSIONS[d.o], (d) => fmt.clients(d.total), (d) => sel >= 0 && d.o !== sel);
      etiq("lab-d", cartes, (d) => d.c, iw + 10, "start", (d) => d.nom,
        (d) => (etroit ? fmt.int(d.total) : `${fmt.int(d.total)} (${N ? fmt.pct1(d.total / N) : "–"})`), () => false);
      const labD = App.layer(plot, "lab-d").selectAll("text");

      // Zones de survol des nœuds (nœud + étiquette, 24 px minimum) : infobulle, clavier, clic
      const hauteurHit = (d) => Math.max(26, d.h);
      const hitsG = App.layer(plot, "hits-g").selectAll("rect").data(occs, (d) => d.o).join("rect").attr("class", "hit")
        .attr("x", -ctx.m.l + 4).attr("width", ctx.m.l - 4 + nw)
        .attr("y", (d) => d.y + d.h / 2 - hauteurHit(d) / 2).attr("height", hauteurHit)
        .attr("role", "button").attr("aria-pressed", (d) => String(d.o === sel));
      maj.sankey = () => {
        chemins.attr("fill-opacity", opacite);
        App.attenuer(noeudsD, "card", (d) => d.c);
        App.attenuer(labD, "card", (d) => d.c);
      };
      const surligner = (v) => { survolA = v; maj.sankey(); };
      App.hover(hitsG, (d) => ({
        title: PROFESSIONS[d.o],
        sub: `${fmt.int(d.total)} clients${d.o === sel ? " (sélectionnée)" : ""}`,
        rows: CARTES.map((c, i) => ({
          label: c, color: flux[i],
          value: d.total ? `${fmt.pct1(d.counts[i] / d.total)} (${fmt.int(d.counts[i])})` : "–",
        })),
        note: d.o === sel ? "Cliquer pour désélectionner" : "Cliquer pour isoler cette profession dans la page",
      }), {
        click: (d) => { survolA = null; filtres.set("occ", d.o === sel ? -1 : d.o); },
        enter: (d) => surligner({ i: d.o }),
        leave: () => surligner(null),
      });
      const hitsD = App.layer(plot, "hits-d").selectAll("rect").data(cartes, (d) => d.c).join("rect").attr("class", "hit")
        .attr("x", iw - nw).attr("width", nw + ctx.m.r - 4)
        .attr("y", (d) => d.y + d.h / 2 - hauteurHit(d) / 2).attr("height", hauteurHit);
      App.hover(hitsD, (d) => ({
        title: `Carte ${d.nom}`,
        sub: `${fmt.int(d.total)} clients, ${N ? fmt.pct1(d.total / N) : "–"} du total`,
        rows: occs.filter((o) => o.counts[d.c] > 0).map((o) => ({
          label: PROFESSIONS[o.o], value: `${fmt.pct1(o.counts[d.c] / d.total)} (${fmt.int(o.counts[d.c])})`,
        })),
        note: App.surlignage.fixe("card") === d.c ? "Cliquer pour relâcher cette carte" : "Cliquer pour garder cette carte en évidence dans la page",
      }), {
        enter: (d) => App.surlignage.survoler("card", d.c),
        leave: () => App.surlignage.survoler("card", null),
        click: (d) => App.surlignage.basculer("card", d.c),
      });
      maj.sankey();
      App.empty(ctx, N === 0, "Aucun client ne correspond à ces filtres.");

      App.table("t-a", [
        { label: "Profession", value: (d) => PROFESSIONS[d.o] },
        { label: "Clients", value: (d) => d.total, format: fmt.int },
        ...CARTES.map((c, i) => ({
          label: c,
          value: (d) => `${fmt.int(d.counts[i])} (${d.total ? fmt.pct1(d.counts[i] / d.total) : "–"})`,
        })),
      ], occs, { note: "Lecture d'une ligne : répartition des clients d'une profession entre les cinq cartes (largeur des bandes du diagramme)." });
    },
  });

  /* ---------- B. Revenu par carte (échelle logarithmique) ---------- */
  const LOG0 = 5, LOG1 = 6.95, PAS = 0.05;
  const NB_BINS = Math.round((LOG1 - LOG0) / PAS);
  const chartB = App.chart("#chart-b", {
    label: "Histogramme empilé du revenu annuel par type de carte, échelle logarithmique, avec les bornes minimum et maximum de chaque carte.",
    height: (w) => (w < 640 ? 380 : 430),
    margin: (w) => ({ t: 5 * 17 + 22, r: 12, b: 34, l: 52 }),
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const rows = clients.filter(App.match(st));
      const bins = d3.range(NB_BINS).map((b) => ({ b, x0: 10 ** (LOG0 + b * PAS), x1: 10 ** (LOG0 + (b + 1) * PAS), counts: new Array(NB_CARTES).fill(0) }));
      const bornes = CARTES.map(() => ({ min: Infinity, max: -Infinity, n: 0 }));
      for (const r of rows) {
        const b = Math.min(NB_BINS - 1, Math.max(0, Math.floor((Math.log10(r.inc) - LOG0) / PAS)));
        bins[b].counts[r.card]++;
        const k = bornes[r.card];
        if (r.inc < k.min) k.min = r.inc;
        if (r.inc > k.max) k.max = r.inc;
        k.n++;
      }
      bins.forEach((d) => { d.total = d3.sum(d.counts); });

      const x = d3.scaleLog([10 ** LOG0, 10 ** LOG1], [0, iw]);
      const y = d3.scaleLinear([0, d3.max(bins, (d) => d.total) || 1], [ih, 0]).nice();
      const ticksX = [1e5, 2e5, 5e5, 1e6, 2e6, 5e6];
      App.layer(plot, "grid gy").call((g) => ctx.tr(g).call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat("")));
      App.layer(plot, "axis ax").attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).tickValues(ticksX).tickFormat(fmt.k).tickSizeOuter(0));
      App.layer(plot, "axis ay no-domain").call((g) => ctx.tr(g).call(d3.axisLeft(y).ticks(5).tickFormat(fmt.int).tickSize(0).tickPadding(8)));
      App.layer(plot, "axis-title xt", "text").attr("class", "xt axis-title").attr("x", iw).attr("y", ih + 30).attr("text-anchor", "end").text("Revenu annuel (échelle logarithmique)");

      // Barres empilées (une colonne par tranche de revenu)
      const segs = [];
      bins.forEach((d) => {
        const dernier = d.counts.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
        let cum = 0;
        d.counts.forEach((v, c) => {
          segs.push({ b: d.b, c, y0: cum, y1: cum + v, dernier: c === dernier, v });
          cum += v;
        });
      });
      const bx = (d) => x(bins[d.b].x0) + 1, bw = (d) => Math.max(0, x(bins[d.b].x1) - x(bins[d.b].x0) - 2);
      const barres = App.layer(plot, "bars").selectAll("path").data(segs, (d) => `${d.b}-${d.c}`)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(bx(d), ih, bw(d), 0, 0, "top")))
        .attr("fill", (d) => colors.cards[d.c])
        .call((s) => ctx.tr(s).attr("d", (d) => {
          const top = y(d.y1) + (d.v > 0 && !d.dernier ? 1 : 0), bottom = y(d.y0);
          return App.barPath(bx(d), top, bw(d), Math.max(0, bottom - top), d.dernier ? 3 : 0, "top");
        }));

      // Bornes min–max de chaque carte, au-dessus du graphique
      const lignes = bornes.map((k, c) => ({ c, ...k })).filter((k) => k.n > 0)
        .map((k) => ({ ...k, med: d3.median(rows.filter((r) => r.card === k.c), (r) => r.inc) }));
      const yb = (c) => -ctx.m.t + 14 + c * 17;
      const gB = App.layer(plot, "bornes").selectAll("g").data(lignes, (d) => d.c)
        .join((e) => {
          const g = e.append("g");
          g.append("line").attr("stroke-width", 2.5).attr("stroke-linecap", "round");
          g.append("circle").attr("class", "a").attr("r", 3.5);
          g.append("circle").attr("class", "b").attr("r", 3.5);
          g.append("text").attr("class", "val-label soft").attr("dy", "0.35em");
          return g;
        });
      gB.select("line").attr("stroke", (d) => colors.cards[d.c])
        .call((s) => ctx.tr(s).attr("x1", (d) => x(d.min)).attr("x2", (d) => x(d.max)).attr("y1", (d) => yb(d.c)).attr("y2", (d) => yb(d.c)));
      gB.select("circle.a").attr("fill", (d) => colors.cards[d.c]).call((s) => ctx.tr(s).attr("cx", (d) => x(d.min)).attr("cy", (d) => yb(d.c)));
      gB.select("circle.b").attr("fill", (d) => colors.cards[d.c]).call((s) => ctx.tr(s).attr("cx", (d) => x(d.max)).attr("cy", (d) => yb(d.c)));
      // Étiquette à gauche du trait si elle y tient, sinon à droite, sinon du côté le plus large
      const texte = (d) => `${CARTES[d.c]} : ${fmt.k(d.min)} – ${fmt.k(d.max)}`;
      const gauche = (d) => {
        const lw = texte(d).length * 6.6;
        const placeG = x(d.min) - 10 + ctx.m.l, placeD = iw - x(d.max) - 10;
        return placeG >= lw || (placeD < lw && placeG >= placeD);
      };
      gB.select("text")
        .attr("text-anchor", (d) => (gauche(d) ? "end" : "start"))
        .text(texte)
        .call((s) => ctx.tr(s).attr("x", (d) => (gauche(d) ? x(d.min) - 10 : x(d.max) + 10)).attr("y", (d) => yb(d.c)));
      // Survoler la fourchette d'une carte la fait ressortir dans l'histogramme
      App.hover(gB, (d) => ({
        title: `Carte ${CARTES[d.c]}`, sub: `${fmt.int(d.n)} clients`,
        rows: [
          { label: "Revenu minimum", value: fmt.k(d.min), color: colors.cards[d.c] },
          { label: "Revenu médian", value: fmt.k(d.med), color: "transparent" },
          { label: "Revenu maximum", value: fmt.k(d.max), color: "transparent" },
        ],
      }), {
        enter: (d) => App.surlignage.survoler("card", d.c),
        leave: () => App.surlignage.survoler("card", null),
        click: (d) => App.surlignage.basculer("card", d.c),
      });
      maj.histogramme = () => { App.attenuer(barres, "card", (d) => d.c); App.attenuer(gB, "card", (d) => d.c); };
      maj.histogramme();

      // Survol par colonne (toutes les cartes de la tranche)
      const hits = App.layer(plot, "hits").selectAll("rect").data(bins, (d) => d.b).join("rect").attr("class", "hit")
        .attr("x", (d) => x(d.x0)).attr("width", (d) => Math.max(1, x(d.x1) - x(d.x0))).attr("y", 0).attr("height", ih);
      App.hover(hits, (d) => ({
        title: `Revenu de ${fmt.k(d.x0)} à ${fmt.k(d.x1)}`,
        sub: `${fmt.int(d.total)} clients`,
        rows: CARTES.map((c, i) => ({ label: c, value: fmt.int(d.counts[i]), color: colors.cards[i] })).filter((r, i) => d.counts[i] > 0),
      }), { focus: false });
      App.empty(ctx, rows.length === 0, "Aucun client ne correspond à ces filtres.");

      App.table("t-b", [
        { label: "Carte", value: (d) => CARTES[d.c] },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "Revenu minimum", value: (d) => d.min, format: fmt.k },
        { label: "Revenu médian", value: (d) => d.med, format: fmt.k },
        { label: "Revenu maximum", value: (d) => d.max, format: fmt.k },
      ], lignes);
    },
  });

  /* ---------- C. Plafond en fonction du revenu (log-log) ---------- */
  const chartC = App.chart("#chart-c", {
    label: "Nuage de points du plafond de crédit en fonction du revenu annuel, en double échelle logarithmique, coloré par type de carte.",
    height: (w) => (w < 640 ? 360 : 440),
    margin: (w) => ({ t: 10, r: 16, b: 40, l: 56 }),
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const rows = App.echantillon.filter(App.match(st));
      const x = d3.scaleLog([8e4, 1e7], [0, iw]);
      const y = d3.scaleLog([1e4, 8e6], [ih, 0]);
      const tx = [1e5, 3e5, 1e6, 3e6, 1e7], ty = [1e4, 3e4, 1e5, 3e5, 1e6, 3e6];
      App.layer(plot, "grid gx").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).tickValues(tx).tickSize(-ih).tickFormat(""));
      App.layer(plot, "grid gy").call(d3.axisLeft(y).tickValues(ty).tickSize(-iw).tickFormat(""));
      App.layer(plot, "axis ax").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).tickValues(tx).tickFormat(fmt.k).tickSizeOuter(0));
      App.layer(plot, "axis ay").call(d3.axisLeft(y).tickValues(ty).tickFormat(fmt.k).tickSizeOuter(0));
      App.layer(plot, "axis-title xt", "text").attr("class", "xt axis-title").attr("x", iw).attr("y", ih + 34).attr("text-anchor", "end").text("Revenu annuel");
      App.layer(plot, "axis-title yt", "text").attr("class", "yt axis-title").attr("x", 6).attr("y", 4).attr("dy", "0.7em").text("Plafond de crédit");

      const pts = App.layer(plot, "pts").selectAll("circle").data(rows, (d) => d.i)
        .join((e) => e.append("circle").attr("r", 0).attr("cx", (d) => x(d.inc)).attr("cy", (d) => y(d.lim)))
        .attr("fill", (d) => colors.cards[d.card]).attr("fill-opacity", 0.78)
        .attr("stroke", colors.page).attr("stroke-width", 0.6);
      ctx.tr(pts).attr("r", 2.7).attr("cx", (d) => x(d.inc)).attr("cy", (d) => y(d.lim));

      // Étiquettes directes : multiplicateur médian de chaque carte
      const stats = d3.rollups(rows, (v) => {
        const ratios = v.map((r) => r.lim / r.inc).sort(d3.ascending);
        return {
          k: d3.quantileSorted(ratios, 0.5), q1: d3.quantileSorted(ratios, 0.25), q3: d3.quantileSorted(ratios, 0.75),
          min: d3.min(v, (r) => r.inc), max: d3.max(v, (r) => r.inc), n: v.length,
        };
      }, (r) => r.card).map(([c, s]) => ({ c, ...s })).sort((a, b) => a.c - b.c);
      const etiquettes = App.layer(plot, "labels").selectAll("text").data(stats.filter((s) => s.n >= 5), (d) => d.c)
        .join("text").attr("class", "val-label").attr("dy", "0.35em")
        .attr("text-anchor", (d) => (d.c <= 2 ? "start" : "end"))
        .attr("x", (d) => (d.c <= 2 ? x(d.max) + 10 : x(d.min) - 10))
        .attr("y", (d) => (d.c <= 2 ? y(d.k * d.max) : y(d.k * d.min)))
        .text((d) => `${CARTES[d.c]} : ${fmt.pct0(d.k)}`);

      // Interaction par carte : un client isolé n'apprend rien, c'est sa carte qui compte.
      // Le point le plus proche (Delaunay, 24 px au plus) désigne la carte à faire ressortir.
      maj.nuage = () => {
        const fc = enEvidence();
        pts.attr("fill-opacity", (d) => (fc == null ? 0.78 : d.card === fc ? 0.95 : 0.07));
        if (fc != null) pts.filter((d) => d.card === fc).raise();
        App.attenuer(etiquettes, "card", (d) => d.c);
      };
      maj.nuage();
      const delaunay = d3.Delaunay.from(rows, (d) => x(d.inc), (d) => y(d.lim));
      const carteProche = (ev) => {
        const [px, py] = d3.pointer(ev);
        const d = rows.length ? rows[delaunay.find(px, py)] : null;
        return d && Math.hypot(x(d.inc) - px, y(d.lim) - py) <= 24 ? d.card : null;
      };
      App.layer(plot, "hit-zone", "rect").attr("class", "hit-zone hit").attr("width", iw).attr("height", ih)
        .style("cursor", "pointer")
        .on("pointermove", (ev) => {
          const c = carteProche(ev);
          App.surlignage.survoler("card", c);
          const s = stats.find((k) => k.c === c);
          if (c == null || !s) { App.tip.hide(); return; }
          const regle = App.structure[c].ratio.moy;
          App.tip.show(ev, {
            title: `Carte ${CARTES[c]}`, sub: `${fmt.int(s.n)} clients de l’échantillon`,
            rows: [
              { label: "Plafond / revenu (médiane)", value: fmt.pct1(s.k), color: colors.cards[c] },
              { label: "Moitié des clients entre", value: `${fmt.pct0(s.q1)} et ${fmt.pct0(s.q3)}`, color: "transparent" },
              { label: "Revenus de l’échantillon", value: `${fmt.k(s.min)} – ${fmt.k(s.max)}`, color: "transparent" },
              { label: "Moyenne sur 50 000 clients", value: fmt.pct1(regle), color: "transparent" },
            ],
            note: App.surlignage.fixe("card") === c ? "Cliquer pour relâcher cette carte" : "Cliquer pour garder cette carte en évidence",
          });
        })
        .on("click", (ev) => {
          const c = carteProche(ev);
          if (c != null) App.surlignage.basculer("card", c);
          else App.surlignage.effacer("card");
        })
        .on("pointerleave", () => { App.surlignage.survoler("card", null); App.tip.hide(); });
      App.empty(ctx, rows.length === 0, "Aucun client de l'échantillon ne correspond à ces filtres.");

      App.table("t-c", [
        { label: "Carte", value: (d) => CARTES[d.c] },
        { label: "Clients (échantillon)", value: (d) => d.n, format: fmt.int },
        { label: "Plafond / revenu (médiane)", value: (d) => d.k, format: fmt.pct1 },
        { label: "Revenu min.", value: (d) => d.min, format: fmt.k },
        { label: "Revenu max.", value: (d) => d.max, format: fmt.k },
      ], stats, { note: "Sur les 50 000 clients, le rapport plafond / revenu vaut en moyenne 18 % (Basic), 28 % (Silver), 40 % (Gold), 55 % (Platinum) et 75 % (Signature)." });
    },
  });

  /* ---------- D. Pyramide des âges ---------- */
  const AGE_MIN = 18, AGE_MAX = 70;
  const ages = d3.range(AGE_MIN, AGE_MAX + 1);
  const trancheDe = (age) => App.meta.tranchesAge.findIndex(([a, b]) => age >= a && age <= b);
  const chartD = App.chart("#chart-d", {
    label: "Pyramide des âges des clients, femmes à gauche et hommes à droite, chaque barre découpée par type de carte, de Basic au centre à Signature à l'extérieur.",
    height: (w) => (w < 640 ? 440 : 480),
    margin: { t: 30, r: 8, b: 30, l: 8 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const rows = clients.filter(App.match({ occ: st.occ }));
      const t = [0, 1].map(() => ages.map(() => new Array(NB_CARTES).fill(0)));
      for (const r of rows) t[r.g][r.age - AGE_MIN][r.card]++;
      const gap = 40, demi = (iw - gap) / 2, cx = iw / 2;
      const maxLigne = d3.max([0, 1], (g) => d3.max(t[g], (c) => d3.sum(c))) || 1;
      const xs = d3.scaleLinear([0, maxLigne], [0, demi]).nice();
      const y = d3.scaleBand(ages, [ih, 0]).paddingInner(0.18);
      const bh = y.bandwidth();
      const actif = (g, age) => (st.g < 0 || st.g === g) && (st.ab < 0 || trancheDe(age) === st.ab);

      // Une barre par âge et par genre, découpée par carte avec la rampe de bleus du site
      // (Basic, le plus clair, au centre ; Signature, le plus foncé, à l'extérieur).
      // On y lit un dégradé d'ensemble ; les parts exactes sont dans le graphique voisin et le tableau.
      const segs = [];
      [0, 1].forEach((g) => ages.forEach((age, a) => {
        const counts = t[g][a];
        const dernier = counts.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
        let cum = 0;
        counts.forEach((v, c) => {
          // 1 px d'écart (couleur du fond) entre deux segments voisins
          const w = Math.max(0, xs(cum + v) - xs(cum) - (v > 0 && c !== dernier ? 1 : 0));
          const off = xs(cum);
          segs.push({ g, age, c, w, x0: g === 0 ? cx - gap / 2 - off - w : cx + gap / 2 + off, dernier: c === dernier });
          cum += v;
        });
      }));
      const couches = App.layer(plot, "bars").selectAll("path").data(segs, (d) => `${d.g}-${d.age}-${d.c}`)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(d.g === 0 ? cx - gap / 2 : cx + gap / 2, y(d.age), 0, bh, 0, d.g === 0 ? "left" : "right")))
        .attr("fill", (d) => colors.cards[d.c])
        .classed("is-dim", (d) => !actif(d.g, d.age))
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(d.x0, y(d.age), d.w, bh, d.dernier ? 2 : 0, d.g === 0 ? "left" : "right")));
      maj.pyramide = () => App.attenuer(couches, "card", (d) => d.c);
      maj.pyramide();

      // Âges au centre, axes des effectifs en bas, titres des deux côtés
      App.layer(plot, "age-labels").selectAll("text").data(ages.filter((a) => a % 5 === 0))
        .join("text").attr("class", "axis-title").attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("x", cx).attr("y", (a) => y(a) + bh / 2).style("font-size", "12px").text((a) => a);
      const ticks = xs.ticks(iw < 500 ? 2 : 4).filter((v) => v > 0 && xs(v) < demi - 18);
      App.layer(plot, "axis axl no-domain").attr("transform", `translate(0,${ih})`)
        .call((g) => g.selectAll(".tick").data(ticks).join((e) => { const k = e.append("g").attr("class", "tick"); k.append("text").attr("dy", "1.6em"); return k; })
          .attr("transform", (v) => `translate(${cx - gap / 2 - xs(v)},0)`).select("text").attr("text-anchor", "middle").text(fmt.int));
      App.layer(plot, "axis axr no-domain").attr("transform", `translate(0,${ih})`)
        .call((g) => g.selectAll(".tick").data(ticks).join((e) => { const k = e.append("g").attr("class", "tick"); k.append("text").attr("dy", "1.6em"); return k; })
          .attr("transform", (v) => `translate(${cx + gap / 2 + xs(v)},0)`).select("text").attr("text-anchor", "middle").text(fmt.int));
      const tot = [0, 1].map((g) => d3.sum(t[g], (c) => d3.sum(c)));
      App.layer(plot, "sides").selectAll("text").data([0, 1]).join("text")
        .attr("class", "val-label").attr("y", -14)
        .attr("x", (g) => (g === 0 ? cx - gap / 2 : cx + gap / 2))
        .attr("text-anchor", (g) => (g === 0 ? "end" : "start"))
        .classed("is-dim", (g) => st.g >= 0 && st.g !== g)
        .text((g) => `${GENRES[g]} : ${fmt.int(tot[g])}`);

      // Survol par âge
      const hits = App.layer(plot, "hits").selectAll("rect").data(ages).join("rect").attr("class", "hit")
        .attr("x", 0).attr("width", iw).attr("y", (a) => y(a) - (y.step() - bh) / 2).attr("height", y.step());
      App.hover(hits, (age) => {
        const a = age - AGE_MIN;
        const tous = d3.range(NB_CARTES).map((c) => t[0][a][c] + t[1][a][c]);
        const n = d3.sum(tous);
        return {
          title: `${age} ans`,
          sub: `${fmt.int(d3.sum(t[0][a]))} femmes, ${fmt.int(d3.sum(t[1][a]))} hommes`,
          rows: CARTES.map((c, i) => ({ label: c, value: n ? fmt.pct1(tous[i] / n) : "–", color: colors.cards[i] })),
        };
      }, { focus: false });
      App.empty(ctx, rows.length === 0, "Aucun client ne correspond à ces filtres.");
    },
  });

  /* ---------- D2. Composition par tranche d'âge et par genre ---------- */
  const chartD2 = App.chart("#chart-d2", {
    label: "Part de chaque type de carte par tranche d'âge et par genre : barres empilées à 100 %.",
    height: 7 * 34 + 52,
    margin: { t: 4, r: 20, b: 26, l: 76 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const rows = clients.filter(App.match({ occ: st.occ }));
      const groupes = [
        ...AGES.map((lab, i) => ({ id: `a${i}`, lab, test: (r) => r.ab === i, actif: st.ab < 0 || st.ab === i })),
        ...GENRES.map((lab, i) => ({ id: `g${i}`, lab, test: (r) => r.g === i, actif: st.g < 0 || st.g === i })),
      ];
      groupes.forEach((gr) => { gr.counts = new Array(NB_CARTES).fill(0); });
      for (const r of rows) groupes.forEach((gr) => { if (gr.test(r)) gr.counts[r.card]++; });
      groupes.forEach((gr) => { gr.total = d3.sum(gr.counts); });
      const y = d3.scaleBand(groupes.map((g) => g.id), [0, ih]).paddingInner(0.38);
      // Décalage visuel entre le bloc « âge » et le bloc « genre »
      const yy = (id) => y(id) + (id[0] === "g" ? 8 : 0);
      const x = d3.scaleLinear([0, 1], [0, iw]);
      const bh = Math.min(18, y.bandwidth());

      const segs = [];
      groupes.forEach((gr) => {
        const premier = gr.counts.findIndex((v) => v > 0);
        const dernier = gr.counts.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
        let cum = 0;
        gr.counts.forEach((v, c) => {
          const p = gr.total ? v / gr.total : 0;
          const gL = p > 0 && c !== premier ? 1 : 0, gR = p > 0 && c !== dernier ? 1 : 0;
          segs.push({ id: gr.id, c, px: x(cum) + gL, pw: Math.max(0, x(cum + p) - x(cum) - gL - gR), dernier: c === dernier, actif: gr.actif });
          cum += p;
        });
      });
      const parts = App.layer(plot, "bars").selectAll("path").data(segs, (d) => `${d.id}-${d.c}`)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(0, yy(d.id), 0, bh, 0)))
        .attr("fill", (d) => colors.cards[d.c])
        .classed("is-dim", (d) => !d.actif)
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(d.px, yy(d.id), d.pw, bh, d.dernier ? 3 : 0)));
      // Carte en évidence : sa part est écrite dans chaque barre, pour vérifier qu'elle ne bouge pas
      const partDe = (id, c) => { const gr = groupes.find((g) => g.id === id); return gr && gr.total ? gr.counts[c] / gr.total : 0; };
      maj.parts = () => {
        App.attenuer(parts, "card", (d) => d.c);
        const fc = enEvidence();
        App.layer(plot, "focus-labels").selectAll("text")
          .data(fc == null ? [] : segs.filter((d) => d.c === fc && d.pw > 34), (d) => d.id)
          .join("text").attr("class", "focus-label").attr("text-anchor", "middle").attr("dy", "0.35em")
          .attr("x", (d) => d.px + d.pw / 2).attr("y", (d) => yy(d.id) + bh / 2)
          .style("fill", (d) => (d.actif ? App.inkOn(colors.cards[d.c]) : "var(--ink-2)"))
          .text((d) => fmt.pct1(partDe(d.id, d.c)));
      };
      maj.parts();
      App.layer(plot, "axis cat ay no-domain").selectAll("text").data(groupes).join("text")
        .attr("x", -10).attr("y", (d) => yy(d.id) + bh / 2).attr("dy", "0.35em").attr("text-anchor", "end")
        .style("fill", "var(--ink-2)").style("font-size", "13px").text((d) => d.lab);
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih + 4})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(fmt.pct0).tickSize(0).tickPadding(8));
      const hits = App.layer(plot, "hits").selectAll("rect").data(groupes).join("rect").attr("class", "hit")
        .attr("x", -ctx.m.l).attr("width", iw + ctx.m.l).attr("y", (d) => yy(d.id) - 4).attr("height", bh + 8);
      App.hover(hits, (d) => ({
        title: d.lab, sub: `${fmt.int(d.total)} clients`,
        rows: CARTES.map((c, i) => ({ label: c, value: d.total ? fmt.pct1(d.counts[i] / d.total) : "–", color: colors.cards[i] })),
      }));

      App.table("t-d", [
        { label: "Groupe", value: (d) => d.lab },
        { label: "Clients", value: (d) => d.total, format: fmt.int },
        ...CARTES.map((c, i) => ({ label: c, value: (d) => (d.total ? d.counts[i] / d.total : 0), format: fmt.pct1 })),
      ], groupes);
    },
  });

  function majTout() {
    const garder = App.match(st);
    let n = 0;
    for (const r of clients) if (garder(r)) n++;
    filtres.count(n);
    chartA.update(); chartB.update(); chartC.update(); chartD.update(); chartD2.update();
  }
  filtres.count(clients.length);
})();
