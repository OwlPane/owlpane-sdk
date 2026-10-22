FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends tini bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/pii-canary ./pii-canary
COPY examples/docker/app-k8s-entrypoint.sh /app-k8s-entrypoint.sh
RUN chmod +x /app-k8s-entrypoint.sh pii-canary/run.sh \
  && cd pii-canary \
  && npm pkg set dependencies.@owlpane/node="@owlpane/node@^0.1.5" \
  && npm install --no-audit --no-fund
ENV OWLPANE_DOGFOOD_APP_ID=pii-canary OWLPANE_EXAMPLE_MODE=server OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/app-k8s-entrypoint.sh"]
