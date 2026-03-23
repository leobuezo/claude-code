# Análisis Técnico: Ratings Frontend — Platziflix

**Fecha:** 2026-03-19
**Autor:** Arquitecto de Software
**Estado:** Listo para implementación
**Alcance:** Frontend Next.js 15 — 3 gaps funcionales sobre infraestructura ya existente

---

## 1. Resumen ejecutivo

El backend está 100% operativo. El Frontend tiene la infraestructura de tipos y servicios completa pero le faltan tres piezas de UI:

| Gap | Descripción | Archivos afectados |
|-----|-------------|-------------------|
| Gap 1 | `CourseDetail` no muestra el rating promedio del curso | `CourseDetail.tsx`, `CourseDetail.module.scss` |
| Gap 2 | `StarRating` es display-only; necesita modo interactivo | `StarRating.tsx`, `StarRating.module.scss` |
| Gap 3 | No existe UI para que el usuario envíe su calificación | Nuevo: `RatingWidget.tsx`, `RatingWidget.module.scss` |

El orden de implementación importa: Gap 2 → Gap 3 → Gap 1, porque `CourseDetail` (Gap 1) depende de `RatingWidget` (Gap 3), que a su vez depende de `StarRating` interactivo (Gap 2).

---

## 2. Análisis de impacto arquitectural

### 2.1 Árbol de dependencias actual

```
page.tsx (Server Component)
  └── CourseDetailComponent (Server Component)   ← Gap 1: agregar rating display + widget
        └── [sin StarRating ni RatingWidget]

page.tsx (Server Component — listado)
  └── Course.tsx (Server Component)
        └── StarRating (actualmente sin 'use client')   ← Gap 2: agregar interactividad
```

### 2.2 Árbol de dependencias objetivo

```
/app/course/[slug]/page.tsx (Server Component)
  └── CourseDetailComponent (Server Component)
        ├── StarRating size="large" readonly=true       ← Gap 1: rating promedio (display)
        └── RatingWidget courseId={course.id}           ← Gap 3: nuevo Client Component
              └── StarRating onRate={handler}            ← Gap 2: modo interactivo

/app/page.tsx (Server Component)
  └── Course.tsx (Server Component)
        └── StarRating size="small" readonly=true       ← sin cambios funcionales
```

### 2.3 Boundary Server/Client

El principio clave de Next.js App Router es: los Server Components pueden importar Client Components, pero no al revés (sin serialización). El patrón que usamos aquí:

- `CourseDetailComponent` permanece Server Component. No necesita `'use client'`.
- `StarRating` pasa a ser Client Component al agregar `'use client'` (necesario para `useState` del hover). Esto es válido: Server Components pueden renderizar Client Components directamente.
- `RatingWidget` es Client Component (maneja estado, side effects, llamadas a API desde el browser).
- `Course.tsx` en el listado sigue siendo Server Component. `StarRating` con `'use client'` es embebible desde Server Components sin problemas.

No se rompe ningún boundary existente.

### 2.4 Decisión: un componente `StarRating` dual vs dos componentes separados

**Alternativa A — Un único `StarRating` con prop `onRate` opcional.**
- Pro: un solo componente con dos modos de operación, menor surface de API.
- Contra: agregar `'use client'` hace que Next.js serialice el componente incluso en usos readonly dentro de Server Components. Esto tiene un costo de hidratación pequeño pero no bloqueante.

**Alternativa B — Dos componentes: `StarRating` (readonly, Server) y `InteractiveStarRating` (Client).**
- Pro: separación perfecta de responsabilidades, el readonly no hidrata.
- Contra: duplicación de lógica SVG y estilos, mayor carga de mantenimiento.

**Decision: Alternativa A.** El impacto de hidratación es mínimo (5 estrellas SVG). Mantener un único componente reduce la deuda de mantenimiento. El prop `onRate` es opcional — cuando no se pasa, el componente actúa como display-only en términos de comportamiento aunque técnicamente sea un Client Component.

