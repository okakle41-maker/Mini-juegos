/**
 * js/views/cuenta.ts
 *
 * Vista de registro / inicio de sesión. La lógica de interacción vive
 * en js/accountView.ts (mismo patrón que configuracion.ts + configPanel.ts:
 * la vista es HTML puro, la lógica se conecta por delegación de eventos
 * porque esta sección se hidrata de forma lazy).
 *
 * Estado inicial: siempre se renderizan los tres bloques (login, registro,
 * sesión activa) y accountView.ts decide cuál mostrar/ocultar según
 * Auth.isLoggedIn() al recibir 'view-shown' — evita un parpadeo de
 * "cargando" mientras se resuelve la sesión, ya que Auth.ready() se
 * espera antes de que el usuario pueda llegar a esta vista desde el
 * sidebar (ver accountView.ts).
 */
import type { ViewTemplate } from '../types/game.js';

const template = (): string => {
  return `
      <div class="game-view-inner">
        <button class="back-btn" data-back-to="home"></button>
        <div class="card account-card">

          <div data-ui="accountLoggedOut" class="account-section">
            <h2>Cuenta</h2>
            <p>Iniciá sesión o registrate para guardar tus récords en el scoreboard global.</p>

            <div class="account-tabs" role="tablist" aria-label="Iniciar sesión o registrarse">
              <button type="button" class="account-tab account-tab--active" data-ui="tabLogin" role="tab" aria-selected="true">Iniciar sesión</button>
              <button type="button" class="account-tab" data-ui="tabRegister" role="tab" aria-selected="false">Registrarse</button>
            </div>

            <form data-ui="loginForm" class="account-form" novalidate>
              <label for="loginUsername">Nombre de usuario</label>
              <input id="loginUsername" name="username" type="text" autocomplete="username" required minlength="3" maxlength="20">

              <label for="loginPassword">Contraseña</label>
              <input id="loginPassword" name="password" type="password" autocomplete="current-password" required minlength="6">

              <button type="submit" data-ui="loginSubmit">Iniciar sesión</button>
              <p data-ui="loginError" class="account-error" role="alert" aria-live="polite" hidden></p>
            </form>

            <form data-ui="registerForm" class="account-form hidden" novalidate>
              <label for="registerUsername">Nombre de usuario</label>
              <input id="registerUsername" name="username" type="text" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+">
              <span class="account-hint">3-20 caracteres: letras, números o guion bajo. No se puede repetir.</span>

              <label for="registerPassword">Contraseña</label>
              <input id="registerPassword" name="password" type="password" autocomplete="new-password" required minlength="6">
              <span class="account-hint">Mínimo 6 caracteres.</span>

              <button type="submit" data-ui="registerSubmit">Crear cuenta</button>
              <p data-ui="registerError" class="account-error" role="alert" aria-live="polite" hidden></p>
            </form>
          </div>

          <div data-ui="accountLoggedIn" class="account-section hidden">
            <h2>Cuenta</h2>
            <div class="account-profile">
              <span class="account-profile-label">Sesión activa como</span>
              <span data-ui="accountUsername" class="account-profile-name"></span>
            </div>
            <button type="button" data-ui="logoutBtn" class="config-danger-btn">Cerrar sesión</button>
          </div>

        </div>
      </div>`;
};

export default template as ViewTemplate;
