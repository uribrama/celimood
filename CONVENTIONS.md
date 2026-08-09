# Celimood — Convenciones de implementación

Cómo se instala, se versiona y se cuida este proyecto. Complementa a
[SPEC.md](SPEC.md), que define *qué* se construye; esto define *cómo*.

Entorno verificado en esta máquina: **Node 24.15.0 · pnpm 11.5.2 · corepack 0.34.6 ·
git 2.34.1**. Los comandos de abajo están chequeados contra esas versiones.

---

## 1. Gestor de paquetes: pnpm

**pnpm**, no npm ni yarn. Las razones que importan acá:

- **Instalación estricta por defecto.** Con npm, cualquier paquete puede importar
  algo que no declaró como dependencia (hoisting plano) y funciona igual — hasta que
  deja de funcionar. pnpm no lo permite.
- **Verificación de supply chain integrada** (§3). Es la razón principal, y npm no
  tiene equivalente.
- Store con enlaces duros: instalaciones rápidas y sin duplicar en disco.

### Fijar la versión del gestor

```bash
corepack enable
```

Y en `package.json`:

```json
{
  "packageManager": "pnpm@11.5.2",
  "engines": { "node": ">=24" }
}
```

Con `packageManager` declarado, corepack usa esa versión exacta sin importar qué pnpm
tenga instalado quien clone el repo. Un `.nvmrc` con `24` cubre lo mismo para Node.

> **Regla:** no se mezclan gestores. Si aparece un `package-lock.json` o un
> `yarn.lock` en el repo, alguien corrió el comando equivocado — se borra y se
> reinstala con pnpm. Dos lockfiles es no tener ninguno.

---

## 2. Configuración base

### `pnpm-workspace.yaml` — acá va todo

**En pnpm 11 la configuración del proyecto ya no vive en `.npmrc`.** Verificado en
esta máquina: con `save-exact=true` en un `.npmrc`, `pnpm config get save-exact`
devuelve `undefined` y el setting no aparece en `pnpm config list` — es config muerta
que no hace nada. Los mismos valores en `pnpm-workspace.yaml`, en camelCase, sí se
leen.

Esto importa más de lo que parece: un `save-exact` que se ignora en silencio hace que
cada `pnpm add` escriba un rango `^`, deshaciendo la regla central de §3 sin que nadie
se entere.

```yaml
# pnpm-workspace.yaml — existe aunque esto no sea un monorepo

# Versiones exactas: nada de ^ ni ~ (ver §3)
saveExact: true

# Ninguna versión con menos de 7 días publicada (en MINUTOS: 7 × 24 × 60)
minimumReleaseAge: 10080

# Dependencias autorizadas a ejecutar scripts de build (ver §3)
onlyBuiltDependencies:
  - esbuild
```

Un `.npmrc` sigue sirviendo solo para cosas de registry (URL, tokens, scopes). Este
proyecto no necesita ninguna, así que no hay `.npmrc`.

### `.gitignore`

```gitignore
node_modules/
dist/
dist-ssr/
.DS_Store
*.local
coverage/
.vite/

# Datos personales exportados desde la app — ver §6
*.celimood.json
celimood-export-*.json
```

---

## 3. Instalación de dependencias (la parte importante)

### Regla: ninguna versión con menos de 7 días publicada

Los ataques de supply chain funcionan publicando una versión maliciosa de un paquete
legítimo y esperando a que se instale sola. La ventana peligrosa son las primeras
horas: casi siempre se detecta y se despublica en un par de días. Esperar una semana
elimina la mayor parte del riesgo a cambio de casi nada.

**pnpm 11 hace cumplir esto por vos**, sin que haya que acordarse. En
`pnpm-workspace.yaml`:

```yaml
minimumReleaseAge: 10080   # en MINUTOS: 7 × 24 × 60
```

pnpm consulta la fecha de publicación en el registry y **resuelve hacia abajo**: elige
automáticamente la versión más nueva que ya cumplió el plazo, en vez de fallar.
Comprobado en esta máquina:

```
minimumReleaseAge: 0        → pnpm add is-odd  →  is-odd 3.0.1
minimumReleaseAge: 5256000  → pnpm add is-odd  →  is-odd 0.1.0
```

