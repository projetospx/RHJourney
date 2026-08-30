(function () {
  'use strict';

  const PRIMARY_STORAGE_KEY = 'shopeeJourneyTheme';
  const LEGACY_STORAGE_KEYS = ['theme', 'journey-theme'];
  const VALID_THEMES = new Set(['light', 'dark']);

  let syncing = false;

  function normalizeTheme(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return VALID_THEMES.has(normalized) ? normalized : null;
  }

  function readTheme() {
    const htmlTheme = normalizeTheme(
      document.documentElement.getAttribute('data-theme')
    );

    if (htmlTheme) {
      return htmlTheme;
    }

    const bodyTheme = normalizeTheme(
      document.body?.getAttribute('data-theme')
    );

    if (bodyTheme) {
      return bodyTheme;
    }

    const savedTheme = normalizeTheme(
      localStorage.getItem(PRIMARY_STORAGE_KEY)
    );

    if (savedTheme) {
      return savedTheme;
    }

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacyTheme = normalizeTheme(localStorage.getItem(key));

      if (legacyTheme) {
        return legacyTheme;
      }
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function syncTheme() {
    const body = document.body;

    if (!body || syncing) {
      return;
    }

    syncing = true;

    try {
      const theme = readTheme();
      const dark = theme === 'dark';

      body.classList.toggle('sj-dark', dark);
      body.classList.toggle('sj-light', !dark);

      updateToggleButtons(theme);
    } finally {
      syncing = false;
    }
  }

  function updateToggleButtons(theme) {
    const dark = theme === 'dark';
    const targetLabel = dark ? 'claro' : 'escuro';
    const icon = dark ? '☀️' : '🌙';

    document
      .querySelectorAll('[data-theme-toggle], #themeToggleApp, #themeToggle')
      .forEach(button => {
        button.textContent = icon;
        button.title = `Mudar para tema ${targetLabel}`;
        button.setAttribute('aria-label', `Mudar para tema ${targetLabel}`);
        button.setAttribute('aria-pressed', String(dark));
      });
  }

  function scheduleSync() {
    window.setTimeout(syncTheme, 0);
    window.setTimeout(syncTheme, 80);
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncTheme();

    document.addEventListener('click', event => {
      if (event.target.closest('[data-theme-toggle], #themeToggleApp, #themeToggle')) {
        scheduleSync();
      }
    });

    const observer = new MutationObserver(syncTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  });

  window.addEventListener('storage', event => {
    if (
      event.key === PRIMARY_STORAGE_KEY ||
      LEGACY_STORAGE_KEYS.includes(event.key)
    ) {
      syncTheme();
    }
  });
})();
