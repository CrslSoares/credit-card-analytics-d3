function initChart3(data) {
  const container = d3.select("#chart-risk");
  container.html(""); // Nettoyage de la div principale

  // 1. Dimensions du SVG
  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const width = 850 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  // 2. Nettoyage des données
  const processedData = data.map(d => {
    const monthlySpending = +d.Monthly_Spending || 0;
    const paymentRatio = +d.Payment_Ratio || 0;
    const creditLimit = +d.Credit_Limit || 0;
    const creditUtilization = +d.Credit_Utilization || 0;
    const creditScore = +d.Credit_Score || 300;

    const totalDebt = creditLimit * (creditUtilization / 100);

    return {
      ...d,
      MonthlySpending: monthlySpending,
      PaymentRatio: paymentRatio,
      CreditUtilization: creditUtilization,
      TotalDebt: totalDebt,
      CreditScore: creditScore
    };
  });

  const sampledData = processedData.length > 3000 ? processedData.slice(0, 3000) : processedData;

  const minScore = d3.min(sampledData, d => d.CreditScore) || 300;
  const maxScore = d3.max(sampledData, d => d.CreditScore) || 850;

  // 3. Création automatique du conteneur de filtre
  let filterContainer = d3.select("#filter-container-3");
  if (filterContainer.empty()) {
    filterContainer = container.append("div").attr("id", "filter-container-3");
  } else {
    filterContainer.html("");
  }

  const filterWrapper = filterContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "12px")
    .style("margin-bottom", "15px")
    .style("font-family", "sans-serif");

  filterWrapper.append("label")
    .style("font-weight", "bold")
    .style("font-size", "13px")
    .attr("for", "score-slider")
    .text("Score max :");

  const slider = filterWrapper.append("input")
    .attr("type", "range")
    .attr("id", "score-slider")
    .attr("min", minScore)
    .attr("max", maxScore)
    .attr("value", maxScore) // Initialisé au maximum pour TOUT afficher au départ
    .style("cursor", "pointer")
    .style("width", "180px");

  const sliderValueLabel = filterWrapper.append("span")
    .style("font-weight", "bold")
    .style("font-size", "13px")
    .style("color", "#2563eb")
    .text(`≤ ${maxScore}`);

  const riskCounter = filterWrapper.append("span")
    .style("font-size", "12px")
    .style("color", "#dc2626")
    .style("margin-left", "auto")
    .style("font-weight", "bold");

  // 4. Échelles (Scales)
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(sampledData, d => d.MonthlySpending) * 1.05])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(sampledData, d => d.PaymentRatio) * 1.05])
    .range([height, 0]);

  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(sampledData, d => d.TotalDebt)])
    .range([3, 18]);

  const colorScale = d3.scaleSequential()
    .domain([minScore, maxScore])
    .interpolator(d3.interpolateRdYlGn);

  // 5. Canvas SVG
  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(8).tickFormat(d => `$${d3.format(",.0f")(d)}`);
  const yAxis = d3.axisLeft(yScale).ticks(8).tickFormat(d => `${d3.format(".0%")(d)}`);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .append("text")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("fill", "#0f172a")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("text-anchor", "middle")
    .text("Dépense Mensuelle Totale (Monthly Spending)");

  svg.append("g")
    .call(yAxis)
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45)
    .attr("x", -height / 2)
    .attr("fill", "#0f172a")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("text-anchor", "middle")
    .text("Ratio de Remboursement (Payment Ratio)");

  // Zone à Risque
  const riskYCutoff = yScale(0.3);

  svg.append("rect")
    .attr("x", 0)
    .attr("y", riskYCutoff)
    .attr("width", width)
    .attr("height", height - riskYCutoff)
    .attr("fill", "#ef4444")
    .attr("opacity", 0.08)
    .attr("pointer-events", "none");

  svg.append("text")
    .attr("x", 10)
    .attr("y", height - 10)
    .style("fill", "#dc2626")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text("⚠️️ Zone de Vulnérabilité Financière (Paiement ≤ 30%)");

  // Tooltip
  let tooltip = d3.select("body").select(".chart-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(15, 23, 42, 0.95)")
      .style("color", "#fff")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");
  }

  const pointsGroup = svg.append("g").attr("class", "points-group");

  // 6. Fonction de mise à jour (FILTRE SCORE MAXIMAL)
  function updateChart(maxAllowedScore) {
    sliderValueLabel.text(`≤ ${maxAllowedScore}`);

    // LOGIQUE SCORE MAX : Garder les clients avec un score <= à la valeur du slider
    const filtered = sampledData.filter(d => d.CreditScore <= maxAllowedScore);

    // Détection automatique du format de CreditUtilization (décimal ou %)
    const inRiskZone = filtered.filter(d => {
      return d.PaymentRatio <= 0.3;
    });

    riskCounter.text(`Clients vulnérables identifiés : ${inRiskZone.length}`);

    const circles = pointsGroup.selectAll("circle.risk-point")
      .data(filtered, d => d.Customer_ID || (d.MonthlySpending + "-" + d.CreditScore + "-" + d.TotalDebt));

    // Suppression des points hors filtre
    circles.exit()
      .transition()
      .duration(150)
      .attr("r", 0)
      .attr("opacity", 0)
      .remove();

    // Nouveaux points + mise à jour
    const enterCircles = circles.enter()
      .append("circle")
      .attr("class", "risk-point")
      .attr("cx", d => xScale(d.MonthlySpending))
      .attr("cy", d => yScale(d.PaymentRatio))
      .attr("r", 0)
      .attr("fill", d => colorScale(d.CreditScore))
      .attr("opacity", 0)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer");

    enterCircles.merge(circles)
      .on("mouseover", function (event, d) {
        d3.select(this)
          .attr("opacity", 1)
          .attr("stroke", "#0f172a")
          .attr("stroke-width", 2);

        tooltip.style("visibility", "visible")
          .html(`
            <strong>Client ID :</strong> ${d.Customer_ID || 'N/A'}<br/>
            <strong>Score de Crédit :</strong> <span style="color:${colorScale(d.CreditScore)}; font-weight:bold;">${d.CreditScore}</span><br/>
            <strong>Dépense Mensuelle :</strong> $${d3.format(",.2f")(d.MonthlySpending)}<br/>
            <strong>Ratio Remboursement :</strong> ${d3.format(".1%")(d.PaymentRatio)}<br/>
            <strong>Dette Engagée (Bulle) :</strong> $${d3.format(",.2f")(d.TotalDebt)}<br/>
            <strong>Avance en Cash :</strong> $${d3.format(",.2f")(+d.Cash_Advance_Amount || 0)}
          `);
      })
      .on("mousemove", function (event) {
        tooltip.style("top", (event.pageY - 10) + "px")
               .style("left", (event.pageX + 10) + "px");
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("opacity", 0.65)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 0.5);
        tooltip.style("visibility", "hidden");
      })
      .transition()
      .duration(200)
      .attr("r", d => radiusScale(d.TotalDebt))
      .attr("opacity", 0.65);
  }

  // Initialisation avec le score MAX (affiche tous les points au départ)
  updateChart(maxScore);

  // Événement du slider
  slider.on("input", function () {
    updateChart(+this.value);
  });
}