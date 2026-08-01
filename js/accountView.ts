/**
 * accountView.ts — Conecta js/views/cuenta.ts con authManager.ts.
 *
 * Mismo patrón que configPanel.ts / configReset.ts: delegación de
 * eventos sobre `document`, porque la vista "cuenta" se hidrata de
 * forma lazy y sus elementos no existen en el DOM cuando este módulo
 * se importa desde main.ts.
 *
 * También actualiza el label del botón del sidebar ("CUENTA" vs el
 * nombre de usuario) y su ícono, reaccionando al evento 'auth:changed'
 * que emite authManager.ts — así el sidebar refleja la sesión incluso
 * si el cambio de sesión ocurrió fuera de esta vista (p.ej. loguearse,
 * navegar a otro juego, y volver).
 */

import Auth from './authManager.js';
import ViewManager from './core/viewManager.js';

function setHidden(el: HTMLElement | null, hidden: boolean): void {
  if (el) el.classList.toggle('hidden', hidden);
}

function showError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function clearError(el: HTMLElement | null): void {
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

function setSubmitting(btn: HTMLButtonElement | null, submitting: boolean, idleLabel: string): void {
  if (!btn) return;
  btn.disabled = submitting;
  btn.textContent = submitting ? 'Un momento…' : idleLabel;
}

/** Refleja el estado de sesión en la vista Cuenta, si está montada. */
function renderAccountSection(): void {
  const root = document.getElementById('cuenta');
  if (!root) return; // vista todavía no hidratada — nada que actualizar

  const loggedOut = root.querySelector<HTMLElement>('[data-ui="accountLoggedOut"]');
  const loggedIn = root.querySelector<HTMLElement>('[data-ui="accountLoggedIn"]');
  const usernameEl = root.querySelector<HTMLElement>('[data-ui="accountUsername"]');

  const user = Auth.getUser();
  setHidden(loggedOut, !!user);
  setHidden(loggedIn, !user);
  if (usernameEl) usernameEl.textContent = user?.username ?? '';
}

/** Refleja el estado de sesión en el badge de usuario del header (RANGER_7). */
function renderHeaderBadge(): void {
  const badge = document.getElementById('headerUserBadge');
  if (!badge) return;

  const nameEl = badge.querySelector<HTMLElement>('.header-user-name');
  const avatarEl = badge.querySelector<HTMLElement>('.header-user-avatar');

  const user = Auth.getUser();
  const displayName = user ? user.username.toUpperCase() : 'DESCONOCIDO';
  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) {
    // Iniciales del username (o "?" si no hay sesión) para el avatar circular.
    avatarEl.textContent = user ? user.username.slice(0, 2).toUpperCase() : '?';
  }
}

function renderAll(): void {
  renderAccountSection();
  renderHeaderBadge();
}

function switchTab(root: HTMLElement, tab: 'login' | 'register'): void {
  const tabLogin = root.querySelector<HTMLElement>('[data-ui="tabLogin"]');
  const tabRegister = root.querySelector<HTMLElement>('[data-ui="tabRegister"]');
  const loginForm = root.querySelector<HTMLElement>('[data-ui="loginForm"]');
  const registerForm = root.querySelector<HTMLElement>('[data-ui="registerForm"]');

  const isLogin = tab === 'login';
  tabLogin?.classList.toggle('account-tab--active', isLogin);
  tabRegister?.classList.toggle('account-tab--active', !isLogin);
  tabLogin?.setAttribute('aria-selected', String(isLogin));
  tabRegister?.setAttribute('aria-selected', String(!isLogin));
  setHidden(loginForm, !isLogin);
  setHidden(registerForm, isLogin);

  // Un error de un intento anterior (p.ej. "contraseña incorrecta" en
  // login) no debe seguir visible si el usuario cambia de tab y vuelve
  // más tarde — se limpian los errores de ambos formularios al cambiar.
  clearError(root.querySelector<HTMLElement>('[data-ui="loginError"]'));
  clearError(root.querySelector<HTMLElement>('[data-ui="registerError"]'));
}

