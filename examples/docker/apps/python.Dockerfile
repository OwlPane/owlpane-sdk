FROM python:3.12-slim-bookworm
ARG SDK_VERSION=0.1.5
RUN apt-get update && apt-get install -y --no-install-recommends tini bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/apps/python/app.py examples/apps/python/run.sh ./apps/python/
COPY examples/apps/python/requirements-published.txt ./apps/python/
COPY examples/docker/app-k8s-entrypoint.sh /docker/
RUN chmod +x /docker/app-k8s-entrypoint.sh apps/python/run.sh \
  && cd apps/python \
  && sed -i "s/^owlpane==.*/owlpane==${SDK_VERSION}/" requirements-published.txt \
  && python3 -m venv .venv \
  && .venv/bin/pip install --no-cache-dir -r requirements-published.txt
ENV OWLPANE_DOGFOOD_APP_ID=python OWLPANE_EXAMPLE_MODE=loop OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/docker/app-k8s-entrypoint.sh"]
