FROM node:22-alpine
ARG SDK_VERSION=0.1.5
RUN apk add --no-cache tini bash
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/docker/app-k8s-entrypoint.sh examples/docker/npm-install-published-node.sh /docker/
RUN chmod +x /docker/app-k8s-entrypoint.sh /docker/npm-install-published-node.sh
COPY examples/apps/demo-server/package.json ./apps/demo-server/
COPY examples/apps/demo-server/src ./apps/demo-server/src
COPY examples/apps/demo-server/run.sh ./apps/demo-server/
RUN chmod +x apps/demo-server/run.sh \
  && /docker/npm-install-published-node.sh "${SDK_VERSION}" apps/demo-server \
  && cd apps/demo-server && npm install tsx@^4.20.6 typescript@^5.9.3 --no-audit --no-fund
ENV NODE_ENV=production \
    OWLPANE_DOGFOOD_APP_ID=demo-server \
    OWLPANE_EXAMPLE_MODE=server \
    OWLPANE_SDK_SOURCE=published \
    OWLPANE_METRICS_EXPORT_INTERVAL_MS=5000 \
    DEMO_INTERVAL_MS=3000 \
    DEMO_BIND_HOST=0.0.0.0 \
    DEMO_SERVER_PORT=4399
EXPOSE 4399
ENTRYPOINT ["/sbin/tini", "--", "/docker/app-k8s-entrypoint.sh"]
