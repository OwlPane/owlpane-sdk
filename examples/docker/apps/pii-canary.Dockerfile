FROM node:22-bookworm
ARG SDK_VERSION=0.1.5
RUN apt-get update && apt-get install -y --no-install-recommends tini bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/pii-canary/package.json ./pii-canary/
COPY examples/pii-canary/src ./pii-canary/src
COPY examples/pii-canary/run.sh ./pii-canary/
COPY examples/docker/app-k8s-entrypoint.sh /docker/
RUN chmod +x /docker/app-k8s-entrypoint.sh pii-canary/run.sh \
  && cd pii-canary \
  && npm pkg delete dependencies.@owlpane/node 2>/dev/null || true \
  && npm pkg set "dependencies.@owlpane/node=@owlpane/node@${SDK_VERSION}" \
  && npm install --no-audit --no-fund \
  && npm install tsx@^4.19.0 typescript@^5.7.0 --no-audit --no-fund
ENV OWLPANE_DOGFOOD_APP_ID=pii-canary OWLPANE_EXAMPLE_MODE=server OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/usr/bin/tini", "--", "/docker/app-k8s-entrypoint.sh"]
