// Variable globale pour stocker les données une fois chargées
let globalData = [];

// Affiche le graphique correspondant au lien sélectionné.
const chartPages = Array.from(document.querySelectorAll(".chart-page"));
const pageLinks = Array.from(document.querySelectorAll("[data-page-link]"));

function showChartPage() {
  const requestedId = window.location.hash.slice(1);
  const activePage = chartPages.find(page => page.id === requestedId) || chartPages[0];

  chartPages.forEach(page => {
    page.hidden = page !== activePage;
  });

  pageLinks.forEach(link => {
    const isActive = link.hash === `#${activePage.id}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

window.addEventListener("hashchange", showChartPage);
showChartPage();

// Chargement des données CSV avec D3.js
d3.csv("data/synthetic_credit_card_customer_behavior_dataset.csv", d3.autoType)
  .then(data => {
    console.log("Données chargées avec succès :", data.length, "lignes");
    globalData = data;

    // Initialisation des graphiques
    initChart1(globalData);
    initChart2(globalData);
    initChart3(globalData);
    initChart4(globalData);
  })
  .catch(error => {
    console.error("Erreur lors du chargement des données :", error);
  });