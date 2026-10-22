# OTLP emitter apps (rust, php, dotnet, react-native, serverless) via shared Node helper.
# build: docker build -f examples/docker/apps/emitter.Dockerfile --build-arg APP_ID=rust .
ARG APP_ID=rust
FROM node:22-bookworm
ARG APP_ID
RUN apt-get update && apt-get install -y --no-install-recommends tini bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/apps/node ./apps/node
COPY examples/apps/${APP_ID} ./apps/${APP_ID}
COPY examples/docker/app-k8s-entrypoint.sh /app-k8s-entrypoint.sh
RUN chmod +x /app-k8s-entrypoint.sh apps/${APP_ID}/run.sh apps/node/run.sh \
  && cd apps/node && npm install --no-audit --no-fund
ENV OWLPANE_DOGFOOD_APP_ID=${APP_ID} OWLPANE_EXAMPLE_MODE=loop OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/app-k8s-entrypoint.sh"]
