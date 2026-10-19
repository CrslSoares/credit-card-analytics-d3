"""
Préparation des données du projet « Cartes de crédit » (D3.js).

Lit data/credit.csv (50 000 clients, 30 variables) et produit data/donnees.js,
un fichier JavaScript chargé par chaque page avec une simple balise <script>.
Ce choix (plutôt qu'un d3.csv) permet d'ouvrir le site par un double-clic,
sans serveur local : les navigateurs bloquent fetch() sur les fichiers locaux.

Le fichier produit contient :
  1. clients     — 11 colonnes utiles pour les 50 000 clients (format colonnes,
                   valeurs arrondies) : toutes les agrégations interactives sont
                   recalculées dans le navigateur avec D3 ;
  2. echantillon — 7 colonnes supplémentaires pour les 3 000 premiers clients
                   (les lignes sont mélangées, donc ces 3 000 clients forment un
                   échantillon aléatoire) ;
  3. cube        — sommes par segment (genre × âge × profession × carte ×
                   connexions), pour les dépenses par catégorie et les points ;
  4. correlations— matrices de corrélation de Pearson pour chaque combinaison
                   de filtres de la page Risque ;
  5. modeles     — régressions linéaires (moindres carrés) du score de crédit.

Utilisation :  python scripts/prepare_data.py
              (options : --entree data/credit.csv --sortie data/donnees.js)
Dépendances :  pandas, numpy
"""

import argparse
import json
from datetime import date
from itertools import product
from pathlib import Path

import numpy as np
import pandas as pd

GRAINE = 42            # graine du mélange aléatoire (résultats reproductibles)
TAILLE_ECHANTILLON = 3000

# Ordres d'affichage (fixes sur tout le site)
CARTES = ["Basic", "Silver", "Gold", "Platinum", "Signature"]
PROFESSIONS = [  # triées par revenu médian croissant
    ("Student", "Étudiant"),
    ("Retired", "Retraité"),
    ("Private Employee", "Salarié du privé"),
    ("Government Employee", "Fonctionnaire"),
    ("Self-Employed", "Indépendant"),
    ("Business Owner", "Chef d'entreprise"),
]
GENRES = [("F", "Femmes"), ("M", "Hommes")]
CATEGORIES = [  # triées par part décroissante dans la dépense totale
    ("Grocery_Spending", "Courses"),
    ("Utility_Bill_Spending", "Factures"),
    ("Online_Shopping_Spending", "Achats en ligne"),
    ("Fuel_Spending", "Carburant"),
    ("Dining_Spending", "Restaurants"),
    ("Entertainment_Spending", "Loisirs"),
    ("Travel_Spending", "Voyages"),
]
TRANCHES_AGE = [(18, 24), (25, 34), (35, 44), (45, 54), (55, 70)]
# Quintiles du nombre de connexions à l'application (20 % des clients chacun)
TRANCHES_CONNEXION = [(2, 17), (18, 26), (27, 37), (38, 48), (49, 71)]

# Variables de la matrice de corrélation (page Risque), dans l'ordre d'affichage
VARIABLES_CORR = [
    ("pay", "Payment_Ratio", "Remboursement"),
    ("util", "Credit_Utilization", "Utilisation du plafond"),
    ("bal", "Outstanding_Balance", "Solde impayé"),
    ("cage", "Card_Age_Months", "Ancienneté de la carte"),
    ("intl", "International_Transactions", "Transactions internationales"),
    ("cash", "Cash_Advance_Amount", "Avances d'espèces"),
    ("emi", "EMI_Count", "Mensualités (EMI)"),
    ("spend", "Monthly_Spending", "Dépense mensuelle"),
    ("inc", "Annual_Income", "Revenu annuel"),
    ("score", "Credit_Score", "Score de crédit"),
]

SEUIL_MAUVAIS_SCORE = 550   # en dessous : score « faible »
SEUIL_UTILISATION = 0.60    # zone à risque par défaut : utilisation > 60 %
SEUIL_REMBOURSEMENT = 0.50  #                          et remboursement < 50 %


def tranche(valeur, tranches):
    """Indice de la tranche [min, max] qui contient la valeur."""
    for i, (lo, hi) in enumerate(tranches):
        if lo <= valeur <= hi:
            return i
    raise ValueError(f"valeur hors tranches : {valeur}")


def regression(X, y):
    """Moindres carrés ordinaires : coefficients, R² et écart-type des résidus."""
    X = np.column_stack([np.ones(len(y)), X])
    coefs, *_ = np.linalg.lstsq(X, y, rcond=None)
    residus = y - X @ coefs
    r2 = 1 - (residus ** 2).sum() / ((y - y.mean()) ** 2).sum()
    return coefs, float(r2), float(residus.std())


