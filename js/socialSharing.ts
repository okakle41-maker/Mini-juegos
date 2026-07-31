/**
 * Social Sharing System
 * Sistema de compartir en redes sociales
 */

interface ShareData {
  title: string;
  description: string;
  url?: string;
  image?: string;
  score?: number;
  game?: string;
  achievement?: string;
}

class SocialSharing {
  private baseUrl = window.location.origin;

  share(data: ShareData): Promise<void> {
    if (navigator.share) {
      return this.nativeShare(data);
    } else {
      return this.fallbackShare(data);
    }
  }

  private async nativeShare(data: ShareData): Promise<void> {
    const shareData = {
      title: data.title,
      text: data.description,
      url: data.url || this.baseUrl
    };

    try {
      await navigator.share(shareData);
    } catch (error) {
      console.error('[SocialSharing] Native share failed:', error);
      throw error;
    }
  }

  private async fallbackShare(data: ShareData): Promise<void> {
    const text = this.formatShareText(data);
    
    try {
      await navigator.clipboard.writeText(text);
      if ((window as any).notificationSystem) {
        (window as any).notificationSystem.success('¡Copiado!', 'Texto copiado al portapapeles');
      }
    } catch (error) {
      console.error('[SocialSharing] Clipboard failed:', error);
      throw error;
    }
  }

  private formatShareText(data: ShareData): string {
    let text = `${data.title}\n${data.description}`;
    
    if (data.score !== undefined) {
      text += `\n🎯 Puntuación: ${data.score}`;
    }
    
    if (data.game) {
      text += `\n🎮 Juego: ${data.game}`;
    }
    
    if (data.achievement) {
      text += `\n🏆 Logro: ${data.achievement}`;
    }
    
    text += `\n${data.url || this.baseUrl}`;
    
    return text;
  }

  shareTwitter(data: ShareData): void {
    const text = encodeURIComponent(this.formatShareText(data));
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    this.openPopup(url);
  }

  shareFacebook(data: ShareData): void {
    const url = encodeURIComponent(data.url || this.baseUrl);
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    this.openPopup(shareUrl);
  }

  shareLinkedIn(data: ShareData): void {
    const url = encodeURIComponent(data.url || this.baseUrl);
    const title = encodeURIComponent(data.title);
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`;
    this.openPopup(shareUrl);
  }

  shareWhatsApp(data: ShareData): void {
    const text = encodeURIComponent(this.formatShareText(data));
    const url = `https://wa.me/?text=${text}`;
    this.openPopup(url);
  }

  shareTelegram(data: ShareData): void {
    const text = encodeURIComponent(this.formatShareText(data));
    const url = `https://t.me/share/url?url=${encodeURIComponent(data.url || this.baseUrl)}&text=${text}`;
    this.openPopup(url);
  }

  shareReddit(data: ShareData): void {
    const url = encodeURIComponent(data.url || this.baseUrl);
    const title = encodeURIComponent(data.title);
    const shareUrl = `https://www.reddit.com/submit?url=${url}&title=${title}`;
    this.openPopup(shareUrl);
  }

  shareEmail(data: ShareData): void {
    const subject = encodeURIComponent(data.title);
    const body = encodeURIComponent(this.formatShareText(data));
    const url = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = url;
  }

  shareScore(gameId: string, gameName: string, score: number): Promise<void> {
    const data: ShareData = {
      title: `¡Conseguí ${score} puntos en ${gameName}!`,
      description: '¿Puedes superar mi puntuación en Minijuegos — Entrenador de Bots?',
      game: gameName,
      score: score
    };
    return this.share(data);
  }

  shareAchievement(achievementName: string, achievementDescription: string): Promise<void> {
    const data: ShareData = {
      title: `¡Desbloqueé: ${achievementName}!`,
      description: achievementDescription,
      achievement: achievementName
    };
    return this.share(data);
  }

  shareGame(gameId: string, gameName: string): Promise<void> {
    const data: ShareData = {
      title: `Juega ${gameName} en Minijuegos — Entrenador de Bots`,
      description: 'Plataforma de minijuegos para entrenamiento cognitivo. ¡Desafía tu mente!',
      game: gameName
    };
    return this.share(data);
  }

  shareLeaderboard(gameId: string, gameName: string, rank: number, score: number): Promise<void> {
    const data: ShareData = {
      title: `¡Soy el #${rank} en ${gameName}!`,
      description: `Mi puntuación: ${score} puntos. ¿Puedes superarme?`,
      game: gameName,
      score: score
    };
    return this.share(data);
  }

  private openPopup(url: string): void {
    const width = 600;
    const height = 400;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    window.open(
      url,
      'share',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  generateShareImage(data: ShareData): string {
    const params = new URLSearchParams({
      title: data.title,
      score: data.score?.toString() || '',
      game: data.game || ''
    });
    
    return `${this.baseUrl}/api/share-image?${params.toString()}`;
  }

  copyShareLink(data: ShareData): Promise<void> {
    const url = data.url || this.baseUrl;
    const text = `${data.title}\n${data.description}\n${url}`;
    
    return navigator.clipboard.writeText(text).then(() => {
      if ((window as any).notificationSystem) {
        (window as any).notificationSystem.success('¡Enlace copiado!', 'Enlace copiado al portapapeles');
      }
    });
  }

  isNativeShareAvailable(): boolean {
    return typeof navigator.share !== 'undefined';
  }

  getAvailablePlatforms(): string[] {
    const platforms = ['email', 'clipboard'];
    
    if (this.isNativeShareAvailable()) {
      platforms.push('native');
    }
    
    platforms.push('twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'reddit');
    
    return platforms;
  }
}

export const socialSharing = new SocialSharing();

if (typeof window !== 'undefined') {
  (window as any).socialSharing = socialSharing;
}

export default socialSharing;
