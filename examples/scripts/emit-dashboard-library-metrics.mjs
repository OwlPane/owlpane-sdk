#!/usr/bin/env node
/**
 * Emit synthetic gauge metrics named like OpenObserve library dashboards (Redis, K8s nodes, etc.)
 * so installed dashboards show charts in local/SaaS dogfood. Uses examples/.env ingest key (node project).
 */
import { metrics } from '@opentelemetry/api'
import { owlpane, isEnabled, shutdown } from '@owlpane/node'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

owlpane.start({
  service: 'owlpane-dashboard-dogfood',
  endpoint: process.env.OWLPANE_INGEST_URL ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  ingestKey: process.env.OWLPANE_INGEST_KEY_NODE ?? process.env.OWLPANE_INGEST_KEY,
  environment: process.env.OWLPANE_ENVIRONMENT ?? 'development',
  release: 'dashboard-dogfood-1',
})

if (!isEnabled()) {
  console.error('Set OWLPANE_INGEST_URL and OWLPANE_INGEST_KEY_NODE in examples/.env')
  process.exit(1)
}

const meter = metrics.getMeter('owlpane-dashboard-dogfood')
const cluster = process.env.OWLPANE_DOGFOOD_CLUSTER ?? 'local-dogfood'
const node = process.env.OWLPANE_DOGFOOD_NODE ?? 'node-a'

/** Metric names from owlpane-dashboards library (OpenObserve community dashboards). */
const GAUGES = [
  // Redis library dashboard
  'redis_memory_used',
  'redis_memory_peak',
  'redis_commands_processed',
  'redis_cpu_time',
  'redis_uptime',
  'redis_memory_fragmentation_ratio',
  'redis_db_keys',
  'redis_keys_evicted',
  // Kubernetes / host library dashboards
  'k8s_node_cpu_usage',
  'k8s_node_memory_rss',
  'k8s_node_allocatable_cpu',
  'k8s_node_network_io',
  'system_memory_utilization',
  'system_disk_operations',
  'k8s.node.cpu.usage',
  'k8s.node.memory.working_set',
  'k8s.node.allocatable_cpu',
  'system.network.io',
  // PostgreSQL library dashboard (OTel contrib names)
  'postgresql_backends',
  'postgresql_connection_max',
  'postgresql_database_count',
  'postgresql_db_size',
  'postgresql_blks_hit',
  'postgresql_blks_read',
  'postgresql_commits',
  'postgresql_rollbacks',
  // Owlpane ingest / agent dogfood
  'owlpane_ingest_batches_total',
  'owlpane_ingest_bytes_total',
  'process_runtime_jvm_memory_usage',
  'process_cpu_time',
  'otelcol_receiver_accepted_spans',
  'otelcol_exporter_sent_spans',
  'otelcol_exporter_send_failed_spans',
  'http_server_duration_count',
  'rpc_server_duration_count',
]

const attrs = {
  'k8s.cluster.name': cluster,
  'k8s.node.name': node,
  'deployment.environment.name': process.env.OWLPANE_ENVIRONMENT ?? 'development',
  direction: 'receive',
  state: 'used',
}

let t = 0
for (const name of GAUGES) {
  meter.createObservableGauge(name, (obs) => {
    t += 1
    const wave = 1 + 0.15 * Math.sin(t / 8)
    const base = name.includes('ratio') ? 1.05 : name.includes('uptime') ? 86400 : 1_000_000
    obs.observe(base * wave, attrs)
  })
}

console.log(`Emitting ${GAUGES.length} library dashboard metrics to ${process.env.OWLPANE_INGEST_URL} (env ${process.env.OWLPANE_ENVIRONMENT})`)
console.log('Press Ctrl+C to stop. Re-open dashboards after ~30s for catalog refresh.')

process.on('SIGINT', async () => {
  await shutdown()
  process.exit(0)
})

setInterval(() => {}, 60_000)
