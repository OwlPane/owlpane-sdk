"""Optional OTLP runtime/process metrics (Owlpane Runtimes charts)."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.resources import Resource

    from owlpane._generated_config import Config

_meter_provider: Optional["MeterProvider"] = None


def runtime_metrics_enabled() -> bool:
    return os.environ.get("OWLPANE_RUNTIME_METRICS", "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )


def start_runtime_metrics(cfg: "Config", resource: "Resource") -> None:
    global _meter_provider
    if not runtime_metrics_enabled() or _meter_provider is not None:
        return
    try:
        from opentelemetry import metrics
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
        from opentelemetry.instrumentation.system_metrics import SystemMetricsInstrumentor
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    except ImportError:
        return

    headers = {}
    if cfg.authorization:
        headers["Authorization"] = cfg.authorization
    interval_ms = max(
        5000,
        int(os.environ.get("OWLPANE_METRICS_EXPORT_INTERVAL_MS", "5000") or "5000"),
    )
    reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(
            endpoint=f"{cfg.base_url}/v1/metrics",
            headers=headers or None,
        ),
        export_interval_millis=interval_ms,
    )
    _meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(_meter_provider)
    SystemMetricsInstrumentor().instrument(meter_provider=_meter_provider)
    try:
        from owlpane._python_runtime import instrument_python_runtime

        instrument_python_runtime(metrics.get_meter("owlpane.runtime"))
    except Exception:
        pass


def shutdown_runtime_metrics() -> None:
    global _meter_provider
    if _meter_provider is not None:
        _meter_provider.shutdown()
        _meter_provider = None
