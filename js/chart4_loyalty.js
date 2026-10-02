function initChart4(data) {
  const container = d3.select("#chart-loyalty");
  container.html("");

  // Transformation des logins en tranches d'engagement
  const processedData = data.map(d => {
    let appUsageGroup = "< 10 logins";
    if (d.Mobile_App_Login >= 10 && d.Mobile_App_Login <= 25) {
      appUsageGroup = "10-25 logins";
    } else if (d.Mobile_App_Login > 25) {
      appUsageGroup = "> 25 logins";
    }

    const rewardRatio = d.Reward_Points_Earned > 0 
      ? d.Reward_Points_Redeemed / d.Reward_Points_Earned 
      : 0;

    return {
      group: appUsageGroup,
      spending: d.Monthly_Spending,
      rewardRatio: rewardRatio
    };
  });

  const groupKeys = ["< 10 logins", "10-25 logins", "> 25 logins"];

  const margin = { top: 30, right: 30, bottom: 60, left: 70 };
  const width = 500 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Échelle X (Groupes de fréquences d'utilisation)
  const x = d3.scaleBand()
    .domain(groupKeys)
    .range([0, width])
    .padding(0.4);

  // Échelle Y (Dépenses mensuelles)
  const y = d3.scaleLinear()
    .domain([0, d3.max(processedData, d => d.spending) || 100000])
    .nice()
    .range([height, 0]);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .append("text")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("fill", "#334155")
    .style("font-weight", "bold")
    .text("Utilisation App Mobile (Connexions/mois)");

  svg.append("g")
    .call(d3.axisLeft(y).tickFormat(d => d3.format(".2s")(d) + " $"))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -50)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#334155")
    .style("font-weight", "bold")
    .text("Dépenses Mensuelles ($)");

  // Calcul des statistiques BoxPlot pour chaque groupe (Q1, Médiane, Q3, Min, Max)
  groupKeys.forEach(groupKey => {
    const groupValues = processedData
      .filter(d => d.group === groupKey)
      .map(d => d.spending)
      .sort(d3.ascending);

    if (groupValues.length === 0) return;

    const q1 = d3.quantile(groupValues, 0.25);
    const median = d3.quantile(groupValues, 0.5);
    const q3 = d3.quantile(groupValues, 0.75);
    const interQuantileRange = q3 - q1;
    const min = Math.max(d3.min(groupValues), q1 - 1.5 * interQuantileRange);
    const max = Math.min(d3.max(groupValues), q3 + 1.5 * interQuantileRange);

    const center = x(groupKey) + x.bandwidth() / 2;
    const boxWidth = x.bandwidth();

    // Ligne verticale (Ligne des moustaches)
    svg.append("line")
      .attr("x1", center)
      .attr("x2", center)
      .attr("y1", y(min))
      .attr("y2", y(max))
      .attr("stroke", "#475569")
      .attr("stroke-width", 1.5);

    // Boîte (Q1 à Q3)
    svg.append("rect")
      .attr("x", x(groupKey))
      .attr("y", y(q3))
      .attr("height", y(q1) - y(q3))
      .attr("width", boxWidth)
      .attr("stroke", "#1e293b")
      .attr("fill", "#60a5fa")
      .style("opacity", 0.8);

    // Ligne de la Médiane
    svg.append("line")
      .attr("x1", x(groupKey))
      .attr("x2", x(groupKey) + boxWidth)
      .attr("y1", y(median))
      .attr("y2", y(median))
      .attr("stroke", "#1e1b4b")
      .attr("stroke-width", 2.5);

    // Moustaches horizontales (Min et Max)
    svg.append("line")
      .attr("x1", center - boxWidth / 4)
      .attr("x2", center + boxWidth / 4)
      .attr("y1", y(min))
      .attr("y2", y(min))
      .attr("stroke", "#475569");

    svg.append("line")
      .attr("x1", center - boxWidth / 4)
      .attr("x2", center + boxWidth / 4)
      .attr("y1", y(max))
      .attr("y2", y(max))
      .attr("stroke", "#475569");
  });
}