### 2.5 Decisión: manejo de `user_id` sin sistema de autenticación

No existe sistema de auth. Se usa `MOCK_USER_ID = 1` como constante definida en `RatingWidget`. Esta constante debe estar aislada en el componente (no en un archivo de constantes globales) para facilitar su sustitución cuando se implemente auth. El comentario `// TODO: reemplazar con userId del sistema de auth` debe estar presente.

---

## 3. Especificación detallada por gap

---

### Gap 2 — StarRating interactivo

**Archivo:** `Frontend/src/components/StarRating/StarRating.tsx`

#### 3.1 Cambios en la interfaz de props

Agregar al interface `StarRatingProps`:

```typescript
onRate?: (rating: number) => void; // callback cuando el usuario selecciona una estrella
```

La prop `readonly` ya existe. El comportamiento será:
- Si `onRate` está definido Y `readonly` es `false` (o no se pasa): modo interactivo.
- Si `readonly` es `true` o `onRate` no está definido: modo display.

La condición exacta para activar interactividad: `const isInteractive = !!onRate && !readonly`.

#### 3.2 Estado interno nuevo

```typescript
const [hoverRating, setHoverRating] = useState<number>(0);
```

El `hoverRating` sobreescribe el `rating` prop para el render visual durante el hover. Cuando `hoverRating === 0` se usa `rating` (el valor real).

La variable de render: `const displayRating = hoverRating > 0 ? hoverRating : rating`.

`getStarFillState` debe usar `displayRating` en lugar de `rating`.

#### 3.3 Directiva de entorno

Agregar `'use client';` como primera línea del archivo. Esto es obligatorio porque se introduce `useState`.

#### 3.4 Cambios en el JSX del contenedor `.stars`

Cuando `isInteractive` es true, el `<div className={styles.stars}>` debe recibir:
- `role="radiogroup"` (accesibilidad: grupo de opciones exclusivas)
- `aria-label="Califica este curso"` (solo cuando interactivo)

Cuando `isInteractive` es false, mantener el comportamiento actual.

#### 3.5 Cambios en cada `<span>` de estrella

Cuando `isInteractive` es true, cada `<span>` recibe:

```typescript
role="radio"
aria-checked={Math.round(displayRating) === star}
aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
tabIndex={0}
onClick={() => onRate!(star)}
onMouseEnter={() => setHoverRating(star)}
onMouseLeave={() => setHoverRating(0)}
onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRate!(star); } }}
```

Cuando `isInteractive` es false, mantener `aria-hidden="true"` y sin handlers.

#### 3.6 El `aria-label` del contenedor raíz

Cuando interactivo, el `aria-label` del `<div className={styles.starRating}>` debe cambiar a `"Selector de calificación"` para no confundirse con el rol de display.

#### 3.7 Cambios en `StarRating.module.scss`

Agregar clase `.interactive` al bloque `.starRating`:

```scss
&.interactive {
  .star {
    cursor: pointer;

    &:hover,
    &.hovered {
      transform: scale(1.15);
      color: var(--star-full-color, #ffc107);
    }

    &:focus-visible {
      outline: 2px solid color('primary');
      outline-offset: 2px;
      border-radius: 2px;
    }
  }
}
```

La clase `.interactive` se agrega condicionalmente al `className` del contenedor: `${isInteractive ? styles.interactive : ''}`.

Nota: el archivo usa `@import '../../styles/vars.scss'` por lo que `color('primary')` está disponible. Sin embargo, dado que `StarRating.module.scss` NO importa `vars.scss` actualmente (no aparece en el archivo), usar la variable CSS `var(--color-primary, #ff2d2d)` en lugar de la función SCSS `color()` para el `outline` evita agregar un import nuevo. Alternativa: agregar `@import '../../styles/vars.scss';` al inicio del archivo SCSS.

