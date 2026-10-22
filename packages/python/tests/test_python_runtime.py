from owlpane._python_runtime import _rss_bytes


def test_rss_bytes_positive():
    assert _rss_bytes() > 0
