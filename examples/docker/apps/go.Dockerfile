FROM golang:1.23-bookworm
ARG SDK_VERSION=0.1.5
ENV GOTOOLCHAIN=auto
RUN apt-get update && apt-get install -y --no-install-recommends tini bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app/examples
COPY examples/_lib ./_lib
COPY examples/dogfood.manifest.json ./
COPY examples/apps/go ./apps/go
COPY examples/docker/app-k8s-entrypoint.sh /docker/
RUN chmod +x /docker/app-k8s-entrypoint.sh apps/go/run.sh \
  && cd apps/go \
  && sed -i '/^replace /d' go.mod \
  && go mod edit -require=github.com/OwlPane/owlpane-sdk/packages/go@v${SDK_VERSION} \
  && go mod tidy \
  && go mod download
ENV OWLPANE_DOGFOOD_APP_ID=go OWLPANE_EXAMPLE_MODE=loop OWLPANE_SDK_SOURCE=published
ENTRYPOINT ["/sbin/tini", "--", "/docker/app-k8s-entrypoint.sh"]