**Decision:** agregar el import de `vars.scss` al inicio del archivo SCSS para consistencia con el resto del proyecto.

---

### Gap 3 — RatingWidget (nuevo componente)

**Archivos a crear:**
- `Frontend/src/components/RatingWidget/RatingWidget.tsx`
- `Frontend/src/components/RatingWidget/RatingWidget.module.scss`

#### 3.8 Props del componente

```typescript
interface RatingWidgetProps {
  courseId: number;
  initialRating?: number; // rating actual del usuario si ya calificó, opcional
  onRatingSubmit?: (newRating: number) => void; // callback para notificar al padre del nuevo rating
}
```

#### 3.9 Estado interno

```typescript
const MOCK_USER_ID = 1; // TODO: reemplazar con userId del sistema de auth

const [selectedRating, setSelectedRating] = useState<number>(initialRating ?? 0);
const [submittedRating, setSubmittedRating] = useState<number>(initialRating ?? 0);
const [ratingState, setRatingState] = useState<RatingState>('idle');
const [errorMessage, setErrorMessage] = useState<string>('');
```

`selectedRating`: el valor que el usuario está seleccionando (durante hover o después de clic).
`submittedRating`: el valor confirmado en el backend (para restaurar si hay error).
`ratingState`: controla los estados de UI.

#### 3.10 Flujo de submit

```
Usuario hace clic en estrella N
  → setSelectedRating(N)
  → handleSubmit(N) se llama

handleSubmit(rating):
  → setRatingState('loading')
  → await ratingsApi.createRating(courseId, { user_id: MOCK_USER_ID, rating })
  → éxito:
      setSubmittedRating(rating)
      setRatingState('success')
      onRatingSubmit?.(rating)
      setTimeout(() => setRatingState('idle'), 2000)   // vuelve a idle tras feedback
  → error:
      setSelectedRating(submittedRating)   // restaura valor anterior
      setErrorMessage(error.message)
      setRatingState('error')
      setTimeout(() => setRatingState('idle'), 3000)
```

El backend hace upsert internamente: si ya existe rating activo para `(course_id, user_id)`, lo actualiza. Por eso siempre se llama a `createRating` (nunca `updateRating` desde este componente). Esto simplifica el flujo de UI.

#### 3.11 Estructura JSX

```tsx
'use client';

<div className={styles.ratingWidget}>
  <p className={styles.label}>Califica este curso</p>

  <StarRating
    rating={selectedRating}
    size="large"
    readonly={ratingState === 'loading'}
    onRate={handleSubmit}
  />

  {/* Feedback de estado */}
  {ratingState === 'loading' && (
    <p className={styles.feedback} role="status">Guardando calificación...</p>
  )}
  {ratingState === 'success' && (
    <p className={`${styles.feedback} ${styles.success}`} role="status">
      ¡Calificación guardada!
    </p>
  )}
  {ratingState === 'error' && (
    <p className={`${styles.feedback} ${styles.error}`} role="alert">
      Error: {errorMessage}
    </p>
  )}
</div>
```

Cuando `ratingState === 'loading'`, `readonly={true}` se pasa a `StarRating` para deshabilitar la interactividad temporalmente. La prop `onRate` se pasa siempre — el comportamiento interactivo está bloqueado por `readonly`.

#### 3.12 Estilos `RatingWidget.module.scss`

```scss
@import '../../styles/vars.scss';

.ratingWidget {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
  background: color('off-white');
  border-radius: 12px;
  border: 1px solid color('light-gray');
  align-items: flex-start;
}

.label {
  font-size: 1rem;
  font-weight: 600;
  color: color('text-primary');
  margin: 0;
}

.feedback {
  font-size: 0.875rem;
  font-weight: 500;
  color: color('text-secondary');
  margin: 0;

  &.success {
    color: #2d7a2d; // verde semántico, no en vars.scss actualmente
  }

  &.error {
    color: color('primary'); // rojo de la paleta = señal de error
  }
}
```

