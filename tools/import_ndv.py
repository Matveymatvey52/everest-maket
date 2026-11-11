"""Импорт настоящих ЖК Москвы и области с ndv.ru (источник, который дала Екатерина).

Что делает:
  1. берёт список новостроек через открытый API ndv.ru;
  2. оставляет ЖК Москвы и области с ценами (без коттеджных посёлков);
  3. скачивает по 4 фото на ЖК и сжимает их в webp (нужен cwebp из Homebrew);
  4. пишет assets/js/zhk.js — данные для витрины, каталога и страниц ЖК.

Запуск из корня проекта:  python3 -I tools/import_ndv.py
Без скачивания фото:      python3 -I tools/import_ndv.py --no-img
"""
import datetime
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img", "zhk")
OUT = os.path.join(ROOT, "assets", "js", "zhk.js")
API = "https://www.ndv.ru/backend-api/realty/new-buildings?&limit=200&offset=0"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

# Цвета линий метро (как их называет ndv.ru)
LINE_COLOR = {
    "red": "#e42313", "green": "#4baf4f", "darkblue": "#0078be", "lightblue": "#19c1f3",
    "brown": "#915133", "orange": "#ef7e24", "purple": "#943e90", "yellow": "#ffd702",
    "gray": "#a1a2a3", "lightgreen": "#b1d332", "darkcyan": "#79cdcd", "pink": "#e74280",
    "magenta": "#de64a1", "heliotrope": "#ac87c5", "goldenrod": "#e9b200",
}
SKIP_NAMES = ("Чайные холмы", "Десяткино")  # Сочи и Ленобласть — не наш регион
QUARTER = {1: "1 кв.", 2: "1 кв.", 3: "1 кв.", 4: "2 кв.", 5: "2 кв.", 6: "2 кв.",
           7: "3 кв.", 8: "3 кв.", 9: "3 кв.", 10: "4 кв.", 11: "4 кв.", 12: "4 кв."}
ROOM = {0: ("studio", "Студии"), 1: ("1", "1-комнатные"), 2: ("2", "2-комнатные"),
        3: ("3", "3-комнатные"), 4: ("4", "4 комнаты и больше"), 5: ("4", "4 комнаты и больше")}


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode("utf-8")


def slug(s):
    return re.sub(r"[^a-z0-9-]+", "-", s.strip().lower()).strip("-")


def clean_name(t):
    t = t.strip()
    t = re.sub(r"^(ЖК|Жилой комплекс|Жилой район|Жилой дом|Мкр\.)\s*", "", t)
    t = re.sub(r"[«»\"]", "", t)
    return re.sub(r"\s+", " ", t).strip(" ,")


def clean_dev(t):
    t = re.sub(r"\s+", " ", t or "").strip()
    t = re.sub(r"(?i)общество с ограниченной ответственностью|специализированный застройщик|\b(ООО|АО|ПАО|ППК|СЗ)\b", "", t)
    t = re.sub(r"[«»\"]", "", t)
    t = re.sub(r"\s+", " ", t).strip(" ,-")
    if t.isupper() and len(t) > 6:
        t = t.title()
    return t


def about(desc):
    t = html.unescape(re.sub(r"<[^>]+>", " ", desc or ""))
    t = re.sub(r"\s+", " ", t).strip()
    out = ""
    for s in re.split(r"(?<=[.!?])\s+", t):
        if len(out) + len(s) > 330:
            break
        out += (" " if out else "") + s
    return out or t[:330]


def region_of(b):
    dd = b.get("fullDadataAddress") or {}
    addr = b.get("addressString") or b.get("addressToString") or ""
    if dd.get("dadataAddressCityArea") == "Новомосковский" or "НАО" in addr or "Новомосковский" in addr:
        return "newmoscow"
    if dd.get("dadataAddressRegion") == "Москва" or ", Москва," in addr:
        return "moscow"
    return "mo"


def district_of(b, region):
    dd = b.get("fullDadataAddress") or {}
    addr = (b.get("addressString") or b.get("addressToString") or "").replace("Россия, ", "")
    if region == "moscow":
        area = dd.get("dadataAddressCityArea")
        d = dd.get("dadataAddressCityDistrict")
        if d:
            return f"Москва, {d}"
        street = addr.replace("Москва, ", "").split(",")[0]
        return f"Москва, {street}" if street and "Москва" not in street and not street.startswith("жилой") else "Москва"
    if region == "newmoscow":
        return "Новая Москва"
    city = dd.get("dadataAddressCity") or dd.get("dadataAddressSettlement") or addr.split(",")[0]
    return f"Подмосковье, {city}"


def deadline_of(b):
    if (b.get("buildingState") or "").startswith("Введен") or b.get("isReady"):
        return "Дом сдан", 2025
    d = ((b.get("housingCommissionAt") or {}).get("date") or "")[:10]
    if d:
        y, m = int(d[:4]), int(d[5:7])
        if y >= 2026:
            return f"{QUARTER[m]} {y}", y
    return "Уточняется", None


