SHELL := /bin/sh

ENV_FILES := --env-file .env --env-file .env.local
COMPOSE := docker compose $(ENV_FILES)
COMPOSE_DEV := $(COMPOSE) -f compose.yaml -f compose.dev.yaml
COMPOSE_PROD := $(COMPOSE) -f compose.yaml

.DEFAULT_GOAL := help

.PHONY: help check-env network config build up down restart ps logs shell install css typecheck format format-check test seed clean prod-build prod-up prod-down prod-logs prod-seed

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
	@$(COMPOSE_DEV) up -d

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
	@$(COMPOSE_DEV) exec app npm test

seed: check-env ## Importe les données initiales sans créer de doublons
	@$(COMPOSE_DEV) exec app npm run seed:dev

clean: down ## Arrête les services sans supprimer les données MongoDB

prod-build: check-env ## Construit les images de production
	@$(COMPOSE_PROD) build

prod-up: check-env network ## Démarre l'environnement de production
	@$(COMPOSE_PROD) up -d

prod-down: check-env ## Arrête l'environnement de production
	@$(COMPOSE_PROD) down --remove-orphans

prod-logs: check-env ## Suit les journaux de production
	@$(COMPOSE_PROD) logs -f

prod-seed: check-env ## Importe les données initiales en production
	@$(COMPOSE_PROD) exec app npm run seed
