FROM node:22-alpine
ARG SDK_VERSION=0.1.5
RUN apk add --no-cache tini bash
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/docker/app-k8s-entrypoint.sh examples/docker/npm-install-published-node.sh /docker/
RUN chmod +x /docker/app-k8s-entrypoint.sh /docker/npm-install-published-node.sh
COPY examples/apps/node/package.json examples/apps/node/package-lock.json* ./apps/node/
COPY examples/apps/node/src ./apps/node/src
COPY examples/apps/node/run.sh ./apps/node/
RUN chmod +x apps/node/run.sh \
  && /docker/npm-install-published-node.sh "${SDK_VERSION}" apps/node \
  && cd apps/node && npm install tsx@^4.20.6 typescript@^5.9.3 --no-audit --no-fund
ENV OWLPANE_DOGFOOD_APP_ID=node OWLPANE_EXAMPLE_MODE=loop OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/docker/app-k8s-entrypoint.sh"]
