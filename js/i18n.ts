/**
 * Internationalization (i18n) System
 * Sistema de traducciones para múltiples idiomas
 */

interface Translation {
  [key: string]: string | Translation;
}

interface LocaleConfig {
  code: string;
  name: string;
  flag: string;
  rtl: boolean;
}

class I18nManager {
  private currentLocale: string = 'es';
  private translations: Map<string, Translation> = new Map();
  private fallbackLocale: string = 'es';
  private availableLocales: LocaleConfig[] = [
    { code: 'es', name: 'Español', flag: '🇪🇸', rtl: false },
    { code: 'en', name: 'English', flag: '🇬🇧', rtl: false },
    { code: 'pt', name: 'Português', flag: '🇧🇷', rtl: false },
    { code: 'fr', name: 'Français', flag: '🇫🇷', rtl: false },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', rtl: false },
    { code: 'ja', name: '日本語', flag: '🇯🇵', rtl: false },
    { code: 'zh', name: '中文', flag: '🇨🇳', rtl: false },
    { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true }
  ];

  constructor() {
    this.loadTranslations();
    this.detectLocale();
  }

  private detectLocale(): void {
    // Check localStorage first
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale && this.isLocaleAvailable(savedLocale)) {
      this.currentLocale = savedLocale;
      return;
    }

    // Check browser language
    const browserLocale = navigator.language.split('-')[0];
    if (this.isLocaleAvailable(browserLocale)) {
      this.currentLocale = browserLocale;
      return;
    }

