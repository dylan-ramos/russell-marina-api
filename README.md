# Russell Marina API

Application web privée de gestion du port de plaisance Russell. Elle fournit une API REST et une interface EJS pour administrer les catways, leurs réservations et les comptes de la capitainerie.

- Application : <https://russell-marina-api.srv924756.hstgr.cloud>
- Documentation Swagger : <https://russell-marina-api.srv924756.hstgr.cloud/api-docs>
- Spécification OpenAPI : <https://russell-marina-api.srv924756.hstgr.cloud/openapi.json>
- Dépôt : <https://github.com/dylan-ramos/russell-marina-api>

## Technologies

Node.js 22, TypeScript strict, Express 5, MongoDB 8, Mongoose, EJS, Tailwind CSS, sessions stockées dans MongoDB, Docker Compose et Traefik.

## Démarrage local avec Docker

Prérequis : Docker avec le plugin Compose et `make`.

```bash
git clone https://github.com/dylan-ramos/russell-marina-api.git
cd russell-marina-api
cp .env .env.local
```

Modifier ensuite toutes les valeurs sensibles de `.env.local`, en particulier :

```dotenv
MONGO_ROOT_USERNAME=russell_local
MONGO_ROOT_PASSWORD=un-mot-de-passe-aleatoire
SESSION_SECRET=une-longue-chaine-aleatoire
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=un-mot-de-passe-de-12-caracteres-minimum
```

`.env` contient uniquement des exemples et reste versionné. `.env.local` surcharge ces valeurs, contient les vrais secrets et est ignoré par Git.

```bash
make build
make up
make seed
```

L'application est alors disponible sur <http://localhost:3000>. Le seed est idempotent : il peut être relancé sans dupliquer les 24 catways, les 6 réservations ou l'administrateur.

Les identifiants de connexion sont les valeurs `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` choisies dans `.env.local`.

## Commandes utiles

| Commande                           | Rôle                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| `make help`                        | Afficher toutes les commandes                         |
| `make up` / `make down`            | Démarrer ou arrêter le développement                  |
| `make logs`                        | Suivre les journaux                                   |
| `make shell`                       | Ouvrir un shell dans l'application                    |
| `make seed`                        | Importer les données initiales sans doublon           |
| `make reset-admin`                 | Remplacer l'unique compte initial avec `SEED_ADMIN_*` |
| `make typecheck`                   | Vérifier TypeScript                                   |
| `make test`                        | Lancer les tests Node                                 |
| `make format`                      | Appliquer Prettier                                    |
| `make prod-build` / `make prod-up` | Construire et lancer la production                    |
| `make prod-deploy`                 | Valider, construire et lancer la production           |
| `make prod-seed`                   | Importer les données en production                    |
| `make prod-ps` / `make prod-logs`  | Contrôler les conteneurs de production                |
| `make prod-backup`                 | Créer une archive MongoDB locale compressée           |

Les commandes d'arrêt ne suppriment pas le volume MongoDB.

## API

Toutes les ressources métier sont privées. La connexion s'effectue par `POST /login` et crée une session HTTP stockée dans MongoDB. Les mutations exigent aussi le jeton CSRF renvoyé dans l'en-tête `X-CSRF-Token` des pages protégées.

Pour obtenir du JSON, envoyer l'en-tête :

```http
Accept: application/json
```

### Catways

| Méthode  | Route          | Fonction                              |
| -------- | -------------- | ------------------------------------- |
| `GET`    | `/catways`     | Lister                                |
| `GET`    | `/catways/:id` | Consulter par numéro                  |
| `POST`   | `/catways`     | Créer                                 |
| `PUT`    | `/catways/:id` | Modifier uniquement l'état            |
| `DELETE` | `/catways/:id` | Supprimer s'il n'a aucune réservation |

### Réservations

| Méthode  | Route                                      | Fonction                  |
| -------- | ------------------------------------------ | ------------------------- |
| `GET`    | `/catways/:id/reservations`                | Lister celles d'un catway |
| `GET`    | `/catways/:id/reservations/:idReservation` | Consulter                 |
| `POST`   | `/catways/:id/reservations`                | Créer                     |
| `PUT`    | `/catways/:id/reservations/:idReservation` | Modifier                  |
| `DELETE` | `/catways/:id/reservations/:idReservation` | Supprimer                 |

Une réservation est refusée si le catway n'existe pas, si les dates sont incohérentes ou si la période chevauche une réservation existante.

### Utilisateurs

