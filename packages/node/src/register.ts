/**
 * Zero-config entry for `node --import @owlpane/node/register`.
 * Reads OWLPANE_INGEST_KEY, OWLPANE_INGEST_URL or OTEL_EXPORTER_OTLP_ENDPOINT,
 * OTEL_SERVICE_NAME, and OWLPANE_ENVIRONMENT. Does nothing when no endpoint is set.
 */
import { start } from "./index";

start();
