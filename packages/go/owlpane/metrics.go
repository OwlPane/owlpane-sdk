package owlpane

import (
	"context"
	"os"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
)

var mp *metric.MeterProvider

func runtimeMetricsEnabled() bool {
	v := os.Getenv("OWLPANE_RUNTIME_METRICS")
	return v != "0" && v != "false" && v != "no"
}

func startMetrics(ctx context.Context, cfg *Config, res *resource.Resource) error {
	if !runtimeMetricsEnabled() {
		return nil
	}
	opts := []otlpmetrichttp.Option{
		otlpmetrichttp.WithEndpointURL(cfg.BaseURL + "/v1/metrics"),
	}
	if cfg.Authorization != "" {
		opts = append(opts, otlpmetrichttp.WithHeaders(map[string]string{
			"Authorization": cfg.Authorization,
		}))
	}
	exp, err := otlpmetrichttp.New(ctx, opts...)
	if err != nil {
		return err
	}
	interval := 5 * time.Second
	mp = metric.NewMeterProvider(
		metric.WithResource(res),
		metric.WithReader(metric.NewPeriodicReader(exp, metric.WithInterval(interval))),
	)
	otel.SetMeterProvider(mp)
	return runtime.Start(runtime.WithMinimumReadMemStatsInterval(time.Second))
}

func shutdownMetrics(ctx context.Context) error {
	if mp == nil {
		return nil
	}
	err := mp.Shutdown(ctx)
	mp = nil
	return err
}
