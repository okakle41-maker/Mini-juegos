/**
 * js/utils/createMatchAction.ts
 *
 * Helper genérico para el patrón repetido 4 veces (Signal Triangulation,
 * Fragmented Labyrinth, Centro de Control en onlineLobby.logic.ts, y
 * "crear partida 1v1" del lobby grupal en multiplayer.logic.ts):
 *
 *   clearError();
 *   [chequeo opcional de elegibilidad -> showError + return]
 *   try {
 *     await sistema.createMatch(...);
 *     [éxito: cerrar modal / setPending / navegar a match-waiting]
 *   } catch (e) {
 *     showError(e instanceof Error ? e.message : 'mensaje genérico');
 *   }
 *
 * Cuatro copias casi idénticas de este bloque eran una fuente real de
 * bugs futuros: cualquier cambio al patrón (agregar un log, cambiar el
 * fallback de error, etc.) requería tocar 4 lugares y era fácil
 * actualizar 3 y olvidarse el 4to. `runCreateMatchAction` concentra el
 * flujo común; cada llamador solo aporta las partes específicas
 * (función a llamar, dónde mostrar el error, y qué hacer al tener éxito).
 *
 * No incluye el guard anti-doble-click (ver utils/buttonBusyGuard.ts):
 * son responsabilidades separadas y se componen en el call site
 * (withButtonBusy(btn, () => runCreateMatchAction(...))), no una
 * envuelve a la otra acá, para que este helper siga siendo útil incluso
 * en un caso sin botón (p. ej. el role picker de Centro de Control, que
 * ya resuelve su propio botón por delegación de eventos antes de llegar
 * acá).
 */

import { describeMatchError } from './describeMatchError.js';

export interface CreateMatchActionOptions<T> {
  /** Se llama primero, siempre — limpia cualquier error previo mostrado. */
  clearError: () => void;
  /**
   * Chequeo opcional antes de intentar crear (p. ej.
   * isPlayerEligible()). Si devuelve un mensaje (string), se muestra
   * ese mensaje como error y se aborta sin llamar a `create`. Si
   * devuelve null/undefined, se procede normalmente.
   */
  checkEligibility?: () => string | null | undefined;
  /** La llamada real que crea la partida (createMatch(...) del sistema correspondiente). */
  create: () => Promise<T>;
/**
 * Mensaje de error genérico si `create()` rechaza sin `.message` propio
 * ni forma reconocible de error de red — ver utils/describeMatchError.ts,
 * que ahora decide el mensaje final mostrado (distingue sin-conexión /
 * mensaje propio del sistema / genérico con sugerencia de reintentar,
 * en vez de mostrar siempre este texto tal cual).
 */
  fallbackErrorMessage: string;
  /** Muestra un mensaje de error en el lugar correspondiente del modal/vista. */
  showError: (message: string) => void;
  /**
   * Se llama tras un `create()` exitoso, con el valor resuelto — acá
   * cada llamador hace closeConfigModal()/setPending()/showView(), que
   * difieren entre los 4 casos y no vale la pena forzar a una forma común.
   */
  onSuccess: (result: T) => void;
}

export async function runCreateMatchAction<T>(options: CreateMatchActionOptions<T>): Promise<void> {
  const { clearError, checkEligibility, create, fallbackErrorMessage, showError, onSuccess } = options;

  clearError();

  const eligibilityError = checkEligibility?.();
  if (eligibilityError) {
    showError(eligibilityError);
    return;
  }

  try {
    const result = await create();
    onSuccess(result);
  } catch (e) {
    showError(describeMatchError(e, fallbackErrorMessage));
  }
}
