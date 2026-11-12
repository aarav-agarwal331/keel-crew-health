# Keel: a clean clone plus `make all` reproduces every number shown in the app.
# Requirements: uv (Python 3.12 is fetched by uv), Node 20+, about 2 GB of disk and a network
# connection for `make data`.  Nothing needs an account.

PY := cd research && uv run python -I
NPM := cd app && npm

.PHONY: all setup data sim model validate test dev build e2e shots deploy clean

all: setup data sim model validate test build

setup:
	cd research && uv sync --python 3.12
	$(NPM) install

# Download the open datasets (skips what is already there) and reduce them to daily features.
data:
	$(PY) scripts/fetch_data.py
	$(PY) scripts/build_daily.py

# Calibrate the simulator to real data (calibration halves), then generate the demo missions.
sim:
	$(PY) scripts/calibrate_sim.py
	$(PY) scripts/run_sim.py

# Fit the mission model (correlations, thresholds, choice of detector) on simulated training missions.
model:
	$(PY) scripts/fit_mission_model.py
	$(PY) scripts/make_parity.py

# Every table and figure on the Validation screen.
validate:
	$(PY) scripts/eval_real.py
	$(PY) scripts/eval_sim.py
	$(PY) scripts/sim_realism.py
	$(PY) scripts/eval_bedrest.py

test:
	cd research && uv run pytest -q
	$(NPM) test

dev:
	$(NPM) run dev

build:
	$(NPM) run build

# End-to-end test: loads the built app, cuts the network, exercises every screen.
e2e: build
	$(NPM) run e2e

shots: build
	cd app && npx playwright test e2e/shots.spec.ts

deploy: build
	./deploy.sh

clean:
	rm -rf app/dist data/interim
