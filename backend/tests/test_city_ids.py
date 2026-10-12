from app.city_ids import CityRef, make_city_id, parse_city_id, slugify


def test_slugify_handles_punctuation_and_unicode():
    assert slugify("St. Louis") == "st-louis"
    assert slugify("Saint-Étienne") == "saint-étienne"
    assert slugify("  Rio de  Janeiro ") == "rio-de-janeiro"
    assert slugify("東京") == "東京"


def test_make_and_parse_round_trip():
    city_id = make_city_id("Santa Fe", "NM", "US")
    assert city_id == "santa-fe--nm--us"
    assert parse_city_id(city_id) == CityRef("santa fe", "nm", "us")


def test_parse_without_region():
    assert parse_city_id("singapore--sg") == CityRef("singapore", "", "sg")


def test_parse_legacy_underscore_ids():
    # The old app built IDs like this; multi-word names used to be mis-parsed.
    assert parse_city_id("santa_fe_us") == CityRef("santa fe", "", "us")
    assert parse_city_id("rio_de_janeiro_br") == CityRef("rio de janeiro", "", "br")
    assert parse_city_id("paris_fr").search_text == "paris"


def test_parse_name_only():
    assert parse_city_id("paris") == CityRef("paris", "", "")