def road_of(b):
    best = None
    for d in b.get("distances") or []:
        if d.get("time") and (best is None or d["time"] < best["time"]):
            best = d
    if not best:
        tr = b.get("trainDistances") or []
        best = min(tr, key=lambda d: d.get("time") or 999) if tr else None
    if not best:
        return "", "", "#a1a2a3"
    name = best["toString"].split(":")[0].split("(")[0].strip()
    how = {"foot": "пешком", "transport": "на транспорте", "electro": "на электричке", "drive": "на машине"}.get(best.get("type"), "")
    color = "#a1a2a3"
    for s in b.get("subwayStations") or []:
        if s.get("title") == name:
            color = LINE_COLOR.get(s.get("color"), color)
    return name, f"{best['time']} мин {how}".strip(), color


def rooms_of(b):
    rows = {}
    for f in b.get("flats") or []:
        rc = f.get("roomCount")
        if rc not in ROOM or not f.get("priceNumber"):
            continue
        key, label = ROOM[rc]
        cur = rows.get(key)
        if cur is None or f["priceNumber"] < cur["price"]:
            rows[key] = {"type": key, "label": label, "price": int(f["priceNumber"]),
                         "area": f.get("minArea"), "count": (cur or {}).get("count", 0) + (f.get("flatsCount") or 0)}
        else:
            cur["count"] += f.get("flatsCount") or 0
    order = ["studio", "1", "2", "3", "4"]
    return [rows[k] for k in order if k in rows]


def save_webp(url, path, width):
    if os.path.exists(path):
        return True
    try:
        data = get(url, binary=True)
    except Exception as e:  # фото может не открыться — пропускаем
        print("  фото не скачалось:", url, e)
        return False
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(data)
    try:
        subprocess.run(["cwebp", "-quiet", "-q", "72", "-resize", str(width), "0", tmp.name, "-o", path], check=True)
    except Exception as e:
        print("  cwebp не справился:", e)
        return False
    finally:
        os.unlink(tmp.name)
    return True


def main():
    no_img = "--no-img" in sys.argv
    items = json.loads(get(API))["data"]["items"]["buildings"]
    os.makedirs(IMG_DIR, exist_ok=True)
    out = []
    for b in items:
        name = clean_name(b["complexTitle"])
        price = b.get("objectMinPriceNumber") or 0
        if price < 3_000_000 or b["complexTitle"].startswith("КП") or any(s in name for s in SKIP_NAMES):
            continue
        rooms = rooms_of(b)  # бывает пусто: тогда в карточке «квартиры по запросу»
        sid = slug(b["complexSlug"])
        region = region_of(b)
        dl, year = deadline_of(b)
        metro, walk, color = road_of(b)
        pics = [b.get("mainPicture")] + list(b.get("additionalFiles") or [])
        pics = [p for p in pics if p][:4]
        imgs = []
        for i, p in enumerate(pics):
            fn = f"{sid}-{i}.webp"
            if no_img:
                ok = os.path.exists(os.path.join(IMG_DIR, fn))
            else:
                ok = save_webp(p, os.path.join(IMG_DIR, fn), 760 if i == 0 else 1280)
            if ok:
                imgs.append("zhk/" + fn)
        if not imgs:
            continue
        offer = (b.get("complexSpecialOffers") or "").strip(" !")
        if offer in ("Скоро старт продаж", "Скоро в продаже"):
            offer = ""
        out.append({
            "id": sid, "name": name, "cls": (b.get("complexClass") or "Комфорт").strip(),
            "dev": clean_dev(b.get("developerTitle")),
            "region": region, "district": district_of(b, region),
            "address": (b.get("addressString") or b.get("addressToString") or "").replace("Россия, ", ""),
            "metro": metro, "walk": walk, "color": color,
            "deadline": dl, "year": year, "state": b.get("buildingState") or "",
            "finish": bool(b.get("objectHasFinishing")), "offer": offer,
            "min": int(price), "ppm": int(b.get("objectMinMeterPrice") or 0),
            "rooms": rooms, "onSale": sum(r["count"] for r in rooms),
            "lat": b.get("complexLatitude"), "lon": b.get("complexLongitude"),
            "img": imgs, "about": about(b.get("complexDescription")),
        })
    out.sort(key=lambda z: -z["min"])
    today = datetime.date.today().strftime("%d.%m.%Y")
    js = ("/* Новостройки Москвы и области. Собрано tools/import_ndv.py с ndv.ru " + today + ".\n"
          "   Не править вручную: перезапустите импорт. */\n"
          "window.ZHK_DATA = " + json.dumps({"updated": today, "list": out}, ensure_ascii=False, indent=0) + ";\n")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"ЖК: {len(out)}, файл: {OUT}")


if __name__ == "__main__":
    main()
