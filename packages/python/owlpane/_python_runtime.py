"""CPython runtime gauges (threads, GC, RSS) for Owlpane runtime boards."""

from __future__ import annotations

import gc
import resource
import sys
import threading

from opentelemetry.metrics import CallbackOptions, Observation


def _rss_bytes() -> int:
    usage = resource.getrusage(resource.RUSAGE_SELF)
    rss = int(usage.ru_maxrss)
    # Linux reports KB; macOS reports bytes.
    if sys.platform == "linux":
        return rss * 1024
    return rss


def instrument_python_runtime(meter) -> None:
    """Register semconv-aligned observable gauges on an existing meter."""

    def observe_threads(_options: CallbackOptions):
        yield Observation(threading.active_count())

    def observe_gc(_options: CallbackOptions):
        yield Observation(sum(gc.get_count()))

    def observe_memory(_options: CallbackOptions):
        yield Observation(_rss_bytes())

    meter.create_observable_gauge(
        "process.runtime.python.thread_count",
        callbacks=[observe_threads],
        description="Active Python threads in this interpreter",
    )
    meter.create_observable_gauge(
        "process.runtime.python.gc.count",
        callbacks=[observe_gc],
        description="Cumulative GC collections (gen0+gen1+gen2)",
    )
    meter.create_observable_gauge(
        "process.runtime.python.memory",
        callbacks=[observe_memory],
        unit="By",
        description="Process RSS (best-effort, platform-specific)",
    )
    meter.create_observable_gauge(
        "process.runtime.cpython.memory",
        callbacks=[observe_memory],
        unit="By",
        description="Alias for CPython RSS",
    )
