"""Новости рынка недвижимости с РБК для страницы «Журнал» и главной.

Берёт RSS «РБК Недвижимость», оставляет новости о жилье, ипотеке и ценах,
пишет assets/data/news.json: заголовок, короткий анонс, дата, картинка и ссылка.
Полный текст не копируем: на сайте анонс и ссылка на РБК.

Запуск: python3 -I tools/news.py  (на GitHub — каждые 2 часа, .github/workflows/news.yml)
"""
import email.utils
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "data", "news.json")
FEED = "https://rssexport.rbc.ru/realty/news/30/full.rss"
RBC = "{https://www.rbc.ru}"
KEEP_CAT = {"Жилье", "Деньги"}
WORDS = re.compile(r"новостро|ипотек|застройщ|квартир|жиль|цен[аыу]|метр|ключев|ставк|рынок|сделк|аренд", re.I)
SKIP = re.compile(r"ручк|батаре|управляющ|ЖКУ|посуточн|ремонт|\bдач", re.I)


def main():
    req = urllib.request.Request(FEED, headers={"User-Agent": "Mozilla/5.0 (site news reader)"})
    root = ET.fromstring(urllib.request.urlopen(req, timeout=40).read())
    out = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        cat = (it.findtext("category") or "").strip()
        anons = (it.findtext(RBC + "anons") or it.findtext("description") or "").strip()
        if cat not in KEEP_CAT or SKIP.search(title) or not WORDS.search(title + " " + anons):
            continue
        dt = email.utils.parsedate_to_datetime(it.findtext("pubDate"))
        enc = it.find("enclosure")
        anons = re.sub(r"\s+", " ", anons)
        if len(anons) > 220:
            anons = anons[:220].rsplit(" ", 1)[0] + "…"
        out.append({
            "title": title, "anons": anons, "link": (it.findtext("link") or "").strip(),
            "date": dt.isoformat(), "cat": cat,
            "tag": (it.findtext(RBC + "tag") or "").strip(),
            "img": enc.get("url") if enc is not None else "",
        })
    if not out:
        print("Новостей нет, файл не трогаю")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"source": "РБК Недвижимость", "items": out[:20]}, f, ensure_ascii=False, indent=1)
    print("Новостей:", len(out[:20]))


if __name__ == "__main__":
    main()
