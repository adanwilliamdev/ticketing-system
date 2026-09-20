from app.token import generate_reservation_token


def test_token_is_url_safe_and_43_chars():
    token = generate_reservation_token()
    assert len(token) == 43
    assert all(c.isalnum() or c in "-_" for c in token)


def test_tokens_are_unique():
    tokens = {generate_reservation_token() for _ in range(1000)}
    assert len(tokens) == 1000
