/* =========================================================================
   Chapitre 4 — L'application fidélise-t-elle ?
   A. Dépense mensuelle par quintile de connexions (boîtes à moustaches)
   B1. Composition par carte de chaque quintile (barres empilées 100 %)
   B2. Dépense médiane selon les connexions, une courbe par carte
   C. Points de fidélité : gaufrier, gains par carte, taux d'utilisation
   ========================================================================= */
(function () {
  "use strict";
  const { clients, CARTES, CONNEXIONS, fmt } = App;
  const NQ = CONNEXIONS.length;
  const labQ = (q) => `${CONNEXIONS[q]} connexions`;

  const filtres = App.filterBar("#filtres", ["card", "g", "ab", "occ"], () => majTout());
  const st = filtres.state;
  let rows = clients;
  const filtrer = () => { rows = clients.filter(App.match(st)); };
  filtrer();

  App.legend("#leg-a", [
    { label: "Boîte : 50 % central des clients", color: "color-mix(in srgb, var(--mesure) 16%, transparent)", type: "" },
    { label: "Médiane", color: "var(--ink)", type: "line" },
    { label: "Clients de l'échantillon", color: "var(--axis)", type: "dot" },
  ]);
  const legA = document.querySelector("#leg-a .sw");
  if (legA) legA.style.boxShadow = "inset 0 0 0 1.5px var(--mesure)";
  App.legend("#leg-b", CARTES.map((c, i) => ({ label: c, color: `var(--card-${i})`, v: i })), {
    cle: "card", astuce: "Survolez une carte pour suivre sa part d’un quintile à l’autre, et sa courbe à droite.",
  });
  App.legend("#leg-b2", CARTES.map((c, i) => ({ label: c, color: `var(--card-${i})`, type: "line", v: i })), {
    cle: "card", astuce: "Survolez une courbe, son nom ou la légende pour l’isoler. Cliquez pour la garder.",
  });

  /** Mises à jour quand la carte mise en évidence change (sans redessiner). */
  const maj = {};
  App.surlignage.ecouter("card", () => Object.values(maj).forEach((f) => f()));
  const enEvidence = () => App.surlignage.valeur("card");
  const relier = (v) => ({
    enter: (d) => App.surlignage.survoler("card", v(d)),
    leave: () => App.surlignage.survoler("card", null),
    click: (d) => App.surlignage.basculer("card", v(d)),
  });
  const noteClic = (c) => (App.surlignage.fixe("card") === c ? "Cliquer pour relâcher cette carte" : "Cliquer pour garder cette carte en évidence");
  App.legend("#leg-c", [
    { label: "Points utilisés", color: "var(--mesure)" },
    { label: "Points jamais utilisés", color: "var(--axis)" },
  ]);

  /* ---------- A. Boîtes à moustaches ---------- */
  const chartA = App.chart("#chart-a", {
    label: "Boîtes à moustaches de la dépense mensuelle par quintile de connexions à l'application, échelle logarithmique.",
    height: (w) => (w < 640 ? 400 : 480),
    margin: (w) => ({ t: 30, r: 16, b: 54, l: 58 }),
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const groupes = d3.range(NQ).map((q) => {
        const v = Float64Array.from(rows.filter((r) => r.lq === q), (r) => r.spend).sort();
        return v.length ? { q, ...App.stats.box(v) } : { q, n: 0 };
      });
      const x = d3.scaleBand(d3.range(NQ), [0, iw]).padding(0.3);
      const y = d3.scaleLog([1500, 8e5], [ih, 0]);
      const ty = [2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5];
      const bw = Math.min(64, x.bandwidth());
      const cx = (q) => x(q) + x.bandwidth() / 2;
      App.layer(plot, "grid gy").call(d3.axisLeft(y).tickValues(ty).tickSize(-iw).tickFormat(""));
      App.layer(plot, "axis ay no-domain").call(d3.axisLeft(y).tickValues(ty).tickFormat(fmt.k).tickSize(0).tickPadding(8));
      App.layer(plot, "axis ax cat no-domain").attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).tickSize(0).tickPadding(12).tickFormat((q) => CONNEXIONS[q]));
      App.layer(plot, "axis-title xt", "text").attr("class", "axis-title xt").attr("x", iw / 2).attr("y", ih + 44).attr("text-anchor", "middle")
        .text(iw < 480 ? "Connexions (quintiles)" : "Connexions à l'application (quintiles, 20 % des clients chacun)");

      // Nuage de l'échantillon, dispersé horizontalement dans chaque colonne
      const ech = App.echantillon.filter(App.match(st));
      const jit = (i) => ((((i * 9301 + 49297) % 233280) / 233280) - 0.5);
      App.layer(plot, "cloud").selectAll("circle").data(ech, (d) => d.i)
        .join((e) => e.append("circle").attr("r", 1.7))
        .attr("cx", (d) => cx(d.lq) + jit(d.i) * x.bandwidth() * 0.95)
        .attr("cy", (d) => y(d.spend)).attr("fill", colors.axis).attr("fill-opacity", 0.55);

      const ok = groupes.filter((g) => g.n > 0);
      const gB = App.layer(plot, "boxes").selectAll("g.box").data(ok, (d) => d.q)
        .join((e) => {
          const g = e.append("g").attr("class", "box");
          g.append("line").attr("class", "wh");
          g.append("line").attr("class", "cap-lo");
          g.append("line").attr("class", "cap-hi");
          g.append("rect").attr("class", "iqr");
          g.append("line").attr("class", "med");
          return g;
        });
      ctx.tr(gB.select("line.wh")).attr("x1", (d) => cx(d.q)).attr("x2", (d) => cx(d.q)).attr("y1", (d) => y(d.lo)).attr("y2", (d) => y(d.hi));
      gB.select("line.wh").attr("stroke", colors.ink2).attr("stroke-width", 1.5);
      [["cap-lo", "lo"], ["cap-hi", "hi"]].forEach(([cls, k]) => {
        gB.select(`line.${cls}`).attr("stroke", colors.ink2).attr("stroke-width", 1.5);
        ctx.tr(gB.select(`line.${cls}`)).attr("x1", (d) => cx(d.q) - bw / 5).attr("x2", (d) => cx(d.q) + bw / 5).attr("y1", (d) => y(d[k])).attr("y2", (d) => y(d[k]));
      });
      gB.select("rect.iqr").attr("fill", colors.mesure).attr("fill-opacity", 0.16).attr("stroke", colors.mesure).attr("stroke-width", 1.5).attr("rx", 4);
      ctx.tr(gB.select("rect.iqr")).attr("x", (d) => cx(d.q) - bw / 2).attr("width", bw).attr("y", (d) => y(d.q3)).attr("height", (d) => Math.max(1, y(d.q1) - y(d.q3)));
      gB.select("line.med").attr("stroke", colors.ink).attr("stroke-width", 2.5).attr("stroke-linecap", "round");
      ctx.tr(gB.select("line.med")).attr("x1", (d) => cx(d.q) - bw / 2 + 2).attr("x2", (d) => cx(d.q) + bw / 2 - 2).attr("y1", (d) => y(d.med)).attr("y2", (d) => y(d.med));

      App.layer(plot, "med-labels").selectAll("text").data(ok, (d) => d.q).join("text").attr("class", "val-label halo")
        .attr("text-anchor", "middle").attr("x", (d) => cx(d.q))
        .call((s) => ctx.tr(s).attr("y", (d) => y(d.hi) - 10))
        .text((d) => fmt.k(d.med));

      // Rapport entre le dernier et le premier quintile
      const a = groupes[0], b = groupes[NQ - 1];
      const rapport = a.n && b.n ? b.med / a.med : null;
      App.layer(plot, "annot").selectAll("text").data(rapport ? [rapport] : []).join("text")
        .attr("class", "val-label").attr("x", 0).attr("y", -14)
        .text((r) => `Médiane ×${fmt.dec1(r)} entre le premier et le dernier quintile`);

      const hits = App.layer(plot, "hits").selectAll("rect").data(ok, (d) => d.q).join("rect").attr("class", "hit")
        .attr("x", (d) => x(d.q)).attr("width", x.bandwidth()).attr("y", 0).attr("height", ih);
      App.hover(hits, (d) => ({
        title: labQ(d.q), sub: `${fmt.int(d.n)} clients`,
        rows: [
          { label: "Médiane", value: fmt.int(d.med) },
          { label: "1er – 3e quartile", value: `${fmt.k(d.q1)} – ${fmt.k(d.q3)}` },
          { label: "Moyenne", value: fmt.int(d.mean) },
          { label: "Moustaches", value: `${fmt.k(d.lo)} – ${fmt.k(d.hi)}` },
        ],
      }));
      App.empty(ctx, ok.length === 0, "Aucun client ne correspond à ces filtres.");

      App.table("t-a", [
        { label: "Connexions", value: (d) => CONNEXIONS[d.q] },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "1er quartile", value: (d) => d.q1, format: fmt.int },
        { label: "Médiane", value: (d) => d.med, format: fmt.int },
        { label: "3e quartile", value: (d) => d.q3, format: fmt.int },
        { label: "Moyenne", value: (d) => d.mean, format: fmt.int },
      ], ok);
    },
  });

  /* ---------- B1. Composition par carte des quintiles ---------- */
  const chartB1 = App.chart("#chart-b1", {
    label: "Barres empilées à 100 % : part de chaque type de carte dans chaque quintile de connexions.",
    height: NQ * 42 + 32,
    margin: { t: 4, r: 20, b: 28, l: 78 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const t = d3.range(NQ).map(() => new Array(CARTES.length).fill(0));
      for (const r of rows) t[r.lq][r.card]++;
      const data = t.map((counts, q) => ({ q, counts, total: d3.sum(counts) }));
      const y = d3.scaleBand(d3.range(NQ), [0, ih]).padding(0.38);
      const x = d3.scaleLinear([0, 1], [0, iw]);
      const bh = Math.min(22, y.bandwidth());
      const segs = [];
      data.forEach((d) => {
        const premier = d.counts.findIndex((v) => v > 0);
        const dernier = d.counts.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
        let cum = 0;
        d.counts.forEach((v, c) => {
          const p = d.total ? v / d.total : 0;
          const gL = p > 0 && c !== premier ? 1 : 0, gR = p > 0 && c !== dernier ? 1 : 0;
          segs.push({ q: d.q, c, px: x(cum) + gL, pw: Math.max(0, x(cum + p) - x(cum) - gL - gR), dernier: c === dernier });
          cum += p;
        });
      });
      const barres = App.layer(plot, "bars").selectAll("path").data(segs, (d) => `${d.q}-${d.c}`)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(0, y(d.q), 0, bh, 0)))
        .attr("fill", (d) => colors.cards[d.c])
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(d.px, y(d.q) + (y.bandwidth() - bh) / 2, d.pw, bh, d.dernier ? 3 : 0)));
      // Carte en évidence : sa part est écrite dans chaque quintile
      maj.composition = () => {
        App.attenuer(barres, "card", (d) => d.c);
        const fc = enEvidence();
        App.layer(plot, "focus-labels").selectAll("text")
          .data(fc == null ? [] : segs.filter((d) => d.c === fc && d.pw > 34), (d) => d.q)
          .join("text").attr("class", "focus-label").attr("text-anchor", "middle").attr("dy", "0.35em")
          .attr("x", (d) => d.px + d.pw / 2).attr("y", (d) => y(d.q) + y.bandwidth() / 2)
          .style("fill", (d) => App.inkOn(colors.cards[d.c]))
          .text((d) => fmt.pct0(data[d.q].total ? data[d.q].counts[d.c] / data[d.q].total : 0));
      };
      maj.composition();
      App.layer(plot, "names").selectAll("text").data(data).join("text").attr("x", -10).attr("text-anchor", "end").attr("dy", "0.35em")
        .style("font-size", "13px").style("fill", "var(--ink-2)").attr("y", (d) => y(d.q) + y.bandwidth() / 2).text((d) => CONNEXIONS[d.q]);
      App.layer(plot, "axis ax no-domain").attr("transform", `translate(0,${ih + 2})`).call(d3.axisBottom(x).ticks(4).tickFormat(fmt.pct0).tickSize(0).tickPadding(8));
      const hits = App.layer(plot, "hits").selectAll("rect").data(data).join("rect").attr("class", "hit")
        .attr("x", -ctx.m.l).attr("width", iw + ctx.m.l).attr("y", (d) => y(d.q) - 6).attr("height", y.bandwidth() + 12);
      App.hover(hits, (d) => ({
        title: labQ(d.q), sub: `${fmt.int(d.total)} clients`,
        rows: CARTES.map((c, i) => ({ label: c, value: d.total ? fmt.pct1(d.counts[i] / d.total) : "–", color: colors.cards[i] })),
      }));
      App.table("t-b", [
        { label: "Connexions", value: (d) => CONNEXIONS[d.q] },
        { label: "Clients", value: (d) => d.total, format: fmt.int },
        ...CARTES.map((c, i) => ({ label: c, value: (d) => (d.total ? d.counts[i] / d.total : 0), format: fmt.pct1 })),
      ], data, { note: "Composition par carte de chaque quintile de connexions." });
    },
  });

  /* ---------- B2. Dépense médiane selon les connexions, par carte ---------- */
  const PAS = 5;
  const chartB2 = App.chart("#chart-b2", {
    label: "Courbes : dépense mensuelle médiane selon le nombre de connexions, une courbe par type de carte, échelle logarithmique.",
    height: (w) => Math.max(280, Math.min(340, w * 0.7)),
    margin: { t: 10, r: 84, b: 40, l: 52 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const series = CARTES.map((nom, c) => {
        const parBin = d3.rollup(rows.filter((r) => r.card === c), (v) => ({ med: d3.median(v, (r) => r.spend), n: v.length }), (r) => Math.floor(r.login / PAS));
        const pts = [...parBin].filter(([, s]) => s.n >= 30).map(([b, s]) => ({ b, x: b * PAS + PAS / 2, ...s })).sort((a, b) => a.b - b.b);
        return { c, nom, pts };
      }).filter((s) => s.pts.length > 0);
      const x = d3.scaleLinear([0, 72], [0, iw]);
      const y = d3.scaleLog([5e3, 5e5], [ih, 0]);
      const ty = [5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5];
      App.layer(plot, "grid gy").call(d3.axisLeft(y).tickValues(ty).tickSize(-iw).tickFormat(""));
      App.layer(plot, "axis ay no-domain").call(d3.axisLeft(y).tickValues(ty).tickFormat(fmt.k).tickSize(0).tickPadding(8));
      App.layer(plot, "axis ax").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(6).tickSizeOuter(0));
      App.layer(plot, "axis-title xt", "text").attr("class", "axis-title xt").attr("x", iw).attr("y", ih + 34).attr("text-anchor", "end").text("Connexions à l'application");
      const ligne = d3.line().x((d) => x(d.x)).y((d) => y(d.med)).curve(d3.curveMonotoneX);
      const courbes = App.layer(plot, "lines").selectAll("path").data(series, (d) => d.c).join("path")
        .attr("fill", "none").attr("stroke", (d) => colors.cards[d.c]).attr("stroke-width", 2.2).attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
      ctx.tr(courbes).attr("d", (d) => ligne(d.pts));
      // Points d'extrémité avec anneau de la couleur du fond
      const fins = series.map((s) => ({ c: s.c, nom: s.nom, ...s.pts[s.pts.length - 1] }));
      const bouts = App.layer(plot, "ends").selectAll("circle").data(fins, (d) => d.c).join("circle").attr("r", 4)
        .attr("fill", (d) => colors.cards[d.c]).attr("stroke", colors.page).attr("stroke-width", 2)
        .call((s) => ctx.tr(s).attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.med)));
      // Étiquettes en bout de ligne, écartées si elles se chevauchent, avec trait de rappel
      const lab = fins.map((d) => ({ ...d, y0: y(d.med), yl: y(d.med) })).sort((a, b) => a.y0 - b.y0);
      for (let k = 1; k < lab.length; k++) if (lab[k].yl - lab[k - 1].yl < 15) lab[k].yl = lab[k - 1].yl + 15;
      for (let k = lab.length - 2; k >= 0; k--) if (lab[k + 1].yl > ih) { lab[k + 1].yl = ih; if (lab[k + 1].yl - lab[k].yl < 15) lab[k].yl = lab[k + 1].yl - 15; }
      const xl = iw + 14;
      const traits = App.layer(plot, "leaders").selectAll("path").data(lab, (d) => d.c).join("path").attr("class", "leader")
        .attr("fill", "none").attr("stroke", colors.axis).attr("stroke-width", 1)
        .attr("d", (d) => `M${x(d.x) + 6},${d.y0}L${xl - 4},${d.yl}`);
      const noms = App.layer(plot, "end-labels").selectAll("text").data(lab, (d) => d.c).join("text").attr("class", "val-label end-label")
        .attr("x", xl).attr("y", (d) => d.yl).attr("dy", "0.35em").text((d) => d.nom);
      // Le nom d'une courbe (au survol, au clavier ou au clic) l'isole des quatre autres
      const resumeCourbe = (s) => {
        const a = s.pts[0], b = s.pts[s.pts.length - 1];
        return {
          title: `Carte ${s.nom}`, sub: "Dépense mensuelle médiane",
          rows: [
            { label: `${a.b * PAS}–${a.b * PAS + PAS - 1} connexions`, value: fmt.int(a.med), color: colors.cards[s.c] },
            { label: `${b.b * PAS}–${b.b * PAS + PAS - 1} connexions`, value: fmt.int(b.med), color: colors.cards[s.c] },
            { label: "Rapport", value: `×${fmt.dec1(b.med / a.med)}`, color: "transparent" },
          ],
          note: noteClic(s.c),
        };
      };
      App.hover(noms, (d) => resumeCourbe(series.find((s) => s.c === d.c)), relier((d) => d.c));
      maj.courbes = () => {
        const fc = enEvidence();
        courbes.attr("stroke-opacity", (d) => (fc == null || d.c === fc ? 1 : 0.15))
          .attr("stroke-width", (d) => (fc != null && d.c === fc ? 3.4 : 2.2));
        if (fc != null) courbes.filter((d) => d.c === fc).raise();
        [bouts, traits, noms].forEach((sel) => App.attenuer(sel, "card", (d) => d.c));
      };
      maj.courbes();

      // Réticule : lit toutes les cartes à la tranche survolée
      const cross = App.layer(plot, "crosshair", "line").attr("class", "crosshair").attr("y1", 0).attr("y2", ih).attr("opacity", 0);
      App.layer(plot, "hit-zone", "rect").attr("class", "hit-zone hit").attr("width", iw).attr("height", ih)
        .on("pointermove", (ev) => {
          const [mx, my] = d3.pointer(ev);
          const b = Math.max(0, Math.min(14, Math.floor(x.invert(mx) / PAS)));
          const lignes = series.map((s) => ({ s, p: s.pts.find((p) => p.b === b) })).filter((o) => o.p);
          if (!lignes.length) { cross.attr("opacity", 0); App.tip.hide(); App.surlignage.survoler("card", null); return; }
          // La courbe la plus proche du pointeur (16 px au plus) est mise en évidence
          const proche = d3.least(lignes, (o) => Math.abs(y(o.p.med) - my));
          App.surlignage.survoler("card", proche && Math.abs(y(proche.p.med) - my) <= 16 ? proche.s.c : null);
          cross.attr("opacity", 1).attr("x1", x(b * PAS + PAS / 2)).attr("x2", x(b * PAS + PAS / 2));
          App.tip.show(ev, {
            title: `${b * PAS}–${b * PAS + PAS - 1} connexions`, sub: "Dépense mensuelle médiane",
            rows: lignes.slice().reverse().map((o) => ({ label: `${o.s.nom} (${fmt.int(o.p.n)})`, value: fmt.int(o.p.med), color: colors.cards[o.s.c] })),
            note: App.surlignage.valeur("card") != null ? noteClic(App.surlignage.valeur("card")) : null,
          });
        })
        .on("click", () => {
          const v = App.surlignage.valeur("card");
          if (v != null) App.surlignage.basculer("card", v); else App.surlignage.effacer("card");
        })
        .on("pointerleave", () => { cross.attr("opacity", 0); App.tip.hide(); App.surlignage.survoler("card", null); });
      App.empty(ctx, series.length === 0, "Pas assez de clients pour tracer les courbes.");
      const tranches = [...new Set(series.flatMap((sr) => sr.pts.map((p) => p.b)))].sort((a, b) => a - b);
      App.table("t-b2", [
        { label: "Connexions", value: (b) => `${b * PAS}–${b * PAS + PAS - 1}` },
        ...series.map((sr) => ({
          label: sr.nom,
          value: (b) => { const p = sr.pts.find((q) => q.b === b); return p ? fmt.int(p.med) : "–"; },
        })),
      ], tranches, { note: "Dépense mensuelle médiane ; « – » : moins de 30 clients dans la tranche." });
    },
  });

  /* ---------- C. Points de fidélité ---------- */
  const cellules = () => App.cube.filter(App.match(st));
  function agreger(cells) {
    const o = { n: 0, spend: 0, earn: 0, red: 0, red0: 0 };
    for (const c of cells) { o.n += c.n; o.spend += c.spend; o.earn += c.earn; o.red += c.red; o.red0 += c.red0; }
    return o;
  }

  const chartC1 = App.chart("#chart-c1", {
    label: "Gaufrier de 100 cases : sur 100 points de fidélité gagnés, combien ont été utilisés.",
    height: (w) => Math.min(w, 300) + 4,
    margin: { t: 2, r: 2, b: 2, l: 2 },
    draw(ctx) {
      const { plot, iw, colors } = ctx;
      const a = agreger(cellules());
      const taux = a.earn ? a.red / a.earn : 0;
      const utilises = Math.round(taux * 100);
      const cote = Math.min(iw, 300) / 10;
      const cases = d3.range(100).map((k) => ({ k, utilise: k < utilises }));
      App.layer(plot, "cells").selectAll("rect").data(cases).join("rect")
        .attr("x", (d) => (d.k % 10) * cote + 1.5).attr("y", (d) => Math.floor(d.k / 10) * cote + 1.5)
        .attr("width", cote - 3).attr("height", cote - 3).attr("rx", 3)
        .attr("fill", (d) => (d.utilise ? colors.mesure : colors.axis))
        .attr("fill-opacity", (d) => (d.utilise ? 1 : 0.55));
      document.getElementById("waffle-sub").textContent =
        a.earn ? `${utilises} ont été utilisés, ${100 - utilises} dorment.` : "Aucun point pour cette sélection.";
      const kp = document.getElementById("kpis-c");
      kp.replaceChildren();
      [
        ["Points jamais utilisés", fmt.k(a.earn - a.red), `sur ${fmt.k(a.earn)} gagnés`],
        ["Clients sans aucun point utilisé", a.n ? fmt.pct1(a.red0 / a.n) : "–", `${fmt.int(a.red0)} clients`],
      ].forEach(([l, v, nt]) => {
        const k = document.createElement("div");
        k.className = "kpi";
        k.innerHTML = '<div class="label"></div><div class="value"></div><div class="note"></div>';
        k.querySelector(".label").textContent = l;
        k.querySelector(".value").textContent = v;
        k.querySelector(".note").textContent = nt;
        kp.append(k);
      });
    },
  });

  const chartC2 = App.chart("#chart-c2", {
    label: "Deux séries de barres par carte : points gagnés pour 1 000 dépensés, et part des points utilisés.",
    height: (w) => (w < 520 ? 2 * (CARTES.length * 30 + 30) + 16 : CARTES.length * 36 + 40),
    margin: { t: 22, r: 12, b: 6, l: 74 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const cells = cellules();
      const data = CARTES.map((nom, i) => {
        const a = agreger(cells.filter((c) => c.card === i));
        return { i, nom, n: a.n, gain: a.spend ? (a.earn / a.spend) * 1000 : 0, taux: a.earn ? a.red / a.earn : 0 };
      }).filter((d) => d.n > 0);
      // Deux panneaux côte à côte (large) ou l'un sous l'autre (étroit)
      const empile = ctx.w < 520;
      const gap = 28;
      const pw = empile ? iw : (iw - gap) / 2;
      const ph = empile ? (ih - 16 - 22) / 2 : ih;
      const panneaux = [
        { k: 0, titre: "Points pour 1 000 dépensés", dx: 0, dy: 0 },
        { k: 1, titre: "Part des points utilisés", dx: empile ? 0 : pw + gap, dy: empile ? ph + 16 + 22 : 0 },
      ];
      const y = d3.scaleBand(data.map((d) => d.i), [0, ph]).padding(0.38);
      const bh = Math.min(16, y.bandwidth());
      const yc = (d) => y(d.i) + y.bandwidth() / 2;
      const x1 = d3.scaleLinear([0, 90], [0, pw - 34]);
      const x2 = d3.scaleLinear([0, 1], [0, pw - 40]);
      const g = App.layer(plot, "panels").selectAll("g.pan").data(panneaux).join("g").attr("class", "pan")
        .attr("transform", (p) => `translate(${p.dx},${p.dy})`);
      g.selectAll("text.head").data((p) => [p]).join("text").attr("class", "head axis-title").attr("x", (p) => (empile ? -ctx.m.l + 4 : p.k ? 0 : 0)).attr("y", -8).text((p) => p.titre);
      g.selectAll("text.name").data((p) => (empile || p.k === 0 ? data.map((d) => ({ ...d, p })) : []), (d) => d.i).join("text").attr("class", "name")
        .attr("x", -10).attr("text-anchor", "end").attr("dy", "0.35em").style("font-size", "13px").style("fill", "var(--ink-2)")
        .attr("y", yc).text((d) => d.nom);
      g.selectAll("rect.track").data((p) => (p.k === 1 ? data : []), (d) => d.i).join("rect").attr("class", "track")
        .attr("x", 0).attr("y", (d) => yc(d) - bh / 2).attr("width", x2(1)).attr("height", bh).attr("rx", 3).attr("fill", colors.plane);
      g.selectAll("path.bar").data((p) => data.map((d) => ({ ...d, p })), (d) => d.i).join((e) => e.append("path").attr("class", "bar").attr("d", (d) => App.barPath(0, yc(d) - bh / 2, 0, bh, 0)))
        .attr("fill", (d) => colors.cards[d.i])
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(0, yc(d) - bh / 2, d.p.k === 0 ? x1(d.gain) : x2(d.taux), bh, 3)));
      g.selectAll("text.val").data((p) => data.map((d) => ({ ...d, p })), (d) => d.i).join("text").attr("class", "val val-label").attr("dy", "0.35em").attr("y", yc)
        .call((s) => ctx.tr(s).attr("x", (d) => (d.p.k === 0 ? x1(d.gain) + 6 : x2(1) + 6)))
        .text((d) => (d.p.k === 0 ? fmt.int(d.gain) : fmt.pct0(d.taux)));
      // Survol d'une carte dans l'un des deux panneaux : ses deux barres ressortent
      const zones = g.selectAll("rect.hit").data((p) => data.map((d) => ({ ...d, p })), (d) => d.i).join("rect").attr("class", "hit")
        .attr("x", (d) => (empile || d.p.k === 0 ? -ctx.m.l + 4 : -6)).attr("width", (d) => (empile || d.p.k === 0 ? pw + ctx.m.l - 4 : pw + 6))
        .attr("y", (d) => y(d.i) - 3).attr("height", y.bandwidth() + 6);
      App.hover(zones, (d) => ({
        title: `Carte ${d.nom}`, sub: `${fmt.int(d.n)} clients`,
        rows: [
          { label: "Points pour 1 000 dépensés", value: fmt.int(d.gain), color: colors.cards[d.i] },
          { label: "Part des points utilisés", value: fmt.pct1(d.taux), color: "transparent" },
        ],
        note: noteClic(d.i),
      }), { focus: false, ...relier((d) => d.i) });
      maj.points = () => ["path.bar", "text.val", "text.name"].forEach((s) => App.attenuer(g.selectAll(s), "card", (d) => d.i));
      maj.points();
      App.table("t-c", [
        { label: "Carte", value: (d) => d.nom },
        { label: "Clients", value: (d) => d.n, format: fmt.int },
        { label: "Points pour 1 000 dépensés", value: (d) => d.gain, format: fmt.dec1 },
        { label: "Part des points utilisés", value: (d) => d.taux, format: fmt.pct1 },
      ], data);
    },
  });

  const chartC3 = App.chart("#chart-c3", {
    label: "Barres : part des points utilisés par quintile de connexions.",
    height: NQ * 30 + 10,
    margin: { t: 4, r: 52, b: 6, l: 74 },
    draw(ctx) {
      const { plot, iw, ih, colors } = ctx;
      const cells = cellules();
      const data = d3.range(NQ).map((q) => {
        const a = agreger(cells.filter((c) => c.lq === q));
        return { q, n: a.n, taux: a.earn ? a.red / a.earn : 0 };
      }).filter((d) => d.n > 0);
      const y = d3.scaleBand(data.map((d) => d.q), [0, ih]).padding(0.38);
      const bh = Math.min(14, y.bandwidth());
      const x = d3.scaleLinear([0, 1], [0, iw]);
      const yc = (d) => y(d.q) + y.bandwidth() / 2;
      App.layer(plot, "track").selectAll("rect").data(data, (d) => d.q).join("rect")
        .attr("x", 0).attr("y", (d) => yc(d) - bh / 2).attr("width", x(1)).attr("height", bh).attr("rx", 3).attr("fill", colors.plane);
      App.layer(plot, "bars").selectAll("path").data(data, (d) => d.q)
        .join((e) => e.append("path").attr("d", (d) => App.barPath(0, yc(d) - bh / 2, 0, bh, 0)))
        .attr("fill", colors.mesure)
        .call((s) => ctx.tr(s).attr("d", (d) => App.barPath(0, yc(d) - bh / 2, x(d.taux), bh, 3)));
      App.layer(plot, "names").selectAll("text").data(data, (d) => d.q).join("text").attr("x", -10).attr("text-anchor", "end").attr("dy", "0.35em")
        .style("font-size", "13px").style("fill", "var(--ink-2)").attr("y", yc).text((d) => CONNEXIONS[d.q]);
      App.layer(plot, "vals").selectAll("text").data(data, (d) => d.q).join("text").attr("class", "val-label").attr("dy", "0.35em")
        .attr("y", yc).attr("x", x(1) + 6).text((d) => fmt.pct0(d.taux));
      const zones = App.layer(plot, "hits").selectAll("rect").data(data, (d) => d.q).join("rect").attr("class", "hit")
        .attr("x", -ctx.m.l).attr("width", iw + ctx.m.l + ctx.m.r).attr("y", (d) => y(d.q) - 3).attr("height", y.bandwidth() + 6);
      App.hover(zones, (d) => ({
        title: labQ(d.q), sub: `${fmt.int(d.n)} clients`,
        rows: [{ label: "Part des points utilisés", value: fmt.pct1(d.taux), color: colors.mesure }],
      }), { focus: false });
    },
  });

  function majTout() {
    filtrer();
    filtres.count(rows.length);
    chartA.update(); chartB1.update(); chartB2.update(); chartC1.update(); chartC2.update(); chartC3.update();
  }
  filtres.count(rows.length);
})();
