FROM node:22-alpine
RUN apk add --no-cache tini bash
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/apps/demo-server/src ./apps/demo-server/src
COPY examples/apps/demo-server/run.sh ./apps/demo-server/
COPY examples/docker/app-k8s-entrypoint.sh /app-k8s-entrypoint.sh
RUN chmod +x /app-k8s-entrypoint.sh apps/demo-server/run.sh \
  && cd apps/demo-server \
  && npm init -y >/dev/null \
  && npm pkg set type=module \
  && npm pkg set scripts.start="node --import tsx src/server.ts" \
  && npm install --no-audit --no-fund @owlpane/node@^0.1.5 tsx@^4.20.6 typescript@^5.9.3
ENV NODE_ENV=production \
    OWLPANE_DOGFOOD_APP_ID=demo-server \
    OWLPANE_EXAMPLE_MODE=server \
    OWLPANE_SDK_SOURCE=published \
    OWLPANE_METRICS_EXPORT_INTERVAL_MS=5000 \
    DEMO_INTERVAL_MS=3000 \
    DEMO_BIND_HOST=0.0.0.0 \
    DEMO_SERVER_PORT=4399
EXPOSE 4399
ENTRYPOINT ["/sbin/tini", "--", "/app-k8s-entrypoint.sh"]
