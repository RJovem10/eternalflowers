#!/usr/bin/env python3
"""
Backfill script for Eternal Flowers — local dev only.

Populates new fields added to Payload schema with existing hardcoded data.
Idempotent and non-destructive: never overwrites already-prefilled values.

Usage:
  python3 scripts/backfill.py

Prerequisites:
  - Dev server running on http://localhost:3457
  - SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars (or user already created)
"""
import json, os, sys, time, requests, re
from pathlib import Path

BASE = "http://localhost:3457/api"
HEADERS = {"Content-Type": "application/json"}

# ===== Credenciais =====
SEED_ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL")
SEED_ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD")

if not SEED_ADMIN_EMAIL or not SEED_ADMIN_PASSWORD:
    print("Define SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no ambiente.")
    sys.exit(1)

# Proteção contra execução acidental em produção
NODE_ENV = os.environ.get("NODE_ENV", "development")
if NODE_ENV == "production":
    print("ERRO: Não executar em produção.")
    sys.exit(1)


def get_token():
    """Obtain an auth token via login or first-register."""
    for url_path in ["/api/users/login", "/api/users/first-register"]:
        try:
            url = BASE.replace("/api", url_path)
            r = requests.post(url, json={"email": SEED_ADMIN_EMAIL, "password": SEED_ADMIN_PASSWORD}, timeout=15)
            if r.status_code == 200 and r.json().get("token"):
                return r.json()["token"]
        except:
            pass
    print("⚠ Could not authenticate.")
    return None


TOKEN = get_token()
AUTH_HEADERS = {"Content-Type": "application/json", "Authorization": f"JWT {TOKEN}"} if TOKEN else HEADERS


def api(path, method="GET", data=None):
    url = f"{BASE}/{path.lstrip('/')}"
    if method == "GET":
        r = requests.get(url, headers=AUTH_HEADERS, timeout=15)
    elif method == "PATCH" or method == "PUT":
        r = requests.request(method, url, headers=AUTH_HEADERS, json=data, timeout=15)
    elif method == "POST":
        r = requests.post(url, headers=AUTH_HEADERS, json=data, timeout=15)
    else:
        raise ValueError(f"Unsupported method: {method}")
    if r.status_code >= 400:
        print(f"⚠ {method} {url} → {r.status_code}: {r.text[:200]}")
    return r.json() if r.text else {}


def extract_phone_number(raw: str) -> str:
    """Extract just the digits from a phone number or wa.me URL."""
    # If it's a wa.me URL, extract the number
    m = re.search(r'wa\.me/(\d+)', raw)
    if m:
        return m.group(1)
    # Otherwise strip all non-digits
    return re.sub(r'[^0-9]', '', raw)


def backfill_categories():
    """Backfill category emoji icons from the hardcoded map."""
    print("\n📁 Backfilling Categories...")
    icon_map = {
        "brincos": "💎",
        "aneis": "💍",
        "pingentes": "🌙",
        "colares": "📿",
        "pulseiras": "🔗",
        "conjuntos": "✨",
        "decoracao": "🏺",
    }
    result = api("categories?limit=50")
    cats = result.get("docs", [])
    updated = 0
    for cat in cats:
        slug = cat.get("slug", "")
        if slug in icon_map and not cat.get("icon"):
            new_icon = icon_map[slug]
            api(f"categories/{cat['id']}", "PATCH", {"icon": new_icon})
            print(f"  ✅ {slug}: icon → {new_icon}")
            updated += 1
        elif cat.get("icon"):
            print(f"  ⏭ {slug}: icon already set ({cat['icon']})")
        else:
            print(f"  ⏭ {slug}: no icon mapping or slug unknown")
    print(f"  → {updated} categories updated")


def backfill_sitesettings():
    """Backfill site-settings with data from homepage.footer if empty."""
    print("\n🔧 Backfilling Site Settings...")

    try:
        settings = api("globals/site-settings")
    except Exception as e:
        print(f"  ⚠ Could not fetch site-settings: {e}")
        return

    # Get footer data
    homepage = api("globals/homepage")
    footer = homepage.get("footer", {})

    contacts = settings.get("contacts", {})
    social = settings.get("social", {})
    patch_data = {}

    # Backfill email
    if not contacts.get("email") and footer.get("email"):
        patch_data.setdefault("contacts", {})["email"] = footer["email"]
        print(f"  ✅ contacts.email → {footer['email']}")

    # Backfill phone
    if not contacts.get("phone") and footer.get("phone"):
        patch_data.setdefault("contacts", {})["phone"] = footer["phone"]
        print(f"  ✅ contacts.phone → {footer['phone']}")

    # Backfill whatsapp — store clean number from URL
    if not contacts.get("whatsapp") and footer.get("whatsappUrl"):
        clean = extract_phone_number(footer["whatsappUrl"])
        if clean:
            patch_data.setdefault("contacts", {})["whatsapp"] = clean
            print(f"  ✅ contacts.whatsapp → {clean}")

    # Backfill instagram
    if not social.get("instagramUrl") and footer.get("instagramUrl"):
        patch_data.setdefault("social", {})["instagramUrl"] = footer["instagramUrl"]
        print(f"  ✅ social.instagramUrl → {footer['instagramUrl']}")

    if patch_data:
        api("globals/site-settings", "POST", patch_data)
    else:
        print("  ⏭ Site settings already populated")


def main():
    print("=" * 50)
    print("🔄 Backfill — Eternal Flowers Non-Destructive Migration")
    print("=" * 50)

    backfill_categories()
    backfill_sitesettings()

    print("\n✅ Backfill complete.")
    print("⚠ Run with dev server on http://localhost:3457")
    print("=" * 50)


if __name__ == "__main__":
    main()