Es exactamente el comportamiento que se quiere: se obtiene lo más nuevo que sea
seguro, sin trabajo manual. La instalación **sí falla** cuando una versión demasiado
nueva está fijada explícitamente o viene del lockfile, con este mensaje:

> `was published at <fecha>, within the minimumReleaseAge cutoff (<fecha>)`

Aplica a dependencias directas **y transitivas**, que es justamente lo que una
revisión manual nunca cubre bien.

### Cuando hay que saltear la regla

El caso real es un parche de seguridad recién publicado que arregla una
vulnerabilidad activa: la versión segura es, por definición, demasiado nueva. La
excepción se declara por paquete, no se desactiva la regla:

```yaml
minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - 'nombre-del-paquete'   # motivo + fecha, en un comentario
```

Cada entrada lleva comentario con el porqué y la fecha, **y se saca cuando la versión
madura**. Una lista de excepciones que solo crece es la regla desactivada con pasos
extra.

### Verificación manual (si hace falta chequear a mano)

```bash
# Fecha de publicación de una versión concreta
npm view <paquete>@<version> time --json

# Todas las fechas, para elegir la última con ≥ 7 días
npm view <paquete> time --json
```

### Agregar una dependencia

```bash
pnpm add -E <paquete>          # -E = versión exacta, sin ^
pnpm add -DE <paquete>         # dependencia de desarrollo
```

**Versiones exactas, siempre.** Un `^1.2.3` significa "cualquier 1.x futura", o sea:
aceptar de antemano código que todavía no existe y que nadie revisó. Con
`saveExact: true` en `pnpm-workspace.yaml` (§2) esto ya es el default y el `-E` es
redundante — pero se escribe igual, porque un flag explícito sobrevive a que alguien
toque la config.

### El lockfile se commitea

`pnpm-lock.yaml` va al repo, siempre. Es el registro de qué se instaló exactamente.

Para reinstalar sin sorpresas:

```bash
pnpm install --frozen-lockfile
```

Falla si el lockfile no coincide con `package.json`, en vez de "arreglarlo" en
silencio. Es el comando por defecto en cualquier entorno que no seas vos editando
dependencias a propósito.

### Scripts de instalación: no poner `ignore-scripts`

Un `postinstall` es código arbitrario ejecutándose con tus permisos en el momento de
instalar. **pnpm 11 ya los bloquea por defecto**, sin configurar nada. Comprobado:

```
$ pnpm add -E esbuild
+ esbuild 0.28.1
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

Los paquetes que de verdad necesitan compilar se autorizan uno por uno:

```bash
pnpm approve-builds     # menú interactivo; escribe onlyBuiltDependencies
```

```yaml
onlyBuiltDependencies:
  - esbuild        # Vite lo necesita para compilar