Nota: `vars.scss` no define un color de éxito (verde). Para el estado `success`, se usa un valor literal `#2d7a2d` con comentario. No se modifica `vars.scss` para no alterar el sistema de tokens existente — esto puede ser una mejora futura.

---

### Gap 1 — CourseDetail muestra rating promedio + RatingWidget

**Archivos a modificar:**
- `Frontend/src/components/CourseDetail/CourseDetail.tsx`
- `Frontend/src/components/CourseDetail/CourseDetail.module.scss`

#### 3.13 Cambios en `CourseDetail.tsx`

Agregar dos imports:

```typescript
import { StarRating } from "@/components/StarRating/StarRating";
import { RatingWidget } from "@/components/RatingWidget/RatingWidget";
```

En el bloque `.stats`, después del span `.classCount`, agregar el bloque de rating:

```tsx
{/* Rating promedio del curso */}
{typeof course.average_rating === 'number' && course.average_rating > 0 && (
  <div className={styles.ratingDisplay}>
    <StarRating
      rating={course.average_rating}
      totalRatings={course.total_ratings}
      showCount={true}
      size="medium"
      readonly={true}
    />
  </div>
)}
```

Después del cierre del bloque `.stats`, agregar el widget de calificación:

```tsx
{/* Widget de calificación del usuario */}
<RatingWidget courseId={course.id} />
```

La condición `average_rating > 0` evita mostrar "0.0 (0 ratings)" cuando el curso no tiene ningún rating aún. El widget siempre se muestra independientemente — el usuario debe poder calificar aunque no haya ratings previos.

#### 3.14 Cambios en `CourseDetail.module.scss`

Agregar dentro del bloque `.stats`:

```scss
.ratingDisplay {
  display: flex;
  align-items: center;
}
```

Agregar debajo del bloque `.stats`:

```scss
.ratingSection {
  margin-top: 1.5rem;
}
```

El `RatingWidget` tiene su propio fondo y padding interno — no necesita un wrapper con estilos adicionales. El `margin-top` es suficiente para separarlo visualmente del bloque `.stats`.

---

## 4. Plan de implementación paso a paso

El orden es crítico para evitar errores de importación durante el desarrollo.

### Paso 1 — Hacer `StarRating` interactivo

**Archivos modificados:**
1. `Frontend/src/components/StarRating/StarRating.tsx`
2. `Frontend/src/components/StarRating/StarRating.module.scss`

**Cambios en `StarRating.tsx`:**
1. Agregar `'use client';` como primera línea.
2. Agregar `import { useState } from 'react';`.
3. Agregar prop `onRate?: (rating: number) => void;` al interface `StarRatingProps`.
4. Dentro del componente, agregar `const [hoverRating, setHoverRating] = useState<number>(0);`.
5. Calcular `const isInteractive = !!onRate && !readonly;`.
6. Calcular `const displayRating = isInteractive && hoverRating > 0 ? hoverRating : rating;`.
7. Actualizar `getStarFillState` para usar `displayRating` en lugar de `rating`.
8. En el `<div className={styles.stars}>`: agregar `className` condicional con `styles.interactive` cuando `isInteractive`.
9. En cada `<span>` de estrella: agregar handlers condicionales basados en `isInteractive`.
10. Actualizar `aria-label` del contenedor raíz según modo.

**Cambios en `StarRating.module.scss`:**
1. Agregar `@import '../../styles/vars.scss';` al inicio del archivo.
2. Agregar bloque `.interactive` dentro de `.starRating` con estilos de cursor, hover y focus-visible.

**Verificación:** el componente en modo `readonly=true` sin `onRate` debe comportarse exactamente igual que antes para no romper `Course.tsx`.

### Paso 2 — Crear `RatingWidget`

**Archivos creados:**
1. `Frontend/src/components/RatingWidget/RatingWidget.tsx`
2. `Frontend/src/components/RatingWidget/RatingWidget.module.scss`

