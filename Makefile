.DEFAULT_GOAL := help
.PHONY: help install setup dev build start lint format test test-cov test-e2e generate migrate migrate-deploy studio clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

setup: install generate ## Install dependencies and generate the Prisma client
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")

dev: ## Run in watch mode
	npm run start:dev

build: ## Compile to dist/
	npm run build

start: build ## Build and run in production mode
	npm run start:prod

lint: ## Lint with autofix
	npm run lint

format: ## Format with Prettier
	npm run format

test: ## Run unit tests
	npm test

test-cov: ## Run unit tests with coverage
	npm run test:cov

test-e2e: ## Run end-to-end tests
	npm run test:e2e

generate: ## Generate the Prisma client
	npx prisma generate

migrate: ## Create/apply a dev migration (usage: make migrate name=add_thing)
	npx prisma migrate dev $(if $(name),--name $(name))

migrate-deploy: ## Apply pending migrations (production)
	npx prisma migrate deploy

studio: ## Open Prisma Studio
	npx prisma studio

clean: ## Remove build output and coverage
	rm -rf dist coverage .nest