async function handleLoginSubmit(form: HTMLFormElement): Promise<void> {
  const errorEl = form.querySelector<HTMLElement>('[data-ui="loginError"]');
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-ui="loginSubmit"]');
  clearError(errorEl);

  const username = (form.elements.namedItem('username') as HTMLInputElement)?.value ?? '';
  const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? '';

  setSubmitting(submitBtn, true, 'Iniciar sesión');
  const result = await Auth.login(username, password);
  setSubmitting(submitBtn, false, 'Iniciar sesión');

  if (result.ok === false) {
    showError(errorEl, result.error);
    return;
  }

  // No hace falta llamar a renderAll() acá: Auth.login ya disparó
  // 'auth:changed' internamente (ver emitChange() en authManager.ts), y
  // el listener global de abajo (window.addEventListener('auth:changed',
  // renderAll)) ya se encarga de refrescar la UI. Llamarlo también acá
  // sería una doble ejecución redundante (inofensiva por ser idempotente,
  // pero innecesaria).
  form.reset();
}

async function handleRegisterSubmit(form: HTMLFormElement): Promise<void> {
  const errorEl = form.querySelector<HTMLElement>('[data-ui="registerError"]');
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-ui="registerSubmit"]');
  clearError(errorEl);

  const username = (form.elements.namedItem('username') as HTMLInputElement)?.value ?? '';
  const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? '';

  setSubmitting(submitBtn, true, 'Crear cuenta');
  const result = await Auth.register(username, password);
  setSubmitting(submitBtn, false, 'Crear cuenta');

  if (result.ok === false) {
    showError(errorEl, result.error);
    return;
  }

  // Ídem: Auth.register ya disparó 'auth:changed' internamente.
  form.reset();
}

function handleSubmit(event: Event): void {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  // El botón deshabilitado durante el request (ver setSubmitting) evita
  // un doble clic sobre el propio botón, pero no evita que Enter en un
  // <input> dispare un segundo 'submit' mientras el primero sigue en
  // vuelo — por eso se chequea también el propio evento 'submit' en
  // curso vía un dataset flag a nivel de formulario.
  if (form.dataset.submitting === 'true') return;

  if (form.dataset.ui === 'loginForm') {
    event.preventDefault();
    form.dataset.submitting = 'true';
    void handleLoginSubmit(form).finally(() => {
      delete form.dataset.submitting;
    });
  } else if (form.dataset.ui === 'registerForm') {
    event.preventDefault();
    form.dataset.submitting = 'true';
    void handleRegisterSubmit(form).finally(() => {
      delete form.dataset.submitting;
    });
  }
}

function handleHeaderBadgeKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.closest('#headerUserBadge')) return;

  event.preventDefault(); // evita el scroll de página que dispara la barra espaciadora
  ViewManager.showView('cuenta');
}

function handleClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  // Header: clic en el nombre/avatar de usuario (RANGER_7) navega a Cuenta,
  // igual que el link "CUENTA" del sidebar.
  const headerBadge = target.closest('#headerUserBadge');
  if (headerBadge) {
    ViewManager.showView('cuenta');
    return;
  }

  const root = target.closest<HTMLElement>('#cuenta');

  const tabLogin = target.closest('[data-ui="tabLogin"]');
  if (tabLogin && root) {
    switchTab(root, 'login');
    return;
  }
  const tabRegister = target.closest('[data-ui="tabRegister"]');
  if (tabRegister && root) {
    switchTab(root, 'register');
    return;
  }
  const logoutBtn = target.closest('[data-ui="logoutBtn"]');
  if (logoutBtn) {
    // Auth.logout() dispara 'auth:changed' internamente, que ya
    // refresca la UI vía el listener global — no hace falta encadenar
    // renderAll acá.
    void Auth.logout();
  }
}

function handleViewShown(event: Event): void {
  const id = (event as CustomEvent<{ id: string }>).detail?.id;
  if (id === 'cuenta') renderAccountSection();
}

document.addEventListener('submit', handleSubmit);
document.addEventListener('click', handleClick);
document.addEventListener('keydown', handleHeaderBadgeKeydown);
document.addEventListener('view-shown', handleViewShown);
window.addEventListener('auth:changed', renderAll);

// El badge del header (RANGER_7 hardcodeado en el HTML estático) se
// puede pintar apenas se resuelva la sesión inicial, sin esperar a que
// el usuario visite la vista Cuenta.
void Auth.ready().then(renderHeaderBadge);
