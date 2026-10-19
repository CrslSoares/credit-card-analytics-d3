function initChart2(data) {
  const container = d3.select("#chart-spending");
  const filterContainer = d3.select("#filter-container-2");

  container.html("");
  filterContainer.html("");

  // 1. Catégories de dépenses
  const spendingCategories = [
    { keys: ["Online_Shopping_Spending", "Online_Shopping"], label: "Achats en ligne", icon: "🛒" },
    { keys: ["Grocery_Spending", "Grocery"], label: "Alimentation", icon: "🍏" },
    { keys: ["Fuel_Spending", "Fuel"], label: "Carburant", icon: "⛽" },
    { keys: ["Dining_Spending", "Dining"], label: "Restauration", icon: "🍽️" },
    { keys: ["Travel_Spending", "Travel"], label: "Voyages", icon: "✈️" },
    { keys: ["Entertainment_Spending", "Entertainment"], label: "Divertissement", icon: "🎟️" },
    { keys: ["Utility_Bill_Spending", "Utility_Bill", "Utilities"], label: "Factures", icon: "⚡" }
  ];

  function getSpendingValue(d, catKeys) {
    for (const key of catKeys) {
      if (d[key] !== undefined && d[key] !== null) {
        return +d[key] || 0;
      }
    }
    return 0;
  }

  function normalizeGender(genderStr) {
    if (!genderStr) return "Unknown";
    const g = String(genderStr).trim().toLowerCase();
    if (g === "male" || g === "m" || g === "homme" || g === "h") return "Male";
    if (g === "female" || g === "f" || g === "femme") return "Female";
    return genderStr;
  }

  // 2. Nettoyage des données
  const processedData = data.map(d => {
    const ageNum = +d.Age || 0;
    return {
      ...d,
      AgeNum: ageNum,
      NormalizedGender: normalizeGender(d.Gender),
      AgeGroup: ageNum < 30 ? "< 30 ans" : ageNum < 50 ? "30-49 ans" : "50+ ans"
    };
  });

  // 3. Barre de filtres (Carte + Âge + Genre)
  const filterWrapper = filterContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "20px")
    .style("flex-wrap", "wrap")
    .style("margin-bottom", "15px");

  // Helper pour créer un sélecteur
  function createSelect(label, id, options) {
    const box = filterWrapper.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "8px");

    box.append("label")
      .style("font-weight", "bold")
      .style("font-size", "13px")
      .text(label);

    const select = box.append("select")
      .attr("id", id)
      .style("padding", "5px 10px")
      .style("border-radius", "6px")
      .style("border", "1px solid #cbd5e1");

    select.selectAll("option")
      .data(options)
      .enter()
      .append("option")
      .attr("value", d => d.value)
      .text(d => d.label);

    return select;
  }

  const cardSelect = createSelect("Type de carte :", "card-type-filter", [
    { value: "All", label: "Toutes les cartes" },
    { value: "Basic", label: "Carte Basic" },
    { value: "Silver", label: "Carte Silver" },
    { value: "Gold", label: "Carte Gold" },
    { value: "Platinum", label: "Carte Platinum" },
    { value: "Signature", label: "Carte Signature" }
  ]);

  const ageSelect = createSelect("Tranche d'âge :", "age-filter", [
    { value: "All", label: "Toutes les tranches" },
    { value: "< 30 ans", label: "< 30 ans" },
    { value: "30-49 ans", label: "30-49 ans" },
    { value: "50+ ans", label: "50+ ans" }
  ]);

  const genderSelect = createSelect("Genre :", "gender-filter", [
    { value: "All", label: "Tous les genres" },
    { value: "Male", label: "Hommes 👨" },
    { value: "Female", label: "Femmes 👩" }
  ]);

  // Conteneur principal pour le donut unique
  const chartBox = container.append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("justify-content", "center");

  const colorScale = d3.scaleOrdinal()
    .domain(spendingCategories.map(d => d.label))
    .range(["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"]);

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

  // 4. Fonction de mise à jour du Donut
  function updateChart() {
    chartBox.html("");

    const selectedCard = cardSelect.property("value");
    const selectedAge = ageSelect.property("value");
    const selectedGender = genderSelect.property("value");

    let filteredData = processedData;

    if (selectedCard !== "All") {
      filteredData = filteredData.filter(d => String(d.Card_Type).trim() === selectedCard);
    }
    if (selectedAge !== "All") {
      filteredData = filteredData.filter(d => d.AgeGroup === selectedAge);
    }
    if (selectedGender !== "All") {
      filteredData = filteredData.filter(d => d.NormalizedGender === selectedGender);
    }

    const totals = spendingCategories.map(cat => ({
      name: cat.label,
      icon: cat.icon,
      value: d3.sum(filteredData, d => getSpendingValue(d, cat.keys))
    }));

    const grandTotal = d3.sum(totals, d => d.value);

    // Titre d'effectif
    chartBox.append("h3")
      .style("margin-bottom", "15px")
      .style("color", "#1e293b")
      .style("font-size", "15px")
      .text(`Échantillon : ${filteredData.length} clients`);

    const width = 360;
    const height = 320;
    const radius = Math.min(width, height) / 2 - 20;

    const svg = chartBox.append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.52).outerRadius(radius + 8);

    const centerTitle = svg.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -8)
      .style("font-size", "12px")
      .style("fill", "#64748b")
      .text("Répartition");

    const centerValue = svg.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 14)
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .style("fill", "#0f172a")
      .text("100%");

    const path = svg.selectAll("path")
      .data(pie(totals))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", d => colorScale(d.data.name))
      .attr("stroke", "#ffffff")
      .style("stroke-width", "2px")
      .style("cursor", "pointer");

    path.on("mouseover", function (event, d) {
      d3.select(this).transition().duration(150).attr("d", arcHover);
      const percent = grandTotal > 0 ? ((d.data.value / grandTotal) * 100).toFixed(1) : 0;

      centerTitle.text(`${d.data.icon} ${d.data.name}`);
      centerValue.text(`${percent}%`);

      tooltip.style("visibility", "visible")
        .html(`
          <strong>${d.data.icon} ${d.data.name}</strong><br/>
          Part du total : <strong>${percent}%</strong>
        `);
    })
    .on("mousemove", function (event) {
      tooltip.style("top", (event.pageY - 10) + "px")
             .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).transition().duration(150).attr("d", arc);
      centerTitle.text("Répartition");
      centerValue.text("100%");
      tooltip.style("visibility", "hidden");
    });
  }

  // Initialisation
  updateChart();

  // Événements des filtres
  cardSelect.on("change", updateChart);
  ageSelect.on("change", updateChart);
  genderSelect.on("change", updateChart);
}