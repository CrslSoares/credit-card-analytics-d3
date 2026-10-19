# Cartes de crédit : 50 000 clients en données

Projet universitaire de visualisation de données, en pages HTML avec **D3.js v7**.
Il raconte une histoire en quatre chapitres à partir du fichier `credit.csv` (50 000 clients, 30 variables).

> **Le revenu choisit la carte. Le comportement fixe le risque.**

| Page | Question | Réponse courte |
|---|---|---|
| `profil.html` | Qui sont nos clients ? | La profession borne le revenu, le revenu fixe la carte, et le plafond suit une règle par carte (18 % à 75 % du revenu). L'âge et le genre ne jouent aucun rôle. |
| `depenses.html` | Comment dépensent-ils ? | Tout le monde a le même panier (courses 24 %, voyages 8 %), mais un client Signature dépense 19 fois plus qu'un client Basic. |
| `risque.html` | Qui présente un risque ? | Le remboursement et l'utilisation du plafond expliquent 95 % du score. La zone à risque « en carré » rate 3 scores faibles sur 4 ; une frontière diagonale en capte 89 %. |
| `engagement.html` | L'application fidélise-t-elle ? | Les plus connectés dépensent 7 fois plus, et l'écart persiste à carte égale (sauf Signature). 78 % des points de fidélité dorment. |
| `conclusion.html` | Conclusion | Ce que la banque peut en faire, et ce que le projet nous a appris. |
| `methodologie.html` | Annexe | Données, préparation, méthodes statistiques, choix des graphiques, accessibilité, limites. |

## Ouvrir le site

1. Décompressez le dossier en entier.
2. Double-cliquez sur `index.html` : le site s'ouvre dans votre navigateur (Chrome, Firefox, Edge ou Safari récents).

Aucune connexion Internet ni aucun serveur n'est nécessaire : D3, la police et les données sont inclus.

**Avec VS Code** : *Fichier > Ouvrir le dossier…*, puis ouvrez `index.html` dans le navigateur (clic droit > *Reveal in File Explorer / Finder*, puis double-clic). L'extension *Live Server* fonctionne aussi, mais elle n'est pas nécessaire.

> Si un aperçu intégré (dans une application ou un éditeur) affiche une erreur du type « Forbidden » ou « fichier hors d'un dossier de confiance », ouvrez simplement `index.html` dans un vrai navigateur.

## Ce que l'on peut faire sur chaque page

- **Filtres** en haut de page (genre, âge, profession, carte) : tous les graphiques de la page se recalculent sur les 50 000 clients, avec transitions animées.
- **Infobulles** au survol, au toucher ou au clavier (touche Tab).
- **Mise en évidence par catégorie** : survoler une carte ou une catégorie de dépense, dans un graphique ou dans sa légende, la fait ressortir dans tous les graphiques de la page. Un clic la garde en évidence ; un second clic ou la touche Échap la relâche.
- **Voir les données** : le tableau de chaque graphique, mis à jour avec les filtres.
- **Méthode : pourquoi ce graphique et ces couleurs ?** : lien « Voir la méthode de ce graphique » sous le titre de chaque graphique. Le volet présente deux tableaux. Le premier donne l'encodage (donnée, type de variable, variable visuelle de Bertin, rang de Mackinlay). Le second donne le graphique retenu, les graphiques écartés et le choix des couleurs.
- Page Risque : seuils réglables, frontière « diagonale », sélection d'une zone à la souris, matrice de corrélation cliquable et **simulateur de score**.
- **Thème sombre** : bouton en haut à droite (ou réglage du système).

## Structure

```
index.html, profil.html, depenses.html, risque.html, engagement.html, conclusion.html, methodologie.html
assets/
  css/style.css          système de design (couleurs clair et sombre, typographie, mise en page)
  js/d3.v7.min.js        D3.js 7.9.0
  js/commun.js           socle partagé : données, formats français, thème, cadre de graphique,
                         infobulle, filtres, tableaux de données
  js/accueil.js … engagement.js   graphiques de chaque page
  fonts/                 police Archivo (licence OFL)
data/
  credit.csv             données sources
  donnees.js             données préparées (générées par le script ci-dessous)
scripts/
  prepare_data.py        préparation reproductible (Python 3, pandas, numpy)
```

## Régénérer les données

```bash
pip install pandas numpy
python scripts/prepare_data.py
```

Le script lit `data/credit.csv`, mélange les lignes (graine 42, pour que les 3 000 premières forment un échantillon aléatoire), code les catégories, pré-calcule les agrégats, les corrélations et les régressions, puis écrit `data/donnees.js`.

Les données sont chargées par une balise `<script>` plutôt que par `d3.csv()`. Les navigateurs bloquent `fetch()` sur les fichiers locaux, et ce choix permet d'ouvrir le site par un simple double-clic.

## Méthodes (résumé)

- Statistiques descriptives : moyennes, médianes, quartiles, boîtes de Tukey.
- Corrélations de Pearson, de Spearman (rangs) et rapport de corrélation η.
- Régression linéaire (moindres carrés) du score : `score ≈ 546,5 + 220,0 × remboursement − 200,4 × utilisation` (R² = 0,952 ; 0,965 avec six variables).
- Précision et rappel des deux définitions de la zone à risque (score faible : moins de 550).

Le détail, et les limites (notamment les signes d'un jeu de données synthétique), sont dans `methodologie.html`.

## Choix de conception

- **Un fil narratif.** Une banque de détail (fictive) prépare le bilan annuel de son portefeuille pour son comité de direction. Chaque chapitre part de la demande d'un service (marketing, fidélité, risques, application) et les chapitres s'enchaînent dans l'ordre où les questions se posent, jusqu'à la page `conclusion.html`.
- **Des textes qui accompagnent les graphiques.** Chaque chapitre s'ouvre sur la demande du service. Un court paragraphe tire la conséquence de chaque graphique et amène le suivant.
- **Une méthode visible au niveau de chaque graphique.** Le lien « Voir la méthode de ce graphique » ouvre deux tableaux : l'encodage (donnée, type de variable, variable visuelle de Bertin, rang de Mackinlay), puis le graphique retenu, les graphiques écartés et le choix des couleurs.
- **Une interaction par catégorie plutôt que point par point.** Légendes cliquables, nuages qui font ressortir toute une carte, valeur de la catégorie choisie écrite dans chaque barre.
- **Une couleur, un seul sens.** Rampe « encre » pour les cartes, sept teintes pour les catégories de dépense, divergente rouge et bleu pour le score, bleu-vert pour les mesures qui ne représentent aucune carte. La pyramide des âges reprend la rampe des cartes et les parts exactes sont données à côté.