**Checklist de `RatingWidget.tsx`:**
- `'use client';` al inicio.
- Imports: `useState` de React, `StarRating`, `ratingsApi` de `@/services/ratingsApi`, tipos `RatingState` de `@/types/rating`.
- Constante `MOCK_USER_ID = 1` con comentario TODO.
- Props: `courseId: number`, `initialRating?: number`, `onRatingSubmit?: (newRating: number) => void`.
- Estados: `selectedRating`, `submittedRating`, `ratingState`, `errorMessage`.
- Función `handleSubmit(rating: number): Promise<void>` con el flujo descrito en §3.10.
- JSX según §3.11.
- Export nombrado: `export const RatingWidget`.

**Checklist de `RatingWidget.module.scss`:**
- Import de `vars.scss`.
- Estilos según §3.12.

### Paso 3 — Integrar en `CourseDetail`

**Archivos modificados:**
1. `Frontend/src/components/CourseDetail/CourseDetail.tsx`
2. `Frontend/src/components/CourseDetail/CourseDetail.module.scss`

**Checklist de `CourseDetail.tsx`:**
- Agregar import de `StarRating`.
- Agregar import de `RatingWidget`.
- En el JSX del bloque `.stats`: agregar `<div className={styles.ratingDisplay}>` con `<StarRating>` readonly condicional (solo si `average_rating > 0`).
- Después del `.stats`: agregar `<RatingWidget courseId={course.id} />`.
- Verificar que `CourseDetail` NO tiene `'use client'` — debe mantenerse como Server Component.

**Checklist de `CourseDetail.module.scss`:**
- Agregar `.ratingDisplay` dentro del bloque `.stats`.
- Agregar `.ratingSection` después de `.stats`.

### Paso 4 — Verificación manual end-to-end

1. Iniciar backend (`cd Backend && make start`).
2. Iniciar frontend (`cd Frontend && yarn dev`).
3. Ir a `http://localhost:3000` — verificar que las tarjetas de curso muestran el rating sin regresiones.
4. Ir a un detalle de curso — verificar que aparece el rating promedio en `.stats` (si el curso tiene ratings).
5. Usar el `RatingWidget` para calificar con 1, 3 y 5 estrellas — verificar feedback de éxito.
6. Calificar el mismo curso dos veces — verificar que el segundo submit actualiza el valor (upsert en backend).
7. Desconectar el backend y calificar — verificar que aparece el mensaje de error y el rating se restaura al valor anterior.

---

## 5. Consideraciones de testing

### 5.1 Tests a actualizar

**`StarRating.test.tsx` (si existe)**

Los tests existentes deben seguir pasando ya que el comportamiento readonly no cambia. Verificar específicamente:
- Render con `readonly=true` y sin `onRate`: sin handlers de clic, sin cursor pointer.
- Render con `rating=3.5`: media estrella en la posición correcta.

Si no existe archivo de test, crearlo como parte de esta implementación.

**Ubicación esperada:** `Frontend/src/components/StarRating/StarRating.test.tsx`

### 5.2 Tests nuevos para `StarRating` modo interactivo

```
describe('StarRating — modo interactivo')
  test: render con onRate definido agrega role="radiogroup" al contenedor de estrellas
  test: hover sobre estrella 4 muestra 4 estrellas iluminadas
  test: clic en estrella 3 llama onRate(3)
  test: keydown Enter sobre estrella 2 llama onRate(2)
  test: keydown Space sobre estrella 5 llama onRate(5)
  test: readonly=true con onRate definido no llama onRate al hacer clic
  test: onMouseLeave restaura el rating original
```

### 5.3 Tests nuevos para `RatingWidget`

**Ubicación:** `Frontend/src/components/RatingWidget/RatingWidget.test.tsx`