    // Default to Spanish
    this.currentLocale = this.fallbackLocale;
  }

  private isLocaleAvailable(locale: string): boolean {
    return this.availableLocales.some(l => l.code === locale);
  }

  private loadTranslations(): void {
    // Spanish (default)
    this.translations.set('es', {
      // Common
      'app.title': 'Minijuegos — Entrenador de Bots',
      'app.subtitle': 'Plataforma de entrenamiento cognitivo',
      
      // Lobby
      'lobby.title': 'Lobby de Juegos',
      'lobby.search': 'Buscar juegos...',
      'lobby.filter.all': 'Todos',
      'lobby.filter.memory': 'Memoria',
      'lobby.filter.reflex': 'Reflejos',
      'lobby.filter.logic': 'Lógica',
      'lobby.filter.perception': 'Percepción',
      'lobby.filter.cipher': 'Cifrado',
      'lobby.filter.typing': 'Tipeo',
      'lobby.filter.analysis': 'Análisis',
      'lobby.favorites': 'Favoritos',
      'lobby.favorites.empty': 'No tienes favoritos aún',
      'lobby.noResults': 'No se encontraron juegos',
      
      // Games
      'game.start': 'Iniciar',
      'game.stop': 'Detener',
      'game.score': 'Puntuación',
      'game.round': 'Ronda',
      'game.time': 'Tiempo',
      'game.info': 'Información',
      'game.instructions': 'Instrucciones',
      'game.completed': '¡Completado!',
      'game.gameOver': 'Juego Terminado',
      'game.newRecord': '¡Nuevo Récord!',
      
      // Navigation
      'nav.home': 'Inicio',
      'nav.games': 'Juegos',
      'nav.leaderboard': 'Récords',
      'nav.settings': 'Configuración',
      'nav.profile': 'Perfil',
      
      // Settings
      'settings.title': 'Configuración',
      'settings.language': 'Idioma',
      'settings.theme': 'Tema',
      'settings.sound': 'Sonido',
      'settings.music': 'Música',
      'settings.highContrast': 'Alto Contraste',
      'settings.reducedMotion': 'Movimiento Reducido',
      'settings.reset': 'Restablecer',
      
      // Messages
      'message.welcome': '¡Bienvenido!',
      'message.loading': 'Cargando...',
      'message.error': 'Ha ocurrido un error',
      'message.success': '¡Éxito!',
      
      // Buttons
      'button.ok': 'Aceptar',
      'button.cancel': 'Cancelar',
      'button.save': 'Guardar',
      'button.close': 'Cerrar',
      'button.retry': 'Reintentar'
    });

    // English
    this.translations.set('en', {
      'app.title': 'Minigames — Bot Trainer',
      'app.subtitle': 'Cognitive training platform',
      
      'lobby.title': 'Game Lobby',
      'lobby.search': 'Search games...',
      'lobby.filter.all': 'All',
      'lobby.filter.memory': 'Memory',
      'lobby.filter.reflex': 'Reflexes',
      'lobby.filter.logic': 'Logic',
      'lobby.filter.perception': 'Perception',
      'lobby.filter.cipher': 'Cipher',
      'lobby.filter.typing': 'Typing',
      'lobby.filter.analysis': 'Analysis',
      'lobby.favorites': 'Favorites',
      'lobby.favorites.empty': 'No favorites yet',
      'lobby.noResults': 'No games found',
      
      'game.start': 'Start',
      'game.stop': 'Stop',
      'game.score': 'Score',
      'game.round': 'Round',
      'game.time': 'Time',
      'game.info': 'Info',
      'game.instructions': 'Instructions',
      'game.completed': 'Completed!',
      'game.gameOver': 'Game Over',
      'game.newRecord': 'New Record!',
      
      'nav.home': 'Home',
      'nav.games': 'Games',
      'nav.leaderboard': 'Leaderboard',
      'nav.settings': 'Settings',
      'nav.profile': 'Profile',
      
      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'settings.sound': 'Sound',
      'settings.music': 'Music',
      'settings.highContrast': 'High Contrast',
      'settings.reducedMotion': 'Reduced Motion',
      'settings.reset': 'Reset',
      
      'message.welcome': 'Welcome!',
      'message.loading': 'Loading...',
      'message.error': 'An error occurred',
      'message.success': 'Success!',
      
      'button.ok': 'OK',
      'button.cancel': 'Cancel',
      'button.save': 'Save',
      'button.close': 'Close',
      'button.retry': 'Retry'
    });

    // Portuguese
    this.translations.set('pt', {
      'app.title': 'Minijogos — Treinador de Bots',
      'app.subtitle': 'Plataforma de treinamento cognitivo',
      
      'lobby.title': 'Lobby de Jogos',
      'lobby.search': 'Buscar jogos...',
      'lobby.filter.all': 'Todos',
      'lobby.filter.memory': 'Memória',
      'lobby.filter.reflex': 'Reflexos',
      'lobby.filter.logic': 'Lógica',
      'lobby.filter.perception': 'Percepção',
      'lobby.filter.cipher': 'Cifra',
      'lobby.filter.typing': 'Digitação',
      'lobby.filter.analysis': 'Análise',
      'lobby.favorites': 'Favoritos',
      'lobby.favorites.empty': 'Sem favoritos ainda',
      'lobby.noResults': 'Nenhum jogo encontrado',
      
      'game.start': 'Iniciar',
      'game.stop': 'Parar',
      'game.score': 'Pontuação',
      'game.round': 'Rodada',
      'game.time': 'Tempo',
      'game.info': 'Informação',
      'game.instructions': 'Instruções',
      'game.completed': 'Concluído!',
      'game.gameOver': 'Fim de Jogo',
      'game.newRecord': 'Novo Recorde!',
      
      'nav.home': 'Início',
      'nav.games': 'Jogos',
      'nav.leaderboard': 'Recordes',
      'nav.settings': 'Configurações',
      'nav.profile': 'Perfil',
      
      'settings.title': 'Configurações',
      'settings.language': 'Idioma',
      'settings.theme': 'Tema',
      'settings.sound': 'Som',
      'settings.music': 'Música',
      'settings.highContrast': 'Alto Contraste',
      'settings.reducedMotion': 'Movimento Reduzido',
      'settings.reset': 'Restaurar',
      
      'message.welcome': 'Bem-vindo!',
      'message.loading': 'Carregando...',
      'message.error': 'Ocorreu um erro',
      'message.success': 'Sucesso!',
      
      'button.ok': 'OK',
      'button.cancel': 'Cancelar',
      'button.save': 'Salvar',
      'button.close': 'Fechar',
      'button.retry': 'Tentar novamente'
    });

    // French
    this.translations.set('fr', {
      'app.title': 'Minijeux — Entraîneur de Bots',
      'app.subtitle': 'Plateforme d\'entraînement cognitif',
      
      'lobby.title': 'Lobby des Jeux',
      'lobby.search': 'Rechercher des jeux...',
      'lobby.filter.all': 'Tous',
      'lobby.filter.memory': 'Mémoire',
      'lobby.filter.reflex': 'Réflexes',
      'lobby.filter.logic': 'Logique',
      'lobby.filter.perception': 'Perception',
      'lobby.filter.cipher': 'Chiffrement',
      'lobby.filter.typing': 'Frappe',
      'lobby.filter.analysis': 'Analyse',
      'lobby.favorites': 'Favoris',
      'lobby.favorites.empty': 'Aucun favori pour le moment',
      'lobby.noResults': 'Aucun jeu trouvé',
      
      'game.start': 'Démarrer',
      'game.stop': 'Arrêter',
      'game.score': 'Score',
      'game.round': 'Manche',
      'game.time': 'Temps',
      'game.info': 'Info',
      'game.instructions': 'Instructions',
      'game.completed': 'Terminé!',
      'game.gameOver': 'Jeu Terminé',
      'game.newRecord': 'Nouveau Record!',
      
      'nav.home': 'Accueil',
      'nav.games': 'Jeux',
      'nav.leaderboard': 'Classement',
      'nav.settings': 'Paramètres',
      'nav.profile': 'Profil',
      
      'settings.title': 'Paramètres',
      'settings.language': 'Langue',
      'settings.theme': 'Thème',
      'settings.sound': 'Son',
      'settings.music': 'Musique',
      'settings.highContrast': 'Contraste Élevé',
      'settings.reducedMotion': 'Mouvement Réduit',
      'settings.reset': 'Réinitialiser',
      
      'message.welcome': 'Bienvenue!',
      'message.loading': 'Chargement...',
      'message.error': 'Une erreur est survenue',
      'message.success': 'Succès!',
      
      'button.ok': 'OK',
      'button.cancel': 'Annuler',
      'button.save': 'Enregistrer',
      'button.close': 'Fermer',
      'button.retry': 'Réessayer'
    });

    // German
    this.translations.set('de', {
      'app.title': 'Minispiele — Bot-Trainer',
      'app.subtitle': 'Kognitive Trainingsplattform',
      
      'lobby.title': 'Spiel-Lobby',
      'lobby.search': 'Spiele suchen...',
      'lobby.filter.all': 'Alle',
      'lobby.filter.memory': 'Gedächtnis',
      'lobby.filter.reflex': 'Reflexe',
      'lobby.filter.logic': 'Logik',
      'lobby.filter.perception': 'Wahrnehmung',
      'lobby.filter.cipher': 'Chiffre',
      'lobby.filter.typing': 'Tippen',
      'lobby.filter.analysis': 'Analyse',
      'lobby.favorites': 'Favoriten',
      'lobby.favorites.empty': 'Noch keine Favoriten',
      'lobby.noResults': 'Keine Spiele gefunden',
      
      'game.start': 'Starten',
      'game.stop': 'Stoppen',
      'game.score': 'Punktzahl',
      'game.round': 'Runde',
      'game.time': 'Zeit',
      'game.info': 'Info',
      'game.instructions': 'Anweisungen',
      'game.completed': 'Abgeschlossen!',
      'game.gameOver': 'Spiel Beendet',
      'game.newRecord': 'Neuer Rekord!',
      
      'nav.home': 'Startseite',
      'nav.games': 'Spiele',
      'nav.leaderboard': 'Bestenliste',
      'nav.settings': 'Einstellungen',
      'nav.profile': 'Profil',
      
      'settings.title': 'Einstellungen',
      'settings.language': 'Sprache',
      'settings.theme': 'Design',
      'settings.sound': 'Ton',
      'settings.music': 'Musik',
      'settings.highContrast': 'Hoher Kontrast',
      'settings.reducedMotion': 'Reduzierte Bewegung',
      'settings.reset': 'Zurücksetzen',
      
      'message.welcome': 'Willkommen!',
      'message.loading': 'Laden...',
      'message.error': 'Ein Fehler ist aufgetreten',
      'message.success': 'Erfolg!',
      
      'button.ok': 'OK',
      'button.cancel': 'Abbrechen',
      'button.save': 'Speichern',
      'button.close': 'Schließen',
      'button.retry': 'Wiederholen'
    });

    // Japanese
    this.translations.set('ja', {
      'app.title': 'ミニゲーム — ボットトレーナー',
      'app.subtitle': '認知トレーニングプラットフォーム',
      
      'lobby.title': 'ゲームロビー',
      'lobby.search': 'ゲームを検索...',
      'lobby.filter.all': 'すべて',
      'lobby.filter.memory': '記憶',
      'lobby.filter.reflex': '反射神経',
      'lobby.filter.logic': '論理',
      'lobby.filter.perception': '知覚',
      'lobby.filter.cipher': '暗号',
      'lobby.filter.typing': 'タイピング',
      'lobby.filter.analysis': '分析',
      'lobby.favorites': 'お気に入り',
      'lobby.favorites.empty': 'お気に入りはまだありません',
      'lobby.noResults': 'ゲームが見つかりません',
      
      'game.start': '開始',
      'game.stop': '停止',
      'game.score': 'スコア',
      'game.round': 'ラウンド',
      'game.time': '時間',
      'game.info': '情報',
      'game.instructions': '説明',
      'game.completed': '完了!',
      'game.gameOver': 'ゲームオーバー',
      'game.newRecord': '新記録!',
      
      'nav.home': 'ホーム',
      'nav.games': 'ゲーム',
      'nav.leaderboard': 'リーダーボード',
      'nav.settings': '設定',
      'nav.profile': 'プロフィール',
      
      'settings.title': '設定',
      'settings.language': '言語',
      'settings.theme': 'テーマ',
      'settings.sound': 'サウンド',
      'settings.music': '音楽',
      'settings.highContrast': 'ハイコントラスト',
      'settings.reducedMotion': '動作削減',
      'settings.reset': 'リセット',
      
      'message.welcome': 'ようこそ!',
      'message.loading': '読み込み中...',
      'message.error': 'エラーが発生しました',
      'message.success': '成功!',
      
      'button.ok': 'OK',
      'button.cancel': 'キャンセル',
      'button.save': '保存',
      'button.close': '閉じる',
      'button.retry': '再試行'
    });

    // Chinese
    this.translations.set('zh', {
      'app.title': '小游戏 — 机器人训练器',
      'app.subtitle': '认知训练平台',
      
      'lobby.title': '游戏大厅',
      'lobby.search': '搜索游戏...',
      'lobby.filter.all': '全部',
      'lobby.filter.memory': '记忆',
      'lobby.filter.reflex': '反应',
      'lobby.filter.logic': '逻辑',
      'lobby.filter.perception': '感知',
      'lobby.filter.cipher': '加密',
      'lobby.filter.typing': '打字',
      'lobby.filter.analysis': '分析',
      'lobby.favorites': '收藏',
      'lobby.favorites.empty': '还没有收藏',
      'lobby.noResults': '未找到游戏',
      
      'game.start': '开始',
      'game.stop': '停止',
      'game.score': '分数',
      'game.round': '回合',
      'game.time': '时间',
      'game.info': '信息',
      'game.instructions': '说明',
      'game.completed': '完成!',
      'game.gameOver': '游戏结束',
      'game.newRecord': '新纪录!',
      
      'nav.home': '首页',
      'nav.games': '游戏',
      'nav.leaderboard': '排行榜',
      'nav.settings': '设置',
      'nav.profile': '个人资料',
      
      'settings.title': '设置',
      'settings.language': '语言',
      'settings.theme': '主题',
      'settings.sound': '声音',
      'settings.music': '音乐',
      'settings.highContrast': '高对比度',
      'settings.reducedMotion': '减少动画',
      'settings.reset': '重置',
      
      'message.welcome': '欢迎!',
      'message.loading': '加载中...',
      'message.error': '发生错误',
      'message.success': '成功!',
      
      'button.ok': '确定',
      'button.cancel': '取消',
      'button.save': '保存',
      'button.close': '关闭',
      'button.retry': '重试'
    });

    // Arabic
    this.translations.set('ar', {
      'app.title': 'ألعاب صغيرة — مدرب الروبوتات',
      'app.subtitle': 'منصة التدريب المعرفي',
      
      'lobby.title': 'ردهة الألعاب',
      'lobby.search': 'بحث في الألعاب...',
      'lobby.filter.all': 'الكل',
      'lobby.filter.memory': 'الذاكرة',
      'lobby.filter.reflex': 'الانعكاس',
      'lobby.filter.logic': 'المنطق',
      'lobby.filter.perception': 'الإدراك',
      'lobby.filter.cipher': 'التشفير',
      'lobby.filter.typing': 'الكتابة',
      'lobby.filter.analysis': 'التحليل',
      'lobby.favorites': 'المفضلة',
      'lobby.favorites.empty': 'لا توجد مفضلة بعد',
      'lobby.noResults': 'لم يتم العثور على ألعاب',
      
      'game.start': 'بدء',
      'game.stop': 'إيقاف',
      'game.score': 'النتيجة',
      'game.round': 'الجولة',
      'game.time': 'الوقت',
      'game.info': 'معلومات',
      'game.instructions': 'تعليمات',
      'game.completed': 'مكتمل!',
      'game.gameOver': 'انتهت اللعبة',
      'game.newRecord': 'رقم قياسي جديد!',
      
      'nav.home': 'الرئيسية',
      'nav.games': 'الألعاب',
      'nav.leaderboard': 'قائمة المتصدرين',
      'nav.settings': 'الإعدادات',
      'nav.profile': 'الملف الشخصي',
      
      'settings.title': 'الإعدادات',
      'settings.language': 'اللغة',
      'settings.theme': 'المظهر',
      'settings.sound': 'الصوت',
      'settings.music': 'الموسيقى',
      'settings.highContrast': 'تباين عالي',
      'settings.reducedMotion': 'حركة مخفضة',
      'settings.reset': 'إعادة تعيين',
      
      'message.welcome': 'مرحباً!',
      'message.loading': 'جاري التحميل...',
      'message.error': 'حدث خطأ',
      'message.success': 'نجاح!',
      
      'button.ok': 'موافق',
      'button.cancel': 'إلغاء',
      'button.save': 'حفظ',
      'button.close': 'إغلاق',
      'button.retry': 'إعادة المحاولة'
    });
  }

  t(key: string, params?: Record<string, string | number>): string {
    const translations = this.translations.get(this.currentLocale);
    let value = this.getNestedValue(translations, key);

    // Fallback to default locale if translation not found
    if (!value && this.currentLocale !== this.fallbackLocale) {
      const fallbackTranslations = this.translations.get(this.fallbackLocale);
      value = this.getNestedValue(fallbackTranslations, key);
    }

    // Return key if translation not found
    if (!value) {
      return key;
    }

    // Replace parameters
    if (params && typeof value === 'string') {
      // Igual que en los .logic.ts: TS no propaga el narrowing de
      // typeof value === 'string' hacia dentro del forEach (closure
      // anidada) — se fija una referencia local ya tipada como string.
      let strValue = value;
      Object.entries(params).forEach(([param, replacement]) => {
        strValue = strValue.replace(`{${param}}`, String(replacement));
      });
      value = strValue;
    }

    return value;
  }

  private getNestedValue(obj: Translation | undefined, key: string): string | undefined {
    if (!obj) return undefined;
    
    const keys = key.split('.');
    let value: Translation | string = obj;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return typeof value === 'string' ? value : undefined;
  }

  setLocale(locale: string): void {
    if (!this.isLocaleAvailable(locale)) {
      console.warn(`[I18n] Locale ${locale} not available`);
      return;
    }

    this.currentLocale = locale;
    localStorage.setItem('locale', locale);
    
    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('locale:changed', { detail: locale }));
    
    // Update document direction for RTL languages
    const localeConfig = this.availableLocales.find(l => l.code === locale);
    if (localeConfig) {
      document.documentElement.dir = localeConfig.rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = locale;
    }
  }

  getLocale(): string {
    return this.currentLocale;
  }

  getAvailableLocales(): LocaleConfig[] {
    return this.availableLocales;
  }

  getCurrentLocaleConfig(): LocaleConfig | undefined {
    return this.availableLocales.find(l => l.code === this.currentLocale);
  }

  isRTL(): boolean {
    const config = this.getCurrentLocaleConfig();
    return config ? config.rtl : false;
  }
}

// Singleton instance
export const i18n = new I18nManager();

// Exponer en window para debugging
if (typeof window !== 'undefined') {
  window.i18n = i18n;
  window.t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
}

export default i18n;
