/* =========================================================================
   Chapitre 2 — Comment dépensent-ils ?
   A. Structure des dépenses par groupe (barres empilées 100 % / montants)
   B. Écart de chaque groupe à la moyenne (diagramme en points)
   C. Fréquence × panier moyen par carte (bulles + courbes d'iso-dépense)
   D. Usage à l'étranger vs part des voyages
   Toutes les agrégations partent du « cube » (sommes par segment).
   ========================================================================= */
(function () {
  "use strict";
  const { CARTES, PROFESSIONS, GENRES, AGES, CATEGORIES, fmt } = App;
  const NC = CATEGORIES.length;
  const catVar = (j) => `var(--cat-${j})`;
  App.legend("#leg-a", CATEGORIES.map((c, j) => ({ label: c, color: catVar(j), v: j })), {
    cle: "cat", astuce: "Survolez une catégorie, ici ou dans les barres : elle ressort dans tous les groupes et dans le graphique suivant. Cliquez pour la garder.",
  });
  App.legend("#leg-c", CARTES.map((c, i) => ({ label: c, color: `var(--card-${i})`, type: "dot", v: i })), {
    cle: "card", astuce: "Survolez une carte (légende ou cercle) pour faire ressortir ses clients ici et dans les graphiques voisins.",
  });

  /** Mises à jour quand la catégorie ou la carte mise en évidence change (sans redessiner). */
  const maj = {};
  ["cat", "card"].forEach((cle) => App.surlignage.ecouter(cle, () => Object.values(maj).forEach((f) => f())));
  const carteEnEvidence = () => App.surlignage.valeur("card");
  const categorieEnEvidence = () => App.surlignage.valeur("cat");
  /** Options d'App.hover pour une marque qui représente une catégorie (survol, clic pour garder). */
  const relier = (cle, v) => ({
    enter: (d) => App.surlignage.survoler(cle, v(d)),
    leave: () => App.surlignage.survoler(cle, null),
    click: (d) => App.surlignage.basculer(cle, v(d)),
  });
  const noteClic = (cle, v, quoi) => (App.surlignage.fixe(cle) === v ? `Cliquer pour relâcher ${quoi}` : `Cliquer pour garder ${quoi} en évidence`);
  App.legend("#leg-d", [
    { label: "Barres : clients ayant payé au moins une fois à l'étranger (couleur de la carte)", color: "linear-gradient(90deg, var(--card-0), var(--card-4))" },
    { label: "Points : part des voyages dans la dépense", color: "var(--ink)", type: "dot" },
  ]);

  const filtres = App.filterBar("#filtres", ["g", "ab", "occ", "card"], () => majTout());
  const st = filtres.state;

  const DIMENSIONS = {
    card: { libelle: "Carte", noms: CARTES },
    ab: { libelle: "Âge", noms: AGES },
    occ: { libelle: "Profession", noms: PROFESSIONS },
    g: { libelle: "Genre", noms: GENRES },
  };
  let groupe = "card";
  let mesure = "p";
  App.segmented("#groupe", Object.entries(DIMENSIONS).map(([k, v]) => ({ value: k, label: v.libelle })), groupe,
    (v) => { groupe = v; chartA.update(); chartB.update(); }, "Regrouper par");
  App.segmented("#mesure", [{ value: "p", label: "Structure (100 %)" }, { value: "m", label: "Montant moyen" }], mesure,
    (v) => { mesure = v; chartA.update(); }, "Mesure");

  /** Somme des cellules du cube. */
  function agreger(cells) {
    const o = { n: 0, spend: 0, tx: 0, ticket: 0, intlU: 0, intlN: 0, inc: 0, cats: new Array(NC).fill(0) };
    for (const c of cells) {
      o.n += c.n; o.spend += c.spend; o.tx += c.tx; o.ticket += c.ticket;
      o.intlU += c.intlU; o.intlN += c.intlN; o.inc += c.inc;
      for (let j = 0; j < NC; j++) o.cats[j] += c[`c${j}`];
    }
    o.total = d3.sum(o.cats);
    return o;
  }
  /** Cellules filtrées, sauf sur la dimension « dim » (mise en évidence au lieu d'un filtre). */
  const cellules = (dimLibre) => {
    const f = { ...st };
    if (dimLibre) delete f[dimLibre];
    return App.cube.filter(App.match(f));
  };
  /** Groupes (ensemble + chaque modalité de la dimension) avec leurs agrégats. */
  function groupes(dim) {
    const cells = cellules(dim);
    const ens = { id: "all", nom: "Ensemble", ...agreger(cells), actif: true, ref: true };
    const parts = DIMENSIONS[dim].noms.map((nom, i) => ({
      id: i, nom, ...agreger(cells.filter((c) => c[dim] === i)), actif: st[dim] < 0 || st[dim] === i,
    }));
    return [ens, ...parts.filter((p) => p.n > 0)];
  }

  /* ---------- A. Structure des dépenses ---------- */
  const chartA = App.chart("#chart-a", {
    label: "Barres horizontales empilées : répartition de la dépense mensuelle entre sept catégories, pour l'ensemble et pour chaque groupe.",
    height: () => 32 + 8 * 46 + 18,
    margin: (w) => ({ t: 4, r: w < 640 ? 54 : 84, b: 32, l: w < 640 ? 118 : 150 }),
    draw(ctx) {
      const { plot, iw, colors } = ctx;
      const data = groupes(groupe);
      const parts = mesure === "p";
      data.forEach((d) => {
        d.vals = d.cats.map((v) => (parts ? (d.total ? v / d.total : 0) : (d.n ? v / d.n : 0)));
        d.somme = d3.sum(d.vals);
      });
      const pas = 46, bh = 24;
      const ih = 18 + data.length * pas;
      ctx.svg.attr("height", ih + ctx.m.t + ctx.m.b).attr("viewBox", [0, 0, ctx.w, ih + ctx.m.t + ctx.m.b]);
      const yRow = (i) => (i === 0 ? 0 : 18 + i * pas);
      const x = d3.scaleLinear([0, parts ? 1 : d3.max(data, (d) => d.somme) || 1], [0, iw]);
      if (!parts) x.nice();

      App.layer(plot, "grid gx").call((g) => ctx.tr(g).call(d3.axisBottom(x).ticks(iw < 420 ? 3 : 5).tickSize(ih).tickFormat("")));
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih})`)
        .call((g) => ctx.tr(g).call(d3.axisBottom(x).ticks(iw < 420 ? 3 : 5).tickFormat(parts ? fmt.pct0 : fmt.k).tickSize(0).tickPadding(10)));
      App.layer(plot, "baseline-l", "line").attr("class", "baseline-l baseline").attr("y1", -4).attr("y2", ih);

      const segs = [];
      data.forEach((d, i) => {
        const premier = d.vals.findIndex((v) => v > 0);
        const dernier = d.vals.reduce((acc, v, j) => (v > 0 ? j : acc), -1);
        let cum = 0;
        d.vals.forEach((v, j) => {
          const a = x(cum), b = x(cum + v);
          const gL = v > 0 && j !== premier ? 1 : 0, gR = v > 0 && j !== dernier ? 1 : 0;
          segs.push({ id: d.id, i, j, v, px: a + gL, pw: Math.max(0, b - a - gL - gR), dernier: j === dernier, actif: d.actif, ref: d.ref });
          cum += v;
        });
      });
      const barres = App.layer(plot, "bars").selectAll("path").data(segs, (d) => `${d.id}-${d.j}`)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(0, yRow(d.i), 0, bh, 0)))
        .attr("fill", (d) => colors.cats[d.j])
        .classed("is-dim", (d) => !d.actif)
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(d.px, yRow(d.i), d.pw, bh, d.dernier ? 4 : 0)));

      // Étiquettes dans les segments de la barre « Ensemble » (seulement si elles tiennent)
      const refSegs = segs.filter((s) => s.ref);
      const etiquettesEns = App.layer(plot, "in-labels").selectAll("text").data(refSegs, (d) => d.j)
        .join("text").attr("class", "in-label").attr("text-anchor", "middle").attr("dy", "0.35em")
        .attr("y", bh / 2)
        .style("fill", (d) => App.inkOn(colors.cats[d.j]))
        .text((d) => (parts ? fmt.pct1(d.v) : fmt.k(d.v)))
        .attr("x", (d) => d.px + d.pw / 2)
        .attr("display", null)
        .attr("display", function (d) { return this.getComputedTextLength() + 10 <= d.pw ? null : "none"; });

      // Noms des groupes et total (en mode montant)
      const nomsLignes = App.layer(plot, "row-labels").selectAll("text").data(data, (d) => d.id)
        .join("text").attr("text-anchor", "end").attr("dy", "0.35em").attr("x", -14)
        .style("fill", (d) => (d.ref ? "var(--ink)" : "var(--ink-2)")).style("font-size", "13.5px")
        .style("font-weight", (d) => (d.ref ? 620 : null))
        .classed("is-dim", (d) => !d.actif)
        .attr("y", (d, i) => yRow(i) + bh / 2).text((d) => d.nom);
      App.layer(plot, "totals").selectAll("text").data(parts ? [] : data, (d) => d.id)
        .join("text").attr("class", "val-label").attr("dy", "0.35em")
        .classed("is-dim", (d) => !d.actif)
        .attr("y", (d, i) => yRow(i) + bh / 2)
        .call((s) => ctx.tr(s).attr("x", (d) => x(d.somme) + 8))
        .text((d) => fmt.int(d.somme));

      // Survol d'un segment : la catégorie entière ressort dans tous les groupes,
      // et l'infobulle compare sa part d'un groupe à l'autre.
      App.hover(barres, (d) => ({
        title: CATEGORIES[d.j],
        sub: parts ? "Part de la dépense, selon le groupe" : "Dépense moyenne par mois, selon le groupe",
        rows: data.map((g) => ({
          label: g.nom, color: g.id === d.id ? colors.cats[d.j] : "transparent",
          value: parts ? fmt.pct1(g.vals[d.j]) : fmt.int(g.vals[d.j]),
        })),
        note: noteClic("cat", d.j, "cette catégorie"),
      }), { focus: false, ...relier("cat", (d) => d.j) });
      // Survol (ou focus clavier) du nom d'un groupe : composition détaillée de ce groupe
      App.hover(nomsLignes, (d) => ({
        title: d.nom,
        sub: `${fmt.int(d.n)} clients, ${fmt.int(d.n ? d.total / d.n : 0)} par mois en moyenne`,
        rows: CATEGORIES.map((c, j) => ({
          label: c, color: colors.cats[j],
          value: `${fmt.pct1(d.total ? d.cats[j] / d.total : 0)} (${fmt.k(d.n ? d.cats[j] / d.n : 0)})`,
        })),
      }));
      maj.panier = () => {
        const fc = categorieEnEvidence();
        App.attenuer(barres, "cat", (d) => d.j);
        etiquettesEns.style("opacity", fc == null ? null : 0);
        // La catégorie en évidence affiche sa valeur dans chaque barre
        App.layer(plot, "focus-labels").selectAll("text")
          .data(fc == null ? [] : segs.filter((d) => d.j === fc && d.pw > 38), (d) => d.id)
          .join("text").attr("class", "focus-label").attr("text-anchor", "middle").attr("dy", "0.35em")
          .attr("x", (d) => d.px + d.pw / 2).attr("y", (d) => yRow(d.i) + bh / 2)
          .style("fill", (d) => (d.actif ? App.inkOn(colors.cats[fc]) : "var(--ink-2)"))
          .text((d) => (parts ? fmt.pct1(d.v) : fmt.k(d.v)));
      };
      maj.panier();
      App.empty(ctx, data[0].n === 0, "Aucun client ne correspond à ces filtres.");

      App.table("t-a", [
        { label: "Groupe", value: (d) => d.nom },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "Dépense moyenne", value: (d) => (d.n ? d.total / d.n : 0), format: fmt.int },
        ...CATEGORIES.map((c, j) => ({ label: c, value: (d) => (d.total ? d.cats[j] / d.total : 0), format: fmt.pct1 })),
      ], data);
    },
  });

  /* ---------- B. Écarts à la moyenne (points de pourcentage) ---------- */
  let groupeSurvole = null;
  /** Écart en points, sans « −0,0 » pour un écart nul à l'arrondi. */
  const pt = (v) => (Math.abs(v) < 0.05 ? "0,0" : fmt.pts(v));
  const chartB = App.chart("#chart-b", {
    label: "Diagramme en points : écart de la part de chaque catégorie, pour chaque groupe, par rapport à l'ensemble, en points de pourcentage.",
    height: NC * 40 + 76,
    margin: (w) => ({ t: 34, r: 24, b: 38, l: w < 640 ? 132 : 150 }),
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const data = groupes(groupe);
      const ens = data[0];
      const points = [];
      data.slice(1).forEach((d) => CATEGORIES.forEach((c, j) => {
        const part = d.total ? d.cats[j] / d.total : 0, ref = ens.total ? ens.cats[j] / ens.total : 0;
        points.push({ id: `${d.id}-${j}`, gid: d.id, nom: d.nom, j, part, ref, ecart: (part - ref) * 100, actif: d.actif, n: d.n });
      }));
      const maxAbs = d3.max(points, (p) => Math.abs(p.ecart)) || 0;
      const lim = Math.max(1, Math.ceil(maxAbs * 2.2) / 2);
      const x = d3.scaleLinear([-lim, lim], [0, iw]);
      const y = d3.scaleBand(d3.range(NC), [0, ih]).padding(0.3);

      App.layer(plot, "band", "rect").attr("class", "band").attr("fill", colors.plane)
        .call((s) => ctx.tr(s).attr("x", x(-0.5)).attr("width", x(0.5) - x(-0.5))).attr("y", 0).attr("height", ih);
      App.layer(plot, "grid gx").call((g) => ctx.tr(g).call(d3.axisBottom(x).ticks(iw < 420 ? 4 : 8).tickSize(ih).tickFormat("")));
      App.layer(plot, "zero", "line").attr("class", "zero baseline").attr("y1", 0).attr("y2", ih)
        .call((s) => ctx.tr(s).attr("x1", x(0)).attr("x2", x(0)));
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih})`)
        .call((g) => ctx.tr(g).call(d3.axisBottom(x).ticks(iw < 420 ? 4 : 8).tickFormat((v) => (v === 0 ? "0" : fmt.pts(v))).tickSize(0).tickPadding(10)));
      App.layer(plot, "axis-title xt", "text").attr("class", "axis-title xt").attr("x", iw).attr("y", ih + 34).attr("text-anchor", "end").text("Écart à l'ensemble, en points");
      App.layer(plot, "axis cat ay no-domain").call(d3.axisLeft(y).tickSize(0).tickPadding(14).tickFormat((j) => CATEGORIES[j]));
      // pastille de couleur de la catégorie devant chaque nom
      App.layer(plot, "cat-keys").selectAll("rect").data(d3.range(NC)).join("rect")
        .attr("x", -10).attr("y", (j) => y(j) + y.bandwidth() / 2 - 4).attr("width", 8).attr("height", 8).attr("rx", 2)
        .attr("fill", (j) => colors.cats[j]);
      App.layer(plot, "axis cat ay no-domain").selectAll(".tick text").attr("dx", -12);

      // Survol d'une ligne : la catégorie, avec l'écart de chaque groupe
      const lignes = App.layer(plot, "row-hits").selectAll("rect").data(d3.range(NC)).join("rect").attr("class", "hit")
        .attr("x", -ctx.m.l + 4).attr("width", iw + ctx.m.l - 4).attr("y", (j) => y(j) - 4).attr("height", y.bandwidth() + 8);
      App.hover(lignes, (j) => ({
        title: CATEGORIES[j], sub: "Écart de chaque groupe à l’ensemble",
        rows: points.filter((p) => p.j === j).map((p) => ({ label: p.nom, value: `${pt(p.ecart)} pt` })),
        note: noteClic("cat", j, "cette catégorie"),
      }), { focus: false, ...relier("cat", (j) => j) });

      const dots = App.layer(plot, "dots").selectAll("circle").data(points, (d) => d.id)
        .join((e) => e.append("circle").attr("r", 0).attr("cx", x(0)).attr("cy", (d) => y(d.j) + y.bandwidth() / 2))
        .attr("fill", colors.ink2).attr("fill-opacity", 0.85).attr("stroke", colors.page).attr("stroke-width", 2)
        .classed("is-dim", (d) => !d.actif);
      ctx.tr(dots).attr("r", 5.5).attr("cx", (d) => x(d.ecart)).attr("cy", (d) => y(d.j) + y.bandwidth() / 2);
      // Survol d'un point : tout son groupe ressort (ses sept points), avec leurs valeurs
      App.hover(dots, (d) => ({
        title: d.nom, sub: "Écart de chaque catégorie à l’ensemble",
        rows: points.filter((p) => p.gid === d.gid).map((p) => ({
          label: CATEGORIES[p.j], color: colors.cats[p.j], value: `${pt(p.ecart)} pt`,
        })),
      }), {
        focus: false,
        enter: (d) => { groupeSurvole = d.gid; maj.ecarts(); },
        leave: () => { groupeSurvole = null; maj.ecarts(); },
      });
      const ticks = App.layer(plot, "axis cat ay no-domain").selectAll(".tick");
      const pastilles = App.layer(plot, "cat-keys").selectAll("rect");
      maj.ecarts = () => {
        const fc = categorieEnEvidence(), g = groupeSurvole;
        dots.classed("is-faded", (d) => (fc != null && d.j !== fc) || (g != null && d.gid !== g));
        App.attenuer(ticks, "cat", (j) => j);
        App.attenuer(pastilles, "cat", (j) => j);
        App.layer(plot, "group-labels").selectAll("text")
          .data(g == null ? [] : points.filter((p) => p.gid === g), (p) => p.id)
          .join("text").attr("class", "val-label halo").attr("text-anchor", "middle")
          .attr("x", (p) => x(p.ecart)).attr("y", (p) => y(p.j) + y.bandwidth() / 2 - 11)
          .text((p) => pt(p.ecart));
      };
      maj.ecarts();

      // Point le plus éloigné de zéro : cerclé, et décrit au-dessus du graphique
      const extreme = points.length ? points.reduce((a, b) => (Math.abs(b.ecart) > Math.abs(a.ecart) ? b : a)) : null;
      App.layer(plot, "extreme-ring").selectAll("circle").data(extreme ? [extreme] : [], (d) => d.id).join("circle")
        .attr("r", 10).attr("fill", "none").attr("stroke", colors.ink).attr("stroke-width", 1.5)
        .call((s) => ctx.tr(s).attr("cx", (d) => x(d.ecart)).attr("cy", (d) => y(d.j) + y.bandwidth() / 2));
      App.layer(plot, "annot").selectAll("text").data(extreme ? [extreme] : [], (d) => d.id).join("text")
        .attr("class", "val-label").attr("x", -ctx.m.l + 4).attr("y", -14)
        .text((d) => `Écart le plus fort : ${d.nom}, ${CATEGORIES[d.j].toLowerCase()} (${fmt.pts(d.ecart)} pt)`);

      App.table("t-b", [
        { label: "Groupe", value: (d) => d.nom },
        { label: "Catégorie", value: (d) => CATEGORIES[d.j] },
        { label: "Part", value: (d) => d.part, format: fmt.pct1 },
        { label: "Ensemble", value: (d) => d.ref, format: fmt.pct1 },
        { label: "Écart (points)", value: (d) => d.ecart, format: fmt.pts },
      ], points);
    },
  });

  /* ---------- C. Fréquence × panier moyen ---------- */
  const ISO = [1e4, 3e4, 1e5, 3e5];
  const chartC = App.chart("#chart-c", {
    label: "Nuage de points : nombre de transactions par mois en abscisse, panier moyen en ordonnée (échelle logarithmique), avec la moyenne de chaque carte et des courbes de dépense constante.",
    height: (w) => (w < 640 ? 380 : 470),
    margin: { t: 14, r: 18, b: 42, l: 58 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const cells = cellules("card");
      const moy = CARTES.map((nom, i) => {
        const a = agreger(cells.filter((c) => c.card === i));
        return {
          i, nom, n: a.n, tx: a.n ? a.tx / a.n : 0, ticket: a.n ? a.ticket / a.n : 0, spend: a.n ? a.spend / a.n : 0,
          ratio: a.inc ? (a.spend * 12) / a.inc : 0, actif: st.card < 0 || st.card === i,
        };
      }).filter((d) => d.n > 0);
      const f = { ...st };
      const pts = App.echantillon.filter(App.match(f));
      const x = d3.scaleLinear([0, 185], [0, iw]);
      const y = d3.scaleLog([40, 15000], [ih, 0]);
      const ty = [50, 100, 300, 1000, 3000, 10000];
      App.layer(plot, "grid gx").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(6).tickSize(-ih).tickFormat(""));
      App.layer(plot, "grid gy").call(d3.axisLeft(y).tickValues(ty).tickSize(-iw).tickFormat(""));
      App.layer(plot, "axis ax").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(6).tickFormat(fmt.int).tickSizeOuter(0));
      App.layer(plot, "axis ay").call(d3.axisLeft(y).tickValues(ty).tickFormat(fmt.k).tickSizeOuter(0));
      App.layer(plot, "axis-title xt", "text").attr("class", "axis-title xt").attr("x", iw).attr("y", ih + 36).attr("text-anchor", "end").text("Transactions par mois");
      App.layer(plot, "axis-title yt", "text").attr("class", "axis-title yt").attr("x", 6).attr("y", 2).attr("dy", "0.7em").text("Panier moyen (échelle log.)");

      // Courbes d'iso-dépense : transactions × panier = constante
      const ligne = d3.line().x((d) => x(d[0])).y((d) => y(d[1]));
      const isoData = ISO.map((S) => {
        const xs = d3.range(Math.max(8, S / 15000), 185.01, 1);
        return { S, pts: xs.map((t) => [t, S / t]).filter((p) => p[1] >= 40 && p[1] <= 15000) };
      });
      App.layer(plot, "iso").selectAll("path").data(isoData).join("path").attr("class", "iso").attr("d", (d) => ligne(d.pts));
      App.layer(plot, "iso-labels").selectAll("text").data(isoData).join("text").attr("class", "iso-label halo")
        .attr("text-anchor", "end").attr("x", iw - 2).attr("y", (d) => y(d.S / 185) - 6)
        .text((d) => (iw < 460 ? fmt.k(d.S) : `${fmt.k(d.S)} par mois`));

      const nuage = App.layer(plot, "cloud").selectAll("circle").data(pts, (d) => d.i)
        .join((e) => e.append("circle").attr("r", 1.9))
        .attr("cx", (d) => x(d.tx)).attr("cy", (d) => y(d.ticket))
        .attr("fill", (d) => colors.cards[d.card]).attr("fill-opacity", 0.32);

      const rMax = Math.min(34, iw / 22);
      const r = d3.scaleSqrt([0, d3.max(moy, (d) => d.n) || 1], [0, rMax]);
      const bulles = App.layer(plot, "bubbles").selectAll("circle").data(moy, (d) => d.i)
        .join((e) => e.append("circle").attr("cx", (d) => x(d.tx)).attr("cy", (d) => y(d.ticket)).attr("r", 0))
        .attr("fill", (d) => colors.cards[d.i]).attr("stroke", colors.page).attr("stroke-width", 2)
        .classed("is-dim", (d) => !d.actif);
      ctx.tr(bulles).attr("cx", (d) => x(d.tx)).attr("cy", (d) => y(d.ticket)).attr("r", (d) => Math.max(6, r(d.n)));
      App.hover(bulles, (d) => ({
        title: `Carte ${d.nom}`, sub: `${fmt.int(d.n)} clients`,
        rows: [
          { label: "Transactions par mois", value: fmt.dec1(d.tx) },
          { label: "Panier moyen", value: fmt.int(d.ticket) },
          { label: "Dépense mensuelle moyenne", value: fmt.int(d.spend) },
        ],
        note: noteClic("card", d.i, "cette carte"),
      }), relier("card", (d) => d.i));
      // Position des étiquettes : sous Basic, au-dessus de Silver, à droite des autres (évite les chevauchements)
      const place = ["bas", "haut", "droite", "droite", "droite"];
      const rr = (d) => Math.max(6, r(d.n));
      const lx = (d) => (place[d.i] === "droite" ? x(d.tx) + rr(d) + 8 : x(d.tx));
      const ly = (d) => (place[d.i] === "bas" ? y(d.ticket) + rr(d) + 15 : place[d.i] === "haut" ? y(d.ticket) - rr(d) - 9 : y(d.ticket) + 4);
      const etiquettes = App.layer(plot, "bubble-labels").selectAll("text").data(moy, (d) => d.i)
        .join((e) => { const t = e.append("text").attr("class", "val-label halo"); t.append("tspan").attr("class", "a"); t.append("tspan").attr("class", "b soft"); return t; })
        .attr("text-anchor", (d) => (place[d.i] === "droite" ? "start" : "middle"))
        .classed("is-dim", (d) => !d.actif);
      const compact = iw < 460;
      etiquettes.select(".a").text((d) => d.nom);
      etiquettes.select(".b").attr("dx", 6).style("font-weight", 500).style("fill", "var(--ink-2)").text((d) => (compact ? "" : `${fmt.k(d.spend)} / mois`));
      ctx.tr(etiquettes).attr("x", lx).attr("y", ly);
      maj.volume = () => {
        const fc = carteEnEvidence();
        nuage.attr("fill-opacity", (d) => (fc == null ? 0.32 : d.card === fc ? 0.75 : 0.04));
        App.attenuer(bulles, "card", (d) => d.i);
        App.attenuer(etiquettes, "card", (d) => d.i);
      };
      maj.volume();

      // Annotation : décomposition de l'écart Basic → Signature
      const b = moy.find((d) => d.i === 0), s = moy.find((d) => d.i === 4);
      const note = b && s ? [
        `De Basic à Signature :`,
        `×${fmt.dec1(s.tx / b.tx)} transactions par mois,`,
        `×${fmt.dec1(s.ticket / b.ticket)} de panier moyen,`,
        `×${fmt.int(s.spend / b.spend)} de dépense mensuelle.`,
      ] : [];
      const an = App.layer(plot, "annot").selectAll("text").data(note.length && iw > 420 ? [note] : []).join("text")
        .attr("class", "halo").attr("x", 14).attr("y", 34);
      an.selectAll("tspan").data((d) => d).join("tspan").attr("x", 14).attr("dy", (d, i) => (i ? "1.35em" : 0))
        .style("font-weight", (d, i) => (i ? 500 : 620)).style("fill", (d, i) => (i ? "var(--ink-2)" : "var(--ink)")).text((d) => d);
      App.empty(ctx, moy.length === 0, "Aucun client ne correspond à ces filtres.");

      App.table("t-c", [
        { label: "Carte", value: (d) => d.nom },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "Transactions / mois", value: (d) => d.tx, format: fmt.dec1 },
        { label: "Panier moyen", value: (d) => d.ticket, format: fmt.int },
        { label: "Dépense mensuelle moyenne", value: (d) => d.spend, format: fmt.int },
        { label: "Dépense annuelle / revenu", value: (d) => d.ratio, format: fmt.pct1 },
      ], moy);
    },
  });

  /* ---------- C2. Part du revenu dépensée ---------- */
  const chartC2 = App.chart("#chart-c2", {
    label: "Barres : dépense annuelle rapportée au revenu annuel, par type de carte.",
    height: 5 * 34 + 26,
    margin: { t: 4, r: 46, b: 24, l: 72 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const cells = cellules("card");
      const data = CARTES.map((nom, i) => {
        const a = agreger(cells.filter((c) => c.card === i));
        return { i, nom, n: a.n, ratio: a.inc ? (a.spend * 12) / a.inc : 0, actif: st.card < 0 || st.card === i };
      }).filter((d) => d.n > 0);
      const y = d3.scaleBand(data.map((d) => d.i), [0, ih]).padding(0.4);
      const x = d3.scaleLinear([0, 0.8], [0, iw]);
      const bh = Math.min(16, y.bandwidth());
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih + 2})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(fmt.pct0).tickSize(0).tickPadding(8));
      const barresRevenu = App.layer(plot, "bars").selectAll("path").data(data, (d) => d.i)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(0, y(d.i), 0, bh, 0)))
        .attr("fill", (d) => colors.cards[d.i]).classed("is-dim", (d) => !d.actif)
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(0, y(d.i) + (y.bandwidth() - bh) / 2, x(d.ratio), bh, 3)));
      App.layer(plot, "names").selectAll("text").data(data, (d) => d.i).join("text")
        .attr("x", -10).attr("text-anchor", "end").attr("dy", "0.35em").style("font-size", "13px").style("fill", "var(--ink-2)")
        .attr("y", (d) => y(d.i) + y.bandwidth() / 2).text((d) => d.nom);
      const valeursRevenu = App.layer(plot, "vals").selectAll("text").data(data, (d) => d.i).join("text").attr("class", "val-label")
        .attr("dy", "0.35em").attr("y", (d) => y(d.i) + y.bandwidth() / 2).classed("is-dim", (d) => !d.actif)
        .call((s) => ctx.tr(s).attr("x", (d) => x(d.ratio) + 6)).text((d) => fmt.pct0(d.ratio));
      const zones = App.layer(plot, "hits").selectAll("rect").data(data, (d) => d.i).join("rect").attr("class", "hit")
        .attr("x", -ctx.m.l).attr("width", iw + ctx.m.l).attr("y", (d) => y(d.i) - 4).attr("height", y.bandwidth() + 8);
      App.hover(zones, (d) => ({
        title: `Carte ${d.nom}`, sub: `${fmt.int(d.n)} clients`,
        rows: [{ label: "Dépense annuelle / revenu", value: fmt.pct1(d.ratio), color: colors.cards[d.i] }],
      }), { focus: false, ...relier("card", (d) => d.i) });
      maj.revenu = () => { App.attenuer(barresRevenu, "card", (d) => d.i); App.attenuer(valeursRevenu, "card", (d) => d.i); };
      maj.revenu();
    },
  });

  /* ---------- D. Usage à l'étranger ---------- */
  const chartD = App.chart("#chart-d", {
    label: "Barres : part des clients ayant au moins une transaction internationale, par carte ; points : part des voyages dans la dépense.",
    height: 5 * 52 + 40,
    margin: (w) => ({ t: 6, r: 70, b: 32, l: w < 640 ? 84 : 110 }),
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const cells = cellules("card");
      const data = CARTES.map((nom, i) => {
        const a = agreger(cells.filter((c) => c.card === i));
        return {
          i, nom, n: a.n, intl: a.n ? a.intlU / a.n : 0, intlMoy: a.n ? a.intlN / a.n : 0,
          voyage: a.total ? a.cats[NC - 1] / a.total : 0, actif: st.card < 0 || st.card === i,
        };
      }).filter((d) => d.n > 0);
      const y = d3.scaleBand(data.map((d) => d.i), [0, ih]).paddingInner(0.45).paddingOuter(0.2);
      const x = d3.scaleLinear([0, 1], [0, iw]);
      const bh = Math.min(22, y.bandwidth());
      const yc = (d) => y(d.i) + y.bandwidth() / 2;
      App.layer(plot, "grid gx").call(d3.axisBottom(x).ticks(5).tickSize(ih).tickFormat(""));
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(fmt.pct0).tickSize(0).tickPadding(10));
      App.layer(plot, "axis cat ay no-domain").call(d3.axisLeft(y).tickSize(0).tickPadding(14).tickFormat((i) => CARTES[i]));
      App.layer(plot, "baseline-l", "line").attr("class", "baseline-l baseline").attr("y1", 0).attr("y2", ih);
      const barresIntl = App.layer(plot, "bars").selectAll("path").data(data, (d) => d.i)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(0, yc(d) - bh / 2, 0, bh, 0)))
        .attr("fill", (d) => colors.cards[d.i]).classed("is-dim", (d) => !d.actif)
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(0, yc(d) - bh / 2, x(d.intl), bh, 4)));
      const dots = App.layer(plot, "dots").selectAll("circle").data(data, (d) => d.i)
        .join((e) => e.append("circle").attr("r", 5).attr("cy", yc).attr("cx", 0))
        .attr("fill", colors.ink).attr("stroke", colors.page).attr("stroke-width", 2).classed("is-dim", (d) => !d.actif);
      ctx.tr(dots).attr("cx", (d) => x(d.voyage)).attr("cy", yc);
      const valeursIntl = App.layer(plot, "vals").selectAll("text").data(data, (d) => d.i).join("text").attr("class", "val-label")
        .attr("dy", "0.35em").attr("y", yc).classed("is-dim", (d) => !d.actif)
        .call((s) => ctx.tr(s).attr("x", (d) => Math.max(x(d.intl), x(d.voyage) + 6) + 10))
        .text((d) => fmt.pct1(d.intl));
      const hits = App.layer(plot, "hits").selectAll("rect").data(data, (d) => d.i).join("rect").attr("class", "hit")
        .attr("x", -ctx.m.l + 4).attr("width", iw + ctx.m.l - 4).attr("y", (d) => y(d.i) - 8).attr("height", y.bandwidth() + 16);
      App.hover(hits, (d) => ({
        title: `Carte ${d.nom}`, sub: `${fmt.int(d.n)} clients`,
        rows: [
          { label: "Au moins une transaction à l'étranger", value: fmt.pct1(d.intl), color: colors.cards[d.i] },
          { label: "Transactions internationales (moyenne)", value: fmt.dec2(d.intlMoy) },
          { label: "Part des voyages dans la dépense", value: fmt.pct1(d.voyage), color: colors.ink },
        ],
        note: noteClic("card", d.i, "cette carte"),
      }), relier("card", (d) => d.i));
      maj.etranger = () => [barresIntl, dots, valeursIntl].forEach((sel) => App.attenuer(sel, "card", (d) => d.i));
      maj.etranger();
      App.empty(ctx, data.length === 0, "Aucun client ne correspond à ces filtres.");
      App.table("t-d", [
        { label: "Carte", value: (d) => d.nom },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "Au moins une transaction à l'étranger", value: (d) => d.intl, format: fmt.pct1 },
        { label: "Transactions intl. (moyenne)", value: (d) => d.intlMoy, format: fmt.dec2 },
        { label: "Part des voyages", value: (d) => d.voyage, format: fmt.pct1 },
      ], data);
    },
  });

  function majTout() {
    filtres.count(d3.sum(cellules(null), (c) => c.n));
    chartA.update(); chartB.update(); chartC.update(); chartD.update(); chartC2.update();
  }
  filtres.count(App.N);
})();
