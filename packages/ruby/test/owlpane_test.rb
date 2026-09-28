# frozen_string_literal: true

require "minitest/autorun"
require_relative "../lib/owlpane"

# Every env var this module reads is scoped to one test via ENV.delete/[]= + an
# ensure block, so tests can run in any order without leaking state into each other.
class OwlpaneTest < Minitest::Test
  ENV_KEYS = %w[OTEL_SDK_DISABLED OTEL_EXPORTER_OTLP_ENDPOINT OWLPANE_INGEST_URL OWLPANE_INGEST_KEY OTEL_SERVICE_NAME].freeze

  def setup
    @saved = ENV_KEYS.to_h { |k| [k, ENV[k]] }
    ENV_KEYS.each { |k| ENV.delete(k) }
  end

  def teardown
    @saved.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  def test_otlp_endpoint_resolves_from_otel_exporter_otlp_endpoint_and_strips_trailing_slash
    ENV["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://ingest.example.com/"
    assert_equal "https://ingest.example.com", Owlpane.otlp_endpoint
  end

  def test_otlp_endpoint_falls_back_to_owlpane_ingest_url
    ENV["OWLPANE_INGEST_URL"] = "https://fallback.example.com"
    assert_equal "https://fallback.example.com", Owlpane.otlp_endpoint
  end

  def test_otlp_endpoint_prefers_otel_var_over_owlpane_fallback
    ENV["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otel.example.com"
    ENV["OWLPANE_INGEST_URL"] = "https://fallback.example.com"
    assert_equal "https://otel.example.com", Owlpane.otlp_endpoint
  end

  def test_otlp_endpoint_nil_when_nothing_set
    assert_nil Owlpane.otlp_endpoint
  end

  def test_otlp_endpoint_nil_when_sdk_disabled_even_with_endpoint_set
    ENV["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://ingest.example.com"
    ENV["OTEL_SDK_DISABLED"] = "true"
    assert_nil Owlpane.otlp_endpoint
  end

  def test_sdk_disabled_is_case_insensitive
    ENV["OTEL_SDK_DISABLED"] = "TRUE"
    assert Owlpane.sdk_disabled?
  end

  def test_sdk_disabled_false_for_anything_else
    ENV["OTEL_SDK_DISABLED"] = "false"
    refute Owlpane.sdk_disabled?
  end

  def test_authorization_header_wraps_the_ingest_key_as_a_bearer_token
    ENV["OWLPANE_INGEST_KEY"] = "owl_ing_abc123"
    assert_equal "Bearer owl_ing_abc123", Owlpane.authorization_header
  end

  def test_authorization_header_nil_when_no_key
    assert_nil Owlpane.authorization_header
  end

  def test_service_name_defaults_to_ruby_app
    assert_equal "ruby-app", Owlpane.service_name
  end

  def test_service_name_uses_otel_service_name_when_set
    ENV["OTEL_SERVICE_NAME"] = "checkout-worker"
    assert_equal "checkout-worker", Owlpane.service_name
  end
end
