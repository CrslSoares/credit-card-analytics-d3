function initChart1(data) {
  const container = d3.select("#chart-profile");
  const filterContainer = d3.select("#filter-container-1");

  // Nettoyage au cas où
  container.html("");
  filterContainer.html("");

  // Menu déroulant pour changer la dimension
  filterContainer.append("label")
    .text("Grouper par : ")
    .style("font-weight", "bold");

  const select = filterContainer.append("select")
    .attr("id", "groupby-select");

  select.selectAll("option")
    .data([
      { label: "Secteur d'activité (Occupation)", value: "Occupation" },
      { label: "Genre (Gender)", value: "Gender" },
      { label: "Tranche d'âge", value: "AgeGroup" }
    ])
    .enter()
    .append("option")
    .attr("value", d => d.value)
    .text(d => d.label);

  // Préparer les tranches d’âge dans les données
  const processedData = data.map(d => ({
    ...d,
    AgeGroup: d.Age < 30 ? "< 30 ans" : d.Age < 50 ? "30-49 ans" : "50+ ans"
  }));

  // Dimensions du SVG
  const margin = { top: 30, right: 120, bottom: 80, left: 60 };
  const width = 600 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const cardTypes = ["Basic", "Silver", "Gold", "Platinum"];
  const colorScale = d3.scaleOrdinal()
    .domain(cardTypes)
    .range(["#94a3b8", "#38bdf8", "#f59e0b", "#8b5cf6"]);

  function updateChart(groupByKey) {
    // Aggrégation des données selon la clé choisie
    const rolledUp = d3.rollup(
      processedData,
      v => {
        const counts = { Basic: 0, Silver: 0, Gold: 0, Platinum: 0 };
        v.forEach(d => counts[d.Card_Type] = (counts[d.Card_Type] || 0) + 1);
        return counts;
      },
      d => d[groupByKey]
    );

    const categories = Array.from(rolledUp.keys());
    const formattedData = categories.map(cat => ({
      group: cat,
      ...rolledUp.get(cat)
    }));

    // Empilement (Stack)
    const stack = d3.stack().keys(cardTypes);
    const stackedData = stack(formattedData);

    // Échelles
    const x = d3.scaleBand()
      .domain(categories)
      .range([0, width])
      .padding(0.3);

    const maxY = d3.max(formattedData, d => d.Basic + d.Silver + d.Gold + d.Platinum);
    const y = d3.scaleLinear()
      .domain([0, maxY])
      .nice()
      .range([height, 0]);

    // Redessiner les axes
    svg.selectAll(".axis").remove();

    svg.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end");

    svg.append("g")
      .attr("class", "axis y-axis")
      .call(d3.axisLeft(y));

    // Dessin des barres empilées
    svg.selectAll(".layer-group").remove();

    const layers = svg.selectAll(".layer-group")
      .data(stackedData)
      .enter()
      .append("g")
      .attr("class", "layer-group")
      .attr("fill", d => colorScale(d.key));

    layers.selectAll("rect")
      .data(d => d)
      .enter()
      .append("rect")
      .attr("x", d => x(d.data.group))
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth());

    // Légende
    svg.selectAll(".legend").remove();
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width + 20}, 0)`);

    cardTypes.forEach((type, i) => {
      const legRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 20})`);

      legRow.append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", colorScale(type));

      legRow.append("text")
        .attr("x", 20)
        .attr("y", 10)
        .text(type)
        .style("font-size", "12px");
    });
  }

  // Premier affichage
  updateChart("Occupation");

  // Événement au changement de filtre
  select.on("change", function () {
    updateChart(this.value);
  });
}