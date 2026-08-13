/**
 * js/components/HeaderUserBadge.tsx
 *
 * Fase 5 de la migración a Preact (ver docs/ARCHITECTURE.md):
 * reemplaza el `<div id="headerUserBadge">` estático de index.html y
 * la lógica que antes vivía en accountView.ts (renderHeaderBadge).
 *
 * Motivación: el nombre/avatar del usuario se reflejaban a mano en
 * DOS lugares del código (este badge y la vista #cuenta) coordinados
 * solo por convención (acordarse de llamar a la función correcta en
 * cada evento relevante). Investigando el alcance real se encontró
 * además que `.header-user-avatar` lo escribían DOS SISTEMAS
 * independientes sin coordinarse entre sí — accountView.ts (iniciales
 * del username) y customizationSystem.ts (ícono de avatar elegido por
 * el usuario, vía querySelectorAll global) — una fuente real de
 * carrera: cualquiera que corriera último pisaba al otro. Ver el
 * comentario en customizationSystem.ts (getActiveAvatarIcon/
 * applyAvatar) para el otro lado de este fix.
 *
 * Este componente centraliza ambas fuentes de estado (Auth.getUser()
 * y customizationSystem.getActiveAvatarIcon()) como la única fuente
 * de verdad para el badge — nadie más escribe sus nodos.
 *
 * #headerUserLevel (el "RECLUTA"/"EXPERTO"/etc. que ya vivía dentro
 * del mismo badge) NO forma parte de este componente a propósito: es
 * un sistema separado (progreso de módulos completados, ver
 * sideNavBoot.ts) sin relación con auth ni con el avatar, y sigue
 * actualizándose exactamente igual que antes vía
 * document.getElementById('headerUserLevel') — se preserva ese id
 * intacto en el JSX de abajo para no romper esa integración.
 */
import { useEffect, useState } from 'preact/hooks';
import Auth, { type AuthUser } from '../authManager.js';
import customizationSystem from '../customizationSystem.js';
import ViewManager from '../core/viewManager.js';

function readState(): { user: AuthUser | null; avatarIcon: string } {
  return {
    user: Auth.getUser(),
    avatarIcon: customizationSystem.getActiveAvatarIcon(),
  };
}

export function HeaderUserBadge() {
  const [{ user, avatarIcon }, setState] = useState(readState);

  useEffect(() => {
    // 'auth:changed' lo emite authManager.ts (login/logout/restauración
    // de sesión). 'customization:avatar_changed' lo emite
    // customizationSystem.ts (setActiveAvatar). Cualquiera de los dos
    // requiere refrescar este badge, así que ambos disparan la misma
    // relectura completa de estado — evita que uno quede desincronizado
    // del otro si solo reaccionáramos a uno de los dos eventos.
    const refresh = () => setState(readState());
    window.addEventListener('auth:changed', refresh);
    window.addEventListener('customization:avatar_changed', refresh);
    return () => {
      window.removeEventListener('auth:changed', refresh);
      window.removeEventListener('customization:avatar_changed', refresh);
    };
  }, []);

  const displayName = user ? user.username.toUpperCase() : 'DESCONOCIDO';
  // Mismo fallback que accountView.ts original: iniciales del
  // username si hay sesión, ícono de avatar elegido si no hay sesión
  // pero el usuario personalizó uno igual, "?" como último recurso.
  const avatarText = user ? user.username.slice(0, 2).toUpperCase() : avatarIcon;

  const goToAccount = () => ViewManager.showView('cuenta');

  return (
    <div
      className="header-user"
      id="headerUserBadge"
      title="Ir a Cuenta"
      role="button"
      tabIndex={0}
      aria-label="Ir a Cuenta"
      onClick={goToAccount}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); // evita el scroll de página que dispara la barra espaciadora
        goToAccount();
      }}
    >
      <span className="header-user-avatar">{avatarText}</span>
      <span className="header-user-info">
        <span className="header-user-name">{displayName}</span>
        {/* Sistema de progreso de módulos, no de auth — ver nota de
            arriba. sideNavBoot.ts sigue escribiendo este textContent
            directamente por getElementById, sin pasar por Preact. */}
        <span className="header-user-level" id="headerUserLevel">RECLUTA</span>
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="header-user-caret">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
