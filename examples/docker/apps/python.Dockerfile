FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends tini bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/apps/python ./apps/python
COPY examples/docker/app-k8s-entrypoint.sh /app-k8s-entrypoint.sh
RUN chmod +x /app-k8s-entrypoint.sh apps/python/run.sh \
  && cd apps/python && python3 -m venv .venv && .venv/bin/pip install --no-cache-dir -r requirements.txt
ENV OWLPANE_DOGFOOD_APP_ID=python OWLPANE_EXAMPLE_MODE=loop OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/app-k8s-entrypoint.sh"]
