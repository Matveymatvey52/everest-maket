/* Сайт Екатерины Чукоминой — поведение. Без библиотек, родной скролл.
   Карта подгружает Leaflet только когда её открыли. */
(function () {
  "use strict";
  const D = window.SITE;
  const IMG = D.IMG;
  document.documentElement.classList.add("js");

  /* ---------- Утилиты ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const nf = new Intl.NumberFormat("ru-RU");
  const NB = " ";
  const rub = (n) => nf.format(Math.round(n)) + NB + "₽";
  const mln = (n) => (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + NB + "млн" + NB + "₽";
  const mlnShort = (n) => (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + NB + "млн";
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };
  const ico = (n, cls = "") => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const params = new URLSearchParams(location.search);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
  };
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const dayMonth = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const endOfDay = (iso) => new Date(iso + "T23:59:59+03:00");

  /* ---------- Откуда пришёл человек (метки ссылок) ---------- */
  // Первое касание храним в браузере: потом оно уходит вместе с заявкой.
  (function rememberSource() {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    const got = {};
    keys.forEach((k) => { if (params.get(k)) got[k] = params.get(k); });
    if (!store.get("src:first", null)) {
      const ref = document.referrer && !document.referrer.includes(location.host) ? document.referrer : "";
      store.set("src:first", { ...got, ref, landing: location.pathname, at: new Date().toISOString() });
    }
    if (Object.keys(got).length) store.set("src:last", got);
  })();

  /* ---------- Модель ЖК ---------- */
  const CLS_RANK = { "Премиум": 0, "Бизнес": 1, "Комфорт": 2 };
  const zhkMap = Object.fromEntries(D.ZHK.map((z) => [z.id, z]));
  const premiumFirst = (a, b) => (CLS_RANK[a.cls] ?? 3) - (CLS_RANK[b.cls] ?? 3) || b.min - a.min;
  const roomName = { studio: "студию", "1": "однокомнатную", "2": "двухкомнатную", "3": "трёхкомнатную", "4": "квартиру от 4 комнат" };

  /* ---------- Избранное ---------- */
  let favs = new Set(store.get("everest:fav", []));
  function syncFavCount() {
    $$("[data-fav-count]").forEach((el) => {
      const n = [...favs].filter((k) => k.startsWith("z:")).length;
      el.textContent = n;
      el.hidden = n === 0;
    });
  }
  function favBtn(key, name, extra = "") {
    const on = favs.has(key);
    return `<button class="fav-btn${on ? " is-on" : ""}${extra}" type="button" data-fav="${key}" aria-pressed="${on}" aria-label="${on ? "Убрать из избранного" : "В избранное"}: ${esc(name)}">${ico("heart")}</button>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]");
    if (!b) return;
    e.preventDefault();
    const k = b.dataset.fav;
    const on = !favs.has(k);
    on ? favs.add(k) : favs.delete(k);
    store.set("everest:fav", [...favs]);
    $$(`[data-fav="${CSS.escape(k)}"]`).forEach((x) => {
      x.classList.toggle("is-on", on);
      x.setAttribute("aria-pressed", on);
    });
    syncFavCount();
    toast(on ? "Добавили в избранное" : "Убрали из избранного");
  });

  /* ---------- Тост ---------- */
  let toastTimer;
  function toast(text) {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.innerHTML = ico("check") + `<span>${esc(text)}</span>`;
    requestAnimationFrame(() => t.classList.add("is-on"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
  }

  /* ---------- Карточка ЖК ---------- */
  function roomBtn(z, r, cls = "zhk-room") {
    const ctx = `ЖК ${z.name}: ${r.label.toLowerCase()} от ${r.area} м², от ${mlnShort(r.price)}`;
    return `<button class="${cls}" type="button" data-open="callback" data-kind="Квартира в ЖК" data-context="${esc(ctx)}" data-context-title="${esc("Подобрать " + roomName[r.type] + " в ЖК «" + z.name + "»")}">
      <span class="zhk-room__t">${esc(r.label)}</span><span class="zhk-room__a">от ${r.area}${NB}м²</span><b class="zhk-room__p">от ${mlnShort(r.price)}</b>
    </button>`;
  }
  function zhkCard(z) {
    const tags = [`<span class="tag">${esc(z.cls)}</span>`];
    if (z.offer) tags.push(`<span class="tag tag--gold">${esc(z.offer)}</span>`);
    const extra = z.rooms.length - 3;
    const rooms = z.rooms.length
      ? `<div class="zhk-rooms">${z.rooms.slice(0, 3).map((r) => roomBtn(z, r)).join("")}${extra > 0 ? `<span class="zhk-rooms__more">ещё ${extra} ${plural(extra, "тип", "типа", "типов")} квартир на странице ЖК</span>` : ""}</div>`
      : `<div class="zhk-rooms zhk-rooms--empty"><button class="zhk-rooms__ask" type="button" data-open="callback" data-kind="Квартира в ЖК" data-context="${esc("ЖК " + z.name + ": квартиры и цены")}" data-context-title="${esc("Квартиры в ЖК «" + z.name + "»")}"><b>Квартиры и цены по запросу</b><span>Застройщик не публикует прайс. Пришлю свободные квартиры за день.</span></button></div>`;
    return `<article class="zhk-card">
      <div class="zhk-card__media">
        <img src="${IMG}${z.img[0]}" alt="ЖК «${esc(z.name)}»" loading="lazy" width="760" height="570">
        <div class="zhk-card__tags">${tags.join("")}</div>
      </div>
      ${favBtn("z:" + z.id, "ЖК " + z.name)}
      <div class="zhk-card__body">
        <h3 class="zhk-card__name"><a href="zhk.html?id=${z.id}">${esc(z.name)}</a></h3>
        <div class="zhk-card__loc">
          ${z.metro ? `<span class="loc-line"><i class="metro-dot" style="background:${z.color}"></i>${esc(z.metro)}${z.walk ? ", " + esc(z.walk) : ""}</span>` : ""}
          <span class="loc-line">${ico("pin", "ico--sm")}${esc(z.district)}</span>
        </div>
        ${rooms}
        <div class="zhk-card__facts">
          <div><span class="fact__k">Сдача</span><span class="fact__v">${esc(z.deadline)}</span></div>
          <div><span class="fact__k">Класс</span><span class="fact__v">${esc(z.cls)}</span></div>
          <div><span class="fact__k">В продаже</span><span class="fact__v">${z.onSale ? z.onSale + " " + plural(z.onSale, "квартира", "квартиры", "квартир") : "по запросу"}</span></div>
        </div>
        <div class="zhk-card__price"><b>от ${mln(z.min)}</b>${z.ppm ? `<span>от ${nf.format(Math.round(z.ppm / 1000))} тыс. ₽/м²</span>` : ""}</div>
      </div>
    </article>`;
  }

  /* ---------- Модальные окна ---------- */
  let lastFocus = null;
  function openModal(id, opts = {}) {
    const m = document.getElementById(id);
    if (!m) return;
    if (!m.classList.contains("is-open")) lastFocus = document.activeElement;
    $$(".modal.is-open").forEach((x) => { if (x !== m) { x.classList.remove("is-open"); x.setAttribute("aria-hidden", "true"); } });
    const ctx = $("[data-context]", m);
    if (ctx) ctx.value = opts.context || "";
    const kind = $("[data-kind-field]", m);
    if (kind) kind.value = opts.kind || "";
    const ttl = $("[data-context-title]", m);
    if (ttl) ttl.textContent = opts.contextTitle || ttl.dataset.default;
    const host = $("[data-form-host]", m);
    if (host && host.classList.contains("is-sent") && m.id !== "modal-quiz") host.classList.remove("is-sent");
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    setTimeout(() => {
      if (opts.noFocus) { $(".modal__close", m)?.focus({ preventScroll: true }); return; }
      const f = $(".modal__box input:not([type=hidden]):not([type=radio]):not([type=checkbox]), .modal__box .opt input", m);
      (f || $(".modal__close", m))?.focus({ preventScroll: true });
    }, 60);
  }
  function closeModal(m) {
    m = m || $(".modal.is-open");
    if (!m) return;
    m.classList.remove("is-open");
    m.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o) {
      e.preventDefault();
      openModal("modal-" + o.dataset.open, { context: o.dataset.context, contextTitle: o.dataset.contextTitle, kind: o.dataset.kind });
      return;
    }
    if (e.target.closest("[data-close]") || e.target.classList.contains("modal__scrim")) { closeModal(e.target.closest(".modal")); return; }
    const sv = e.target.closest("[data-svc]");
    if (sv) { e.preventDefault(); showService(sv.dataset.svc); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); closeMenu(); $(".fab")?.classList.remove("is-open"); }
  });

  function showInfo(title, html) {
    const m = $("#modal-info");
    $(".modal__title", m).textContent = title;
    $("[data-info-body]", m).innerHTML = html;
    openModal("modal-info", { noFocus: true });
  }

  function showService(id) {
    const s = D.SERVICES.find((x) => x.id === id);
    if (!s) return;
    showInfo(s.t, `<div class="svc-detail">
      <div><div class="svc-detail__price">${s.price}</div><p class="caption mt-s">${esc(s.sub)}</p></div>
      <p class="muted">${esc(s.d)}</p>
      <div><p class="h4">Что входит</p><ul class="checklist mt-s">${s.inc.map((i) => `<li>${ico("check")}${esc(i)}</li>`).join("")}</ul></div>
      <div class="spec"><div><span>Оплата</span><b>${esc(s.pay)}</b></div><div><span>Сроки</span><b>${esc(s.time)}</b></div></div>
      <button class="btn btn--gold btn--block" type="button" data-open="callback" data-kind="Услуга" data-context="Услуга: ${esc(s.t)}" data-context-title="${esc(s.t)}">Заказать услугу</button>
    </div>`);
  }

  /* ---------- Шапка, меню, панели ---------- */
  const header = $(".site-header");
  const menu = $(".mobile-menu");
  const root = document.documentElement;
  function closeMenu() {
    if (!menu || !menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    root.classList.remove("menu-open");
    root.style.overflow = "";
    $(".burger")?.setAttribute("aria-expanded", "false");
    $(".burger")?.focus({ preventScroll: true });
  }
  $(".burger")?.addEventListener("click", () => {
    menu.classList.add("is-open");
    root.classList.add("menu-open");
    root.style.overflow = "hidden";
    $(".burger").setAttribute("aria-expanded", "true");
    $("[data-menu-close]", menu)?.focus();
  });
  $("[data-menu-close]")?.addEventListener("click", closeMenu);
  $$(".mobile-menu a, .mobile-menu [data-open]").forEach((a) => a.addEventListener("click", () => {
    menu.classList.remove("is-open");
    root.classList.remove("menu-open");
    $(".burger")?.setAttribute("aria-expanded", "false");
    if (!a.dataset.open) root.style.overflow = "";
  }));

  const mbar = $(".mobile-bar");
  const fab = $(".fab");
  $(".fab__btn")?.addEventListener("click", () => {
    const open = fab.classList.toggle("is-open");
    $(".fab__btn").setAttribute("aria-expanded", open);
  });
  document.addEventListener("click", (e) => { if (fab && !e.target.closest(".fab")) { fab.classList.remove("is-open"); $(".fab__btn")?.setAttribute("aria-expanded", "false"); } });

  let ticking = false;
  function onScroll() {
    const y = window.scrollY;
    header?.classList.toggle("is-solid", y > 24);
    mbar?.classList.toggle("is-visible", y > 520);
    ticking = false;
  }
  window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  onScroll();

  /* ---------- Плавный переход к якорю ---------- */
  let scrollAnim = 0;
  function smoothScrollTo(targetY) {
    cancelAnimationFrame(scrollAnim);
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, targetY); return; }
    const dur = Math.min(1000, Math.max(700, Math.abs(dist) * 0.5));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let t0 = null;
    const stop = () => { cancelAnimationFrame(scrollAnim); off(); };
    const off = () => { ["wheel", "touchstart", "keydown"].forEach((ev) => window.removeEventListener(ev, stop)); };
    ["wheel", "touchstart", "keydown"].forEach((ev) => window.addEventListener(ev, stop, { passive: true, once: true }));
    const step = (now) => {
      if (t0 === null) t0 = now;
      const k = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, startY + dist * ease(k));
      if (k < 1) scrollAnim = requestAnimationFrame(step); else off();
    };
    scrollAnim = requestAnimationFrame(step);
  }
  function scrollToEl(el) {
    const offset = (header ? header.offsetHeight : 0) + 12;
    smoothScrollTo(Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset));
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute("data-open")) return;
    const id = a.getAttribute("href").slice(1);
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollToEl(el);
    history.replaceState(null, "", "#" + id);
  });

  /* ---------- Появление при прокрутке ---------- */
  function observeReveal(rootEl = document) {
    const els = $$(".reveal:not(.is-in)", rootEl);
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    els.forEach((el) => io.observe(el));
  }
  observeReveal();

  /* ---------- Телефон и формы ---------- */
  function maskPhone(input) {
    input.addEventListener("input", () => {
      let d = input.value.replace(/\D/g, "");
      if (d.startsWith("8")) d = "7" + d.slice(1);
      if (d && !d.startsWith("7")) d = "7" + d;
      d = d.slice(0, 11);
      let out = "+7";
      if (d.length > 1) out += " (" + d.slice(1, 4);
      if (d.length >= 4) out += ")";
      if (d.length > 4) out += " " + d.slice(4, 7);
      if (d.length > 7) out += "-" + d.slice(7, 9);
      if (d.length > 9) out += "-" + d.slice(9, 11);
      input.value = out;
    });
    input.addEventListener("focus", () => { if (!input.value) input.value = "+7 "; });
    input.addEventListener("blur", () => { if (input.value.trim() === "+7") input.value = ""; });
  }
  $$("input[type=tel]").forEach(maskPhone);

  /* ---------- Яндекс Метрика ---------- */
  // Грузится, только если в config.js указан номер счётчика.
  const YM_ID = Number(window.YM_ID) || 0;
  if (YM_ID) {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const s = document.createElement("script");
    s.async = true; s.src = "https://mc.yandex.ru/metrika/tag.js";
    document.head.appendChild(s);
    window.ym(YM_ID, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  function goal(name, params) {
    if (YM_ID && window.ym) window.ym(YM_ID, "reachGoal", name, params || {});
  }
  // Клики по Telegram, WhatsApp и телефону — отдельные цели.
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open=quiz]")) goal("quiz_open");
    const a = e.target.closest("a[href]");
    if (!a) return;
    const h = a.getAttribute("href");
    if (h.startsWith("tel:")) goal("click_phone");
    else if (h.includes("t.me/")) goal("click_telegram");
    else if (h.includes("wa.me/")) goal("click_whatsapp");
  });

  // Номер заявки: дата + 4 знака. По нему Екатерина найдёт клиента в таблице.
  function leadId() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
  }
  // Куда отправлять заявки. Пока адреса нет, заявка сохраняется только в этом браузере.
  const LEAD_ENDPOINT = window.LEAD_ENDPOINT || "";
  function sendLead(form) {
    const data = {};
    new FormData(form).forEach((v, k) => { if (k === "consent") return; data[k] = data[k] ? data[k] + ", " + v : v; });
    const lead = {
      id: leadId(),
      created: new Date().toISOString(),
      kind: data.kind || form.dataset.kind || (form.id === "quiz" ? "Подбор (квиз)" : "Обратная связь"),
      name: data.name || "", phone: data.tel || "", email: data.email || "", context: data.context || "",
      answers: data, page: location.pathname + location.search,
      source: { first: store.get("src:first", {}), last: store.get("src:last", {}) },
      stage: "Новая",
    };
    const all = store.get("leads", []);
    all.push(lead);
    store.set("leads", all.slice(-50));
    goal("lead", { kind: lead.kind });
    if (lead.kind.startsWith("Гайд")) goal("lead_guide");
    else if (lead.kind.startsWith("Подбор")) goal("lead_quiz");
    else goal("lead_form");
    if (LEAD_ENDPOINT) {
      fetch(LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead), keepalive: true }).catch(() => {});
    }
    return lead;
  }

  function bindForm(form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const tel = $("input[type=tel]", form);
      const field = tel?.closest(".field");
      const digits = tel ? tel.value.replace(/\D/g, "") : "";
      if (tel && digits.length < 11) {
        field?.classList.add("is-error");
        tel.setAttribute("aria-invalid", "true");
        tel.focus();
        return;
      }
      if (field) { field.classList.remove("is-error"); tel.removeAttribute("aria-invalid"); }
      const mail = $("input[type=email][required]", form);
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim())) {
        mail.closest(".field")?.classList.add("is-error");
        mail.setAttribute("aria-invalid", "true");
        mail.focus();
        return;
      }
      if (mail) { mail.closest(".field")?.classList.remove("is-error"); mail.removeAttribute("aria-invalid"); }
      const consent = $("input[name=consent]", form);
      if (consent && !consent.checked) {
        consent.closest(".consent")?.classList.add("is-error");
        toast("Отметьте согласие на обработку данных");
        consent.focus();
        return;
      }
      consent?.closest(".consent")?.classList.remove("is-error");
      const btn = $("button[type=submit]", form);
      const txt = btn.innerHTML;
      btn.classList.add("is-loading");
      btn.textContent = "Отправляем…";
      const lead = sendLead(form);
      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.innerHTML = txt;
        const host = form.closest("[data-form-host]") || form;
        host.classList.add("is-sent");
        const succ = $(".form-success", host);
        if (succ) {
          let no = $("[data-lead-no]", succ);
          if (!no) { no = document.createElement("p"); no.className = "caption"; no.dataset.leadNo = ""; succ.insertBefore(no, $("button", succ)); }
          no.textContent = "Номер заявки: " + lead.id;
          const dl = $("[data-guide-dl]", succ);
          if (dl && window.GUIDE_FILE) { dl.href = window.GUIDE_FILE; dl.hidden = false; $("[data-guide-later]", succ)?.setAttribute("hidden", ""); }
          succ.setAttribute("tabindex", "-1");
          succ.focus({ preventScroll: true });
        }
        form.reset();
      }, 600);
    });
    $$("input[type=tel], input[type=email]", form).forEach((i) => i.addEventListener("input", () => i.closest(".field")?.classList.remove("is-error")));
  }
  $$("form[data-form]").forEach(bindForm);

  /* ---------- Квиз ---------- */
  const quiz = $("#quiz");
  if (quiz) {
    const qm = quiz.closest(".modal") || document;
    const steps = $$(".quiz__step", quiz);
    const bar = $(".quiz__progress span", quiz);
    let i = 0;
    const go = (n) => {
      i = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
      bar.style.width = ((i + 1) / steps.length) * 100 + "%";
      $("[data-quiz-step]", qm).textContent = `Шаг ${i + 1} из ${steps.length}`;
      $("[data-quiz-prev]", quiz).style.visibility = i === 0 ? "hidden" : "visible";
      $("[data-quiz-next]", quiz).hidden = i === steps.length - 1;
    };
    quiz.addEventListener("change", (e) => {
      if (e.target.type === "radio" && e.target.closest(".quiz__step") && i < steps.length - 1 && !e.target.closest("[data-quiz-last]")) setTimeout(() => go(i + 1), 240);
    });
    $("[data-quiz-next]", quiz).addEventListener("click", () => go(i + 1));
    $("[data-quiz-prev]", quiz).addEventListener("click", () => go(i - 1));
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-open=quiz]")) { $("#modal-quiz [data-form-host]")?.classList.remove("is-sent"); go(0); }
    });
    go(0);
  }

  /* ---------- Фильтр ЖК ---------- */
  // Если выбраны комнаты, цена сравнивается с ценой этих комнат, иначе — с минимальной по ЖК.
  function priceFor(z, q) {
    if (q.rooms && q.rooms.size && z.rooms.length) {
      const rs = z.rooms.filter((r) => q.rooms.has(r.type));
      return rs.length ? Math.min(...rs.map((r) => r.price)) : null;
    }
    return z.min;
  }
  function matchZhk(z, q) {
    if (q.rooms && q.rooms.size && z.rooms.length && !z.rooms.some((r) => q.rooms.has(r.type))) return false;
    const p = priceFor(z, q);
    if (p === null) return false;
    if (q.max && p > q.max * 1e6) return false;
    if (q.min && p < q.min * 1e6) return false;
    if (q.deadline && q.deadline !== "any") {
      if (q.deadline === "ready" && z.deadline !== "Дом сдан") return false;
      if (q.deadline === "2027" && !(z.year && z.year <= 2027)) return false;
      if (q.deadline === "2028" && !(z.year && z.year >= 2028)) return false;
    }
    if (q.region && q.region !== "any" && z.region !== q.region) return false;
    if (q.cls && q.cls !== "any" && z.cls !== q.cls) return false;
    if (q.text) {
      const hay = (z.name + " " + z.metro + " " + z.district + " " + z.dev + " " + z.address).toLowerCase();
      if (!hay.includes(q.text.toLowerCase().trim())) return false;
    }
    if (q.fav && !favs.has("z:" + z.id)) return false;
    return true;
  }

  // Подсказки для поиска
  $$("datalist[data-places]").forEach((dl) => {
    const set = new Set();
    D.ZHK.forEach((z) => { set.add(z.name); if (z.metro) set.add(z.metro); set.add(z.district.split(", ").pop()); });
    dl.innerHTML = [...set].map((v) => `<option value="${esc(v)}"></option>`).join("");
  });

  /* ---------- Карта (Leaflet, подгружается по требованию) ---------- */
  let leafletReady = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletReady) return leafletReady;
    leafletReady = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      s.onload = () => resolve(window.L);
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return leafletReady;
  }
  function renderMap(host, list, onPick) {
    host.innerHTML = `<p class="map__loading">Загружаем карту…</p>`;
    loadLeaflet().then((L) => {
      if (host._map) { host._map.remove(); host._map = null; }
      host.innerHTML = "";
      const map = L.map(host, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      host._map = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const pts = list.filter((z) => z.lat && z.lon);
      pts.forEach((z) => {
        const icon = L.divIcon({ className: "map-pin-wrap", html: `<span class="map__pin" data-pin="${z.id}"><span class="map__pin-n">${esc(z.name)} · </span>${mlnShort(z.min)}</span>`, iconSize: null });
        const mk = L.marker([z.lat, z.lon], { icon, title: z.name, keyboard: true }).addTo(map);
        mk.on("click", () => { location.href = "zhk.html?id=" + z.id; });
        if (onPick) mk.on("mouseover", () => onPick(z.id));
      });
      if (pts.length === 1) map.setView([pts[0].lat, pts[0].lon], 14);
      else if (pts.length) map.fitBounds(pts.map((z) => [z.lat, z.lon]), { padding: [40, 40], maxZoom: 13 });
      else map.setView([55.75, 37.62], 10);
      setTimeout(() => map.invalidateSize(), 50);
    }).catch(() => {
      host.innerHTML = `<p class="map__loading">Карта не загрузилась. Проверьте интернет и обновите страницу.</p>`;
    });
  }
  function mapList(list) {
    return list.map((z) => `<a class="map-item" data-id="${z.id}" href="zhk.html?id=${z.id}"><img src="${IMG}${z.img[0]}" alt="" loading="lazy"><div><b>${esc(z.name)}</b><span>${esc(z.metro || z.district)}, сдача: ${z.deadline.toLowerCase()}</span><br><span>от ${mln(z.min)}</span></div></a>`).join("");
  }
  function linkMapList(scope) {
    $$(".map-item", scope).forEach((m) => m.addEventListener("mouseenter", () => $$(".map__pin").forEach((p) => p.classList.toggle("is-active", p.dataset.pin === m.dataset.id))));
  }

  /* ---------- Главная: витрина ЖК ---------- */
  const vitrine = $("#vitrine");
  if (vitrine) {
    const form = $("#vfilter");
    const LIMIT = matchMedia("(max-width: 639px)").matches ? 3 : 6;
    const vq = { rooms: new Set(), min: 0, max: 0, region: "any", cls: "any", deadline: "any", view: params.get("vview") === "map" ? "map" : "grid" };
    const mapBox = $("#vitrine-map");
    function render() {
      const list = D.ZHK.filter((z) => matchZhk(z, vq)).sort(premiumFirst);
      $("#vcount").textContent = list.length
        ? `${list.length} ${plural(list.length, "жилой комплекс", "жилых комплекса", "жилых комплексов")}`
        : "Ничего не нашлось";
      const p = new URLSearchParams();
      if (vq.rooms.size) p.set("rooms", [...vq.rooms].join(","));
      ["min", "max"].forEach((k) => vq[k] && p.set(k, vq[k]));
      ["region", "cls", "deadline"].forEach((k) => vq[k] !== "any" && p.set(k, vq[k]));
      const more = $("#vmore");
      if (more) {
        more.href = "katalog.html" + (p.toString() ? "?" + p : "");
        more.innerHTML = `Все ${list.length} ЖК в каталоге ${ico("arrow-right")}`;
        more.hidden = list.length <= LIMIT || vq.view === "map";
      }
      const empty = `<div class="empty" style="grid-column:1/-1"><div class="empty__ico">${ico("search", "ico--lg")}</div><p class="h3">Под эти условия ЖК не нашлось</p><p class="muted">Ослабьте фильтры или оставьте заявку: подберу вручную, в том числе из закрытых продаж.</p><div class="offer__cta" style="justify-content:center"><button class="btn btn--ghost" type="button" data-vreset>Сбросить фильтры</button><button class="btn btn--gold" type="button" data-open="quiz">Подобрать с Екатериной</button></div></div>`;
      const isMap = vq.view === "map";
      vitrine.hidden = isMap;
      mapBox.hidden = !isMap;
      if (isMap) {
        renderMap($("#vmap"), list, (id) => $$("#vmap-list .map-item").forEach((m) => m.classList.toggle("is-active", m.dataset.id === id)));
        $("#vmap-list").innerHTML = list.length ? mapList(list) : empty;
        linkMapList($("#vmap-list"));
      } else {
        vitrine.innerHTML = list.length ? list.slice(0, LIMIT).map(zhkCard).join("") : empty;
      }
      const n = vq.rooms.size + ["region", "cls", "deadline"].filter((k) => vq[k] !== "any").length + (vq.min ? 1 : 0) + (vq.max ? 1 : 0);
      const tg = $("[data-vfilter-toggle] b");
      if (tg) tg.textContent = n ? " · " + n : "";
    }
    function syncForm() {
      $("[name=min]", form).value = vq.min || "";
      $("[name=max]", form).value = vq.max || "";
      ["region", "cls", "deadline"].forEach((k) => { $(`[name=${k}]`, form).value = vq[k]; });
      $$("[data-vroom]", form).forEach((c) => c.setAttribute("aria-pressed", vq.rooms.has(c.dataset.vroom)));
      $$("[data-vview]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.vview === vq.view));
    }
    form.addEventListener("input", (e) => {
      const t = e.target;
      if (t.name === "min" || t.name === "max") { vq[t.name] = parseFloat(String(t.value).replace(",", ".")) || 0; render(); }
    });
    form.addEventListener("change", (e) => {
      const t = e.target;
      if (["region", "cls", "deadline"].includes(t.name)) { vq[t.name] = t.value; render(); }
    });
    form.addEventListener("click", (e) => {
      const c = e.target.closest("[data-vroom]");
      if (!c) return;
      const r = c.dataset.vroom;
      vq.rooms.has(r) ? vq.rooms.delete(r) : vq.rooms.add(r);
      syncForm(); render();
    });
    $("[data-vfilter-toggle]")?.addEventListener("click", (e) => {
      const open = form.classList.toggle("is-open");
      e.currentTarget.setAttribute("aria-expanded", open);
    });
    $$("[data-vview]").forEach((b) => b.addEventListener("click", () => { vq.view = b.dataset.vview; syncForm(); render(); }));
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-vreset]")) return;
      Object.assign(vq, { rooms: new Set(), min: 0, max: 0, region: "any", cls: "any", deadline: "any" });
      syncForm(); render();
    });
    syncForm();
    render();
  }

  /* ---------- Спецпредложения ---------- */
  const today = new Date();
  const activeOffers = D.OFFERS.filter((o) => endOfDay(o.until) >= today).sort((a, b) => a.until.localeCompare(b.until));
  const offersHost = $("#offers");
  if (offersHost) {
    const sec = offersHost.closest("section");
    if (!activeOffers.length && sec) sec.hidden = true;
    offersHost.innerHTML = activeOffers.map((o) => `<article class="offer-card">
        <div class="offer-card__media"><img src="${IMG}${o.img}.webp" alt="" loading="lazy"></div>
        <div class="offer-card__body">
          <div class="offer-card__top"><span class="offer-card__kind">${o.kind === "Закрытые продажи" ? ico("lock", "ico--sm") : ""}${esc(o.kind)}</span><span class="offer-card__until">до ${dayMonth(endOfDay(o.until))}</span></div>
          <h3 class="offer-card__t">${esc(o.title)}</h3>
          <dl class="offer-card__facts">${o.facts.map((f) => `<div><dt>${esc(f[1])}</dt><dd>${esc(f[0])}</dd></div>`).join("")}</dl>
          <p class="offer-card__p">${esc(o.text)}</p>
          <button class="btn btn--gold btn--block" type="button" data-open="callback" data-kind="Спецпредложение" data-context="${esc("Спецпредложение: " + o.title)}" data-context-title="${esc(o.title)}">Узнать условия</button>
        </div>
      </article>`).join("");
  }

  /* ---------- «Почему сейчас»: таймер до ближайшей акции ---------- */
  const timer = $("[data-timer]");
  if (timer) {
    const o = activeOffers[0];
    if (!o) { timer.hidden = true; }
    else {
      const end = endOfDay(o.until).getTime();
      $("[data-timer-title]", timer).textContent = `До конца акции: ${o.title}`;
      $("[data-timer-date]", timer).textContent = `Предложение действует до ${dayMonth(endOfDay(o.until))} включительно. Бронь фиксирует цену, пока вы решаете.`;
      const btn = $("[data-timer-btn]", timer);
      btn.dataset.context = "Спецпредложение: " + o.title;
      btn.dataset.contextTitle = o.title;
      const cells = { d: $("[data-t=d]", timer), h: $("[data-t=h]", timer), m: $("[data-t=m]", timer), s: $("[data-t=s]", timer) };
      const pad = (n) => String(n).padStart(2, "0");
      const tick = () => {
        let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
        const d = Math.floor(s / 86400); s -= d * 86400;
        const h = Math.floor(s / 3600); s -= h * 3600;
        const m = Math.floor(s / 60); s -= m * 60;
        cells.d.textContent = pad(d); cells.h.textContent = pad(h); cells.m.textContent = pad(m); cells.s.textContent = pad(s);
      };
      tick();
      setInterval(tick, 1000);
    }
    const dl = $("[data-deadlines]");
    if (dl) dl.innerHTML = activeOffers.map((x) => `<li><b>до ${dayMonth(endOfDay(x.until))}</b><span>${esc(x.kind)}: ${esc(x.title)}</span></li>`).join("");
  }

  /* ---------- Калькулятор платежа и выгоды ---------- */
  const calc = $("#calc");
  if (calc) {
    const FAMILY = { 1: [12, 12], 2: [10, 15], 3: [8, 18], 4: [6, 18], 5: [4, 18] };
    const MARKET = 17;
    const st = { prog: "family", price: 15, pv: 20, years: 30, kids: 1 };
    const out = (k, v) => { const el = $(`[data-out="${k}"]`, calc); if (el) el.textContent = v; };
    const setP = (r) => r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min)) * 100 + "%");
    const annuity = (principal, ratePct, years) => {
      const n = years * 12;
      if (ratePct <= 0) return principal / n;
      const r = ratePct / 1200;
      return (principal * r) / (1 - Math.pow(1 + r, -n));
    };
    function recalc() {
      const price = st.price * 1e6;
      const loan = price * (1 - st.pv / 100);
      let rate = MARKET, note = "", warn = false;
      if (st.prog === "family") {
        const [r, lim] = FAMILY[st.kids];
        rate = st.pv >= 50 ? Math.min(r, 6) : r;
        note = st.pv >= 50 ? "При первом взносе от 50% ставка — 6%." : `Москва и область, ${st.kids === 5 ? "5 и более детей" : st.kids + " " + plural(st.kids, "ребёнок", "ребёнка", "детей")}: ставка ${r}%, лимит ${lim} млн ₽.`;
        if (loan > lim * 1e6) { note += ` Кредит больше лимита на ${mln(loan - lim * 1e6)} — эту часть банк даст по обычной ставке.`; warn = true; }
      } else if (st.prog === "dev") {
        rate = 6;
        note = "Ставку субсидирует застройщик. Проверю, что цена квартиры при этом не завышена.";
      } else {
        note = `Рыночная ставка для примера — ${MARKET}%. Точную назовёт банк.`;
      }
      const pay = annuity(loan, rate, st.years);
      const payMarket = annuity(loan, MARKET, st.years);
      const agent = price * 0.015;
      const insurance = loan * 0.006 * 0.3;
      const total = agent + insurance;
      out("price", mln(price));
      out("pv", `${st.pv}%, ${rub(price * st.pv / 100)}`);
      out("years", `${st.years} ${plural(st.years, "год", "года", "лет")}`);
      out("pay", rub(pay));
      out("rate", `${String(rate).replace(".", ",")}%`);
      out("loan", mln(loan));
      out("total", rub(total));
      out("diff", st.prog === "std" ? "Выберите семейную ипотеку или ставку от застройщика, чтобы сравнить." : `Это на ${rub(payMarket - pay)} в месяц меньше, чем по рыночной ставке ${MARKET}%.`);
      const n = $("[data-out=note]", calc);
      n.textContent = note;
      n.classList.toggle("calc__note--warn", warn);
      const segs = [agent, insurance];
      $$(".bar__seg", calc).forEach((s, k) => (s.style.width = (segs[k] / total) * 100 + "%"));
      out("b1", rub(agent));
      out("b2", rub(insurance));
    }
    $$("[role=tab]", calc).forEach((t) => t.addEventListener("click", () => {
      $$("[role=tab]", calc).forEach((x) => x.setAttribute("aria-selected", x === t));
      st.prog = t.dataset.prog;
      $("[data-kids-row]", calc).hidden = st.prog !== "family";
      recalc();
    }));
    $$("[data-kids] .chip", calc).forEach((c) => c.addEventListener("click", () => {
      $$("[data-kids] .chip", calc).forEach((x) => x.setAttribute("aria-pressed", x === c));
      st.kids = +c.dataset.k;
      recalc();
    }));
    $$("input[type=range]", calc).forEach((r) => {
      setP(r);
      r.addEventListener("input", () => { st[r.name] = +r.value; setP(r); recalc(); });
    });
    recalc();
  }

  /* ---------- Каталог ---------- */
  const catalog = $("#catalog");
  if (catalog) {
    const q = {
      view: params.get("view") || "grid",
      rooms: new Set((params.get("rooms") || "").split(",").filter(Boolean)),
      min: +params.get("min") || 0,
      max: +params.get("max") || 0,
      text: params.get("q") || "",
      deadline: params.get("deadline") || "any",
      region: params.get("region") || "any",
      cls: params.get("cls") || "any",
      sort: params.get("sort") || "premium",
      fav: params.get("fav") === "1",
    };
    const bar = $("#catalog-bar");
    const setForm = () => {
      $$("[data-room]", bar).forEach((c) => c.setAttribute("aria-pressed", q.rooms.has(c.dataset.room)));
      $("[name=min]", bar).value = q.min || "";
      $("[name=max]", bar).value = q.max || "";
      $("[name=q]", bar).value = q.text;
      ["deadline", "region", "cls"].forEach((k) => ($(`[name=${k}]`, bar).value = q[k]));
      $("[name=sort]").value = q.sort;
      $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === q.view));
      $("[data-fav-filter]").setAttribute("aria-pressed", q.fav);
      const n = ["deadline", "region", "cls"].filter((k) => q[k] !== "any").length + (q.min ? 1 : 0) + (q.max ? 1 : 0);
      const b = $("[data-more] b", bar);
      if (b) b.textContent = n ? " · " + n : "";
    };
    const syncUrl = () => {
      const p = new URLSearchParams();
      if (q.view !== "grid") p.set("view", q.view);
      if (q.rooms.size) p.set("rooms", [...q.rooms].join(","));
      ["min", "max"].forEach((k) => q[k] && p.set(k, q[k]));
      if (q.text) p.set("q", q.text);
      ["deadline", "region", "cls"].forEach((k) => q[k] !== "any" && p.set(k, q[k]));
      if (q.sort !== "premium") p.set("sort", q.sort);
      if (q.fav) p.set("fav", "1");
      history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
    };
    const sorters = {
      premium: premiumFirst,
      "price-asc": (a, b) => priceFor(a, q) - priceFor(b, q),
      "price-desc": (a, b) => priceFor(b, q) - priceFor(a, q),
      deadline: (a, b) => (a.deadline === "Дом сдан" ? 0 : a.year || 9999) - (b.deadline === "Дом сдан" ? 0 : b.year || 9999),
    };
    function render() {
      const list = D.ZHK.filter((z) => matchZhk(z, q)).sort(sorters[q.sort] || premiumFirst);
      const n = list.length;
      $("#result-count").textContent = `${n} ${plural(n, "жилой комплекс", "жилых комплекса", "жилых комплексов")}`;
      const empty = `<div class="empty"><div class="empty__ico">${ico("search", "ico--lg")}</div><p class="h3">Под эти условия ничего не нашлось</p><p class="muted">Ослабьте фильтры или оставьте заявку: найду вручную, в том числе среди закрытых предложений.</p><div class="offer__cta" style="justify-content:center"><button class="btn btn--ghost" type="button" data-reset>Сбросить фильтры</button><button class="btn btn--gold" type="button" data-open="quiz">Подобрать с Екатериной</button></div></div>`;
      if (q.view === "map") {
        catalog.innerHTML = `<div class="map-wrap"><div class="map" id="map"></div><div class="map-list" id="map-list"></div></div>`;
        renderMap($("#map"), list, (id) => $$(".map-item").forEach((m) => m.classList.toggle("is-active", m.dataset.id === id)));
        $("#map-list").innerHTML = n ? mapList(list) : empty;
        linkMapList($("#map-list"));
      } else {
        catalog.innerHTML = n ? `<div class="zhk-grid">${list.map(zhkCard).join("")}</div>` : empty;
      }
      syncUrl();
    }
    bar.addEventListener("click", (e) => {
      const c = e.target.closest("[data-room]");
      if (c) { const r = c.dataset.room; q.rooms.has(r) ? q.rooms.delete(r) : q.rooms.add(r); setForm(); render(); }
      const mb = e.target.closest("[data-more]");
      if (mb) { const open = $(".f-more", bar).classList.toggle("is-open"); mb.setAttribute("aria-expanded", open); }
    });
    bar.addEventListener("input", (e) => {
      const t = e.target;
      if (t.name === "q") { q.text = t.value; render(); }
      if (t.name === "min" || t.name === "max") { q[t.name] = parseFloat(String(t.value).replace(",", ".")) || 0; setForm(); render(); }
    });
    bar.addEventListener("change", (e) => {
      const t = e.target;
      if (["deadline", "region", "cls"].includes(t.name)) { q[t.name] = t.value; setForm(); render(); }
    });
    $("[name=sort]").addEventListener("change", (e) => { q.sort = e.target.value; render(); });
    $$("[data-view]").forEach((b) => b.addEventListener("click", () => { q.view = b.dataset.view; setForm(); render(); }));
    $("[data-fav-filter]").addEventListener("click", () => { q.fav = !q.fav; setForm(); render(); });
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-reset]")) {
        Object.assign(q, { rooms: new Set(), min: 0, max: 0, text: "", deadline: "any", region: "any", cls: "any", fav: false });
        setForm(); render();
      }
    });
    setForm();
    render();
  }

  /* ---------- Страница ЖК ---------- */
  const zp = $("#zhk-page");
  if (zp) {
    const z = zhkMap[params.get("id")] || [...D.ZHK].sort(premiumFirst)[0];
    document.title = `ЖК «${z.name}» — цены и квартиры | Екатерина Чукомина`;
    $$("[data-z]").forEach((el) => {
      const k = el.dataset.z;
      const v = {
        name: z.name, district: z.district, about: z.about || "Расскажу о проекте, минусах и условиях покупки на консультации.",
        dev: z.dev || "уточню", cls: z.cls, deadline: z.deadline, address: z.address,
        metro: z.metro ? `${z.metro}${z.walk ? ", " + z.walk : ""}` : z.district,
        onSale: z.onSale ? `${z.onSale} ${plural(z.onSale, "квартира", "квартиры", "квартир")}` : "по запросу",
        price: "от " + mln(z.min), ppm: z.ppm ? `от ${nf.format(Math.round(z.ppm / 1000))} тыс. ₽ за м²` : "",
        state: z.state || "уточню", updated: D.ZHK_UPDATED, area: z.district.replace("Москва, ", "").replace("Подмосковье, ", ""),
      }[k];
      if (v !== undefined) el.textContent = v;
    });
    const tags = [`<span class="tag tag--line">${esc(z.cls)}</span>`];
    if (z.offer) tags.unshift(`<span class="tag tag--gold">${esc(z.offer)}</span>`);
    $("[data-z-tags]").innerHTML = tags.join("");
    $("[data-z-metro-dot]").style.background = z.color;
    const main = $("#gallery-main");
    main.src = `${IMG}${z.img[0]}`;
    main.alt = `ЖК «${z.name}»`;
    $("#gallery-thumbs").innerHTML = z.img.map((im, i) => `<button type="button" aria-pressed="${i === 0}" aria-label="Фото ${i + 1}"><img src="${IMG}${im}" alt="" loading="lazy"></button>`).join("");
    $$("#gallery-thumbs button").forEach((b, i) => b.addEventListener("click", () => {
      main.src = `${IMG}${z.img[i]}`;
      $$("#gallery-thumbs button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    $$("[data-z-context]").forEach((b) => { b.dataset.context = `ЖК ${z.name}: ${b.dataset.zContext}`; b.dataset.kind = "ЖК"; });
    const zr = $("#zhk-rooms-list");
    zr.innerHTML = z.rooms.length
      ? z.rooms.map((r) => `<div class="room-row">
          <div><b>${esc(r.label)}</b><span>от ${r.area}${NB}м²${r.count ? " · " + r.count + " " + plural(r.count, "квартира", "квартиры", "квартир") + " в продаже" : ""}</span></div>
          <div class="room-row__p">от ${mln(r.price)}</div>
          <button class="btn btn--ghost btn--sm" type="button" data-open="callback" data-kind="Квартира в ЖК" data-context="${esc(`ЖК ${z.name}: ${r.label.toLowerCase()} от ${r.area} м², от ${mlnShort(r.price)}`)}" data-context-title="${esc("Подобрать " + roomName[r.type] + " в ЖК «" + z.name + "»")}">Подобрать</button>
        </div>`).join("")
      : `<div class="room-row"><div><b>Квартиры и цены — по запросу</b><span>Застройщик не публикует планировки. Пришлю актуальный прайс и свободные квартиры.</span></div><button class="btn btn--gold btn--sm" type="button" data-open="callback" data-kind="ЖК" data-context="${esc("ЖК " + z.name + ": прайс")}" data-context-title="Прайс ЖК «${esc(z.name)}»">Получить прайс</button></div>`;
    renderMap($("#zhk-map"), [z]);
    $("#zhk-similar").innerHTML = D.ZHK.filter((x) => x.id !== z.id)
      .sort((a, b) => (b.cls === z.cls) - (a.cls === z.cls) || (b.region === z.region) - (a.region === z.region) || Math.abs(a.min - z.min) - Math.abs(b.min - z.min))
      .slice(0, 3).map(zhkCard).join("");
  }

  /* ---------- Новости рынка (РБК) ---------- */
  const newsHosts = $$("[data-news]");
  if (newsHosts.length) {
    fetch("assets/data/news.json", { cache: "no-cache" }).then((r) => r.json()).then((d) => {
      newsHosts.forEach((host) => {
        const n = +host.dataset.news || 12;
        host.innerHTML = d.items.slice(0, n).map((it) => {
          const dt = new Date(it.date);
          const time = dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
          return `<article class="news-card">
            <div class="news-card__meta"><b>${esc(it.tag || it.cat)}</b><span>${dayMonth(dt)}, ${time}</span></div>
            <h3><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a></h3>
            <p>${esc(it.anons)}</p>
            <span class="news-card__src">${esc(d.source)} ${ico("arrow-right", "ico--sm")}</span>
          </article>`;
        }).join("");
      });
    }).catch(() => newsHosts.forEach((h) => { h.innerHTML = `<p class="muted">Новости сейчас не загрузились. Загляните позже.</p>`; }));
  }

  /* ---------- Журнал ---------- */
  const postCard = (p, big) => `<article class="post-card${big ? " post-card--big" : ""}">
      <div class="post-card__media"><img src="${IMG}${p.img}.webp" alt="" loading="lazy"></div>
      <div style="display:grid;gap:12px">
        <div class="post-card__meta"><b>${esc(p.cat)}</b><span>${p.date}</span><span>${p.read}</span></div>
        <h3><a href="statya.html?slug=${p.slug}">${esc(p.title)}</a></h3>
        <p>${esc(p.excerpt)}</p>
      </div>
    </article>`;
  const jl = $("#journal-list");
  if (jl) {
    const cats = ["Все", ...new Set(D.POSTS.map((p) => p.cat))];
    const chipsJ = $("#journal-cats");
    chipsJ.innerHTML = cats.map((c, i) => `<button class="chip" type="button" aria-pressed="${i === 0}" data-cat="${c}">${c}</button>`).join("");
    const draw = (c) => {
      const list = D.POSTS.filter((p) => c === "Все" || p.cat === c);
      jl.innerHTML = list.map((p, i) => postCard(p, i === 0 && c === "Все")).join("");
    };
    chipsJ.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      $$("[data-cat]", chipsJ).forEach((x) => x.setAttribute("aria-pressed", x === b));
      draw(b.dataset.cat);
    });
    draw("Все");
  }
  const jt = $("#journal-teaser");
  if (jt) jt.innerHTML = D.POSTS.slice(0, 3).map((p) => postCard(p)).join("");

  const art = $("#article");
  if (art) {
    const p = D.POSTS.find((x) => x.slug === params.get("slug")) || D.POSTS[0];
    document.title = `${p.title} — журнал Екатерины Чукоминой`;
    $("[data-a=title]").textContent = p.title;
    $("[data-a=crumb]").textContent = p.title.length > 48 ? p.title.slice(0, 46) + "…" : p.title;
    $("[data-a=meta]").innerHTML = `<b>${esc(p.cat)}</b><span>${p.date}</span><span>${p.read} чтения</span>`;
    $("[data-a=cover]").innerHTML = `<img src="${IMG}${p.img}.webp" alt="">`;
    $("[data-a=body]").innerHTML = p.body;
    $("#article-more").innerHTML = D.POSTS.filter((x) => x.slug !== p.slug).slice(0, 3).map((x) => postCard(x)).join("");
  }

  /* ---------- Услуги ---------- */
  const sg = $("#services");
  if (sg) {
    sg.innerHTML = D.SERVICES.map((s) => `<button class="svc" type="button" data-svc="${s.id}">
        <img src="${IMG}${s.img}.webp" alt="" loading="lazy">
        <span class="svc__t">${esc(s.t)}</span>
        <span class="svc__p"><span class="svc__price">${s.price}<small>${esc(s.sub)}</small></span><span class="svc__open">Подробнее ${ico("arrow-right", "ico--sm")}</span></span>
      </button>`).join("") + `<div class="svc svc--plain"><span class="svc__t">Не нашли свою задачу?</span><span class="svc__p"><span class="svc__price"><small>Опишите её — предложу решение и цену</small></span><button class="svc__open" type="button" data-open="callback" data-kind="Услуга" data-context="Индивидуальная задача" data-context-title="Опишите задачу">Написать ${ico("arrow-right", "ico--sm")}</button></span></div>`;
  }

  /* ---------- Дата обновления цен ---------- */
  $$("[data-updated]").forEach((el) => { el.textContent = D.ZHK_UPDATED; });

  syncFavCount();
})();