```

> **No agregar `ignore-scripts=true`.** Suena a "más seguro" y es lo contrario de
> útil: en el código de pnpm, `ignoreScripts` saltea la etapa `buildModules` entera —
> que es justamente la que consulta `onlyBuiltDependencies`. O sea, desactiva el
> allowlist: esbuild nunca compila, Vite se rompe en la primera instalación con un
> error confuso, y no se gana nada porque el bloqueo por defecto ya existía.

**Nunca usar `dangerouslyAllowAllBuilds`** — el nombre es una advertencia, no una
sugerencia.

### Antes de agregar cualquier dependencia, preguntarse

1. **¿Se puede resolver en 20 líneas propias?** Una app local-first de este tamaño no
   necesita una dependencia para formatear una fecha relativa.
2. **¿Cuánto arrastra?** `pnpm add --dry-run <pkg>` muestra el árbol antes de
   comprometerse. Una utilidad chica que trae 40 paquetes no es una utilidad chica.
3. **¿Está viva?** Último release, issues abiertos, cantidad de mantenedores. Un
   paquete con un solo mantenedor y sin actividad en dos años es una cuenta esperando
   a ser comprometida.
4. **¿Corre en el cliente con acceso a los datos?** En esta app *todo* corre en el
   cliente con acceso a la base entera. No hay separación de privilegios que te salve.

---

## 4. Mantenimiento

```bash
pnpm outdated          # qué quedó atrás
pnpm audit             # vulnerabilidades conocidas
pnpm licenses list     # licencias de todo el árbol
pnpm dedupe            # colapsar duplicados del árbol
```

Cadencia sugerida: `audit` cuando se toquen dependencias, `outdated` una vez por mes.
Actualizar en tandas chicas y separadas del trabajo de features — un bump de
dependencias mezclado con una feature hace imposible saber cuál rompió qué.

Al actualizar, la regla de los 7 días sigue aplicando: pnpm la va a hacer cumplir
igual, y si una actualización es rechazada por antigüedad, la respuesta es esperar,
no excluir el paquete.

---

## 5. Secretos: no hay, y eso es una decisión

Esta app **no tiene secretos que proteger en el código**: sin backend, sin API keys,
sin tokens, sin variables de entorno con nada sensible (SPEC.md §2). No hay `.env`
que cuidar porque no hay nada que poner adentro.

Vale escribirlo porque es una propiedad de la arquitectura que hay que **defender**:
el día que aparezca una integración que pida una API key, esa key va a terminar en el
bundle del cliente, donde cualquiera la puede leer. No existe forma de ocultar un
secreto en una app puramente cliente. Si eso hace falta, hace falta un backend, y esa
es una decisión de arquitectura (con todo lo que arrastra en datos de salud), no un
detalle de implementación.

---

## 6. Datos de prueba: el riesgo real de este proyecto

La app exporta JSON con humor, síntomas y ciclo menstrual (SPEC.md §5.6). Durante el
desarrollo vas a generar exports de prueba, y **algunos van a tener datos reales** —
los tuyos, mientras probás.

- **Ningún export va al repo.** El `.gitignore` de §2 cubre los nombres esperables,
  pero el `.gitignore` es una red, no una política: la política es no poner archivos
  de datos en el árbol del proyecto.
- **Los fixtures de test son sintéticos**, generados por código, nunca un export real
  renombrado. Viven en `src/**/__fixtures__/` y se ven claramente inventados.
- Si un export real se commitea por error, **no alcanza con borrarlo en el commit
  siguiente**: queda en el historial de git para siempre. Hay que reescribir el
  historial antes de que ese commit salga a cualquier lado.
- Para debuggear con volumen, generar datos falsos por script en vez de usar los
  propios.

Esto no es paranoia genérica: es el único vector por el que datos de salud de este
proyecto pueden terminar en un lugar donde no deberían.

---

## 7. Reglas de código

### `domain/` no importa React

`src/domain/` es lógica pura: detección de períodos, cálculo de fases, agregados de
humor, manejo de `DateKey`. **Cero imports de React, del DOM o de Dexie.** Funciones
que reciben datos y devuelven datos.

Es donde van a estar los bugs (SPEC.md §4 documenta dos que ya conocemos), y es la
única forma de testearlos sin montar componentes. Si un archivo de `domain/` necesita
un hook, la lógica está en el lugar equivocado.

Se puede hacer cumplir con ESLint:

```js
// eslint.config.js — restricción por zona
{
  files: ['src/domain/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: ['react', 'react-*', 'dexie', '@/db/*', '@/components/*'],
    }],
  },
}
```

### TypeScript en estricto

```json
{ "strict": true, "noUncheckedIndexedAccess": true }
```

`noUncheckedIndexedAccess` importa especialmente acá: buena parte del código busca
días por `DateKey` en un `Map` o un objeto, y el resultado **puede no existir** —
justamente el caso "día sin registrar" que ya casi rompe el calendario. Que el
compilador obligue a manejarlo es exactamente lo que se quiere.

### `DateKey` es un tipo, no un `string`

```ts
type DateKey = string & { readonly __brand: 'DateKey' };
```

Un tipo marcado impide pasar un `string` cualquiera donde va una fecha local. Toda
construcción de `DateKey` pasa por `domain/dates.ts`; **ningún otro archivo llama a
`new Date()` para derivar un día**. Es la defensa contra el bug de zona horaria de
SPEC.md §4, movida al compilador en vez de a la disciplina.

---

## 8. Tests

No todo necesita tests. Esto sí, sin excepción:

| Módulo | Por qué |
|---|---|
| `domain/dates.ts` | Zonas horarias, cambios de mes, años bisiestos, horario de verano |
| `domain/cycle.ts` | Detección de períodos con días ausentes, filtro de plausibilidad, mediana |
| `domain/mood.ts` | Agregados, cobertura, distribuciones |
| Import de JSON | Fusión, conflictos, archivo inválido — es el camino de restore |

Casos que tienen que estar sí o sí, porque son bugs conocidos y no hipótesis:

- Registro a las 23:00 en zona horaria negativa → cae en el día correcto
- Período con un día ausente en el medio → **un** período, no dos
- Período con un `flow: 'none'` explícito en el medio → **dos** períodos
- Ciclo derivado de 3 días → descartado por el filtro de plausibilidad
- Menos de 2 ciclos registrados → no se predice nada

Los componentes de UI se testean donde tienen lógica real (el filtro de "días por
humor", el cálculo del indicador del mes), no por cobertura.

### `playwright-core` — verificación visual, no parte de la app

Es devDependency **permanente**, a propósito: sirve para levantar la app con
Chrome headless y mirar capturas reales (layout, hover, ambos temas) antes de dar
algo por terminado — el mismo espíritu de §11 de este documento. No lo usa ningún
script de build ni Vitest; no corre en producción. Antes se instalaba y desinstalaba
en cada verificación, lo que generaba baja constante en `package.json` sin
necesidad — se decidió dejarlo instalado siempre para cortar ese vaivén.

---

## 9. Git

El repo ya está inicializado. Convenciones mínimas:

- **Commits chicos y con un solo tema.** Un cambio de dependencias no viaja con una
  feature.
- **Mensajes que digan el porqué**, no el qué. El diff ya dice qué cambió; lo que se
  pierde es la razón.
- Ramas por feature si el proyecto crece; para trabajo solo, commits directos a
  `master` está bien, siempre que sean atómicos.
- **Antes de commitear, `git diff --staged`.** Es la última oportunidad de ver un
  export de datos o una clave que se coló.

---

## 10. PWA y CSP

La app **no carga nada de hosts externos**: sin CDN, sin fuentes remotas, sin
analytics, sin llamadas de red en runtime. Eso hace que una CSP estricta sea casi
gratis y muy efectiva — no hay nada legítimo que bloquear:

```
default-src 'self';
img-src 'self' data:;
style-src 'self' 'unsafe-inline';
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
```

Si en algún momento una dependencia nueva necesita relajar esto, es una señal para
revisar la dependencia, no la CSP.

El service worker cachea el shell de la app, **nunca los datos del usuario**: los
datos viven en IndexedDB y no tienen nada que hacer en el Cache API.

---

## 11. Arranque de la fase 0

El scaffold tiene un problema de huevo y gallina que conviene admitir en vez de
disimular: `pnpm create vite` **es** la primera instalación, y corre antes de que
exista el `pnpm-workspace.yaml` que define la política. No hay forma de que el
scaffold se aplique a sí mismo la regla de los 7 días.

Se resuelve en dos pasos: el scaffold queda **explícitamente fuera de la política**, y
lo primero que se hace después es volver a resolver todo el árbol bajo la política.

```bash
corepack enable

# 1. Scaffold. Fijar la versión de create-vite a mano — verificar antes con:
#      npm view create-vite time --json
#    y elegir la última con ≥ 7 días. NO usar @latest.
pnpm create vite@<version-verificada> . --template react-ts

# 2. Aplicar la política ANTES de tocar nada más:
#      pnpm-workspace.yaml  → saveExact, minimumReleaseAge, onlyBuiltDependencies (§2)
#      package.json         → packageManager, engines
#      .gitignore           → §2
#      borrar el .npmrc que pueda haber dejado el scaffold (§2)

# 3. Re-resolver todo el árbol bajo la política recién aplicada.
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 4. Autorizar los builds que hagan falta (esbuild, típicamente).
pnpm approve-builds

# 5. Recién ahora el lockfile es confiable. A partir de acá:
pnpm install --frozen-lockfile
```

El paso 3 no es opcional ni cosmético: el lockfile que genera el scaffold se armó sin
`minimumReleaseAge`, así que puede contener versiones publicadas ayer. Borrarlo y
re-resolver es lo que hace que la política cubra el árbol entero y no solo lo que se
instale de acá en adelante.
