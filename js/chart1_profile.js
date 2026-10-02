function initChart1(data) {
  // 1. Seleção dos contêineres conforme os IDs do seu index.html
  const container = d3.select("#chart-profile");
  const filterContainer = d3.select("#filter-container-1");

  // Limpeza
  container.html("");
  filterContainer.html("");

  // Dimensions do SVG
  const margin = { top: 35, right: 10, bottom: 10, left: 10 };
  const width = 850 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  // 2. Cores personalizadas por tipo de cartão
  const cardColors = {
    "Basic": "#94a3b8",      // Cinza
    "Silver": "#38bdf8",     // Azul claro
    "Gold": "#f59e0b",       // Dourado
    "Platinum": "#8b5cf6",   // Roxo
    "Signature": "#d97706"   // Laranja escuro / Ambar
  };

  // 3. Legenda Superior no filtro
  const legend = filterContainer.append("div")
    .style("display", "flex")
    .style("gap", "15px")
    .style("margin-bottom", "12px")
    .style("align-items", "center")
    .style("flex-wrap", "wrap");

  legend.append("span")
    .style("font-weight", "bold")
    .style("font-size", "13px")
    .text("Tipo de Cartão mais Frequente: ");

  Object.entries(cardColors).forEach(([card, color]) => {
    const item = legend.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px");

    item.append("div")
      .style("width", "14px")
      .style("height", "14px")
      .style("background-color", color)
      .style("border-radius", "3px");

    item.append("span")
      .style("font-size", "12px")
      .text(card);
  });

  // 4. Processamento dos Dados (Occupation -> Age -> Avg Spending + Mode Card)
  const groupedData = d3.rollup(
    data,
    v => {
      const avgSpending = d3.mean(v, d => d.Monthly_Spending) || 0;
      
      // Encontrar o tipo de cartão mais comum
      const cardCounts = d3.rollup(v, c => c.length, d => d.Card_Type);
      let topCard = "Basic";
      let maxCount = -1;
      cardCounts.forEach((count, card) => {
        if (count > maxCount) {
          maxCount = count;
          topCard = card;
        }
      });

      return {
        avgSpending: avgSpending,
        topCard: topCard,
        count: v.length
      };
    },
    d => d.Occupation,
    d => d.Age
  );

  // 5. Estruturação Hierárquica para d3.hierarchy
  const hierarchyData = {
    name: "Occupations",
    children: Array.from(groupedData, ([occupation, ageMap]) => ({
      name: occupation,
      children: Array.from(ageMap, ([age, metrics]) => ({
        name: `${age} anos`,
        age: age,
        value: metrics.avgSpending,
        topCard: metrics.topCard,
        count: metrics.count
      }))
    }))
  };

  // 6. Layout do Treemap
  const root = d3.hierarchy(hierarchyData)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  d3.treemap()
    .size([width, height])
    .paddingOuter(4)
    .paddingTop(26)
    .paddingInner(2)
    .tile(d3.treemapBinary)(root);

  // 7. SVG
  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Tooltip
  let tooltip = d3.select("body").select(".treemap-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "treemap-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgba(15, 23, 42, 0.95)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("box-shadow", "0 4px 6px -1px rgba(0,0,0,0.3)")
      .style("pointer-events", "none")
      .style("z-index", "1000");
  }

  // 8. Categoria Principal (Group Occupation Header)
  const node = svg.selectAll("g.occupation-group")
    .data(root.descendants().filter(d => d.depth === 1))
    .enter()
    .append("g")
    .attr("class", "occupation-group")
    .attr("transform", d => `translate(${d.x0},${d.y0})`);

  node.append("rect")
    .attr("width", d => d.x1 - d.x0)
    .attr("height", 22)
    .attr("fill", "#1e293b")
    .attr("rx", 3);

  node.append("text")
    .attr("x", 6)
    .attr("y", 15)
    .style("fill", "#f8fafc")
    .style("font-weight", "bold")
    .style("font-size", "11px")
    .text(d => `${d.data.name} (Méd: ${d3.format(",.0f")(d.value / d.children.length)}$)`);

  // 9. Sub-blocos (Folhas por Idade)
  const leaf = svg.selectAll("g.leaf")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("class", "leaf")
    .attr("transform", d => `translate(${d.x0},${d.y0})`);

  leaf.append("rect")
    .attr("width", d => Math.max(0, d.x1 - d.x0))
    .attr("height", d => Math.max(0, d.y1 - d.y0))
    .attr("fill", d => cardColors[d.data.topCard] || "#94a3b8")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1)
    .attr("rx", 2)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      d3.select(this).attr("stroke", "#0f172a").attr("stroke-width", 2);
      tooltip.style("visibility", "visible")
        .html(`
          <strong>Profissão:</strong> ${d.parent.data.name}<br/>
          <strong>Idade:</strong> ${d.data.name}<br/>
          <strong>Gasto Médio:</strong> ${d3.format(",.2f")(d.data.value)} $<br/>
          <strong>Cartão Mais Comum:</strong> <span style="color:${cardColors[d.data.topCard]}; font-weight:bold;">${d.data.topCard}</span><br/>
          <strong>Volume:</strong> ${d.data.count} clientes
        `);
    })
    .on("mousemove", function(event) {
      tooltip.style("top", (event.pageY - 10) + "px")
             .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("stroke", "#ffffff").attr("stroke-width", 1);
      tooltip.style("visibility", "hidden");
    });

  // 10. Labels com tratamento de tamanho da caixa
  leaf.append("text")
    .attr("x", 4)
    .attr("y", 14)
    .style("fill", "#ffffff")
    .style("font-weight", "bold")
    .style("font-size", d => (d.x1 - d.x0 > 45 && d.y1 - d.y0 > 25) ? "10px" : "8px")
    .text(d => (d.x1 - d.x0 > 30 && d.y1 - d.y0 > 18) ? d.data.name : "");

  leaf.append("text")
    .attr("x", 4)
    .attr("y", 27)
    .style("fill", "#f8fafc")
    .style("font-size", "9px")
    .text(d => (d.x1 - d.x0 > 50 && d.y1 - d.y0 > 35) ? d.data.topCard : "");

  leaf.append("text")
    .attr("x", 4)
    .attr("y", 39)
    .style("fill", "#e2e8f0")
    .style("font-size", "8.5px")
    .text(d => (d.x1 - d.x0 > 55 && d.y1 - d.y0 > 48) ? `${d3.format(".2s")(d.data.value)}$` : "");
}