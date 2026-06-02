# Brand assets — BoxBuild

Esta carpeta contiene los assets de identidad visual de BoxBuild
que el código de la app consume directamente desde `/public`.

## Archivos que el código espera

| Archivo                              | Uso                                         | Obligatorio |
| ------------------------------------ | ------------------------------------------- | ----------- |
| `public/favicon.svg`                 | Favicon de la pestaña del navegador         | Sí          |
| `public/brand/logo-mark.svg`         | Isotipo (cubo BB) — para fondos claros      | Sí          |
| `public/brand/logo-mark-light.svg`   | Isotipo (cubo BB) — para fondos oscuros     | Sí          |
| `public/brand/logo-wordmark.svg`     | Wordmark "BOX BUILD" — fondos claros        | No (futuro) |
| `public/brand/logo-wordmark-light.svg` | Wordmark "BOX BUILD" — fondos oscuros     | No (futuro) |
| `public/brand/logo-full.svg`         | Logo completo (cubo + wordmark)             | No (futuro) |

### Dónde se consume cada archivo

- `logo-mark.svg` → sidebar (light mode) y página de login (light mode)
  Ver: `src/components/layout/sidebar.tsx` y `src/app/(auth)/login/page.tsx`
- `logo-mark-light.svg` → sidebar y login en **dark mode**
- `favicon.svg` → metadata del root layout
  Ver: `src/app/layout.tsx`

## Formato

**Recomendado: SVG** (vectorial, escala perfecto a cualquier tamaño,
mantiene la nitidez del pixel art del isotipo).

Si solo tienes PNGs y no puedes exportar a SVG, súbelos como PNG con
los mismos nombres (`logo-mark.png`, `logo-mark-light.png`, `favicon.png`)
y avísame para cambiar las extensiones en el código (es un find/replace
de 3 líneas).

## Dimensiones sugeridas

- **logo-mark** (isotipo): cuadrado o ligeramente más alto que ancho.
  Si es PNG, mínimo **256×256 px** para que se vea nítido en pantallas Retina.
- **favicon**: cuadrado, mínimo **128×128 px** si es PNG.
  Si es SVG, no importa el tamaño.

## Flujo para subir los archivos

1. Hacer `git pull` de la rama `claude/relaxed-pasteur-ke1sb` en VS Code.
2. Arrastrar los archivos a `public/` y `public/brand/` con los nombres
   exactos de la tabla de arriba.
3. `git add public/` desde la terminal de VS Code.
4. `git commit -m "Add BoxBuild brand assets"`.
5. `git push`.
6. Verificar visualmente en local con `npm run dev` antes del merge.

## Versión clara vs versión oscura

- **`logo-mark.svg`** (versión "oscura"): cubo en color oscuro
  (#262626 según el manual), letras BB en blanco. Se usa sobre
  fondos claros — sidebar y card de login en **modo claro**.
- **`logo-mark-light.svg`** (versión "clara"): cubo en blanco
  (o gris muy claro), letras BB en oscuro. Se usa sobre fondos
  oscuros — sidebar y card de login en **modo oscuro**.

El swap entre versiones es automático con clases Tailwind
`dark:hidden` / `hidden dark:block`.
