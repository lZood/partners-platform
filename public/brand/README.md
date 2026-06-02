# Brand assets — BoxBuild

Esta carpeta contiene los assets de identidad visual de BoxBuild
que el código de la app consume directamente desde `/public`.

## Archivos actuales (PNG)

| Archivo                              | Uso                                              |
| ------------------------------------ | ------------------------------------------------ |
| `WebIcon.png`                        | Favicon + isotipo (cubo BB) en sidebar y login   |
| `LogoComletoWhiteTheme.png`          | Wordmark "BOX BUILD" — para fondos claros        |
| `LogoCompleto_DarkTheme.png`         | Wordmark "BOX BUILD" — para fondos oscuros       |
| `LogoMails.png`                      | Logo completo (cubo + wordmark) para correos     |
| `LogoPdfCompleto.png`                | Wordmark horizontal para PDFs (recibos)          |

### Dónde se consume cada archivo

- **`WebIcon.png`**
  - Favicon (pestaña del navegador) — `src/app/layout.tsx`
  - Isotipo en el sidebar (colapsado y expandido) — `src/components/layout/sidebar.tsx`
  - Isotipo grande en la card de login — `src/app/(auth)/login/page.tsx`

- **`LogoComletoWhiteTheme.png`** / **`LogoCompleto_DarkTheme.png`**
  - Wordmark de la app en sidebar expandido (junto al cubo) y en la card de login.
  - El swap entre versiones es automático con clases Tailwind
    `dark:hidden` / `hidden dark:block`.

- **`LogoMails.png`**
  - Header de todos los correos transaccionales (invitación, restablecer
    contraseña, nuevo reporte, pago registrado).
  - Ver: `src/lib/email.ts` (helper `getLogoUrl()` que arma la URL
    absoluta a partir de `NEXT_PUBLIC_APP_URL`).

- **`LogoPdfCompleto.png`**
  - Marca al pie del recibo de pago — `src/lib/pdf/receipt-pdf.ts`.

- **`LogoCompleto_DarkTheme.png`** (uso adicional)
  - Marca sobre el banner azul oscuro del reporte mensual —
    `src/lib/pdf/report-pdf.ts`.

## Formato

Actualmente todos los assets son **PNG** con fondo transparente.
SVG sería ideal (vectorial, escala perfecto), pero los PNGs funcionan
bien siempre que estén exportados en alta resolución.

### Dimensiones recomendadas

- **WebIcon.png** (isotipo): mínimo **256×256 px** para verse nítido en
  pantallas Retina. Para favicon también se sirve a 32×32.
- **LogoMails.png**: ancho mínimo **480 px** (se renderiza a ~160 px en
  el correo, pero algunos clientes lo escalan en pantallas HiDPI).
- **LogoPdfCompleto.png**: ancho mínimo **280 px** (se inserta a ~70 px
  en el PDF en formato Letter).
- **LogoComletoWhiteTheme.png** / **LogoCompleto_DarkTheme.png**:
  altura mínima **96 px** (se renderizan a 24–32 px de alto).

## Versión clara vs versión oscura

- **`LogoComletoWhiteTheme.png`** (texto oscuro): se usa sobre fondos
  claros — sidebar y card de login en **modo claro**.
- **`LogoCompleto_DarkTheme.png`** (texto blanco): se usa sobre fondos
  oscuros — sidebar y card de login en **modo oscuro**, y también
  sobre el banner azul del reporte PDF.

> El nombre `LogoComletoWhiteTheme.png` contiene una errata
> (falta una "p" en "Comleto"). Si se renombra el archivo, hay
> que actualizar las referencias en:
> `src/app/layout.tsx` (no, ese usa WebIcon),
> `src/components/layout/sidebar.tsx`,
> `src/app/(auth)/login/page.tsx`,
> y este README.

## Flujo para actualizar los assets

1. Reemplazar el PNG en `public/brand/` con el mismo nombre exacto.
2. Si cambia el nombre del archivo, hacer un find/replace global del
   nombre viejo por el nuevo en `src/`.
3. `git add public/brand/`
4. `git commit -m "Update BoxBuild brand assets"`
5. Verificar visualmente con `npm run dev` antes del merge.
