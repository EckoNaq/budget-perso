# Budget Perso

Application de suivi de budget **100 % locale** : toutes les données restent dans ton
navigateur (IndexedDB), rien n'est envoyé sur Internet.

## Lancer l'application (le plus simple)

Double-clique sur **`Lancer Budget Perso.bat`** dans ce dossier.

- Une fenêtre noire s'ouvre, puis la page s'ouvre automatiquement dans ton navigateur
  sur http://localhost:5180
- **Garde la fenêtre noire ouverte** tant que tu utilises l'appli. Ferme-la quand tu as fini.
- Le tout premier lancement est un peu plus long (installation + construction), les
  suivants sont quasi instantanés.

### Créer un raccourci sur le Bureau
Clic droit sur `Lancer Budget Perso.bat` → **Envoyer vers** → **Bureau (créer un raccourci)**.
Tu peux renommer le raccourci et lui mettre une icône (clic droit → Propriétés → Changer d'icône).

## Tes données

- Elles sont stockées **dans ton navigateur**, liées à l'adresse `localhost:5180`.
  Tant que tu lances toujours par le `.bat` (même adresse), tu les retrouves.
- **Sauvegarde** : onglet *Import* → *Exporter mes données (JSON)*. Garde ce fichier
  ailleurs (OneDrive, clé USB). Pour restaurer : *Restaurer une sauvegarde…*.
- Ne « vide pas les données du site » dans ton navigateur sans avoir exporté avant.

## Mettre à jour l'appli (si le code change)

Supprime le dossier `dist`, puis relance le `.bat` (il reconstruira). Ou, dans un terminal
ouvert dans ce dossier : `npm run build`.

## Prérequis

Node.js doit être installé (déjà le cas sur cette machine). Rien d'autre.

## Lancement manuel (alternative)

Dans un terminal, dans ce dossier :
```
npm run dev       # mode développement (http://localhost:5180)
# ou
npm run build && npm run preview -- --port 5180 --open   # version optimisée
```
