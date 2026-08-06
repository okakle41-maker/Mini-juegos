/**
 * Confetti Effect Manager
 * Maneja efectos de confetti para celebraciones (completar juegos, logros, etc.)
 */

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  decay: number;
  shape: 'square' | 'circle' | 'star' | 'heart' | 'diamond';
  gravity: number;
  friction: number;
}

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  colors?: string[];
  shapes?: ('square' | 'circle' | 'star' | 'heart' | 'diamond')[];
  gravity?: number;
  friction?: number;
  duration?: number;
}

class ConfettiEffect {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: ConfettiParticle[] = [];
  private animationId: number | null = null;
  private colors: string[] = [
    '#ff6b00', '#ff9a3c', '#ffcc00', '#22c55e', '#3b82f6', 
    '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4', '#10b981',
    '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'
  ];
  private shapes: ('square' | 'circle' | 'star' | 'heart' | 'diamond')[] = ['square', 'circle', 'star', 'heart', 'diamond'];
  private defaultOptions: ConfettiOptions = {
    particleCount: 100,
    spread: 360,
    startVelocity: 30,
    colors: this.colors,
    shapes: this.shapes,
    gravity: 0.5,
    friction: 0.98,
    duration: 3000
  };

  constructor() {
    this.init();
  }

  private init(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 99999;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private createParticle(x: number, y: number, options: ConfettiOptions): ConfettiParticle {
    const angle = (Math.random() - 0.5) * (options.spread || 360) * (Math.PI / 180);
    const velocity = (Math.random() + 0.5) * (options.startVelocity || 30);
    const shape = (options.shapes || this.shapes)[Math.floor(Math.random() * (options.shapes || this.shapes).length)];
    
    return {
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - Math.random() * 10,
      color: (options.colors || this.colors)[Math.floor(Math.random() * (options.colors || this.colors).length)],
      size: Math.random() * 10 + 5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 15,
      opacity: 1,
      decay: Math.random() * 0.015 + 0.005,
      shape,
      gravity: options.gravity || 0.5,
      friction: options.friction || 0.98
    };
  }

  private updateParticle(particle: ConfettiParticle): boolean {
    particle.vx *= particle.friction;
    particle.vy *= particle.friction;
    particle.vy += particle.gravity;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.rotation += particle.rotationSpeed;
    particle.opacity -= particle.decay;

    return particle.opacity > 0 && particle.y < window.innerHeight + 100;
  }

  private drawParticle(particle: ConfettiParticle): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.translate(particle.x, particle.y);
    this.ctx.rotate((particle.rotation * Math.PI) / 180);
    this.ctx.globalAlpha = particle.opacity;
    this.ctx.fillStyle = particle.color;

    switch (particle.shape) {
      case 'square':
        this.ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        break;
      case 'circle':
        this.ctx.beginPath();
        this.ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      case 'star':
        this.drawStar(0, 0, 5, particle.size / 2, particle.size / 4);
        break;
      case 'heart':
        this.drawHeart(0, 0, particle.size / 2);
        break;
      case 'diamond':
        this.drawDiamond(0, 0, particle.size);
        break;
    }

    this.ctx.restore();
  }

  private drawStar(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
    if (!this.ctx) return;
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      this.ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      this.ctx.lineTo(x, y);
      rot += step;
    }

    this.ctx.lineTo(cx, cy - outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawHeart(cx: number, cy: number, size: number): void {
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy + size / 4);
    this.ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + size / 4);
    this.ctx.bezierCurveTo(cx - size / 2, cy + size / 2, cx, cy + size * 0.75, cx, cy + size);
    this.ctx.bezierCurveTo(cx, cy + size * 0.75, cx + size / 2, cy + size / 2, cx + size / 2, cy + size / 4);
    this.ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + size / 4);
    this.ctx.fill();
  }

  private drawDiamond(cx: number, cy: number, size: number): void {
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - size / 2);
    this.ctx.lineTo(cx + size / 2, cy);
    this.ctx.lineTo(cx, cy + size / 2);
    this.ctx.lineTo(cx - size / 2, cy);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private animate(): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles = this.particles.filter(particle => {
      if (this.updateParticle(particle)) {
        this.drawParticle(particle);
        return true;
      }
      return false;
    });

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.animationId = null;
    }
  }

  burst(x: number, y: number, options?: ConfettiOptions): void {
    const opts = { ...this.defaultOptions, ...options };
    const count = opts.particleCount || 50;

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(x, y, opts));
    }

    if (!this.animationId) {
      this.animate();
    }
  }

  celebrate(options?: ConfettiOptions): void {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    this.burst(centerX, centerY, { ...options, particleCount: 100 });

    // Segunda explosión después de un momento
    setTimeout(() => {
      this.burst(centerX - 150, centerY - 50, { ...options, particleCount: 50 });
      this.burst(centerX + 150, centerY - 50, { ...options, particleCount: 50 });
    }, 200);

    // Tercera explosión
    setTimeout(() => {
      this.burst(centerX, centerY - 100, { ...options, particleCount: 75 });
    }, 400);

    // Cuarta explosión
    setTimeout(() => {
      this.burst(centerX - 100, centerY + 50, { ...options, particleCount: 40 });
      this.burst(centerX + 100, centerY + 50, { ...options, particleCount: 40 });
    }, 600);
  }

  clear(): void {
    this.particles = [];
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  destroy(): void {
    this.clear();
    if (this.canvas) {
      document.body.removeChild(this.canvas);
      this.canvas = null;
    }
    this.ctx = null;
  }
}

// Singleton instance
export const confettiEffect = new ConfettiEffect();

// Funciones helper para usar en cualquier parte
export function triggerConfetti(options?: ConfettiOptions): void {
  confettiEffect.celebrate(options);
}

export default confettiEffect;
