// Variable globale pour stocker les données une fois chargées
let globalData = [];

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