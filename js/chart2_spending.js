function initChart2(data) {
  const container = d3.select("#chart-spending");
  const filterContainer = d3.select("#filter-container-2");

  container.html("");
  filterContainer.html("");

  // Contrôle interactif
  filterContainer.append("label")
    .text("Afficher par : ")
    .style("font-weight", "bold")
    .style("margin-right", "8px");

  const select = filterContainer.append("select")
    .attr("id", "spending-metric-select");

  select.selectAll("option")
    .data([
      { label: "Montant total dépense ($)", value: "amount" },
      { label: "Part des transactions (estimée)", value: "count" }
    ])
    .enter()
    .append("option")
    .attr("value", d => d.value)
    .text(d => d.label);

  const spendingCategories = [
    { key: "Online_Shopping_Spending", label: "Achats en ligne" },
    { key: "Grocery_Spending", label: "Courses / Alimentation" },
    { key: "Fuel_Spending", label: "Carburant" },
    { key: "Dining_Spending", label: "Restauration" },
    { key: "Travel_Spending", label: "Voyages" },
    { key: "Entertainment_Spending", label: "Divertissement" },
    { key: "Utility_Bill_Spending", label: "Factures & Services" }
  ];

  const width = 500;
  const height = 350;
  const radius = Math.min(width, height) / 2 - 20;

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const colorScale = d3.scaleOrdinal()
    .domain(spendingCategories.map(d => d.label))
    .range(d3.schemeCategory10);

  function updateChart(metric) {
    svg.selectAll("*").remove();

    const categoryTotals = spendingCategories.map(cat => {
      const totalAmount = d3.sum(data, d => d[cat.key] || 0);
      const avgTx = d3.mean(data, d => d.Monthly_Transactions || 1);
      const value = metric === "amount" ? totalAmount : Math.round(totalAmount / (avgTx * 10));
      return { name: cat.label, value: value };
    });

    const totalValue = d3.sum(categoryTotals, d => d.value);

    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(radius * 0.5)
      .outerRadius(radius);

    const arcsData = pie(categoryTotals);

    const path = svg.selectAll("path")
      .data(arcsData)
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", d => colorScale(d.data.name))
      .attr("stroke", "#ffffff")
      .style("stroke-width", "2px")
      .style("opacity", 0.85);

    const centerText = svg.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -8)
      .style("font-size", "13px")
      .style("font-weight", "bold")
      .style("fill", "#334155")
      .text("Total Dépenses");

    const centerSubText = svg.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 16)
      .style("font-size", "12px")
      .style("fill", "#64748b")
      .text(
        metric === "amount"
          ? d3.format(",.0f")(totalValue) + " $"
          : d3.format(",.0f")(totalValue) + " tx"
      );

    path.on("mouseover", function(event, d) {
      d3.select(this).style("opacity", 1).style("stroke-width", "3px");
      const percent = ((d.data.value / totalValue) * 100).toFixed(1);
      const valFormatted = metric === "amount"
        ? d3.format(",.0f")(d.data.value) + " $"
        : d3.format(",.0f")(d.data.value) + " tx";

      centerText.text(d.data.name);
      centerSubText.text(`${valFormatted} (${percent}%)`);
    })
    .on("mouseout", function() {
      d3.select(this).style("opacity", 0.85).style("stroke-width", "2px");
      centerText.text("Total Dépenses");
      centerSubText.text(
        metric === "amount"
          ? d3.format(",.0f")(totalValue) + " $"
          : d3.format(",.0f")(totalValue) + " tx"
      );
    });
  }

  updateChart("amount");

  select.on("change", function() {
    updateChart(this.value);
  });
}