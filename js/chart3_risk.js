function initChart3(data) {
  const container = d3.select("#chart-risk");
  container.html("");

  // Échantillonnage de 1500 points pour éviter de surcharger le DOM
  const sampleData = d3.shuffle([...data]).slice(0, 1500);

  const margin = { top: 30, right: 30, bottom: 60, left: 60 };
  const width = 500 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Échelles
  const x = d3.scaleLinear()
    .domain([0, d3.max(sampleData, d => d.Payment_Ratio) || 1])
    .nice()
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(sampleData, d => d.Credit_Utilization) || 1])
    .nice()
    .range([height, 0]);

  const r = d3.scaleSqrt()
    .domain([0, d3.max(sampleData, d => d.Outstanding_Balance) || 1])
    .range([2, 8]);

  // Échelle de couleur du vert (bon score) au rouge (mauvais score)
  const color = d3.scaleSequential()
    .domain([850, 300]) // Inversé pour que vert = score élevé
    .interpolator(d3.interpolateRdYlGn);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .append("text")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("fill", "#334155")
    .style("font-weight", "bold")
    .text("Ratio de remboursement (Payment Ratio)");

  svg.append("g")
    .call(d3.axisLeft(y))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#334155")
    .style("font-weight", "bold")
    .text("Utilisation Crédit (Credit Utilization)");

  // Tooltip
  let tooltip = d3.select("body").select(".chart-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(15, 23, 42, 0.9)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");
  }

  // Nuage de points
  svg.selectAll("circle")
    .data(sampleData)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.Payment_Ratio))
    .attr("cy", d => y(d.Credit_Utilization))
    .attr("r", d => r(d.Outstanding_Balance))
    .style("fill", d => color(d.Credit_Score))
    .style("opacity", 0.6)
    .style("stroke", "#fff")
    .style("stroke-width", "0.5px")
    .on("mouseover", function (event, d) {
      d3.select(this).style("opacity", 1).style("stroke", "#000").style("stroke-width", "1.5px");
      tooltip.style("visibility", "visible")
        .html(`
          <strong>ID Client :</strong> ${d.Customer_ID}<br/>
          <strong>Score Crédit :</strong> ${d.Credit_Score}<br/>
          <strong>Utilisation Crédit :</strong> ${(d.Credit_Utilization * 100).toFixed(1)}%<br/>
          <strong>Solde restant :</strong> ${d3.format(",.0f")(d.Outstanding_Balance)} $
        `);
    })
    .on("mousemove", function (event) {
      tooltip.style("top", (event.pageY - 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).style("opacity", 0.6).style("stroke", "#fff").style("stroke-width", "0.5px");
      tooltip.style("visibility", "hidden");
    });
}