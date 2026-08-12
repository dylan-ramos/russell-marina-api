SHELL := /bin/sh

ENV_FILES := --env-file .env --env-file .env.local
COMPOSE := docker compose $(ENV_FILES)
COMPOSE_DEV := $(COMPOSE) -f compose.yaml -f compose.dev.yaml
COMPOSE_PROD := $(COMPOSE) -f compose.yaml
BACKUP_DIR ?= backups
BACKUP_FILE ?= $(BACKUP_DIR)/russell-marina-$(shell date -u +%Y%m%dT%H%M%SZ).archive.gz

.DEFAULT_GOAL := help

.PHONY: help check-env network config build up down restart ps logs shell install css typecheck format format-check test seed reset-admin mongo-app-user clean prod-config prod-build prod-up prod-deploy prod-down prod-restart prod-ps prod-logs prod-seed prod-reset-admin prod-mongo-app-user prod-backup prod-restore

help: ## Affiche les commandes disponibles
	@awk 'BEGIN {FS = ":.*## "; printf "Commandes disponibles :\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check-env: ## Vérifie la présence des secrets locaux
	@test -f .env.local || (echo "Le fichier .env.local est absent. Copiez .env puis remplacez ses secrets." && exit 1)

network: ## Crée le réseau externe Traefik s'il est absent
	@docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

config: check-env ## Valide la configuration Compose de développement
	@$(COMPOSE_DEV) config --quiet

build: check-env ## Construit les images de développement
	@$(COMPOSE_DEV) build

up: check-env network ## Démarre l'environnement de développement
	@$(COMPOSE_DEV) up -d --wait mongodb
	@$(MAKE) mongo-app-user
	@$(COMPOSE_DEV) up -d --force-recreate --wait app

down: check-env ## Arrête l'environnement de développement
	@$(COMPOSE_DEV) down --remove-orphans

restart: down up ## Redémarre l'environnement de développement

ps: check-env ## Affiche l'état des conteneurs
	@$(COMPOSE_DEV) ps

logs: check-env ## Suit les journaux de développement
	@$(COMPOSE_DEV) logs -f

shell: check-env ## Ouvre un shell dans le conteneur applicatif
	@$(COMPOSE_DEV) exec app sh

install: check-env ## Installe les dépendances dans le conteneur
	@docker run --rm --user "$$(id -u):$$(id -g)" --volume "$(CURDIR):/app" --workdir /app node:22-alpine npm install

css: check-env ## Compile la feuille Tailwind dans le conteneur
	@$(COMPOSE_DEV) exec app npm run css:build

typecheck: check-env ## Vérifie le code TypeScript dans le conteneur
	@$(COMPOSE_DEV) exec app npm run typecheck

format: check-env ## Formate le code dans le conteneur
	@$(COMPOSE_DEV) exec app npm run format

format-check: check-env ## Contrôle le formatage dans le conteneur
	@$(COMPOSE_DEV) exec app npm run format:check

test: check-env ## Lance les tests dans le conteneur
	@$(COMPOSE_DEV) up -d --wait mongodb
	@$(COMPOSE_DEV) exec app npm test

seed: check-env ## Importe les données initiales sans créer de doublons
	@$(COMPOSE_DEV) exec app npm run seed:dev

reset-admin: check-env ## Remplace l'unique utilisateur avec les valeurs SEED_ADMIN_*
	@$(COMPOSE_DEV) exec app npm run admin:reset:dev

mongo-app-user: check-env ## Crée ou met à jour le compte MongoDB limité de l'application
	@$(COMPOSE_DEV) exec -T mongodb sh -c 'mongosh --quiet --host 127.0.0.1 --username "$$MONGO_INITDB_ROOT_USERNAME" --password "$$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin /docker-entrypoint-initdb.d/10-init-app-user.js'

clean: down ## Arrête les services sans supprimer les données MongoDB

prod-config: check-env ## Valide la configuration Compose de production
	@$(COMPOSE_PROD) config --quiet

prod-build: check-env ## Construit les images de production
	@$(COMPOSE_PROD) build

prod-up: check-env network ## Démarre l'environnement de production
	@$(COMPOSE_PROD) up -d --wait mongodb
	@$(MAKE) prod-mongo-app-user
	@$(COMPOSE_PROD) up -d --force-recreate --wait app

prod-deploy: prod-config prod-build prod-up ## Valide, construit et démarre la production

prod-down: check-env ## Arrête l'environnement de production
	@$(COMPOSE_PROD) down --remove-orphans

prod-restart: prod-down prod-up ## Redémarre l'environnement de production

prod-ps: check-env ## Affiche l'état des conteneurs de production
	@$(COMPOSE_PROD) ps

prod-logs: check-env ## Suit les journaux de production
	@$(COMPOSE_PROD) logs -f

prod-seed: check-env ## Importe les données initiales en production
	@$(COMPOSE_PROD) exec app npm run seed

prod-reset-admin: check-env prod-build ## Reconstruit puis remplace l'unique utilisateur de production
	@$(COMPOSE_PROD) run --rm app npm run admin:reset

prod-mongo-app-user: check-env ## Crée ou met à jour le compte MongoDB applicatif en production
	@$(COMPOSE_PROD) exec -T mongodb sh -c 'mongosh --quiet --host 127.0.0.1 --username "$$MONGO_INITDB_ROOT_USERNAME" --password "$$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin /docker-entrypoint-initdb.d/10-init-app-user.js'

prod-backup: check-env ## Sauvegarde MongoDB dans une archive locale compressée
	@set -eu; umask 077; mkdir -p "$(BACKUP_DIR)"; chmod 700 "$(BACKUP_DIR)"; temp_file="$(BACKUP_FILE).tmp.$$$$"; trap 'rm -f "$$temp_file"' EXIT HUP INT TERM; $(COMPOSE_PROD) exec -T mongodb sh -c 'mongodump --quiet --username "$$MONGO_INITDB_ROOT_USERNAME" --password "$$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "$$MONGO_INITDB_DATABASE" --archive --gzip' > "$$temp_file"; test -s "$$temp_file"; chmod 600 "$$temp_file"; mv "$$temp_file" "$(BACKUP_FILE)"; trap - EXIT HUP INT TERM; echo "Sauvegarde créée : $(BACKUP_FILE)"

prod-restore: check-env ## Restaure BACKUP=... avec CONFIRM=restore (destructif)
	@test -n "$(BACKUP)" || (echo "Indiquez l'archive : make prod-restore BACKUP=backups/fichier.archive.gz CONFIRM=restore" && exit 1)
	@test -f "$(BACKUP)" || (echo "Archive introuvable : $(BACKUP)" && exit 1)
	@test "$(CONFIRM)" = "restore" || (echo "Restauration annulée. Ajoutez CONFIRM=restore pour remplacer les données actuelles." && exit 1)
	@$(COMPOSE_PROD) exec -T mongodb sh -c 'mongorestore --quiet --username "$$MONGO_INITDB_ROOT_USERNAME" --password "$$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --drop' < "$(BACKUP)"
	@echo "Restauration terminée depuis $(BACKUP)"
