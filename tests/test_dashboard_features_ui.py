from selenium.webdriver.common.by import By

from pages.dashboard_page import DashboardPage


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------

def test_favorite_pair_can_be_added_and_removed(authenticated_session, base_url):
    """A new user starts empty; stars add/remove a saved pair and it persists after refresh."""
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_overview()

    # A newly registered user must not inherit any default favorite pairs.
    assert dashboard.is_favorites_empty()
    assert dashboard.get_favorite_card_texts() == []

    pair = "USD/ZAR"

    # The pair is offered separately as an unsaved option with an outline star.
    dashboard.toggle_candidate_favorite(pair)
    dashboard.wait_for_favorite_count(1)

    # The saved favorite is now shown in the user's personal watchlist.
    assert pair in dashboard.get_favorite_pairs()
    assert dashboard.get_favorite_star_text(pair) == "★"

    # Refresh to prove the favorite is persisted by the backend, not only cached in JS.
    dashboard.driver.refresh()
    dashboard.go_to_overview()
    dashboard.wait_for_favorite_count(1)
    assert pair in dashboard.get_favorite_pairs()
    assert dashboard.get_favorite_star_text(pair) == "★"

    # Clicking the filled star removes only that user's saved favorite.
    dashboard.toggle_favorite_pair(pair)
    dashboard.wait_for_favorite_count(0)
    assert dashboard.is_favorites_empty()


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

def test_portfolio_add_and_remove_holding(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_portfolio()

    before = dashboard.get_portfolio_list_texts()
    dashboard.add_portfolio_holding(currency="USD", amount="500", notes="Test holding")
    dashboard.wait_for_list_change(dashboard.get_portfolio_list_texts, before)

    items = dashboard.get_portfolio_list_texts()
    assert any("500" in item and "USD" in item for item in items)

    dashboard.remove_portfolio_item(0)
    dashboard.wait_for_list_change(dashboard.get_portfolio_list_texts, items)

    items_after = dashboard.get_portfolio_list_texts()
    assert len(items_after) < len(items)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def test_alert_add_and_remove(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_alerts()

    before = dashboard.get_alerts_list_texts()
    dashboard.add_alert(base="USD", quote="ZAR", direction="above", target_rate="20")
    dashboard.wait_for_list_change(dashboard.get_alerts_list_texts, before)

    items = dashboard.get_alerts_list_texts()
    assert any("USD/ZAR" in item and "20" in item for item in items)

    dashboard.remove_alert_item(0)
    dashboard.wait_for_list_change(dashboard.get_alerts_list_texts, items)

    items_after = dashboard.get_alerts_list_texts()
    assert len(items_after) < len(items)


def test_alert_direction_options_present(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_alerts()

    direction_options = [
        option.get_attribute("value")
        for option in dashboard.driver.find_element(*dashboard.ALERT_DIRECTION).find_elements(
            By.TAG_NAME, "option"
        )
    ]
    assert "above" in direction_options
    assert "below" in direction_options


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------

def test_trend_chart_handles_available_or_missing_data(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_trends()

    if dashboard.is_trend_chart_showing():
        assert dashboard.is_trend_chart_showing()
    else:
        assert "stored" in dashboard.get_trend_message().lower() or "no active threshold" in dashboard.get_trend_message().lower()
