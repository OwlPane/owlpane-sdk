import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.context.Scope;

/** OpenTelemetry Java agent + OTEL_* env (InstallGuide → Any OpenTelemetry SDK). */
public class App {
  public static void main(String[] args) throws Exception {
    boolean rich = "rich".equalsIgnoreCase(System.getenv("OWLPANE_DOGFOOD_MODE"));
    var tracer = GlobalOpenTelemetry.getTracer("owlpane-dogfood");
    Span server =
        tracer
            .spanBuilder("GET /demo")
            .setSpanKind(SpanKind.SERVER)
            .setAttribute("http.request.method", "GET")
            .setAttribute("http.route", "/demo")
            .setAttribute("http.response.status_code", 200L)
            .startSpan();
    try (Scope ignored = server.makeCurrent()) {
      Thread.sleep(40);
      if (rich) {
        Span db =
            tracer
                .spanBuilder("SELECT orders")
                .setSpanKind(SpanKind.CLIENT)
                .setAttribute("db.system", "postgresql")
                .setAttribute("db.operation.name", "SELECT")
                .startSpan();
        Thread.sleep(15);
        db.end();
      }
    } finally {
      server.end();
    }

    if (rich) {
      Span errSpan =
          tracer
              .spanBuilder("POST /checkout")
              .setSpanKind(SpanKind.SERVER)
              .setAttribute("http.request.method", "POST")
              .setAttribute("http.route", "/checkout")
              .setAttribute("http.response.status_code", 500L)
              .startSpan();
      RuntimeException ex = new RuntimeException("Downstream settlement timeout");
      errSpan.recordException(ex);
      errSpan.setStatus(StatusCode.ERROR, ex.getMessage());
      errSpan.end();
    }
    System.out.println("span emitted");
  }
}