| Méthode  | Route           | Fonction                                              |
| -------- | --------------- | ----------------------------------------------------- |
| `GET`    | `/users`        | Lister sans mot de passe                              |
| `GET`    | `/users/:email` | Consulter                                             |
| `POST`   | `/users`        | Créer                                                 |
| `PUT`    | `/users/:email` | Modifier et, facultativement, changer le mot de passe |
| `DELETE` | `/users/:email` | Supprimer                                             |

Les e-mails sont normalisés en minuscules. Les mots de passe font au moins 12 caractères, sont hachés avec bcrypt et ne sont jamais renvoyés. Le compte courant et le dernier compte existant ne peuvent pas être supprimés.

Les corps, exemples, codes HTTP et erreurs sont détaillés dans Swagger sur `/api-docs`.

## Différences avec les coquilles du brief

Le brief alterne parfois entre `/catway` et `/catways`, contient des espaces dans certaines routes et omet `:idReservation` pour la modification. L'implémentation conserve une convention REST cohérente :

- la ressource reste toujours au pluriel `/catways` ;
- `PUT` cible `/catways/:id/reservations/:idReservation`, comme `GET` et `DELETE` ;
- `:id` désigne le numéro fonctionnel du catway et `:idReservation` l'identifiant MongoDB de la réservation.

## Architecture

```text
src/
├── bin/             démarrage et arrêt propre du serveur
├── config/          MongoDB, sessions et OpenAPI
├── controllers/     adaptation HTTP et rendu EJS/JSON
├── middlewares/     authentification, CSRF et limitation de connexion
├── models/          schémas et validations Mongoose
├── routes/          déclaration des routes Express
├── services/        logique métier
└── scripts/         seed et réinitialisation du compte initial
views/                pages EJS et navigation partagée
data/                 données initiales fournies avec le devoir
```

## Déploiement

La production utilise l'image multi-étapes du `Dockerfile`. MongoDB reste exclusivement sur le réseau Docker interne ; seul Express rejoint le réseau externe `proxy` de Traefik.

Sur le VPS, créer `.env.local`, remplacer tous les secrets et limiter sa lecture :

```bash
cp .env .env.local
chmod 600 .env.local
```

Valider puis déployer :

```bash
make prod-deploy
make prod-seed
make prod-ps
```

Traefik termine HTTPS et transmet les requêtes au port interne 3000. Le port MongoDB n'est jamais publié.

Après une mise à jour, sauvegarder les données avant de reconstruire :

```bash
git pull --ff-only
make prod-backup
make prod-deploy
```

Contrôles à effectuer après chaque déploiement :

```bash
make prod-ps
curl --fail https://russell-marina-api.srv924756.hstgr.cloud/health
```

Vérifier ensuite dans le navigateur la connexion, les trois CRUD et `/api-docs`. `make prod-seed` est idempotent et ne duplique pas les données s'il est relancé.

### Sauvegarde et restauration MongoDB

Créer une sauvegarde horodatée dans le dossier local ignoré `backups/` :

```bash
make prod-backup
```

Les archives sont compressées et protégées avec des permissions locales restrictives. Elles contiennent les données du port : elles ne doivent jamais être commitées ni rendues publiques.

La restauration remplace les collections existantes. Elle exige donc le chemin explicite de l'archive et une confirmation :

```bash
make prod-restore BACKUP=backups/russell-marina-AAAAMMJJTHHMMSSZ.archive.gz CONFIRM=restore
```

Effectuer une nouvelle sauvegarde avant toute restauration.

## Sécurité

- mots de passe hachés avec bcrypt ;
- session régénérée à la connexion et stockée dans MongoDB ;
- cookies `httpOnly`, `sameSite` et `secure` en production ;
- protection CSRF en temps constant sur les mutations ;
- limitation des tentatives de connexion ;
- en-têtes Helmet et absence de stack en production ;
- validation explicite et Mongoose des entrées ;
- aucun secret versionné et aucun port MongoDB public.

## Informations pour le livrable

- Dépôt public : <https://github.com/dylan-ramos/russell-marina-api>
- Application HTTPS : <https://russell-marina-api.srv924756.hstgr.cloud>
- Documentation : <https://russell-marina-api.srv924756.hstgr.cloud/api-docs>
- Compte de démonstration : utiliser l'adresse et le mot de passe `SEED_ADMIN_*` configurés uniquement dans le `.env.local` du VPS. Transmettre ces deux valeurs au correcteur séparément du dépôt Git.
