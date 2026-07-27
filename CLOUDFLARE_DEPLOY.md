# Desplegar en Cloudflare Pages

Guía paso a paso para conectar este repo a Cloudflare Pages. Se hace una
sola vez; después cada `git push` a `main` despliega solo.

## Prerequisito: estructura del repo

Esta guía asume que el **contenido de esta carpeta** (`package.json`,
`index.html`, `js/`, `css/`, etc.) queda en la **raíz** del repositorio
de GitHub — no dentro de una subcarpeta `project/`. Si nunca creaste el
repo todavía, la forma más simple de lograrlo:

```bash
# Parado DENTRO de esta carpeta (la que tiene package.json)
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
git push -u origin main
```

Con esta estructura, tanto `.github/workflows/ci.yml` como los pasos de
Cloudflare de abajo funcionan sin necesitar configurar ningún "Root
directory" ni `working-directory` extra.

## Pasos

1. Andá a **https://dash.cloudflare.com** → **Workers & Pages** →
   **Create application** → pestaña **Pages** → **Connect to Git**.
2. Autorizá el acceso a GitHub y elegí este repositorio.
3. En **Set up builds and deployments**, configurá exactamente:

   | Campo | Valor |
   |---|---|
   | Framework preset | `None` (o `Vite` si aparece como opción — el resultado es el mismo) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | dejar vacío / `/` (con la estructura de arriba, no hace falta tocarlo) |

4. **Environment variables**: no hace falta configurar ninguna. Las
   credenciales de Supabase (`SUPABASE_URL`, la clave `anon/public`) ya
   están en el código fuente de `js/core/supabaseClient.ts` — son
   públicas por diseño (ver el comentario en ese archivo), así que no
   necesitan vivir como secreto de build.
5. Click en **Save and Deploy**. La primera build tarda unos minutos.

## Después del primer deploy

- Cloudflare te da una URL tipo `https://<proyecto>.pages.dev` — funciona
  de inmediato, HTTPS incluido.
- **Dominio propio** (opcional): Workers & Pages → tu proyecto →
  **Custom domains** → agregar el dominio. Si el dominio ya está en
  Cloudflare, el DNS se configura solo; si no, te da los registros para
  agregar en tu proveedor de DNS actual.
- **Cada push a `main`** dispara un deploy nuevo automáticamente.
- **Cada Pull Request** genera una preview URL única — útil para revisar
  un cambio antes de mergearlo a `main`, sin tocar el sitio en producción.

## Verificar que la PWA y el Service Worker quedaron bien servidos

Tras el primer deploy, confirmá con curl (o el tab Network de DevTools)
que `sw.js` se sirve con la cabecera correcta — es la parte más fácil de
pasar por alto y la que silenciosamente deja a los usuarios atascados en
una versión vieja de la app:

```bash
curl -sI https://<tu-proyecto>.pages.dev/sw.js | grep -i cache-control
```

Debería mostrar `no-cache` (ver `public/_headers`, ya incluido en el
repo — Cloudflare Pages lo lee automáticamente sin configuración
adicional).

## Relación con CI/CD (`.github/workflows/ci.yml`)

Los workflows de GitHub Actions y el deploy de Cloudflare Pages corren
**en paralelo, de forma independiente** — no están encadenados. Esto es
intencional por ahora: un fallo en `ci.yml` no bloquea el deploy en
Cloudflare, así que quedan dos redes de seguridad separadas en vez de
una sola.

Si en el futuro se quiere que Cloudflare *solo* despliegue cuando
`ci.yml` pasó, hay dos caminos:
- **Simple**: en Cloudflare Pages → Settings → Builds → desactivar
  "Automatic deployments" y en su lugar disparar el deploy desde un paso
  nuevo al final de `ci.yml` usando la
  [Cloudflare Pages GitHub Action](https://github.com/cloudflare/pages-action)
  oficial, con un API token guardado como GitHub Secret.
- **Con branch protection**: si `main` requiere que `ci.yml` pase antes
  de mergear (ver README → CI/CD → "Branch protection recomendada"),
  nunca debería llegar a `main` un commit con tests rotos en primer
  lugar — el deploy automático de Cloudflare queda protegido de forma
  indirecta, sin necesitar encadenarlo a mano.
