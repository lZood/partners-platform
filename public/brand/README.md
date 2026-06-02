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
| `LogoPdfCompleto.png`                | (Legado) ya no se usa — ver nota abajo           |
| `fonts/*.ttf`                        | Tipografías de marca incrustadas en los PDF      |

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

- **`LogoPdfCompleto.png`** (legado)
  - Ya no se referencia en el código. El recibo de pago ahora usa el banner
    oscuro con `LogoCompleto_DarkTheme.png` (ver abajo). Se conserva el archivo
    por si se necesita un wordmark horizontal sobre fondo claro.

- **`LogoCompleto_DarkTheme.png`** (marca de todos los documentos)
  - Wordmark blanco sobre el banner oscuro (`#282828`) de **todos** los
    documentos generados: reporte mensual (`src/lib/pdf/report-pdf.ts`),
    recibo de pago (`src/lib/pdf/receipt-pdf.ts`) y todos los Excel
    (`src/lib/excel/*` vía `src/lib/brand/excel-brand.ts`).

## Sistema de marca en documentos (PDF / Excel)

Toda la generación de documentos sigue el **Manual de Marca BoxBuild** desde una
sola fuente de verdad en `src/lib/brand/`:

- **`theme.ts`** — paleta (mapa HEX para PDF, ARGB para Excel) y familias
  tipográficas. Dirección visual: predomina el gris oscuro `#282828`
  ("Profesionalismo") con grises neutros; el **azul `#1B88CA`** es el único
  acento y marca lo importante (KPIs, totales, estado); el rojo `#E43535` se
  reserva solo para montos negativos / deducciones.
- **`pdf-fonts.ts`** — `registerBrandFonts(doc)` incrusta las TTF de marca en
  los PDF; si faltan, cae a Helvetica sin romper la generación.
- **`excel-brand.ts`** — helpers compartidos (`addBrandBanner`,
  `styleHeaderRow`, `addBrandFooter`, etc.) para que los 6 Excel compartan
  banner oscuro, tipografía Sora/Anek Latin y filas cebra idénticas.

### Tipografías (`fonts/`)

El manual solo permite **Anek Latin** (títulos) y **Sora** (texto). Los PDF las
incrustan como instancias estáticas:

| Archivo                     | Uso                          |
| --------------------------- | ---------------------------- |
| `AnekLatin-Bold.ttf`        | Título principal del banner  |
| `AnekLatin-SemiBold.ttf`    | Encabezados / nombres        |
| `Sora-Regular.ttf`          | Texto y cifras               |
| `Sora-SemiBold.ttf`         | Énfasis, etiquetas, totales  |

Se regeneran (descarga de Google Fonts, licencia OFL, + instanciado de pesos)
con:

```bash
python scripts/build-brand-fonts.py
```

> En Excel las fuentes se referencian por nombre de familia (`Sora`,
> `Anek Latin`); si el visor no las tiene instaladas, Excel sustituye
> automáticamente. La fidelidad tipográfica total se da en los PDF.

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
