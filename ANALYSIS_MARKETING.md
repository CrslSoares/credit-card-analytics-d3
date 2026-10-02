# 📊 Documentation & Roadmap Marketing — Dashboard Analytics

## 1. Matrice Fréquence vs Panier Moyen (Scatter Plot 4 Quadrants)

### 🎯 Objectif Marketing
Déterminer le format et le timing optimal des campagnes promotionnelles en segmentant les clients selon leur fréquence d'achat et la valeur de leurs paniers. L'enjeu est de calibrer l'effort marketing : pousser du volume de transactions (fréquence) vs inciter à augmenter le panier moyen (valeur).

### 📐 Axes & Paramètres de Visualisation
* **Axe X :** Fréquence mensuelle de transactions (`Monthly_Transactions`).
* **Axe Y :** Panier moyen par transaction (`Avg_Transaction_Value`).
* **Taille des points :** Dépense mensuelle totale (`Monthly_Spending`).
* **Couleur :** Type de carte (`Card_Type`) ou Catégorie socioprofessionnelle (`Occupation`).

### 🧩 Segmentation Opérationnelle en 4 Quadrants

| Quadrant | Segment | Profil Comportemental | Stratégie & Recommandation Marketing |
| :--- | :--- | :--- | :--- |
| **Q1 (Haut / Droit)** | **VIPs & Heavy Users** | Fréquence élevée + Fort panier moyen | **Rétention & Prestige :** Programme de fidélité Premium sur-mesure, conciergerie dédiée, accès anticipé aux nouvelles fonctionnalités. |
| **Q2 (Bas / Droit)** | **Acheteurs Quotidiens** | Fréquence élevée + Petit panier moyen | **Cross-Selling & Up-Selling :** Offres groupées (Gift Cards Grocery/Fuel à paliers de dépense) pour stimuler le montant par passage en caisse. |
| **Q3 (Haut / Gauche)** | **Acheteurs Occasionnels** | Faible fréquence + Fort panier moyen | **Activateurs de Récurrence :** Coupons de réduction à durée limitée et cashback ponctuel déclenché au-delà d'un seuil de fréquence mensuel. |
| **Q4 (Bas / Gauche)** | **Clients Dormants / À Risque** | Faible fréquence + Petit panier moyen | **Réactivation Mass-Market :** Push notifications ciblées sur l'App, offres de bienvenue renouvelées et campagnes d'in-app messaging. |

---

## 2. Matrice de Risque Crédit & Détection Préventive (Credit Risk Zone)

### 🎯 Objectif Marketing & Financier
Anticiper le risque de défaut d'impayé en cartographiant l'utilisation de la ligne de crédit par rapport au comportement de remboursement. Permet de protéger la marge tout en adaptant les offres d'accompagnement financier.

### 📐 Définition de la Zone à Risque (Risk Zone)
* **Critères d'Alerte :** Taux d'utilisation du crédit $\ge$ 80 % **ET** Ratio de paiement mensuel $\le$ 40 %.
* **Volume Identifié :** 321 clients (0,6 % du portefeuille global) sur un échantillon affiché de 3 000 points.
* **Score de Crédit Moyen :** **429** pour le segment à risque (vs **629** pour la moyenne globale du portefeuille).

### 💡 Actions Marketing & Opérationnelles
* **Restructuration Proactive :** Notifications in-app proposant un étalement personnalisé des mensualités ou une option de micro-crédit de consolidation.
* **Plafonnement Dynamique :** Réduction graduelle et automatique des plafonds de retrait d'espèces sans bloquer les paiements essentiels.
* **Outils d'Éducation Financière :** Pousser des modules de gestion budgétaire au sein du parcours App Mobile pour restaurer le score de crédit.

---

## 3. Étude de Fidélité & Rétention Client (Loyalty & Engagement)

### 🎯 Objectif Marketing
Mesurer l'attachement à la marque et l'efficacité des programmes de fidélisation pour réduire le taux de churn (attrition) et maximiser la Customer Lifetime Value (LTV).

### 📐 Indicateurs Clefs (KPIs)
* **Score de Fidélité / Engagement :** Ancienneté, fréquence d'utilisation des services annexes et taux d'interaction App.
* **Taux d'Adhésion aux Programmes Rewards :** Conversion par segment sociodémographique et type de carte.

### 💡 Stratégies d'Activation
* **Programme de Gamification :** Défis mensuels sur l'App (ex: "Effectuez 5 paiements sans contact ce mois-ci") pour débloquer des points de fidélité ou du cashback.
* **Avantages Partenaires Personnalisés :** Recommandations d'offres partenaires basées sur l'historique réel de consommation (Cinéma, Restauration, Voyages).