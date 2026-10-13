"""Сборка страниц Everest: вставляет общие части в каждую страницу.

Исходники: src/partials.html (части между маркерами <!-- @part имя -->)
           src/pages/*.html (первая строка — <!--meta {...json...} -->)
Результат: *.html в корне проекта.
Запуск:    python3 -I tools/build.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")

NAV = [
    ("katalog", "katalog.html", "Каталог"),
    ("ipoteka", "ipoteka.html", "Ипотека"),
    ("uslugi", "uslugi.html", "Услуги"),
    ("obo-mne", "obo-mne.html", "Обо мне"),
    ("zhurnal", "zhurnal.html", "Журнал"),
    ("kontakty", "obo-mne.html#kontakty", "Контакты"),
]


def load_parts():
    text = open(os.path.join(SRC, "partials.html"), encoding="utf-8").read()
    parts = {}
    for m in re.finditer(r"<!-- @part (\S+) -->\n(.*?)(?=<!-- @part |\Z)", text, re.S):
        parts[m.group(1)] = m.group(2).strip("\n")
    return parts


def nav_html(active, cls):
    out = []
    for key, href, label in NAV:
        cur = ' aria-current="page"' if key == active else ""
        klass = f' class="{cls}"' if cls else ""
        out.append(f'<a{klass} href="{href}"{cur}>{label}</a>')
    return "\n        ".join(out)


def versioned(html):
    """Добавляет ?v=<хеш содержимого> к css и js, чтобы браузер не брал старую копию."""
    import hashlib
    def rep(m):
        path = m.group(2)
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            return m.group(0)
        h = hashlib.md5(open(full, "rb").read()).hexdigest()[:8]
        return f'{m.group(1)}{path}?v={h}"'
    return re.sub(r'((?:href|src)=")(assets/(?:css|js|fonts)/[^"?]+\.(?:css|js))"', rep, html)


def build():
    parts = load_parts()
    pages_dir = os.path.join(SRC, "pages")
    built = []
    for name in sorted(os.listdir(pages_dir)):
        if not name.endswith(".html"):
            continue
        raw = open(os.path.join(pages_dir, name), encoding="utf-8").read()
        m = re.match(r"<!--meta (\{.*?\}) -->\n", raw, re.S)
        if not m:
            raise SystemExit(f"{name}: нет строки <!--meta ...-->")
        meta = json.loads(m.group(1))
        body = raw[m.end():]
        active = meta.get("nav", "")
        head = parts["head"].replace("{{TITLE}}", meta["title"]).replace("{{DESC}}", meta["desc"])
        head = head.replace("{{EXTRA_HEAD}}", meta.get("extra_head", ""))
        header = parts["header"].replace("{{NAV}}", nav_html(active, "nav__link"))
        header = header.replace("{{MNAV}}", nav_html(active, ""))
        page = (
            "<!doctype html>\n<html lang=\"ru\">\n<head>\n" + head + "\n</head>\n"
            f"<body class=\"page--{meta.get('page', 'inner')} page--overlay-header\">\n"
            + parts["sprite"] + "\n"
            + header + "\n"
            + "<main id=\"main\">\n" + body.strip("\n") + "\n</main>\n"
            + parts["footer"] + "\n"
            + parts["modals"] + "\n"
            + parts["floating"] + "\n"
            + parts["scripts"] + "\n"
            + "</body>\n</html>\n"
        )
        page = versioned(page)
        with open(os.path.join(ROOT, name), "w", encoding="utf-8") as f:
            f.write(page)
        built.append(name)
    print("Собрано:", ", ".join(built))


if __name__ == "__main__":
    sys.exit(build())
