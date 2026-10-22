# build: docker build -f examples/docker/apps/node.Dockerfile -t ghcr.io/owlpane/sdk-example-node:tag .
FROM node:22-alpine
RUN apk add --no-cache tini bash
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/apps/node ./apps/node
COPY examples/docker/app-k8s-entrypoint.sh /app-k8s-entrypoint.sh
RUN chmod +x /app-k8s-entrypoint.sh apps/node/run.sh \
  && cd apps/node && npm install --no-audit --no-fund
ENV OWLPANE_DOGFOOD_APP_ID=node OWLPANE_EXAMPLE_MODE=loop OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/app-k8s-entrypoint.sh"]
