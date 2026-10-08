document.addEventListener("DOMContentLoaded", () => {
  /* =========================================================
     1. 公開後にここだけ変更
  ========================================================= */
  // Google Apps Script をWebアプリとしてデプロイした後、ここに /exec URL を設定してください。
  const GAS_WEB_APP_URL = "";
  const LINE_URL = "ここに公式LINEの友だち追加URLを貼り付け";

  /* =========================================================
     2. 共通：ページ内リンク
  ========================================================= */

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;

      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();
      const header = document.querySelector(".site-header");
      const offset = (header?.offsetHeight || 0) + 12;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  /* =========================================================
     3. ヘッダーのスクロール状態
  ========================================================= */
  const header = document.querySelector(".site-header");
  const updateHeader = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* =========================================================
     4. スクロール時の表示アニメーション
  ========================================================= */
  const revealTargets = document.querySelectorAll(
    ".plan-card, .feature, .step, .faq-list details, .line-banner, .reservation-card"
  );

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.08 }
    );
    revealTargets.forEach((element) => {
      element.classList.add("reveal");
      observer.observe(element);
    });
  }

  /* =========================================================
     6. LINE URLを一括設定
  ========================================================= */
  document.querySelectorAll(".js-line-link").forEach((link) => {
    if (LINE_URL.startsWith("http")) {
      link.href = LINE_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });

  /* =========================================================
     7. 予約フォーム
     GAS Webアプリへhidden iframe経由でPOSTし、
     送信後はLINE追加を再度案内する。
  ========================================================= */
  const reservationForm = document.querySelector("#reservation-form");
  const reservationSuccess = document.querySelector("#reservation-success");
  const reservationFrame = document.querySelector("#reservation-submit-frame");
  const reservationBack = document.querySelector("#reservation-back");
  const reservationSubmit = document.querySelector(".reservation-submit");
  const formSubmitStatus = document.querySelector("#form-submit-status");
  const dateInput = document.querySelector("#date");
  const datePickerButton = document.querySelector("#date-picker-button");
  let reservationSubmitting = false;
  let frameLoadedBeforeSubmit = false;

  if (reservationForm && reservationSuccess && reservationFrame) {
    const fields = {
      plan: { input: document.querySelector("#plan"), error: document.querySelector("#plan-error"), message: "プランを選択してください。" },
      date: { input: document.querySelector("#date"), error: document.querySelector("#date-error"), message: "利用希望日を選択してください。" },
      time: { input: document.querySelector("#time"), error: document.querySelector("#time-error"), message: "利用時間を選択してください。" },
      guests: { input: document.querySelector("#guests"), error: document.querySelector("#guests-error"), message: "人数を選択してください。" },
      payment: { input: document.querySelector("#payment"), error: document.querySelector("#payment-error"), message: "お支払い方法を選択してください。" },
      name: { input: document.querySelector("#name"), error: document.querySelector("#name-error"), message: "お名前を入力してください。" },
      email: { input: document.querySelector("#email"), error: document.querySelector("#email-error"), message: "正しいメールアドレスを入力してください。" },
      phone: { input: document.querySelector("#phone"), error: document.querySelector("#phone-error"), message: "電話番号を入力してください。" }
    };
    const consent = document.querySelector("#consent");
    const consentError = document.querySelector("#consent-error");

    const setError = (input, error, message, hasError) => {
      if (!input || !error) return;
      error.textContent = hasError ? message : "";
      const field = input.closest(".form-field");
      field?.classList.toggle("has-error", hasError);
      input.setAttribute("aria-invalid", String(hasError));
    };

    const validateField = (key) => {
      const item = fields[key];
      if (!item?.input) return true;
      let invalid = !item.input.value.trim();
      let message = item.message;
      if (key === "email" && item.input.value.trim()) {
        invalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.input.value.trim());
      }
      if (key === "phone" && item.input.value.trim()) {
        invalid = !/^[0-9+\-\s()]{8,}$/.test(item.input.value.trim());
        message = "電話番号を正しく入力してください。";
      }
      if (key === "date" && item.input.value) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const selected = new Date(item.input.value + "T00:00:00");
        invalid = selected < today;
        message = "本日以降の日付を選択してください。";
      }
      setError(item.input, item.error, message, invalid);
      return !invalid;
    };

    Object.keys(fields).forEach((key) => {
      fields[key].input?.addEventListener("blur", () => validateField(key));
      fields[key].input?.addEventListener("change", () => validateField(key));
      fields[key].input?.addEventListener("input", () => validateField(key));
    });

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    fields.date?.input?.setAttribute("min", `${yyyy}-${mm}-${dd}`);

    // 日付欄は入力を求めず、タップ/クリックでネイティブカレンダーを開く。
    const openDatePicker = () => {
      if (!dateInput) return;
      dateInput.focus({ preventScroll: true });
      if (typeof dateInput.showPicker === "function") {
        try { dateInput.showPicker(); } catch (_) {}
      }
    };
    dateInput?.addEventListener("click", openDatePicker);
    datePickerButton?.addEventListener("click", openDatePicker);

    reservationFrame.addEventListener("load", () => {
      if (!reservationSubmitting || !frameLoadedBeforeSubmit) return;
      reservationSubmitting = false;
      reservationForm.hidden = true;
      reservationSuccess.hidden = false;
      reservationSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    reservationForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const validFields = Object.keys(fields).map(validateField);
      const consentValid = Boolean(consent?.checked);
      if (consentError) consentError.textContent = consentValid ? "" : "予約条件・キャンセルポリシー、個人情報の取り扱いへの同意が必要です。";
      consent?.closest(".form-consent")?.classList.toggle("has-error", !consentValid);
      consent?.setAttribute("aria-invalid", String(!consentValid));
      if (!validFields.every(Boolean) || !consentValid) {
        const firstError = reservationForm.querySelector('.field-error:not(:empty)');
        const target = firstError?.previousElementSibling || firstError;
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!GAS_WEB_APP_URL.startsWith("https://script.google.com/")) {
        if (formSubmitStatus) {
          formSubmitStatus.textContent = "予約フォームの接続先がまだ設定されていません。script.js の GAS_WEB_APP_URL に、GASのWebアプリURL（/exec）を設定してください。";
          formSubmitStatus.classList.add("is-error");
        }
        return;
      }

      if (formSubmitStatus) {
        formSubmitStatus.textContent = "";
        formSubmitStatus.classList.remove("is-error", "is-success");
      }

      if (reservationSubmitting) return;
      reservationSubmitting = true;
      frameLoadedBeforeSubmit = true;
      if (reservationSubmit) {
        reservationSubmit.disabled = true;
        reservationSubmit.textContent = "送信中…";
      }
      reservationForm.action = GAS_WEB_APP_URL;
      reservationForm.submit();

      window.setTimeout(() => {
        if (!reservationSubmitting) return;
        reservationSubmitting = false;
        if (reservationSubmit) {
          reservationSubmit.disabled = false;
          reservationSubmit.textContent = "予約内容を送信する";
        }
        if (formSubmitStatus) {
          formSubmitStatus.textContent = "送信結果を確認できませんでした。GASのWebアプリ設定とGoogleスプレッドシートをご確認ください。";
          formSubmitStatus.classList.add("is-error");
        }
      }, 10000);
    });

    reservationBack?.addEventListener("click", () => {
      reservationSuccess.hidden = true;
      reservationForm.hidden = false;
      reservationForm.reset();
      Object.keys(fields).forEach((key) => validateField(key));
      Object.keys(fields).forEach((key) => {
        setError(fields[key].input, fields[key].error, fields[key].message, false);
      });
      if (consentError) consentError.textContent = "";
      if (formSubmitStatus) {
        formSubmitStatus.textContent = "";
        formSubmitStatus.classList.remove("is-error", "is-success");
      }
      consent?.closest(".form-consent")?.classList.remove("has-error");
      consent?.setAttribute("aria-invalid", "false");
      if (reservationSubmit) {
        reservationSubmit.disabled = false;
        reservationSubmit.textContent = "予約内容を送信する";
      }
    });
  }
});
