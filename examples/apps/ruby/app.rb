# frozen_string_literal: true

require "opentelemetry/sdk"
require "opentelemetry/exporter/otlp"

endpoint = ENV.fetch("OTEL_EXPORTER_OTLP_ENDPOINT").chomp("/")
headers = {}
if (key = ENV.fetch("OWLPANE_INGEST_KEY", "")).strip != ""
  headers["Authorization"] = "Bearer #{key}"
end

exporter = OpenTelemetry::Exporter::OTLP::Exporter.new(
  endpoint: "#{endpoint}/v1/traces",
  headers: headers,
)

OpenTelemetry::SDK.configure do |c|
  c.service_name = ENV.fetch("OTEL_SERVICE_NAME")
  c.add_span_processor(
    OpenTelemetry::SDK::Trace::Export::BatchSpanProcessor.new(exporter),
  )
  c.resource = OpenTelemetry::SDK::Resources::Resource.create(
    {
      "deployment.environment.name" => ENV.fetch("OWLPANE_ENVIRONMENT", "development"),
      "service.version" => "0.1.5",
      "telemetry.sdk.language" => "ruby",
    },
  )
end

rich = ENV["OWLPANE_DOGFOOD_MODE"] == "rich"
tracer = OpenTelemetry.tracer_provider.tracer("owlpane-dogfood")
tracer.in_span(
  "GET /demo",
  kind: :server,
  attributes: { "http.request.method" => "GET", "http.route" => "/demo", "http.response.status_code" => 200 },
) do
  if rich
    tracer.in_span(
      "SELECT orders",
      kind: :client,
      attributes: { "db.system" => "postgresql", "db.operation.name" => "SELECT" },
    ) {}
  end
end

if rich
  tracer.in_span(
    "POST /checkout",
    kind: :server,
    attributes: { "http.request.method" => "POST", "http.route" => "/checkout", "http.response.status_code" => 500 },
  ) do |span|
    err = StandardError.new("Redis session lock contention")
    span.record_exception(err)
    span.status = OpenTelemetry::Trace::Status.error(err.message)
  end
end

OpenTelemetry.tracer_provider.shutdown
puts "span emitted (#{ENV.fetch('OTEL_SERVICE_NAME')})"