def main(entree: Path, sortie: Path):
    d = pd.read_csv(entree)
    assert len(d) == 50_000 and d.shape[1] == 30, d.shape
    assert d.isna().sum().sum() == 0, "valeurs manquantes inattendues"

    # 1. Mélange aléatoire : les N premières lignes forment un échantillon aléatoire
    d = d.sample(frac=1, random_state=GRAINE).reset_index(drop=True)

    # 2. Codage des variables qualitatives en entiers (indices des listes ci-dessus)
    d["g"] = d.Gender.map({k: i for i, (k, _) in enumerate(GENRES)})
    d["occ"] = d.Occupation.map({k: i for i, (k, _) in enumerate(PROFESSIONS)})
    d["card"] = d.Card_Type.map({k: i for i, k in enumerate(CARTES)})
    d["ab"] = d.Age.apply(tranche, args=(TRANCHES_AGE,))
    d["lq"] = d.Mobile_App_Login.apply(tranche, args=(TRANCHES_CONNEXION,))
    assert d[["g", "occ", "card"]].notna().all().all()

    # 3. Colonnes « clients » (arrondies pour alléger le fichier)
    clients = {
        "age": d.Age.tolist(),
        "g": d.g.tolist(),
        "occ": d.occ.tolist(),
        "card": d.card.tolist(),
        "inc": (d.Annual_Income / 1000).round().astype(int).tolist(),        # milliers
        "spend": d.Monthly_Spending.round().astype(int).tolist(),            # unités
        "login": d.Mobile_App_Login.tolist(),
        "util": (d.Credit_Utilization * 100).round().astype(int).tolist(),   # %
        "pay": (d.Payment_Ratio * 100).round().astype(int).tolist(),         # %
        "score": d.Credit_Score.tolist(),
        "bal": (d.Outstanding_Balance / 1000).round().astype(int).tolist(),  # milliers
    }

    # 4. Échantillon aléatoire : variables supplémentaires (3 000 premiers clients)
    e = d.head(TAILLE_ECHANTILLON)
    echantillon = {
        "tx": e.Monthly_Transactions.tolist(),
        "ticket": e.Avg_Transaction_Value.round().astype(int).tolist(),
        "intl": e.International_Transactions.tolist(),
        "cash": (e.Cash_Advance_Amount / 1000).round(1).tolist(),           # milliers
        "emi": e.EMI_Count.tolist(),
        "cage": e.Card_Age_Months.tolist(),
        "lim": (e.Credit_Limit / 1000).round().astype(int).tolist(),        # milliers
    }

    # 5. Cube : sommes par segment genre × âge × profession × carte × connexions
    cats = [c for c, _ in CATEGORIES]
    agg = d.assign(
        intl_u=(d.International_Transactions > 0).astype(int),
        red0=(d.Reward_Points_Redeemed == 0).astype(int),
    ).groupby(["g", "ab", "occ", "card", "lq"]).agg(
        n=("Age", "size"),
        spend=("Monthly_Spending", "sum"),
        tx=("Monthly_Transactions", "sum"),
        ticket=("Avg_Transaction_Value", "sum"),
        intlU=("intl_u", "sum"),
        intlN=("International_Transactions", "sum"),
        inc=("Annual_Income", "sum"),
        lim=("Credit_Limit", "sum"),
        earn=("Reward_Points_Earned", "sum"),
        red=("Reward_Points_Redeemed", "sum"),
        red0=("red0", "sum"),
        **{f"c{i}": (c, "sum") for i, c in enumerate(cats)},
    ).reset_index()
    champs_cube = [c for c in agg.columns]
    cube = {
        "champs": champs_cube,
        "lignes": [[int(round(v)) for v in ligne] for ligne in agg.itertuples(index=False)],
    }

    # 6. Corrélations de Pearson pour chaque combinaison de filtres (page Risque)
    X = d[[col for _, col, _ in VARIABLES_CORR]].to_numpy(float)
    correlations = {}
    for c, o, g in product(range(-1, 5), range(-1, 6), range(-1, 2)):
        m = np.ones(len(d), bool)
        if c >= 0: m &= d.card.to_numpy() == c
        if o >= 0: m &= d.occ.to_numpy() == o
        if g >= 0: m &= d.g.to_numpy() == g
        n = int(m.sum())
        if n < 30:
            correlations[f"{c},{o},{g}"] = {"n": n, "r": None}
            continue
        r = np.corrcoef(X[m], rowvar=False)
        r = np.nan_to_num(r)  # variable constante dans le segment -> 0
        triangle = [round(float(r[i, j]), 3) for i in range(len(VARIABLES_CORR))
                    for j in range(i + 1, len(VARIABLES_CORR))]
        correlations[f"{c},{o},{g}"] = {"n": n, "r": triangle}

    # 7. Modèles du score de crédit (régressions linéaires)
    y = d.Credit_Score.to_numpy(float)
    pay, util = d.Payment_Ratio.to_numpy(), d.Credit_Utilization.to_numpy()
    cash = (d.Cash_Advance_Amount > 0).to_numpy(float)
    emi, cage = d.EMI_Count.to_numpy(float), d.Card_Age_Months.to_numpy() / 12
    intl = d.International_Transactions.to_numpy(float)

    b2, r2_2, sd2 = regression(np.column_stack([pay, util]), y)
    b6, r2_6, sd6 = regression(np.column_stack([pay, util, cash, emi, cage, intl]), y)
    b3, _, _ = regression(np.column_stack([pay, util, intl]), y)
    pred3 = b3[0] + b3[1] * pay + b3[2] * util + b3[3] * intl
    moyenne = y.mean()
    score_par_carte = []
    for i, nom in enumerate(CARTES):
        m = d.card.to_numpy() == i
        score_par_carte.append({
            "carte": nom,
            "n": int(m.sum()),
            "brut": round(float(y[m].mean()), 2),
            # moyenne des résidus du modèle (remboursement, utilisation, intl) + moyenne générale
            "ajuste": round(float((y[m] - pred3[m]).mean() + moyenne), 2),
            "intl": round(float(intl[m].mean()), 2),
        })

    # Performance de la zone « carré » et de la frontière diagonale (score prédit < 550)
    mauvais = y < SEUIL_MAUVAIS_SCORE
    zone = (util > SEUIL_UTILISATION) & (pay < SEUIL_REMBOURSEMENT)
    diag = (b2[0] + b2[1] * pay + b2[2] * util) < SEUIL_MAUVAIS_SCORE

    modeles = {
        "m2": {"variables": ["const", "pay", "util"], "coefs": [round(float(v), 3) for v in b2],
               "r2": round(r2_2, 4), "sd": round(sd2, 2)},
        "m6": {"variables": ["const", "pay", "util", "cash", "emi", "cage_ans", "intl"],
               "coefs": [round(float(v), 3) for v in b6], "r2": round(r2_6, 4), "sd": round(sd6, 2)},
        "scoreParCarte": score_par_carte,
        "zoneCarre": {"part": round(float(zone.mean()), 4), "precision": round(float(mauvais[zone].mean()), 3),
                      "rappel": round(float(zone[mauvais].mean()), 3)},
        "zoneDiagonale": {"part": round(float(diag.mean()), 4), "precision": round(float(mauvais[diag].mean()), 3),
                          "rappel": round(float(diag[mauvais].mean()), 3)},
    }

    # 8. Règles structurelles : plafond / revenu et revenus extrêmes par carte
    ratio = d.Credit_Limit / d.Annual_Income
    structure = []
    for i, nom in enumerate(CARTES):
        m = d.card == i
        q = ratio[m].quantile([0, 0.25, 0.5, 0.75, 1]).round(4).tolist()
        structure.append({
            "carte": nom,
            "ratio": {"min": q[0], "q1": q[1], "med": q[2], "q3": q[3], "max": q[4], "moy": round(float(ratio[m].mean()), 4)},
            "revenuMin": int(d.Annual_Income[m].min()), "revenuMax": int(d.Annual_Income[m].max()),
            "revenuMedian": float(d.Annual_Income[m].median()),
        })

    meta = {
        "source": entree.name,
        "genere": date.today().isoformat(),
        "n": len(d),
        "graine": GRAINE,
        "tailleEchantillon": TAILLE_ECHANTILLON,
        "cartes": CARTES,
        "professions": [fr for _, fr in PROFESSIONS],
        "professionsEn": [en for en, _ in PROFESSIONS],
        "genres": [fr for _, fr in GENRES],
        "categories": [fr for _, fr in CATEGORIES],
        "categoriesEn": [en for en, _ in CATEGORIES],
        "tranchesAge": TRANCHES_AGE,
        "tranchesConnexion": TRANCHES_CONNEXION,
        "variablesCorr": [{"cle": k, "colonne": col, "nom": nom} for k, col, nom in VARIABLES_CORR],
        "seuils": {"mauvaisScore": SEUIL_MAUVAIS_SCORE, "utilisation": SEUIL_UTILISATION,
                   "remboursement": SEUIL_REMBOURSEMENT},
    }

    donnees = {"meta": meta, "clients": clients, "echantillon": echantillon, "cube": cube,
               "correlations": correlations, "modeles": modeles, "structure": structure}
    texte = json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
    sortie.write_text(
        "// Fichier généré par scripts/prepare_data.py — ne pas modifier à la main.\n"
        f"// Source : {entree.name} ({len(d)} clients). Voir methodologie.html.\n"
        f"window.DONNEES = {texte};\n",
        encoding="utf-8",
    )
    print(f"{sortie} écrit ({sortie.stat().st_size / 1e6:.2f} Mo)")
    print("Modèle 2 variables :", modeles["m2"])
    print("Modèle 6 variables :", modeles["m6"])
    print("Zone carré :", modeles["zoneCarre"], "| diagonale :", modeles["zoneDiagonale"])


if __name__ == "__main__":
    racine = Path(__file__).resolve().parent.parent
    p = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    p.add_argument("--entree", type=Path, default=racine / "data" / "credit.csv")
    p.add_argument("--sortie", type=Path, default=racine / "data" / "donnees.js")
    a = p.parse_args()
    main(a.entree, a.sortie)