```
describe('RatingWidget')
  test: render muestra label "Califica este curso"
  test: render muestra StarRating con rating=0 cuando no hay initialRating
  test: render muestra StarRating con initialRating cuando se pasa
  test: clic en estrella llama ratingsApi.createRating con courseId y MOCK_USER_ID
  test: durante loading, StarRating está en readonly=true
  test: éxito muestra mensaje "¡Calificación guardada!"
  test: error muestra mensaje de error y restaura rating previo
  test: éxito llama onRatingSubmit con el nuevo rating
```

Mock necesario: `vi.mock('@/services/ratingsApi')` con implementaciones de `createRating` que resuelven o rechazan según el test.

### 5.4 Tests nuevos para `CourseDetail` con ratings

**Ubicación:** `Frontend/src/components/CourseDetail/CourseDetail.test.tsx`

```
describe('CourseDetailComponent — con ratings')
  test: muestra StarRating cuando average_rating > 0
  test: NO muestra StarRating cuando average_rating === 0
  test: NO muestra StarRating cuando average_rating es undefined
  test: siempre renderiza RatingWidget
  test: pasa courseId correcto a RatingWidget
```

Mock necesario: `RatingWidget` puede mockearse como `vi.mock('@/components/RatingWidget/RatingWidget')` retornando un div vacío para aislar el test de CourseDetail.

### 5.5 Convenciones de testing del proyecto

- Framework: Vitest + React Testing Library (según CLAUDE.md).
- Render: `render()` de `@testing-library/react`.
- Queries: preferir `getByRole`, `getByLabelText` sobre `getByTestId`.
- Mocks: `vi.mock` y `vi.fn()`.
- No usar `act()` explícito — RTL lo maneja internamente para operaciones síncronas.
- Para operaciones async (submit): usar `await waitFor(() => ...)` o `findBy*` queries.

---

## 6. Consideraciones de accesibilidad

### 6.1 `StarRating` modo interactivo

- El contenedor de estrellas debe tener `role="radiogroup"` cuando es interactivo.
- Cada estrella debe tener `role="radio"` con `aria-checked` apropiado.
- El `tabIndex={0}` en cada estrella permite navegación por teclado.
- El handler `onKeyDown` debe responder a `Enter` y `Space` (estándar ARIA para radio buttons).
- El `outline` en `:focus-visible` es obligatorio para usuarios que navegan con teclado.

### 6.2 `RatingWidget` feedback de estado

- El mensaje de loading usa `role="status"` (live region polite).
- El mensaje de error usa `role="alert"` (live region assertive).
- El mensaje de éxito usa `role="status"`.
- Esto permite que los screen readers anuncien los cambios de estado sin interrumpir.

---

## 7. Consideraciones de performance

### 7.1 Hidratación de `StarRating`

Al agregar `'use client'`, Next.js incluirá `StarRating` en el bundle del cliente. El componente es pequeño (5 SVGs + lógica mínima), por lo que el impacto es negligible. No se requiere lazy loading.

### 7.2 Llamadas a la API desde `RatingWidget`

`ratingsApi.createRating` se llama solo en el evento `onClick` del usuario. No hay polling ni llamadas en `useEffect` al montar. El timeout de 10 segundos en `fetchWithTimeout` es adecuado.

### 7.3 `CourseDetail` sigue siendo Server Component

