#!/usr/bin/env python3
"""Validate PostgreSQL schema after migration 20260826_083000_commercial_content_cms."""
import subprocess, sys, os

TEST_USER = os.environ.get("EF_TEST_PG_USER", "test_user")
TEST_PASS = os.environ.get("EF_TEST_PG_PASS", "test_pass")
TEST_DB = os.environ.get("EF_TEST_PG_DB", "ef_test")
TEST_HOST = os.environ.get("EF_TEST_PG_HOST", "localhost")

def sql(q):
    r = subprocess.run(
        ["psql", "-U", TEST_USER, "-d", TEST_DB, "-h", TEST_HOST, "-t", "-A", "-c", q],
        capture_output=True, text=True, env={"PGPASSWORD": TEST_PASS}
    )
    if r.returncode != 0:
        print(f"  SQL ERROR: {r.stderr.strip()}")
        return None
    # Return the raw stdout with all lines
    return r.stdout

def check(label, ok):
    if ok:
        print(f"  ✅ {label}")
    else:
        print(f"  ❌ {label}")
        sys.exit(1)

def has_table(name):
    out = sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;")
    if out is None:
        return False
    return name in out

def has_column(table, col):
    out = sql(f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}' ORDER BY column_name;")
    if out is None:
        return False
    return col in out

def first_row(q):
    """Return first data row value (stripped), or None."""
    out = sql(q)
    if out is None:
        return None
    for line in out.split('\n'):
        line = line.strip()
        if line and not line.startswith(('INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'GRANT', 'ALTER', 'SELECT')):
            return line
    return None

print("═══ SCHEMA VALIDATION ═══\n")

check("homepage table exists", has_table("homepage"))
check("site_settings table exists", has_table("site_settings"))
check("categories table exists", has_table("categories"))
check("homepage_real_flowers_flowers table exists", has_table("homepage_real_flowers_flowers"))
check("homepage_real_flowers_flowers_locales table exists", has_table("homepage_real_flowers_flowers_locales"))
check("media table exists", has_table("media"))

check("hero_hero_image_position column", has_column("homepage", "hero_hero_image_position"))
check("categories.icon", has_column("categories", "icon"))
check("categories.image_id", has_column("categories", "image_id"))
check("categories.sort_order", has_column("categories", "sort_order"))
check("categories.is_active", has_column("categories", "is_active"))

for col in ["contacts_email","contacts_phone","contacts_whatsapp",
            "social_instagram_url","social_facebook_url","social_tiktok_url",
            "company_address","company_postal_code","company_city","company_country",
            "company_company_name","company_tax_id"]:
    check(f"site_settings.{col}", has_column("site_settings", col))

check("realFlowers_flowers.name", has_column("homepage_real_flowers_flowers", "name"))
check("realFlowers_flowers.scientific_name", has_column("homepage_real_flowers_flowers", "scientific_name"))
check("realFlowers_flowers.image_id", has_column("homepage_real_flowers_flowers", "image_id"))
check("realFlowers_flowers_locales.name", has_column("homepage_real_flowers_flowers_locales", "name"))
check("realFlowers_flowers_locales._locale", has_column("homepage_real_flowers_flowers_locales", "_locale"))

locales_type = sql("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname='_locales');")
check("_locales enum type exists", locales_type and "t" in locales_type)

print("\n═══ CRUD TESTS ═══\n")

# Site settings
sql("DELETE FROM site_settings WHERE id=1;")
sql("INSERT INTO site_settings (id, contacts_email, contacts_phone, company_city, company_country) "
    "VALUES (1, 'test@ef.pt', '+351999999999', 'Braga', 'Portugal') "
    "ON CONFLICT (id) DO UPDATE SET contacts_email='test@ef.pt';")
r = first_row("SELECT contacts_email FROM site_settings WHERE id=1;")
check("site_settings write+read: test@ef.pt", r and "test@ef.pt" in r)

# Categories
sql("DELETE FROM categories_locales WHERE _parent_id IN (SELECT id FROM categories WHERE slug='test-cat');")
sql("DELETE FROM categories WHERE slug='test-cat';")
r = first_row("INSERT INTO categories (slug, icon, sort_order, is_active) VALUES ('test-cat', '🌿', 10, true) RETURNING id;")
check("categories insert with icon/sort/isActive", r and r.isdigit())

cat_id = r.strip() if r else None
if cat_id:
    sql(f"INSERT INTO categories_locales (name, _locale, _parent_id) VALUES ('Test Cat', 'pt', {cat_id}) ON CONFLICT DO NOTHING;")

r = first_row("SELECT icon FROM categories WHERE slug='test-cat';")
check("categories read icon: 🌿", r and "🌿" in r)

# Media + relation
sql("DELETE FROM media WHERE id=1;")
sql("INSERT INTO media (id, filename, mime_type, filesize, width, height) "
    "VALUES (1, 'test.jpg', 'image/jpeg', 1000, 800, 600) ON CONFLICT (id) DO NOTHING;")
sql("UPDATE categories SET image_id=1 WHERE slug='test-cat';")
r = first_row("SELECT m.filename FROM categories c LEFT JOIN media m ON c.image_id=m.id WHERE c.slug='test-cat';")
check("categories join with media: test.jpg", r and "test.jpg" in r)

# RealFlowers — need a homepage row first for FK
r = first_row("INSERT INTO homepage (hero_primary_button_link, instagram_handle, cta_button_link) "
              "VALUES ('/catalog', 'eternal.flowers.pt', '/catalog') RETURNING id;")
hp_id = r.strip() if r else None
check("homepage row created for FK", hp_id and hp_id.isdigit())

if hp_id:
    r = first_row(f"INSERT INTO homepage_real_flowers_flowers (_order, _parent_id, name, scientific_name) "
                  f"VALUES (1, {hp_id}, 'Vanda', 'Vanda coerulea') RETURNING id;")
    check("realFlowers insert", r and r.isdigit())
    fid = r.strip() if r else None
if fid:
    sql(f"INSERT INTO homepage_real_flowers_flowers_locales (name, _locale, _parent_id) "
        f"VALUES ('Orquídea Vanda', 'pt', {fid}) ON CONFLICT DO NOTHING;")
    sql(f"INSERT INTO homepage_real_flowers_flowers_locales (name, _locale, _parent_id) "
        f"VALUES ('Vanda Orchid', 'en', {fid}) ON CONFLICT DO NOTHING;")

r = first_row(f"SELECT name FROM homepage_real_flowers_flowers_locales WHERE _parent_id={fid} AND _locale='pt';")
check("realFlowers locale PT: Orquídea Vanda", r and "Orquídea Vanda" in r)
r = first_row(f"SELECT name FROM homepage_real_flowers_flowers_locales WHERE _parent_id={fid} AND _locale='en';")
check("realFlowers locale EN: Vanda Orchid", r and "Vanda Orchid" in r)

# Cleanup
sql("DELETE FROM categories_locales WHERE _parent_id IN (SELECT id FROM categories WHERE slug='test-cat');")
sql("DELETE FROM categories WHERE slug='test-cat';")
sql("DELETE FROM homepage_real_flowers_flowers_locales;")
sql("DELETE FROM homepage_real_flowers_flowers;")
sql("DELETE FROM homepage WHERE id IN (SELECT id FROM homepage ORDER BY id DESC OFFSET 1);")  # keep the original
sql("DELETE FROM media WHERE id=1;")

print("\n═══ ALL VALIDATIONS PASSED ✅ ═══")