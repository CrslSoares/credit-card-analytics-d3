# 💳 Credit Card Customer Behavior Analytics — D3.js Dashboard

Ce projet présente un tableau de bord interactif conçu avec **D3.js (v7)**. Il s'inscrit dans le cadre d'un travail pratique de visualisation de données visant à explorer le comportement des clients détenteurs de cartes de crédit.

---

## 🎯 Cadrage Métier & Objectifs

Nous nous plaçons dans la peau d'un **établissement bancaire émetteur de cartes de crédit**. L'objectif est de fournir à la direction Marketing et à la gestion des Risques un outil d'aide à la décision basé sur les données pour :
* Comprendre le profil sociodémographique de la clientèle souscrivant aux différentes gammes de cartes.
* Identifier les habitudes et catégories de dépenses pour adapter les offres et avantages.
* Évaluer le risque de crédit et de défaut de paiement pour ajuster les plafonds et autorisations.
* Mesurer l'engagement digital des clients et la rétention via le programme de fidélité.

---

## 📊 Visualisations & Fonctionnalités Interactives

Le tableau de bord regroupe **4 visualisations interactives complémentaires** :

### 1. Profil Clients & Types de Cartes (`Stacked Bar Chart` / `Treemap`)
* **Objectif :** Répartition des cartes de crédit (`Basic`, `Silver`, `Gold`, `Platinum`) selon les caractéristiques sociodémographiques.
* **Interactivité :** Filtres dynamiques permettant de modifier les axes d'analyse par profession (`Occupation`), genre (`Gender`) ou tranche d'âge (`Age`).

### 2. Structure des Dépenses (`Sunburst Chart`)
* **Objectif :** Exploration hiérarchique de la répartition du budget mensuel selon les catégories d'achat (*Online, Grocery, Fuel, Dining, Travel, Entertainment, Utilities*).
* **Interactivité :** Zoom au clic sur les catégories et bascule entre le **montant dépense ($)** et le **nombre de transactions**.

### 3. Matrice du Risque de Crédit (`Scatter Plot`)
* **Objectif :** Évaluation de la fragilité financière des clients en croisant le taux d'utilisation du crédit (*Credit Utilization*) et le ratio de remboursement (*Payment Ratio*).
* **Encodage visuel :**
  * **Couleur :** Score de crédit (`Credit Score`).
  * **Taille des points :** Solde restant à payer (`Outstanding Balance`).
* **Interactivité :** Tooltip détaillé au survol de chaque client.

### 4. Engagement & Rétention (`Box Plot`)
* **Objectif :** Analyse de la corrélation entre l'utilisation de l'application mobile (`Mobile App Login`) et le volume des dépenses mensuelles, complétée par l'adoption du programme de fidélité (points gagnés vs distribués).

---

## 🛠️ Technologies Utilisées

* **HTML5 / CSS3** (Flexbox / CSS Grid pour le layout)
* **JavaScript (ES6+)**
* **D3.js (v7)** — Manipulation du DOM, échelles, générateurs SVG et transitions interactives
* **Dataset :** `synthetic_credit_card_customer_behavior_dataset.csv` (50 000 enregistrements)

---

## 🚀 Installation & Utilisation

1. **Cloner le dépôt :**
   ```bash
   git clone [https://github.com/](https://github.com/)<ton-pseudo>/credit-card-analytics-d3.git
   cd credit-card-analytics-d3
