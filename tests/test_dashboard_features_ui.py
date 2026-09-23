import pytest

from pages.dashboard_page import DashboardPage


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------

def test_favorite_star_adds_and_removes_chip(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()

    before = dashboard.get_favorite_chip_texts()
    dashboard.toggle_favorite()
    dashboard.wait_for_favorite_chip_count(len(before) + 1)

    after_add = dashboard.get_favorite_chip_texts()
    assert len(after_add) == len(before) + 1
    assert dashboard.get_favorite_star_text() == "\u2605"  # filled star

    dashboard.toggle_favorite()
    dashboard.wait_for_favorite_chip_count(len(before))

    after_remove = dashboard.get_favorite_chip_texts()
    assert len(after_remove) == len(before)
    assert dashboard.get_favorite_star_text() == "\u2606"  # empty star


def test_favorite_chip_click_removes_it(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()

    dashboard.toggle_favorite()
    dashboard.wait_for_favorite_chip_count(1)
    chips_before = dashboard.get_favorite_chip_texts()
    assert len(chips_before) >= 1

    dashboard.click_favorite_chip(0)
    dashboard.wait_for_favorite_chip_count(len(chips_before) - 1)

    chips_after = dashboard.get_favorite_chip_texts()
    assert len(chips_after) == len(chips_before) - 1


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

def test_portfolio_add_and_remove_holding(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_portfolio()

    before = dashboard.get_portfolio_list_texts()
    dashboard.add_portfolio_holding(currency="USD", amount="500", notes="Test holding")
    dashboard.wait_for_list_change(dashboard.get_portfolio_list_texts, len(before))

    items = dashboard.get_portfolio_list_texts()
    assert any("500" in item and "USD" in item for item in items)

    dashboard.remove_portfolio_item(0)
    dashboard.wait_for_list_change(dashboard.get_portfolio_list_texts, len(items))

    items_after = dashboard.get_portfolio_list_texts()
    assert len(items_after) < len(items) or "No holdings" in items_after[0]


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def test_alert_add_and_remove(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_alerts()

    before = dashboard.get_alerts_list_texts()
    dashboard.add_alert(base="USD", quote="ZAR", direction="above", target_rate="20")
    dashboard.wait_for_list_change(dashboard.get_alerts_list_texts, len(before))

    items = dashboard.get_alerts_list_texts()
    assert any("USD" in item and "ZAR" in item and "20" in item for item in items)

    dashboard.remove_alert_item(0)
    dashboard.wait_for_list_change(dashboard.get_alerts_list_texts, len(items))

    items_after = dashboard.get_alerts_list_texts()
    assert len(items_after) < len(items) or "No alerts" in items_after[0]


def test_alert_direction_options_present(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()
    dashboard.go_to_alerts()

    direction_options = [
        opt.get_attribute("value")
        for opt in dashboard.driver.find_element(*dashboard.ALERT_DIRECTION).find_elements(
            "tag name", "option"
        )
    ]
    assert "above" in direction_options
    assert "below" in direction_options


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------

def test_trend_sparkline_renders_something(authenticated_session, base_url):
    dashboard = DashboardPage(authenticated_session, base_url)
    dashboard.open_dashboard()

    has_chart = dashboard.is_sparkline_showing_chart()
    if not has_chart:
        text = dashboard.get_sparkline_text()
        assert "not enough trend data" in text.lower()
    else:
        assert has_chart