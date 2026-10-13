/* Everest — поведение сайта. Без библиотек, родной скролл. */
(function () {
  "use strict";
  const D = window.EVEREST;
  const IMG = D.IMG;
  document.documentElement.classList.add("js");

  /* ---------- Утилиты ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const nf = new Intl.NumberFormat("ru-RU");
  const NB = " ";
  const rub = (n) => nf.format(Math.round(n)) + NB + "₽";
  const mln = (n) => (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + NB + "млн" + NB + "₽";
  const area = (a) => a.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + NB + "м²";
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

  /* ---------- Модель ---------- */
  const zhkMap = Object.fromEntries(D.ZHK.map((z) => [z.id, z]));
  const flatsOf = (id) => D.FLATS.filter((f) => f.zhk === id);
  const stats = (id) => {
    const fl = flatsOf(id);
    return {
      min: Math.min(...fl.map((f) => f.price)),
      ppm: Math.min(...fl.map((f) => f.price / f.area)),
      count: fl.length,
    };
  };
  function annuity(principal, ratePct, years) {
    const n = years * 12;
    if (ratePct <= 0) return principal / n;
    const r = ratePct / 1200;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
  }
  function flatPay(f) {
    if (f.pv >= 100) return null;
    const loan = f.price * (1 - f.pv / 100);
    if (f.rate === 0) return { v: loan / 18, label: "рассрочка" };
    return { v: annuity(loan, f.rate, 30), label: `ставка ${String(f.rate).replace(".", ",")}%` };
  }

  /* ---------- Избранное ---------- */
  let favs = new Set(store.get("everest:fav", []));
  function syncFavCount() {
    $$("[data-fav-count]").forEach((el) => {
      el.textContent = favs.size;
      el.hidden = favs.size === 0;
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

  /* ---------- Карточки ---------- */
  function zhkCard(z) {
    const m = D.METRO[z.line];
    const s = stats(z.id);
    const tags = z.tags.map((t, i) => `<span class="tag${i === 0 ? " tag--gold" : ""}">${t === "3D-тур" ? ico("cube", "ico--sm") : ""}${esc(t)}</span>`).join("");
    return `<article class="zhk-card">
      <div class="zhk-card__media">
        <img src="${IMG}${z.img[0]}.webp" alt="ЖК «${esc(z.name)}»" loading="lazy" width="700" height="525">
        <div class="zhk-card__tags">${tags}</div>
      </div>
      ${favBtn("z:" + z.id, "ЖК " + z.name)}
      <div class="zhk-card__body">
        <h3 class="zhk-card__name"><a href="zhk.html?id=${z.id}">${esc(z.name)}</a></h3>
        <div class="zhk-card__loc">
          <span class="loc-line"><i class="metro-dot" style="background:${m.color}" title="${m.name}"></i>${esc(z.metro)}, ${esc(z.walk)}</span>
          <span class="loc-line">${ico("pin", "ico--sm")}${esc(z.district)}</span>
        </div>
        <div class="zhk-card__facts">
          <div><span class="fact__k">Сдача</span><span class="fact__v">${z.deadline}</span></div>
          <div><span class="fact__k">Площади</span><span class="fact__v">${z.areas}</span></div>
          <div><span class="fact__k">Застройщик</span><span class="fact__v">${esc(z.dev)}</span></div>
        </div>
        <div class="zhk-card__price"><b>от ${mln(s.min)}</b><span>от ${nf.format(Math.round(s.ppm / 1000))} тыс. ₽/м²</span></div>
      </div>
    </article>`;
  }

  function moneyBlock(f) {
    const pay = flatPay(f);
    const save = f.old ? f.old - f.price : 0;
    return `<div class="money">
      <div class="money__cell"><span class="money__k">Стоимость</span><span class="money__v">${rub(f.price)}</span>${f.old ? `<span class="money__old">${rub(f.old)}</span>` : ""}</div>
      <div class="money__cell money__cell--accent"><span class="money__k">${pay ? (pay.label === "рассрочка" ? "Рассрочка" : "Платёж") : "Оплата"}</span><span class="money__v">${pay ? rub(pay.v) + "/мес" : "100%"}</span><span class="money__old" style="text-decoration:none">${pay ? esc(pay.label) : "скидка по запросу"}</span></div>
      <div class="money__cell"><span class="money__k">Первый взнос${f.pv < 100 ? " " + f.pv + "%" : ""}</span><span class="money__v">${f.pv >= 100 ? "—" : rub(f.price * f.pv / 100)}</span></div>
      <div class="money__cell"><span class="money__k">${save ? "Выгода" : "Цена за м²"}</span><span class="money__v${save ? " save-badge" : ""}">${save ? rub(save) : rub(f.price / f.area)}</span></div>
    </div>`;
  }

  function flatCard(f) {
    const z = zhkMap[f.zhk];
    const m = D.METRO[z.line];
    const tags = [`<span class="tag">${esc(f.finish)}</span>`, `<span class="tag">${z.deadline === "Сдан" ? "Дом сдан" : "Сдача " + z.deadline}</span>`];
    if (f.tag) tags.unshift(`<span class="tag tag--gold">${esc(f.tag)}</span>`);
    return `<article class="flat-card">
      <div class="flat-card__plan">
        <img src="${IMG}plans/${f.plan}.svg" alt="Планировка: ${esc(f.title)}, ${area(f.area)}" loading="lazy" width="500" height="400">
        <div class="flat-card__tags">${tags.join("")}</div>
      </div>
      ${favBtn("f:" + f.id, f.title + " в ЖК " + z.name)}
      <div class="flat-card__body">
        <div>
          <h3 class="flat-card__title"><a href="#kvartira-${f.id}" data-flat="${f.id}">${esc(f.title)}, ${area(f.area)}</a></h3>
          <p class="flat-card__sub"><i class="metro-dot" style="background:${m.color}"></i>ЖК «${esc(z.name)}», ${esc(z.metro)}</p>
        </div>
        ${moneyBlock(f)}
        <div class="flat-card__foot"><span>Этаж ${f.floor}</span><span>${esc(f.rateLabel)}</span></div>
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
    if (location.hash.startsWith("#kvartira-")) history.replaceState(null, "", location.pathname + location.search);
  }
  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o) {
      e.preventDefault();
      openModal("modal-" + o.dataset.open, { context: o.dataset.context, contextTitle: o.dataset.contextTitle });
      return;
    }
    if (e.target.closest("[data-close]") || e.target.classList.contains("modal__scrim")) { closeModal(e.target.closest(".modal")); return; }
    const fl = e.target.closest("[data-flat]");
    if (fl) { e.preventDefault(); showFlat(fl.dataset.flat); return; }
    const v = e.target.closest("[data-video]");
    if (v) { e.preventDefault(); showInfo("Видеоотзыв", `<p class="modal__text">Здесь будет видео: ${esc(v.dataset.video)}. В макете вместо него фото. Настоящие видео загрузим, когда клиенты дадут согласие.</p>`); return; }
    const t = e.target.closest("[data-tour]");
    if (t) {
      e.preventDefault();
      const z = zhkMap[t.dataset.tour] || D.ZHK[0];
      showInfo("3D-тур по ЖК «" + z.name + "»", `<div class="gallery__main mt-m" style="aspect-ratio:16/9"><img src="${IMG}${z.img[2]}.webp" alt=""></div><p class="modal__text mt-m">Здесь встанет 3D-тур от застройщика: можно пройтись по шоуруму и двору. Пока покажем квартиру онлайн.</p><button class="btn btn--gold mt-m" type="button" data-open="callback" data-context="Видеопоказ ЖК ${esc(z.name)}" data-context-title="Записаться на видеопоказ">Записаться на видеопоказ</button>`);
      return;
    }
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

  function showFlat(id) {
    const f = D.FLATS.find((x) => x.id === id);
    if (!f) return;
    const z = zhkMap[f.zhk];
    const m = $("#modal-flat");
    $(".modal__title", m).textContent = `${f.title}, ${area(f.area)}`;
    $("[data-flat-body]", m).innerHTML = `
      <p class="modal__text">ЖК «${esc(z.name)}», ${esc(z.district)}</p>
      <div class="flat-modal">
        <div class="flat-modal__plan"><img src="${IMG}plans/${f.plan}.svg" alt="Планировка: ${esc(f.title)}"></div>
        <div class="flat-modal__side">
          ${moneyBlock(f)}
          <div class="spec">
            <div><span>Сдача</span><b>${z.deadline}</b></div>
            <div><span>Этаж</span><b>${f.floor}</b></div>
            <div><span>Отделка</span><b>${esc(f.finish)}</b></div>
            <div><span>Застройщик</span><b>${esc(z.dev)}</b></div>
            <div><span>Метро</span><b>${esc(z.metro)}</b></div>
            <div><span>Класс</span><b>${z.cls}</b></div>
          </div>
          <button class="btn btn--gold btn--block" type="button" data-open="callback" data-context="Бронь: ${esc(f.title)}, ${area(f.area)}, ЖК ${esc(z.name)}" data-context-title="Забронировать по текущей цене">Забронировать по текущей цене</button>
          <div class="row-between" style="align-items:center">
            <a class="link-arrow" href="zhk.html?id=${z.id}">Всё о ЖК «${esc(z.name)}» ${ico("arrow-right", "ico--sm")}</a>
            ${favBtn("f:" + f.id, f.title, " fav-btn--static")}
          </div>
          <p class="caption">Платёж посчитан на 30 лет при первом взносе ${f.pv}%. Точные условия зависят от банка и состава семьи — посчитаем на консультации.</p>
        </div>
      </div>`;
    history.replaceState(null, "", "#kvartira-" + f.id);
    openModal("modal-flat", { noFocus: true });
  }

  function showService(id) {
    const s = D.SERVICES.find((x) => x.id === id);
    if (!s) return;
    showInfo(s.t, `<div class="svc-detail">
      <div><div class="svc-detail__price">${s.price}</div><p class="caption mt-s">${esc(s.sub)}</p></div>
      <p class="muted">${esc(s.d)}</p>
      <div><p class="h4">Что входит</p><ul class="checklist mt-s">${s.inc.map((i) => `<li>${ico("check")}${esc(i)}</li>`).join("")}</ul></div>
      <div class="spec"><div><span>Оплата</span><b>${esc(s.pay)}</b></div><div><span>Сроки</span><b>${esc(s.time)}</b></div></div>
      <button class="btn btn--gold btn--block" type="button" data-open="callback" data-context="Услуга: ${esc(s.t)}" data-context-title="${esc(s.t)}">Заказать услугу</button>
    </div>`);
  }

  if (location.hash.startsWith("#kvartira-")) setTimeout(() => showFlat(location.hash.replace("#kvartira-", "")), 200);

  /* ---------- Шапка, меню, панели ---------- */
  const header = $(".site-header");
  const menu = $(".mobile-menu");
  function closeMenu() {
    if (!menu || !menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    document.documentElement.style.overflow = "";
    $(".burger")?.setAttribute("aria-expanded", "false");
    $(".burger")?.focus({ preventScroll: true });
  }
  $(".burger")?.addEventListener("click", () => {
    menu.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
    $(".burger").setAttribute("aria-expanded", "true");
    $("[data-menu-close]", menu)?.focus();
  });
  $("[data-menu-close]")?.addEventListener("click", closeMenu);
  $$(".mobile-menu a, .mobile-menu [data-open]").forEach((a) => a.addEventListener("click", () => {
    menu.classList.remove("is-open");
    $(".burger")?.setAttribute("aria-expanded", "false");
    if (!a.dataset.open) document.documentElement.style.overflow = "";
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
  // Быстро и мягко: 0,7–1 с, остановка от колеса и касания.
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
    if (!a || a.hasAttribute("data-open") || a.hasAttribute("data-flat")) return;
    const id = a.getAttribute("href").slice(1);
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollToEl(el);
    history.replaceState(null, "", "#" + id);
  });

  /* ---------- Появление при прокрутке ---------- */
  function observeReveal(root = document) {
    const els = $$(".reveal:not(.is-in)", root);
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
      const consent = $("input[name=consent]", form);
      if (consent && !consent.checked) { toast("Отметьте согласие на обработку данных"); consent.focus(); return; }
      const btn = $("button[type=submit]", form);
      const txt = btn.innerHTML;
      btn.classList.add("is-loading");
      btn.textContent = "Отправляем…";
      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.innerHTML = txt;
        const host = form.closest("[data-form-host]") || form;
        host.classList.add("is-sent");
        const succ = $(".form-success", host);
        if (succ) { succ.setAttribute("tabindex", "-1"); succ.focus({ preventScroll: true }); }
        form.reset();
      }, 800);
    });
    $$("input[type=tel]", form).forEach((i) => i.addEventListener("input", () => i.closest(".field")?.classList.remove("is-error")));
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

  /* ---------- Подбор по параметрам ---------- */
  function matchFlat(f, q) {
    const z = zhkMap[f.zhk];
    if (q.rooms && q.rooms.size && !q.rooms.has(f.type)) return false;
    if (q.max && f.price > q.max * 1e6) return false;
    if (q.min && f.price < q.min * 1e6) return false;
    if (q.deadline && q.deadline !== "any") {
      if (q.deadline === "ready" && z.deadline !== "Сдан") return false;
      if (q.deadline === "2026" && !(z.year <= 2026)) return false;
      if (q.deadline === "2027" && !(z.year <= 2027)) return false;
      if (q.deadline === "2028" && !(z.year >= 2028)) return false;
    }
    if (q.region && q.region !== "any" && z.region !== q.region) return false;
    if (q.finish && q.finish !== "any") {
      const fin = f.finish.toLowerCase();
      if (q.finish === "rough" && !/черн|предчист/.test(fin)) return false;
      if (q.finish === "wb" && !/white/.test(fin)) return false;
      if (q.finish === "full" && !/чистов|ремонт/.test(fin)) return false;
    }
    if (q.cls && q.cls !== "any" && !z.cls.toLowerCase().startsWith(q.cls)) return false;
    if (q.text) {
      const hay = (z.name + " " + z.metro + " " + z.district + " " + z.dev).toLowerCase();
      if (!hay.includes(q.text.toLowerCase().trim())) return false;
    }
    if (q.fav && !favs.has("f:" + f.id) && !favs.has("z:" + f.zhk)) return false;
    return true;
  }

  /* ---------- Главная: поиск в герое ---------- */
  const heroSearch = $("#hero-search");
  if (heroSearch) {
    const q = { rooms: new Set(), max: 0, deadline: "any", text: "" };
    const btn = $("[data-search-submit]", heroSearch);
    const upd = () => {
      const n = D.FLATS.filter((f) => matchFlat(f, q)).length;
      btn.innerHTML = n ? `Показать ${n} ${plural(n, "квартиру", "квартиры", "квартир")} ${ico("arrow-right")}` : `Подобрать вручную ${ico("arrow-right")}`;
    };
    $$("[data-room]", heroSearch).forEach((c) => c.addEventListener("click", () => {
      const r = c.dataset.room;
      q.rooms.has(r) ? q.rooms.delete(r) : q.rooms.add(r);
      c.setAttribute("aria-pressed", q.rooms.has(r));
      upd();
    }));
    $("[name=max]", heroSearch).addEventListener("change", (e) => { q.max = +e.target.value; upd(); });
    $("[name=deadline]", heroSearch).addEventListener("change", (e) => { q.deadline = e.target.value; upd(); });
    $("[name=q]", heroSearch).addEventListener("input", (e) => { q.text = e.target.value; upd(); });
    heroSearch.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = D.FLATS.filter((f) => matchFlat(f, q)).length;
      if (!n) { openModal("modal-quiz"); return; }
      if (applyToVitrine) { applyToVitrine(q); return; }
      const p = new URLSearchParams();
      if (q.rooms.size) p.set("rooms", [...q.rooms].join(","));
      if (q.max) p.set("max", q.max);
      if (q.deadline !== "any") p.set("deadline", q.deadline);
      if (q.text) p.set("q", q.text);
      location.href = "katalog.html" + (p.toString() ? "?" + p : "");
    });
    upd();
  }

  // Подсказки для поиска
  $$("datalist[data-places]").forEach((dl) => {
    const set = new Set();
    D.ZHK.forEach((z) => { set.add(z.name); set.add(z.metro); set.add(z.district.split(", ").pop()); });
    dl.innerHTML = [...set].map((v) => `<option value="${esc(v)}"></option>`).join("");
  });

  // Карточка на фото в герое
  const fc = $("[data-float-flat]");
  if (fc) {
    const f = D.FLATS.find((x) => x.id === fc.dataset.floatFlat);
    const z = zhkMap[f.zhk];
    const pay = flatPay(f);
    fc.innerHTML = `<img src="${IMG}plans/${f.plan}.svg" alt="">
      <div><div class="float-card__title">${esc(f.title)}, ${area(f.area)}<br>ЖК «${esc(z.name)}»</div>
      <div class="float-card__price">${rub(f.price)}</div>
      <div class="float-card__old">${rub(f.old)}</div>
      <div class="float-card__pay">Платёж ${rub(pay.v)}/мес</div></div>`;
    fc.setAttribute("aria-label", `${f.title}, ${area(f.area)}, ЖК ${z.name}: ${rub(f.price)}. Открыть карточку квартиры`);
    fc.dataset.flat = f.id;
  }

  // Витрина ЖК на главной: фильтры, список и карта в одном блоке
  const vitrine = $("#vitrine");
  let applyToVitrine = null;
  if (vitrine) {
    const form = $("#vfilter");
    const vq = { rooms: new Set(), min: 0, max: 0, district: "", metro: "", deadline: "any", text: "", view: params.get("vview") === "map" ? "map" : "grid" };
    const uniq = (arr) => [...new Set(arr)].sort((x, y) => x.localeCompare(y, "ru"));
    $("[name=district]", form).insertAdjacentHTML("beforeend", uniq(D.ZHK.map((z) => z.district)).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join(""));
    $("[name=metro]", form).insertAdjacentHTML("beforeend", uniq(D.ZHK.map((z) => z.metro)).map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join(""));
    const mapBox = $("#vitrine-map");
    function render() {
      const flats = D.FLATS.filter((f) => {
        const z = zhkMap[f.zhk];
        if (vq.district && z.district !== vq.district) return false;
        if (vq.metro && z.metro !== vq.metro) return false;
        return matchFlat(f, vq);
      });
      const ids = new Set(flats.map((f) => f.zhk));
      const list = D.ZHK.filter((z) => ids.has(z.id));
      $("#vcount").textContent = list.length
        ? `${list.length} ${plural(list.length, "жилой комплекс", "жилых комплекса", "жилых комплексов")}, ${flats.length} ${plural(flats.length, "квартира", "квартиры", "квартир")}`
        : "Ничего не нашлось";
      const p = new URLSearchParams();
      if (vq.rooms.size) p.set("rooms", [...vq.rooms].join(","));
      if (vq.min) p.set("min", vq.min);
      if (vq.max) p.set("max", vq.max);
      if (vq.deadline !== "any") p.set("deadline", vq.deadline);
      const q = vq.metro || (vq.district ? vq.district.split(", ").pop() : "") || vq.text;
      if (q) p.set("q", q);
      $("#vcat").href = "katalog.html" + (p.toString() ? "?" + p : "");
      const empty = `<div class="empty" style="grid-column:1/-1"><div class="empty__ico">${ico("search", "ico--lg")}</div><p class="h3">Под эти условия ЖК не нашлось</p><p class="muted">Ослабьте фильтры или оставьте заявку: подберём вручную, в том числе из закрытых продаж.</p><div class="offer__cta" style="justify-content:center"><button class="btn btn--ghost" type="button" data-vreset>Сбросить фильтры</button><button class="btn btn--gold" type="button" data-open="quiz">Подобрать с Екатериной</button></div></div>`;
      const isMap = vq.view === "map";
      vitrine.hidden = isMap;
      mapBox.hidden = !isMap;
      if (isMap) {
        renderMap($("#vmap"), list, (id) => $$("#vmap-list .map-item").forEach((m) => m.classList.toggle("is-active", m.dataset.id === id)));
        $("#vmap-list").innerHTML = list.length ? list.map((z) => {
          const cnt = flats.filter((f) => f.zhk === z.id).length;
          return `<a class="map-item" data-id="${z.id}" href="zhk.html?id=${z.id}"><img src="${IMG}${z.img[0]}.webp" alt="" loading="lazy"><div><b>${esc(z.name)}</b><span>${esc(z.metro)}, сдача: ${z.deadline.toLowerCase()}</span><br><span>от ${mln(stats(z.id).min)}, ${cnt} ${plural(cnt, "квартира", "квартиры", "квартир")}</span></div></a>`;
        }).join("") : empty;
        $$("#vmap-list .map-item").forEach((m) => m.addEventListener("mouseenter", () => $$("#vmap .map__pin").forEach((pin) => pin.classList.toggle("is-active", pin.dataset.pin === m.dataset.id))));
      } else {
        vitrine.innerHTML = list.length ? list.map(zhkCard).join("") : empty;
      }
    }
    function syncForm() {
      $("[name=min]", form).value = vq.min || "";
      $("[name=max]", form).value = vq.max || "";
      $("[name=district]", form).value = vq.district;
      $("[name=metro]", form).value = vq.metro;
      $("[name=deadline]", form).value = vq.deadline;
      $$("[data-vroom]", form).forEach((c) => c.setAttribute("aria-pressed", vq.rooms.has(c.dataset.vroom)));
      $$("[data-vview]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.vview === vq.view));
    }
    form.addEventListener("input", (e) => {
      const t = e.target;
      if (t.name === "min" || t.name === "max") { vq[t.name] = parseFloat(String(t.value).replace(",", ".")) || 0; vq.text = ""; render(); }
    });
    form.addEventListener("change", (e) => {
      const t = e.target;
      if (["district", "metro", "deadline"].includes(t.name)) { vq[t.name] = t.value; vq.text = ""; render(); }
    });
    form.addEventListener("click", (e) => {
      const c = e.target.closest("[data-vroom]");
      if (!c) return;
      const r = c.dataset.vroom;
      vq.rooms.has(r) ? vq.rooms.delete(r) : vq.rooms.add(r);
      syncForm(); render();
    });
    $$("[data-vview]").forEach((b) => b.addEventListener("click", () => { vq.view = b.dataset.vview; syncForm(); render(); }));
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-vreset]")) return;
      Object.assign(vq, { rooms: new Set(), min: 0, max: 0, district: "", metro: "", deadline: "any", text: "" });
      syncForm(); render();
    });
    // Поиск на первом экране настраивает эту же витрину
    applyToVitrine = (hq) => {
      vq.rooms = new Set(hq.rooms);
      vq.max = hq.max || 0;
      vq.min = 0;
      vq.deadline = hq.deadline || "any";
      const t = (hq.text || "").trim().toLowerCase();
      const metro = D.ZHK.find((z) => z.metro.toLowerCase() === t);
      const dist = D.ZHK.find((z) => z.district.toLowerCase().includes(t) && t);
      vq.metro = metro ? metro.metro : "";
      vq.district = !metro && dist ? dist.district : "";
      vq.text = !metro && !dist ? hq.text || "" : "";
      syncForm(); render();
      scrollToEl($("#vitrina"));
    };
    syncForm();
    render();
  }

  // Квартиры недели
  const weekly = $("#weekly-flats");
  if (weekly) weekly.innerHTML = ["sb-1", "kp-1", "lg-1"].map((id) => flatCard(D.FLATS.find((f) => f.id === id))).join("");

  /* ---------- Калькулятор выгоды ---------- */
  const calc = $("#calc");
  if (calc) {
    const FAMILY = { 1: [12, 12], 2: [10, 15], 3: [8, 18], 4: [6, 18], 5: [4, 18] };
    const MARKET = 17;
    const st = { prog: "family", price: 15, pv: 20, years: 30, kids: 1 };
    const out = (k, v) => { const el = $(`[data-out="${k}"]`, calc); if (el) el.textContent = v; };
    const setP = (r) => r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min)) * 100 + "%");
    function recalc() {
      const price = st.price * 1e6;
      const loan = price * (1 - st.pv / 100);
      let rate = MARKET, note = "", warn = false;
      if (st.prog === "family") {
        const [r, lim] = FAMILY[st.kids];
        rate = st.pv >= 50 ? Math.min(r, 6) : r;
        note = st.pv >= 50 ? "При первом взносе от 50% ставка — 6%." : `Москва и область, ${st.kids === 5 ? "5 и более детей" : st.kids + " " + plural(st.kids, "ребёнок", "ребёнка", "детей")}: ставка ${r}%, лимит ${lim} млн ₽.`;
        if (loan > lim * 1e6) { note += ` Кредит больше лимита на ${mln(loan - lim * 1e6)} — эту часть банк даст по обычной ставке.`; warn = true; }
      } else if (st.prog === "dev") {
        rate = 6;
        note = "Ставку субсидирует застройщик. Проверим, что цена квартиры при этом не завышена.";
      } else {
        note = `Рыночная ставка в макете условная — ${MARKET}%.`;
      }
      const pay = annuity(loan, rate, st.years);
      const payMarket = annuity(loan, MARKET, st.years);
      const discount = price * 0.05;
      const commission = price * 0.02;
      const insurance = loan * 0.006 * 0.3;
      const total = discount + commission + insurance;
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
      const segs = [discount, commission, insurance];
      $$(".bar__seg", calc).forEach((s, k) => (s.style.width = (segs[k] / total) * 100 + "%"));
      out("b1", rub(discount));
      out("b2", rub(commission));
      out("b3", rub(insurance));
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

  /* ---------- График роста цен ---------- */
  const chart = $("#price-chart");
  if (chart) {
    const data = D.PRICE_TREND;
    const W = 640, H = 260, L = 44, R = 16, T = 26, B = 30;
    const vals = data.map((d) => d[1]);
    const min = Math.floor((Math.min(...vals) - 10) / 10) * 10, max = Math.ceil((Math.max(...vals) + 10) / 10) * 10;
    const x = (i) => L + (i * (W - L - R)) / (data.length - 1);
    const y = (v) => T + ((max - v) * (H - T - B)) / (max - min);
    const pts = data.map((d, i) => [x(i), y(d[1])]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const areaPath = line + ` L ${x(data.length - 1)} ${H - B} L ${x(0)} ${H - B} Z`;
    let grid = "";
    for (let v = min; v <= max; v += 20) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,0.08)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    const labels = data.map((d, i) => (i % 2 === 0 || i === data.length - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${d[0]}</text>` : "").join("");
    const last = pts[pts.length - 1];
    chart.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Средняя цена квадратного метра в новостройках Москвы выросла с ${vals[0]} до ${vals[vals.length - 1]} тысяч рублей за 12 месяцев">
      <defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#cdb078" stop-opacity="0.35"/><stop offset="1" stop-color="#cdb078" stop-opacity="0"/></linearGradient></defs>
      ${grid}${labels}
      <path d="${areaPath}" fill="url(#cg)"/>
      <path d="${line}" fill="none" stroke="#cdb078" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#13271f" stroke="#cdb078" stroke-width="1.5"/>`).join("")}
      <circle cx="${last[0]}" cy="${last[1]}" r="6" fill="#cdb078"/>
      <text x="${last[0] - 12}" y="${last[1] - 12}" text-anchor="end" style="fill:#fff;font-weight:700;font-size:13px">${vals[vals.length - 1]} тыс. ₽/м²</text>
    </svg>`;
    const growth = ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100;
    const g = $("[data-growth]");
    if (g) g.textContent = "+" + growth.toFixed(0) + "%";
    const gm = $("[data-growth-month]");
    if (gm) gm.textContent = (growth / 12).toFixed(1).replace(".", ",") + "%";
  }

  /* ---------- Таймер ---------- */
  const timer = $("[data-deadline]");
  if (timer) {
    const end = new Date(timer.dataset.deadline).getTime();
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

  /* ---------- Карта (стилизованная схема Москвы) ---------- */
  function mapSvg() {
    return `<svg viewBox="0 0 1000 860" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="1000" height="860" fill="#eef2ec"/>
      <path d="M260 700 C 240 760, 300 860, 380 860 L 520 860 C 470 800, 450 760, 430 700 Z" fill="#e4ebe3"/>
      <text x="290" y="835" fill="#8c978f" font-size="16" font-family="Manrope, sans-serif">Новая Москва</text>
      <path d="M500 140 C 650 140, 760 250, 770 400 C 780 560, 660 680, 500 690 C 340 690, 230 570, 230 410 C 230 250, 350 140, 500 140 Z" fill="#f7f9f6" stroke="#c9d3cb" stroke-width="3"/>
      <text x="745" y="262" fill="#8c978f" font-size="15" font-family="Manrope, sans-serif">МКАД</text>
      <ellipse cx="500" cy="410" rx="150" ry="140" fill="none" stroke="#d6ded7" stroke-width="2.5" stroke-dasharray="6 6"/>
      <text x="612" y="318" fill="#a0aaa3" font-size="13" font-family="Manrope, sans-serif">ТТК</text>
      <ellipse cx="505" cy="405" rx="68" ry="62" fill="none" stroke="#d6ded7" stroke-width="2"/>
      <path d="M120 300 C 240 330, 300 300, 360 360 C 420 420, 400 470, 470 470 C 540 470, 520 420, 560 400 C 610 380, 640 470, 600 540 C 570 600, 660 650, 760 620 C 840 600, 900 660, 1000 650" fill="none" stroke="#b9d3d8" stroke-width="14" stroke-linecap="round"/>
      <path d="M330 0 C 330 80, 300 160, 360 230" fill="none" stroke="#b9d3d8" stroke-width="8" stroke-linecap="round"/>
      <text x="836" y="640" fill="#7d9aa0" font-size="14" font-family="Manrope, sans-serif">Москва-река</text>
      <circle cx="505" cy="405" r="5" fill="#b8975e"/>
      <text x="515" y="398" fill="#6d7a73" font-size="13" font-family="Manrope, sans-serif">Кремль</text>
    </svg>`;
  }
  function renderMap(host, list, onPick) {
    host.innerHTML = mapSvg() + list.map((z) => {
      const s = stats(z.id);
      return `<a class="map__pin" href="zhk.html?id=${z.id}" data-pin="${z.id}" style="left:${z.map[0]}%;top:${z.map[1]}%">${esc(z.name)}, от ${(s.min / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн</a>`;
    }).join("") + `<div class="map__legend">Схема для макета. На сайте здесь будет Яндекс Карта.</div>`;
    if (onPick) $$(".map__pin", host).forEach((p) => {
      p.addEventListener("mouseenter", () => onPick(p.dataset.pin));
      p.addEventListener("focus", () => onPick(p.dataset.pin));
    });
  }

  /* ---------- Каталог ---------- */
  const catalog = $("#catalog");
  if (catalog) {
    const q = {
      mode: params.get("mode") || "flats",
      view: params.get("view") || "grid",
      rooms: new Set((params.get("rooms") || "").split(",").filter(Boolean)),
      min: +params.get("min") || 0,
      max: +params.get("max") || 0,
      text: params.get("q") || "",
      deadline: params.get("deadline") || "any",
      region: params.get("region") || "any",
      finish: params.get("finish") || "any",
      cls: params.get("cls") || "any",
      sort: params.get("sort") || "price-asc",
      fav: params.get("fav") === "1",
    };
    const bar = $("#catalog-bar");
    const setForm = () => {
      $$("[data-room]", bar).forEach((c) => c.setAttribute("aria-pressed", q.rooms.has(c.dataset.room)));
      $("[name=min]", bar).value = q.min || "";
      $("[name=max]", bar).value = q.max || "";
      $("[name=q]", bar).value = q.text;
      ["deadline", "region", "finish", "cls"].forEach((k) => ($(`[name=${k}]`, bar).value = q[k]));
      $("[name=sort]").value = q.sort;
      $$("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === q.mode));
      $$("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === q.view));
      $("[data-fav-filter]").setAttribute("aria-pressed", q.fav);
    };
    const syncUrl = () => {
      const p = new URLSearchParams();
      if (q.mode !== "flats") p.set("mode", q.mode);
      if (q.view !== "grid") p.set("view", q.view);
      if (q.rooms.size) p.set("rooms", [...q.rooms].join(","));
      ["min", "max"].forEach((k) => q[k] && p.set(k, q[k]));
      if (q.text) p.set("q", q.text);
      ["deadline", "region", "finish", "cls"].forEach((k) => q[k] !== "any" && p.set(k, q[k]));
      if (q.sort !== "price-asc") p.set("sort", q.sort);
      if (q.fav) p.set("fav", "1");
      history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
    };
    const sorters = {
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      "area-desc": (a, b) => b.area - a.area,
      "save-desc": (a, b) => (b.old ? b.old - b.price : 0) - (a.old ? a.old - a.price : 0),
    };
    function render() {
      const flats = D.FLATS.filter((f) => matchFlat(f, q)).sort(sorters[q.sort]);
      const zids = new Set(flats.map((f) => f.zhk));
      const zlist = D.ZHK.filter((z) => zids.has(z.id)).sort((a, b) => sorters[q.sort]({ price: stats(a.id).min, area: 0 }, { price: stats(b.id).min, area: 0 }) || 0);
      const showFlats = q.mode === "flats" && q.view !== "map";
      const n = showFlats ? flats.length : zlist.length;
      $("#result-count").textContent = showFlats ? `${n} ${plural(n, "квартира", "квартиры", "квартир")}` : `${n} ${plural(n, "жилой комплекс", "жилых комплекса", "жилых комплексов")}`;
      const empty = `<div class="empty"><div class="empty__ico">${ico("search", "ico--lg")}</div><p class="h3">Под эти условия ничего не нашлось</p><p class="muted">Ослабьте фильтры или оставьте заявку: найдём вручную, в том числе среди закрытых предложений.</p><div class="offer__cta" style="justify-content:center"><button class="btn btn--ghost" type="button" data-reset>Сбросить фильтры</button><button class="btn btn--gold" type="button" data-open="quiz">Подобрать с Екатериной</button></div></div>`;
      if (q.view === "map") {
        catalog.innerHTML = `<div class="map-wrap"><div class="map" id="map"></div><div class="map-list" id="map-list"></div></div>`;
        renderMap($("#map"), zlist, (id) => $$(".map-item").forEach((m) => m.classList.toggle("is-active", m.dataset.id === id)));
        $("#map-list").innerHTML = zlist.length ? zlist.map((z) => {
          const s = stats(z.id);
          const cnt = flats.filter((f) => f.zhk === z.id).length;
          return `<a class="map-item" data-id="${z.id}" href="zhk.html?id=${z.id}"><img src="${IMG}${z.img[0]}.webp" alt="" loading="lazy"><div><b>${esc(z.name)}</b><span>${esc(z.metro)}, сдача: ${z.deadline.toLowerCase()}</span><br><span>от ${mln(s.min)} · ${cnt} ${plural(cnt, "квартира", "квартиры", "квартир")}</span></div></a>`;
        }).join("") : empty;
        $$(".map-item").forEach((m) => m.addEventListener("mouseenter", () => $$(".map__pin").forEach((p) => p.classList.toggle("is-active", p.dataset.pin === m.dataset.id))));
      } else if (q.mode === "flats") {
        catalog.innerHTML = flats.length ? `<div class="flat-grid">${flats.map(flatCard).join("")}</div>` : empty;
      } else {
        catalog.innerHTML = zlist.length ? `<div class="zhk-grid">${zlist.map(zhkCard).join("")}</div>` : empty;
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
      if (t.name === "min" || t.name === "max") { q[t.name] = parseFloat(String(t.value).replace(",", ".")) || 0; render(); }
    });
    bar.addEventListener("change", (e) => {
      const t = e.target;
      if (["deadline", "region", "finish", "cls"].includes(t.name)) { q[t.name] = t.value; render(); }
    });
    $("[name=sort]").addEventListener("change", (e) => { q.sort = e.target.value; render(); });
    $$("[data-mode]").forEach((b) => b.addEventListener("click", () => { q.mode = b.dataset.mode; if (q.view === "map") q.view = "grid"; setForm(); render(); }));
    $$("[data-view]").forEach((b) => b.addEventListener("click", () => { q.view = b.dataset.view; setForm(); render(); }));
    $("[data-fav-filter]").addEventListener("click", () => { q.fav = !q.fav; setForm(); render(); });
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-reset]")) {
        Object.assign(q, { rooms: new Set(), min: 0, max: 0, text: "", deadline: "any", region: "any", finish: "any", cls: "any", fav: false });
        setForm(); render();
      }
    });
    setForm();
    render();
  }

  /* ---------- Страница ЖК ---------- */
  const zp = $("#zhk-page");
  if (zp) {
    const z = zhkMap[params.get("id")] || D.ZHK[0];
    const s = stats(z.id);
    const m = D.METRO[z.line];
    document.title = `ЖК «${z.name}», ${z.district} — Everest`;
    $$("[data-z]").forEach((el) => {
      const k = el.dataset.z;
      const v = { name: z.name, district: z.district, about: z.about, dev: z.dev, cls: z.cls, deadline: z.deadline, finish: z.finish, areas: z.areas,
        metro: `${z.metro}, ${z.walk}`, onSale: `${z.onSale} ${plural(z.onSale, "квартира", "квартиры", "квартир")}`, price: "от " + mln(s.min), ppm: `от ${nf.format(Math.round(s.ppm / 1000))} тыс. ₽ за м²` }[k];
      if (v !== undefined) el.textContent = v;
    });
    $("[data-z-tags]").innerHTML = z.tags.map((t, i) => `<span class="tag${i === 0 ? " tag--gold" : " tag--line"}">${esc(t)}</span>`).join("");
    $("[data-z-metro-dot]").style.background = m.color;
    const main = $("#gallery-main");
    main.src = `${IMG}${z.img[0]}.webp`;
    main.alt = `ЖК «${z.name}»`;
    $("#gallery-thumbs").innerHTML = z.img.map((im, i) => `<button type="button" aria-pressed="${i === 0}" aria-label="Фото ${i + 1}"><img src="${IMG}${im}.webp" alt="" loading="lazy"></button>`).join("");
    $$("#gallery-thumbs button").forEach((b, i) => b.addEventListener("click", () => {
      main.src = `${IMG}${z.img[i]}.webp`;
      $$("#gallery-thumbs button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    $$("[data-tour]").forEach((b) => (b.dataset.tour = z.id));
    $$("[data-z-context]").forEach((b) => { b.dataset.context = `ЖК ${z.name}: ${b.dataset.zContext}`; });
    $("[data-z-near]").innerHTML = z.near.map((n) => `<li><span>${esc(n[0])}</span><span>${esc(n[1])}</span></li>`).join("");
    renderMap($("#zhk-map"), [z]);
    const fl = flatsOf(z.id);
    const host = $("#zhk-flats");
    const chips = $("#zhk-rooms");
    const types = [...new Set(fl.map((f) => f.type))];
    chips.innerHTML = `<button class="chip" type="button" aria-pressed="true" data-t="all">Все</button>` + types.map((t) => `<button class="chip" type="button" aria-pressed="false" data-t="${t}">${D.TYPE_LABEL[t]}</button>`).join("");
    const draw = (t) => { host.innerHTML = fl.filter((f) => t === "all" || f.type === t).map(flatCard).join(""); };
    chips.addEventListener("click", (e) => {
      const c = e.target.closest("[data-t]");
      if (!c) return;
      $$("[data-t]", chips).forEach((x) => x.setAttribute("aria-pressed", x === c));
      draw(c.dataset.t);
    });
    draw("all");
    const best = fl.reduce((a, f) => Math.max(a, f.old ? (f.old - f.price) / f.old : 0), 0);
    const rates = fl.filter((f) => f.rate > 0).map((f) => f.rate);
    $("[data-cond-rate]").textContent = rates.length ? `от ${String(Math.min(...rates)).replace(".", ",")}%` : "100%";
    $("[data-cond-save]").textContent = best ? `до ${Math.round(best * 100)}%` : "по запросу";
    $("#zhk-similar").innerHTML = D.ZHK.filter((x) => x.id !== z.id).sort((a, b) => (b.region === z.region) - (a.region === z.region)).slice(0, 3).map(zhkCard).join("");
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
    document.title = `${p.title} — журнал Everest`;
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
      </button>`).join("") + `<div class="svc svc--plain"><span class="svc__t">Не нашли свою задачу?</span><span class="svc__p"><span class="svc__price"><small>Опишите её — предложим решение и цену</small></span><button class="svc__open" type="button" data-open="callback" data-context="Индивидуальная задача" data-context-title="Опишите задачу">Написать ${ico("arrow-right", "ico--sm")}</button></span></div>`;
  }

  syncFavCount();
})();
