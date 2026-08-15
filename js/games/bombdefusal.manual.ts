/**
 * js/games/bombdefusal.manual.ts
 *
 * Contenido HTML del manual de desactivación (texto de referencia que
 * lee el Experto). Autocontenido, sin dependencias del resto del
 * juego. Extraído de bombdefusal.logic.ts como parte de dividir ese
 * archivo (antes 3212 líneas).
 */

export function buildManualHTML() {
  return `
    <div class="bd-manual-intro">
      <p class="bd-manual-callsign">📻 <strong>MANUAL TÉCNICO EOD · PROTOCOLOS DE DESACTIVACIÓN</strong></p>
      <p><em>Este manual contiene los procedimientos estándar para la desactivación de dispositivos explosivos improvisados. Siga las instrucciones en orden. Verifique todos los datos con el Operador antes de proceder. La precisión es crítica.</em></p>
      <p class="bd-manual-warn">⚠️ <strong>Terminología:</strong> <code>Serial</code> = código alfanumérico del dispositivo · <code>Indicador</code> = LED de estado (activo/inactivo) · <code>Strikes</code> = errores acumulados · <code>Dígitos</code> = caracteres numéricos del serial · <code>Vocales</code> = A, E, I, O, U. Requerido para cálculos.</p>
    </div>

    <h3 id="man-wires">📕 Protocolo W · Desarmado de cableado</h3>
    <p class="bd-manual-flavor"><em>Identifique el cable correcto según el número de hilos y su configuración de colores. Solicite al Operador que describa los cables de arriba a abajo.</em></p>
    <ul>
      <li><strong>3 hilos:</strong> Sin cables rojos → corte el del medio. Con exactamente un cable azul → corte el azul. En cualquier otro caso → corte el último.</li>
      <li><strong>4 hilos:</strong> Con más de un cable rojo → corte el último cable rojo. Con cable amarillo al final y sin cables rojos → corte el primero. Con exactamente un cable azul → corte el primero. En otros casos → corte el segundo.</li>
      <li><strong>5 hilos:</strong> Con cable negro al final → corte el cuarto. Con exactamente un cable rojo y más de un cable amarillo → corte el primero. Sin cables negros → corte el segundo. En otros casos → corte el primero.</li>
      <li><strong>6 hilos:</strong> Sin cables amarillos y último dígito del serial par → corte el tercero. Con exactamente un cable amarillo y más de un cable blanco → corte el cuarto. Sin cables rojos → corte el segundo. En otros casos → corte el primero.</li>
    </ul>

    <h3 id="man-buttons">📗 Protocolo B · Pulsadores armados</h3>
    <p class="bd-manual-flavor"><em>Determine la acción requerida según el color del botón y su etiqueta. Evalúe las condiciones en orden.</em></p>
    <ul>
      <li>Botón azul con etiqueta "ABORTAR" → mantenga presionado, libere cuando el dígito de las unidades del temporizador coincida.</li>
      <li>Botón blanco con indicador activo → pulse brevemente.</li>
      <li>Botón amarillo → mantenga presionado, libere cuando el indicador se ilumine.</li>
      <li>Botón rojo con etiqueta "DETONAR" → pulse brevemente.</li>
      <li>Botón rojo con strikes > 0 → mantenga presionado, libere cuando el indicador se ilumine.</li>
      <li>Botón blanco (sin indicador) → pulse brevemente.</li>
      <li>Botón azul sin vocal en el serial → pulse brevemente.</li>
      <li>Cualquier otro caso → mantenga presionado, libere cuando el indicador se ilumine.</li>
    </ul>

    <h3 id="man-symbols">📒 Protocolo Σ · Glifos cirílicos</h3>
    <p class="bd-manual-flavor"><em>Identifique el orden de pulsación según los símbolos presentes. Cuatro símbolos deben pulsarse en secuencia.</em></p>
    <ul>
      <li>Pulse los símbolos en el orden especificado, uno tras otro.</li>
      <li>Con ★ y © → pulse ©, ★, ?, λ.</li>
      <li>Con λ y ? → pulse λ, ?, ★, Ϙ.</li>
      <li>Con ¶ y Ϙ → pulse Ϙ, ¶, ★, λ.</li>
      <li>Con Ω y ¿ → pulse Ω, ¿, ?, ★.</li>
    </ul>

    <h3 id="man-memory">📘 Protocolo M · Secuencia de memoria volátil</h3>
    <p class="bd-manual-flavor"><em>Cinco etapas secuenciales. La pantalla muestra un número (1-4). Los botones tienen etiquetas (0-3). Registre cada etapa.</em></p>
    <ul>
      <li><strong>Etapa 1:</strong> Display=1 → posición 1. Display=4 → posición 3. Otros → posición 0.</li>
      <li><strong>Etapa 2:</strong> Display=1 → botón con etiqueta 1. Display=4 → posición 0. Display=2 → misma posición que etapa 1. Otros → posición 1.</li>
      <li><strong>Etapa 3:</strong> Display=3 → botón con etiqueta 3. Display=1 → botón con etiqueta 1. Otros → posición 2.</li>
      <li><strong>Etapa 4:</strong> Display=4 → posición de etapa 1. Display=2 → posición 0. Otros → posición de etapa 2.</li>
      <li><strong>Etapa 5:</strong> Display=1 → posición 0. Display=2 → posición de etapa 2. Display=4 → posición de etapa 1. Otros → posición de etapa 3.</li>
    </ul>

    <h3 id="man-screen">📕 Protocolo P · Pantalla parlante</h3>
    <p class="bd-manual-flavor"><em>La pantalla muestra un mensaje. Determine la respuesta correcta según el mensaje y las condiciones del dispositivo.</em></p>
    <ul>
      <li>"SÍ" → responda "SÍ" si strikes=0, de lo contrario "NO".</li>
      <li>"NO" → responda "SÍ" si el serial comienza con vocal, de lo contrario "NO".</li>
      <li>"ARRIBA" → responda "ABAJO".</li>
      <li>"ABAJO" → responda "ARRIBA" si último dígito par, de lo contrario "IZQ".</li>
      <li>"IZQ" → responda "DER".</li>
      <li>"DER" → responda "ESPERA" si strikes>0, de lo contrario "LISTO".</li>
      <li>"¿?" → responda "SÍ". "88:88" → responda "ESPERA". "12:34" → responda "IZQ" si último dígito ≤5, de lo contrario "DER". "99:99" → responda "ABAJO".</li>
    </ul>

    <h3 id="man-frequency">📗 Protocolo F · Sintonía de detonador</h3>
    <p class="bd-manual-flavor"><em>El módulo muestra dos etiquetas OTAN. Conviértalas a índices numéricos (Alfa=0, Bravo=1, etc.), sume y determine la banda.</em></p>
    <ul>
      <li>Índice de banda = (índice etiqueta A + índice etiqueta B) mod 6.</li>
      <li>Cada banda permite dos frecuencias: la inferior y la superior.</li>
      <li>Banda 0 → 3.55 o 3.70 MHz. Banda 1 → 3.70 o 3.85 MHz. Banda 2 → 3.85 o 4.00 MHz. Banda 3 → 4.00 o 4.15 MHz. Banda 4 → 4.15 o 4.30 MHz. Banda 5 → 4.30 o 3.55 MHz.</li>
      <li>Seleccione la frecuencia inferior de la banda calculada.</li>
    </ul>

    <h3 id="man-colors">📒 Protocolo C · Cromática Hostil</h3>
    <p class="bd-manual-flavor"><em>Cuatro pulsos de color. Determine el punto de inicio según la suma de dígitos del serial y el nivel de batería.</em></p>
    <ul>
      <li>Secuencia base: rojo, azul, verde, amarillo.</li>
      <li>Índice de inicio = (suma de dígitos del serial + nivel de batería + strikes) mod 4.</li>
      <li>Si el indicador está activo, omita el primer color de la secuencia.</li>
      <li>Pulse los colores en el orden determinado, comenzando desde el índice calculado.</li>
    </ul>

    <h3 id="man-pattern">📘 Protocolo Π · Patrón fantasma</h3>
    <p class="bd-manual-flavor"><em>El módulo muestra celdas iluminadas. El patrón correcto depende del número de celdas iluminadas, el serial y el conteo de puertos.</em></p>
    <ul>
      <li>Cuadrícula 5×5.</li>
      <li>4 celdas iluminadas → seleccione las cuatro esquinas (0,0), (0,4), (4,0), (4,4).</li>
      <li>5 celdas iluminadas → seleccione la cruz central: fila 2 completa y columna 2 completa.</li>
      <li>6 celdas iluminadas → si el serial comienza con consonante, seleccione la fila central (fila 2). Si comienza con vocal, seleccione la columna central (columna 2).</li>
      <li>Si strikes > 0 o conteo de puertos > 3, invierta horizontalmente el patrón (espejo).</li>
    </ul>

    <h3 id="man-switches">📕 Protocolo S · Interruptores tácticos</h3>
    <p class="bd-manual-flavor"><em>Tres interruptores. Determine cuáles deben estar activos según las condiciones del dispositivo.</em></p>
    <ul>
      <li>Interruptor 1: activo si el último carácter del serial es un dígito par.</li>
      <li>Interruptor 2: activo si el indicador está iluminado.</li>
      <li>Interruptor 3: activo si (suma de dígitos del serial + strikes) es impar.</li>
    </ul>

    <h3 id="man-code">📗 Protocolo K · Código de anulación</h3>
    <p class="bd-manual-flavor"><em>Calcule el código de anulación de cuatro dígitos basándose en el serial del dispositivo.</em></p>
    <ul>
      <li>Calcule la suma de los dígitos del serial y cuente las vocales en la parte alfabética.</li>
      <li>Código = (suma de dígitos × 7 + conteo de vocales × 13) mod 10000.</li>
      <li>Formatee el resultado con exactamente 4 dígitos, anteponiendo ceros si es necesario.</li>
      <li>El Operador debe ingresar este código.</li>
    </ul>

    <h3 id="man-keypad">📒 Protocolo T · Teclado rúnico</h3>
    <p class="bd-manual-flavor"><em>Determine la secuencia de pulsación según el serial y el estado del indicador. El teclado tiene una distribución fija de 3×3.</em></p>
    <ul>
      <li>Distribución: fila superior [λ, ψ, Ω], fila central [Ϙ, ☆, ¿], fila inferior [¶, ♡, β].</li>
      <li>Si la primera letra del serial está en A-M: pulse la fila superior de izquierda a derecha.</li>
      <li>Si está en N-Z: pulse la columna derecha de arriba a abajo.</li>
      <li>Si el indicador está activo: pulse ¶ primero, luego continúe con la secuencia.</li>
      <li>Si strikes > 0: invierta el orden de la secuencia.</li>
    </ul>

    <h3 id="man-morse">📘 Protocolo · — · · Morse Bravo</h3>
    <p class="bd-manual-flavor"><em>El módulo transmite un código Morse. Identifique la letra correspondiente.</em></p>
    <ul>
      <li>Cartilla Morse (·=punto, −=raya): E·, T−, A·−, I··, S···, N−·, O−−−, M−−, R·−·, L·−··.</li>
      <li>Letras adicionales: C·−·−, D−···, F··−··, G−−··, H····, J·−−−, K−·−, P·−−··, Q−−·−.</li>
      <li>Si la letra no está en la cartilla, elimínela por exclusión de las opciones.</li>
    </ul>

    <h3 id="man-password">📕 Protocolo Ψ · Contraseña OTAN</h3>
    <p class="bd-manual-flavor"><em>Determine la contraseña correcta de las cuatro opciones mostradas.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial + conteo de vocales) mod 8.</li>
      <li>Léxico OTAN: 0=ALFA, 1=BRAVO, 2=CHARLIE, 3=DELTA, 4=ECHO, 5=FOXTROT, 6=GOLF, 7=HOTEL.</li>
      <li>Seleccione la palabra en la posición calculada.</li>
    </ul>

    <h3 id="man-simon">📗 Protocolo Σi · Eco lumínico</h3>
    <p class="bd-manual-flavor"><em>El módulo muestra una secuencia de colores. Determine la secuencia de respuesta aplicando transformaciones.</em></p>
    <ul>
      <li>Secuencia base: rojo, azul, verde, amarillo.</li>
      <li>Si strikes > 0: invierta la secuencia.</li>
      <li>Si el serial comienza con vocal: intercambie los dos primeros y los dos últimos colores.</li>
      <li>Si el último dígito del serial es par: rote dos posiciones (tercero y cuarto al frente).</li>
      <li>Aplique las transformaciones en orden y repita la secuencia resultante.</li>
    </ul>

    <h3 id="man-knobs">📒 Protocolo Δ · Perillas balísticas</h3>
    <p class="bd-manual-flavor"><em>Tres perillas con cuatro posiciones cada una. Calcule la orientación correcta para cada una según el tipo de puerto.</em></p>
    <ul>
      <li>Ciclo de posiciones: izquierda, arriba, derecha, abajo.</li>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Para la perilla i (0,1,2): índice = (suma de dígitos del serial + i + strikes + offset puerto) mod 4.</li>
      <li>Si el indicador está activo: añada 2 al índice de la perilla central (i=1).</li>
      <li>Oriente cada perilla según el índice calculado.</li>
    </ul>

    <h3 id="man-maze">📘 Protocolo L · Cartografía del laberinto</h3>
    <p class="bd-manual-flavor"><em>Determine las coordenadas de salida en una cuadrícula 5×5. El Operador comienza en (0,0).</em></p>
    <ul>
      <li>Fila de salida = (suma de dígitos del serial + nivel de batería) mod 5.</li>
      <li>Columna de salida = (suma de dígitos del serial + strikes) mod 5.</li>
      <li>Dirija al Operador con movimientos cardinales hasta la salida.</li>
    </ul>

    <h3 id="man-timer">📕 Protocolo χ · Cronómetro al filo</h3>
    <p class="bd-manual-flavor"><em>Determine el segundo exacto en que el Operador debe detener el cronómetro según el conteo de puertos.</em></p>
    <ul>
      <li>Segundo objetivo = (suma de dígitos del serial + strikes + conteo de puertos) mod 60.</li>
      <li>El Operador debe detener el cronómetro cuando el display muestre exactamente ese segundo.</li>
    </ul>

    <h3 id="man-sequence">📗 Protocolo N · Secuencia numérica</h3>
    <p class="bd-manual-flavor"><em>Determine el punto de inicio de la secuencia numérica 1-2-3-4-5 según el tipo de puerto.</em></p>
    <ul>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Índice de inicio = (suma de dígitos del serial + offset puerto) mod 5.</li>
      <li>Comience desde el número en el índice calculado y continúe cíclicamente (1→2→3→4→5→1).</li>
      <li>Si strikes > 0: invierta la secuencia.</li>
    </ul>

    <h3 id="man-binary">📒 Protocolo 01 · Cifra binaria</h3>
    <p class="bd-manual-flavor"><em>Convierta un valor decimal a binario de 5 bits según el nivel de batería.</em></p>
    <ul>
      <li>Valor = (suma de dígitos del serial + strikes + nivel de batería × 2) mod 32.</li>
      <li>Convierta a binario con exactamente 5 bits (anteponga ceros si es necesario).</li>
      <li>El Operador debe ingresar los bits del más significativo al menos significativo.</li>
    </ul>

    <h3 id="man-math">📘 Protocolo Σ+ · Aritmética bajo fuego</h3>
    <p class="bd-manual-flavor"><em>Calcule una operación aritmética basada en el serial y el conteo de puertos.</em></p>
    <ul>
      <li>Operando A = (suma de dígitos del serial + conteo de puertos) mod 10.</li>
      <li>Operando B = (suma de dígitos del serial + strikes) mod 10.</li>
      <li>Operación: si (suma de dígitos mod 3) = 0 → suma, = 1 → resta, = 2 → multiplicación.</li>
      <li>El resultado debe ser no negativo. El Operador ingresa el resultado.</li>
    </ul>

    <h3 id="man-word">📕 Protocolo Ω · Palabra clave</h3>
    <p class="bd-manual-flavor"><em>Determine la palabra clave del léxico EOD según el tipo de puerto.</em></p>
    <ul>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Índice = (suma de dígitos del serial + strikes + offset puerto) mod 8.</li>
      <li>Léxico EOD: 0=BOMBA, 1=FUEGO, 2=TIEMPO, 3=CABLE, 4=SECRETO, 5=CODIGO, 6=PULSAR, 7=DETENER.</li>
      <li>Seleccione la palabra en la posición calculada.</li>
    </ul>

    <h3 id="man-reaction">📗 Protocolo R · Reflejo controlado</h3>
    <p class="bd-manual-flavor"><em>Determine el tiempo de reacción objetivo en milisegundos según el nivel de batería.</em></p>
    <ul>
      <li>Tiempo base = 2000 ms.</li>
      <li>Añada 100 ms por cada unidad en la suma de dígitos del serial.</li>
      <li>Añada 200 ms por cada strike acumulado.</li>
      <li>Añada 50 ms por cada nivel de batería.</li>
      <li>El Operador debe presionar dentro de ±200 ms del objetivo tras el encendido del indicador.</li>
    </ul>

    <h3 id="man-matching">📒 Protocolo ⇆ · Pares espejo</h3>
    <p class="bd-manual-flavor"><em>Memorice las posiciones de los símbolos para encontrar las parejas coincidentes.</em></p>
    <ul>
      <li>Ocho casillas con cuatro parejas de símbolos.</li>
      <li>Las parejas correctas permanecen visibles; las incorrectas se ocultan.</li>
      <li>Registre las coordenadas de cada símbolo revelado.</li>
    </ul>

    <h3 id="man-cipher">📘 Protocolo Φ · Cifrado César</h3>
    <p class="bd-manual-flavor"><em>Descifre un mensaje cifrado con desplazamiento César según el conteo de puertos.</em></p>
    <ul>
      <li>Desplazamiento = (suma de dígitos del serial + strikes + conteo de puertos) mod 26.</li>
      <li>Para descifrar: retroceda cada letra del mensaje cifrado por el desplazamiento.</li>
      <li>El alfabeto es circular (Z → A).</li>
    </ul>

    <h3 id="man-timing">📕 Protocolo τ · Sincronía dual</h3>
    <p class="bd-manual-flavor"><em>Determine el desfase requerido entre dos relojes según el tipo de puerto.</em></p>
    <ul>
      <li>Offset de puerto: DVI=0, Parallel=1, PS/2=2, RJ-45=3, Stereo RCA=4, USB=5.</li>
      <li>Desfase = (suma de dígitos del serial + strikes + offset puerto) mod 10 segundos.</li>
      <li>El segundo reloj debe estar desfasado del primero por el valor calculado.</li>
      <li>Especifique si el desfase es positivo (adelante) o negativo (atrás).</li>
    </ul>

    <h3 id="man-coordinates">📗 Protocolo XY · Coordenadas tácticas</h3>
    <p class="bd-manual-flavor"><em>Calcule dos coordenadas (X, Y) en el rango 0-9 según el nivel de batería.</em></p>
    <ul>
      <li>Coordenada X = (suma de dígitos del serial + strikes + nivel de batería) mod 10.</li>
      <li>Coordenada Y = (suma de dígitos del serial + strikes × 2) mod 10.</li>
      <li>El Operador debe ingresar ambas coordenadas.</li>
    </ul>

    <h3 id="man-battery">📕 Protocolo 🔋 · Nivel de batería</h3>
    <p class="bd-manual-flavor"><em>Determine el nivel de batería correcto según el serial.</em></p>
    <ul>
      <li>Nivel objetivo = ((suma de dígitos del serial) mod 4) + 1.</li>
      <li>Rango válido: 1-4.</li>
      <li>El Operador debe seleccionar el nivel calculado.</li>
    </ul>

    <h3 id="man-ports">📗 Protocolo ⚓ · Identificación de puertos</h3>
    <p class="bd-manual-flavor"><em>Determine el puerto correcto de la lista disponible.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial) mod 6.</li>
      <li>Puertos: 0=DVI, 1=Parallel, 2=PS/2, 3=RJ-45, 4=Stereo RCA, 5=USB.</li>
      <li>El Operador debe seleccionar el puerto en la posición calculada.</li>
    </ul>

    <h3 id="man-compass">📘 Protocolo 🧭 · Orientación cardinal</h3>
    <p class="bd-manual-flavor"><em>Determine la dirección cardinal correcta según el serial y strikes.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial + strikes) mod 8.</li>
      <li>Direcciones: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW.</li>
      <li>El Operador debe seleccionar la dirección calculada.</li>
    </ul>

    <h3 id="man-slots">📕 Protocolo ☰ · Ranuras de seguridad</h3>
    <p class="bd-manual-flavor"><em>Determine la ranura segura basándose en el nivel de batería, puertos y serial.</em></p>
    <ul>
      <li>Índice = (suma de dígitos del serial + nivel de batería + conteo de puertos) mod 5.</li>
      <li>Rango válido: 0-4.</li>
      <li>El Operador debe seleccionar la ranura calculada.</li>
    </ul>

    <div class="bd-manual-outro">
      <p><em>📻 <strong>NOTA:</strong> Este manual es referencia técnica. Siga los procedimientos con precisión. La seguridad del personal depende del cumplimiento estricto de los protocolos.</em></p>
    </div>
  `;
}
