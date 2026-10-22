FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends tini bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/apps/browser/package.json examples/apps/browser/package-lock.json* ./apps/browser/
COPY examples/apps/browser/src ./apps/browser/src
COPY examples/apps/browser/run.sh ./apps/browser/
COPY examples/docker/app-k8s-entrypoint.sh /app-k8s-entrypoint.sh
RUN chmod +x /app-k8s-entrypoint.sh apps/browser/run.sh \
  && cd apps/browser \
  && npm pkg set dependencies.@owlpane/browser="@owlpane/browser@^0.1.5" \
  && npm install --no-audit --no-fund
ENV OWLPANE_DOGFOOD_APP_ID=browser OWLPANE_EXAMPLE_MODE=loop OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/app-k8s-entrypoint.sh"]