La página de detalle de curso sigue siendo renderizada en el servidor. El `average_rating` llega ya calculado en el payload de `/courses/{slug}` — no hay llamada adicional a `/ratings/stats` en el cliente. Esto es óptimo: no hay waterfall de datos.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| `StarRating` con `'use client'` rompe `Course.tsx` en listado | Baja | Medio | Server Components pueden importar Client Components sin restricción en Next.js App Router. Verificar con test de regresión. |
| El endpoint `POST /courses/{course_id}/ratings` devuelve error 422 si `rating` no es entero 1-5 | Media | Bajo | El type guard `isValidRating` en `rating.ts` ya valida esto. `StarRating` solo emite valores 1-5 (índices del array). Agregar validación en `handleSubmit` antes de llamar a la API. |
| `CourseDetail` importa `RatingWidget` (Client Component) y se convierte inadvertidamente en Client Component | Baja | Alto | En Next.js, importar un Client Component desde un Server Component es válido y no convierte al Server Component. Solo `'use client'` explícito o hooks React harían eso. Verificar que `CourseDetail.tsx` no tenga `'use client'` después de los cambios. |
| `MOCK_USER_ID = 1` colisiona si hay múltiples usuarios en la DB de prueba | Media | Bajo | Es un entorno de desarrollo sin auth. El upsert del backend garantiza que solo existe un rating por `(course_id, user_id)`. No hay corrupción de datos. |
| El gradiente SVG `halfStarGradient` tiene ID fijo — colisión si hay múltiples `StarRating` en la página | Media | Bajo | Problema ya existente en el código actual. No se resuelve en este scope. Mitigation futura: usar ID único con `useId()` de React. |

---

## 9. Archivos a crear/modificar — resumen

### Archivos a modificar

| Archivo | Tipo de cambio |
|---------|---------------|
| `Frontend/src/components/StarRating/StarRating.tsx` | Agregar `'use client'`, `useState`, prop `onRate`, lógica de hover, handlers de accesibilidad |
| `Frontend/src/components/StarRating/StarRating.module.scss` | Agregar `@import vars.scss`, bloque `.interactive` |
| `Frontend/src/components/CourseDetail/CourseDetail.tsx` | Agregar imports de `StarRating` y `RatingWidget`, JSX para rating display y widget |
| `Frontend/src/components/CourseDetail/CourseDetail.module.scss` | Agregar `.ratingDisplay` y `.ratingSection` |

### Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `Frontend/src/components/RatingWidget/RatingWidget.tsx` | Client Component con flujo completo de submit de rating |
| `Frontend/src/components/RatingWidget/RatingWidget.module.scss` | Estilos del widget |
| `Frontend/src/components/RatingWidget/RatingWidget.test.tsx` | Tests unitarios del widget |
| `Frontend/src/components/StarRating/StarRating.test.tsx` | Tests para modo interactivo (si no existe) |

### Archivos que NO se tocan

| Archivo | Razón |
|---------|-------|
| `Frontend/src/types/index.ts` | Ya tiene `average_rating` y `total_ratings` en `Course` y `CourseDetail` |
| `Frontend/src/types/rating.ts` | Completo. Tiene `RatingState`, `RatingRequest`, type guards |
| `Frontend/src/services/ratingsApi.ts` | Completo. Todos los métodos necesarios están implementados |
| `Frontend/src/components/Course/Course.tsx` | No requiere cambios funcionales |
| `Frontend/src/app/page.tsx` | No requiere cambios |
| `Frontend/src/app/course/[slug]/page.tsx` | No requiere cambios — `average_rating` ya viene en el payload |
| `Frontend/src/styles/vars.scss` | No agregar tokens nuevos en este scope |
| Todo el Backend | 100% completo, no tocar |

---

## 10. Referencia rápida de la API del backend

Para no consultar el backend durante la implementación:

```
POST /courses/{course_id}/ratings
  Body: { "user_id": number, "rating": number }  // rating: entero 1-5
  Response 200: CourseRating { id, course_id, user_id, rating, created_at, updated_at }
  Comportamiento: upsert — si existe rating activo para (course_id, user_id), actualiza; si no, crea.

GET /courses/{slug}
  Response 200: CourseDetail { id, name, description, thumbnail, slug, average_rating, total_ratings, classes[] }
  Nota: average_rating y total_ratings ya vienen calculados. No llamar a /ratings/stats por separado.
```

La variable de entorno del frontend para la URL base: `NEXT_PUBLIC_API_URL` (fallback: `http://localhost:8000`). Ya está configurada en `ratingsApi.ts`.
