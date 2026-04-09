// i18n configuration
const i18n = {
  supportedLanguages: ['en', 'de', 'fr', 'cs', 'es', 'id', 'it', 'pt_BR', 'tr'],
  defaultLanguage: 'en',
  currentLanguage: null,
  translations: {},

  /**
   * Initialize i18n
   */
  async init() {
    this.currentLanguage = this.detectLanguage();
    await this.loadTranslations(this.currentLanguage);
    this.translatePage();
  },

  /**
   * Detect language: URL param > browser lang > default
   */
  detectLanguage() {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');

    if (urlLang && this.supportedLanguages.includes(urlLang)) {
      return urlLang;
    }

    // Check browser language preference
    const browserLang = this.getBrowserLanguage();
    if (browserLang && this.supportedLanguages.includes(browserLang)) {
      return browserLang;
    }

    // Fallback to English
    return this.defaultLanguage;
  },

  /**
   * Get browser language (handle pt-BR → pt_BR conversion)
   */
  getBrowserLanguage() {
    const lang = navigator.language || navigator.userLanguage;
    if (!lang) return null;

    const baseLang = lang.split('-')[0].toLowerCase();

    // Direct match
    if (this.supportedLanguages.includes(baseLang)) {
      return baseLang;
    }

    // Handle specific regional variants
    if (lang.startsWith('pt')) {
      // Portuguese: pt-BR → pt_BR, others → pt_BR (default)
      return 'pt_BR';
    }

    return null;
  },

  /**
   * Load translations from JSON file
   */
  async loadTranslations(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
      this.translations = await response.json();
    } catch (error) {
      console.error(`Error loading language file for ${lang}:`, error);
      // Fallback to English if loading fails
      if (lang !== this.defaultLanguage) {
        await this.loadTranslations(this.defaultLanguage);
      }
    }
  },

  /**
   * Get translation by key (supports nested keys like "common.back")
   */
  getTranslation(key) {
    const keys = key.split('.');
    let value = this.translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key; // Return key itself if not found
      }
    }

    return value;
  },

  /**
   * Translate the entire page
   */
  translatePage() {
    this.translateText();
    this.translatePlaceholders();
    this.translateAltText();
  },

  /**
   * Translate text content (data-i18n attribute)
   */
  translateText() {
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      const translation = this.getTranslation(key);

      // Check if translation contains HTML (like <strong>)
      if (typeof translation === 'string' && translation.includes('<')) {
        element.innerHTML = translation;
      } else {
        element.textContent = translation;
      }
    });
  },

  /**
   * Translate input placeholders (data-i18n-placeholder attribute)
   */
  translatePlaceholders() {
    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translation = this.getTranslation(key);
      element.setAttribute('placeholder', translation);
    });
  },

  /**
   * Translate image alt text (data-i18n-alt attribute)
   */
  translateAltText() {
    document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      const key = element.getAttribute('data-i18n-alt');
      const translation = this.getTranslation(key);
      element.setAttribute('alt', translation);
    });
  },

  /**
   * Change language at runtime
   */
  async changeLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      console.error(`Language ${lang} is not supported`);
      return;
    }

    this.currentLanguage = lang;
    await this.loadTranslations(lang);
    this.translatePage();

    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url);
  },
};

// Initialize i18n when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => i18n.init());
} else {
  i18n.init();
}
