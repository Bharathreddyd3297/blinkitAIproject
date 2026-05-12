# Blinkit — Premium AI Commerce Frontend

A production-grade, cinematic frontend for the Blinkit cloud-native ecommerce platform. Built to feel like a modern AI-powered storefront from the very first paint — glass surfaces, neon glow, animated gradients, and cinematic 3D — backed by an enterprise-shaped React architecture.

> **Status:** Transaction-experience phase. The full ecommerce journey — Cart → Checkout → Payment → Confirmation → Tracking — is wired on top of the customer-experience phase. The frontend is end-to-end demo-ready, including a payment-processing simulation that covers both success and failure paths.

---

## Table of contents

**Foundation**
1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Quick start](#2-quick-start)
3. [Project structure](#3-project-structure)
4. [Design system](#4-design-system)

**Experience layers**

4a. [Customer experience](#4a-customer-experience)
4b. [Mock fallback layer](#4b-mock-fallback-layer)
4c. [Transaction experience](#4c-transaction-experience)

**Engineering systems**

5. [Animation architecture](#5-animation-architecture)
6. [3D architecture (React Three Fiber)](#6-3d-architecture-react-three-fiber)
7. [API integration](#7-api-integration)
8. [Auth foundation](#8-auth-foundation)
9. [Routing](#9-routing)
10. [Loading experience](#10-loading-experience)
11. [Performance](#11-performance)
12. [Responsiveness](#12-responsiveness)

**Operations**

13. [Roadmap](#13-roadmap)
14. [Browser support](#14-browser-support)
15. [Accessibility](#15-accessibility)
16. [Security model](#16-security-model)
17. [Deployment](#17-deployment)
18. [Testing & verification](#18-testing--verification)
19. [State management deep dive](#19-state-management-deep-dive)
20. [Backend integration contracts](#20-backend-integration-contracts)
21. [Troubleshooting](#21-troubleshooting)
22. [FAQ](#22-faq)
23. [Development workflow](#23-development-workflow)
24. [Glossary](#24-glossary)
25. [Conventions](#25-conventions)
26. [Scripts](#26-scripts)
27. [License](#27-license)

---

## 1. Architecture at a glance

```
┌─────────────────────────────────────────────┐
│                React frontend               │
│  (this repo — talks ONLY to the gateway)    │
└───────────────────┬─────────────────────────┘
                    │  HTTPS / JWT
        ┌───────────▼───────────┐
        │   API Gateway :8080   │
        └───────────┬───────────┘
                    │
┌──────────┬────────┴────────┬───────────────┬─────────────────┐
│  auth-   │  product-       │  cart-        │  order-         │
│  service │  service        │  service      │  service        │
├──────────┼─────────────────┼───────────────┼─────────────────┤
│ payment- │ ai-recommend.   │   Redis caching layer           │
│ service  │ service         │   (cross-service)               │
└──────────┴─────────────────┴─────────────────────────────────┘
```

The frontend's contract is the gateway. Direct service URLs are forbidden — the gateway is where auth, rate limits, and tracing live. Swap a backend service tomorrow and the frontend never knows.

### Container runtime

```
Browser
   │
   │  HTTP  (same origin: http://localhost)
   ▼
┌─────────────────────────────────────────────┐
│  frontend-app container (nginx:alpine)      │
│                                             │
│  • serves dist/ (immutable assets + SPA)    │
│  • reverse-proxies /api/** → api-gateway    │
│  • applies security headers + gzip          │
└────────────────────┬────────────────────────┘
                     │  Docker DNS:  http://api-gateway:8080
                     ▼
              ┌──────────────┐
              │  api-gateway │  (JWT pre-validate, CORS, rate-limit)
              └──────┬───────┘
                     │
                     ▼
            6 microservices  +  Redis  +  5 Postgres
            (auth, product, cart, order, payment, AI)
```

Two ways to run the frontend:

1. **Vite dev server** (`npm run dev` → `http://localhost:5173`) — HMR, instant rebuilds. The bundle uses `VITE_API_BASE_URL=http://localhost:8080`, so the browser talks to the gateway directly (CORS is configured to allow `:5173`). This is the daily-driver loop.
2. **Containerised nginx** (`docker compose -f docker-compose.platform.yml up frontend-app` → `http://localhost`) — production-style. The bundle is built with **`VITE_API_BASE_URL=""`** so axios issues relative URLs (`/api/auth/login`, …). nginx in this container receives them and `proxy_pass`es into `http://api-gateway:8080` over the Docker bridge network. The browser only ever sees one origin, so there is no CORS preflight, and the gateway port doesn't even need to be exposed on the host. The container that nginx is running in resolves `api-gateway` via Docker DNS — never `localhost`.

Both modes can run simultaneously: Vite on 5173 + nginx on 80. They use different bundles and don't interfere.

---

## 2. Quick start

### Dev server (Vite, HMR)

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Then edit VITE_API_BASE_URL to point at your gateway.

# 3. Run dev
npm run dev          # http://localhost:5173

# 4. Build for production
npm run build
npm run preview      # smoke-test the production bundle locally
```

### Containerised (production-style, nginx)

```bash
# From the WORKSPACE ROOT, not from frontend-app/:
cd ..
docker compose -f docker-compose.platform.yml up --build -d
```

That one command builds and starts **14 containers**: 5 Postgres + Redis + 6 backend services + api-gateway + this nginx frontend. The SPA lands at **`http://localhost`** (host port 80). Health is exposed at `docker inspect -f '{{.State.Health.Status}}' frontend-app`.

Host port can be overridden if 80 is taken on your machine — set `FRONTEND_HOST_PORT=8088` in `.env` and the SPA will live at `http://localhost:8088`.

The container is a **multi-stage build**:

| Stage | Image | What it does | What it leaves behind |
|---|---|---|---|
| `builder` | `node:20-alpine` | `npm ci` (deterministic), then `npm run build` (tsc + vite). All `VITE_*` env vars are passed in as `ARG` so they are inlined into the bundle at compile time. | A pristine `dist/` directory. |
| `runtime` | `nginx:1.27-alpine` | Copies `dist/` into `/usr/share/nginx/html` and drops in [`deploy/nginx.conf`](deploy/nginx.conf). No node_modules, no source, no `.env`, no Dockerfile, no tsbuildinfo. | A 75 MB image that serves the SPA + reverse-proxies `/api/**`. |

### Why same-origin, not direct browser → gateway?

The production build sets **`VITE_API_BASE_URL=""`** (see [`.env.production`](.env.production)). axios uses relative URLs (`/api/auth/login`, …). The browser sees those as same-origin against `http://localhost`. nginx in this container then `proxy_pass`es them into `http://api-gateway:8080` over the Docker bridge network:

```
fetch('/api/auth/login')
       │
       ▼  (same-origin → no CORS preflight)
   nginx :80  ──proxy_pass──►  api-gateway :8080  ──►  auth-service :8081
```

Wins:
- **No CORS** — same-origin removes preflight entirely.
- **Gateway is not exposed externally** — host port 8080 stays internal-only in a true production deployment. Only `:80` (the nginx layer) needs to be public.
- **One image, many environments** — to bypass the proxy and front the gateway with Azure App Gateway / ACR on AKS, just rebuild with `--build-arg VITE_API_BASE_URL=https://api.blinkit.example.com`. Same image, different inline base URL.

### Healthcheck

`docker compose` polls the container with:

```
wget -qO- http://localhost/ | grep -q '<title>Blinkit'
```

Healthy means nginx is binding port 80 AND serving the real SPA shell (not a 50x error page). The first health probe runs 15s after start; subsequent probes run every 30s.

### Image hygiene checks (already enforced)

| Concern | Enforced by | Verify with |
|---|---|---|
| No `node_modules` in runtime image | `.dockerignore` + multi-stage `COPY --from=builder /app/dist …` only | `docker exec frontend-app ls /app` → no such directory |
| No source files in runtime image | Same | `docker exec frontend-app ls /usr/share/nginx/html` → only `index.html`, `assets/`, `favicon.svg`, `50x.html` |
| No `.env` baked into runtime | `.dockerignore` excludes `.env`, `.env.local`, `.env.*.local`; only `.env.production` and `.env.example` are explicitly allowed through | `docker exec frontend-app find / -name ".env*" 2>/dev/null` → empty |
| Small image | nginx:alpine base + ~1.5 MB of static dist | `docker images blinkit/frontend-app:1.0.0` → ~75 MB |

### Environment variables

Vite reads `.env` for local dev (`npm run dev`) and `.env.production` for the `vite build` step (which is what the Docker image's builder stage runs). Both sets of values are inlined into the bundle at build time — they never reach the browser as live env vars.

| Variable                  | Dev default              | Prod (container) default | Purpose                                                |
|---------------------------|--------------------------|--------------------------|--------------------------------------------------------|
| `VITE_API_BASE_URL`       | `http://localhost:8080`  | `""` *(empty)*           | Gateway URL. Empty in the container means axios uses relative URLs and nginx proxies `/api/**` to the gateway. |
| `VITE_API_TIMEOUT`        | `15000`                  | `15000`                  | Axios timeout (ms).                                    |
| `VITE_AUTH_STORAGE_KEY`   | `blinkit.auth`           | `blinkit.auth`           | LocalStorage key for the JWT session.                  |
| `VITE_APP_NAME`           | `Blinkit`                | `Blinkit`                | Surfaced in footer / debug menus.                      |
| `VITE_APP_VERSION`        | `0.1.0`                  | `0.1.0`                  | Build identification.                                  |
| `VITE_APP_ENV`            | `development`            | `production`             | Drives feature flags + telemetry.                      |
| `VITE_ENABLE_3D`          | `true`                   | `true`                   | Master kill-switch for all R3F surfaces.               |
| `VITE_ENABLE_PARTICLES`   | `true`                   | `true`                   | Disable just the ambient particle backdrop.            |
| `VITE_ENABLE_DEVTOOLS`    | `true`                   | `false`                  | Redux DevTools.                                        |

Compose-level overrides (set in the workspace-root `.env`):

| Variable               | Default | Purpose                                                                  |
|------------------------|---------|--------------------------------------------------------------------------|
| `FRONTEND_HOST_PORT`   | `80`    | Host port mapped to the container's port 80. Override when 80 is in use. |

---

## 3. Project structure

```
src/
├── app/             # App entry + runtime config (singleton)
│   ├── App.tsx
│   └── config.ts
│
├── pages/           # Route-level pages (lazy-loaded)
│   ├── _shared/     # Page-level shells (PageHeader, AuthShell)
│   └── *Page.tsx    # one file per route
│
├── layouts/         # App shells: MainLayout, Navbar, Footer, Sidebar
│
├── components/
│   ├── primitives/  # Button, Input, Badge, Container, GlassCard, Logo
│   ├── loading/     # Skeleton, Spinner, FullPageLoader, RouteFallback, ProductCardSkeleton
│   ├── product/     # ProductCard (3D-tilt), ProductGrid, ProductFilters,
│   │                # PriceTag, StockPill, CategoryShowcase, RecommendationCarousel
│   ├── cart/        # CartDrawer (slide-in), CartLineItem, CartUpsells
│   ├── checkout/    # CheckoutStepper, CheckoutSummary, StepShell,
│   │                # PaymentCardPreview, PaymentProcessingOverlay,
│   │                # steps/{CartReview,Shipping,Delivery,Payment,Confirmation}Step
│   ├── order/       # OrderTimeline (animated, gradient-rail)
│   ├── search/      # SearchOverlay (cmd+k command palette)
│   ├── feedback/    # Toaster (glass toasts)
│   └── visuals/     # AmbientBackground + lazy 3D backdrop + Confetti
│
├── animations/      # Framer Motion variants + reusable wrappers
│   ├── variants.ts
│   ├── PageTransition.tsx
│   ├── Reveal.tsx
│   └── Stagger.tsx
│
├── three/           # React Three Fiber foundation
│   ├── SceneCanvas.tsx
│   ├── Lighting.tsx
│   ├── ParticleField.tsx
│   └── FloatingGeometry.tsx
│
├── services/        # Axios client + per-domain modules (gateway-only)
│   ├── http.ts
│   ├── authService.ts
│   ├── productService.ts
│   ├── cartService.ts
│   ├── orderService.ts
│   ├── paymentService.ts
│   └── recommendationService.ts
│
├── store/           # Redux Toolkit
│   ├── store.ts
│   ├── hooks.ts
│   └── slices/
│       ├── authSlice.ts
│       ├── productsSlice.ts
│       ├── cartSlice.ts
│       ├── ordersSlice.ts
│       ├── recommendationsSlice.ts
│       ├── checkoutSlice.ts        # multi-step state + processAndPlace thunk
│       └── uiSlice.ts
│
├── routes/          # Router + ProtectedRoute + path constants
│
├── hooks/           # useAuth, useToast, useKeyboardShortcut,
│                    # useMediaQuery, useReducedMotion, useScrollProgress
├── utils/           # cn, format, storage, mock (fallback content)
├── types/           # domain.ts — shared cross-feature types
├── styles/          # globals.css + tokens.ts (JS-readable design tokens)
└── main.tsx
```

### Path aliases

The same set of aliases is configured in [tsconfig.app.json](tsconfig.app.json) and [vite.config.ts](vite.config.ts) — **keep them in sync** if you add or rename one.

| Alias                   | Resolves to             | Use for                             |
|-------------------------|-------------------------|-------------------------------------|
| `@/*`                   | `src/*`                 | Generic escape hatch — avoid where a specific alias fits. |
| `@app/*`                | `src/app/*`             | App entry, runtime config.          |
| `@components/*`         | `src/components/*`      | All UI components.                  |
| `@pages/*`              | `src/pages/*`           | Route-level page modules.           |
| `@layouts/*`            | `src/layouts/*`         | App shell (navbar, footer, etc.).   |
| `@hooks/*`              | `src/hooks/*`           | Custom React hooks.                 |
| `@services/*`           | `src/services/*`        | Axios client + per-domain services. |
| `@store/*`              | `src/store/*`           | Redux store, slices, typed hooks.   |
| `@routes/*`             | `src/routes/*`          | Router, ProtectedRoute, paths.      |
| `@three/*`              | `src/three/*`           | React Three Fiber primitives.       |
| `@animations/*`         | `src/animations/*`      | Framer Motion variants + wrappers.  |
| `@styles/*`             | `src/styles/*`          | Global CSS + design-token JS.       |
| `@utils/*`              | `src/utils/*`           | Tiny pure helpers.                  |
| `@app-types/*`          | `src/types/*`           | Domain TypeScript types.            |
| `@assets/*`             | `src/assets/*`          | Static asset imports.               |

> **Why `@app-types` and not `@types`?** TypeScript reserves `@types/...` for the DefinitelyTyped namespace under `node_modules/@types`. A path alias literally named `@types/*` collides at module-resolution time and TS will refuse the import with TS6137. We use `@app-types/*` instead — explicit, conflict-free.

---

## 4. Design system

The design language is dark, cinematic, and futuristic — Apple meets Stripe meets Linear meets a modern AI startup.

### Tokens

- **Color** — `ink-*` (canvas), `neon-*` (accents), `accent` (brand).
- **Typography** — Inter for UI, Space Grotesk for display, JetBrains Mono for monospace.
- **Spacing** — 4-pt rhythm extended with hero-friendly steps (`18`, `22`, `30`, `34`, `38`, `128`, `144`).
- **Radii** — `xs` → `6xl`, plus a `pill` alias.
- **Shadows / glow** — `glow-sm`, `glow`, `glow-lg`, `glow-cyan`, `glow-magenta`, `glass`, `inner-glow`.
- **Backgrounds** — `bg-aurora`, `bg-mesh`, `bg-grid-faint`, `bg-sheen`.
- **Animations** — `animate-fade-up`, `animate-pulse-glow`, `animate-aurora-shift`, `animate-gradient-pan`, `animate-shimmer`.

The same tokens are exposed to JS / R3F via `src/styles/tokens.ts`, so Three.js materials, computed gradients, and SVG generators all stay in sync with the Tailwind config.

### Reusable component primitives

- **`<Container>`** — page-level max-width + horizontal padding, with `default` / `wide` / `narrow` sizes.
- **`<GlassCard>`** — frosted surface with three intensity levels.
- **`<Button>`** — Framer-animated, variants: `primary` (animated gradient sheen), `ghost`, `outline`, `subtle`.
- **`<Input>`** — focus glow ring, optional leading icon, error/hint slots.
- **`<Badge>`** — neutral / accent / success / warning / danger.
- **`<Logo>`** — inline SVG, gradient mark, optional wordmark.

### Cinematic primitives

- **Glass surfaces** (`.glass`, `.glass-strong`, `.glass-faint`) — backdrop blur + subtle inner highlight.
- **Sheen sweep** (`.sheen`) — hover-driven specular highlight on buttons / cards.
- **Skeleton shimmer** (`.skeleton`) — built-in keyframe, no library dependency.
- **Gradient text** (`.text-gradient`) — animated brand gradient on headlines.

---

## 4a. Customer experience

The customer-facing surfaces are layered on top of the foundation. The design system, animation system, and 3D foundation stay untouched — these are the components that *use* them.

### Homepage

`pages/HomePage.tsx` is the cinematic showpiece. Sections, in order:

1. **Hero** — animated gradient + 3D ornament (icosahedron + torus knot, neon lighting). Headline animates with stagger and blur-in lines. Stats strip reads as four short, confident numbers.
2. **Trending right now** — `RecommendationCarousel` populated by `recommendationService.trending()`. Live AI scoring, scroll-snap horizontal scroller, prev/next chevrons.
3. **Category showcase** — `CategoryShowcase` bento with per-category gradients. Each tile deep-links into the catalog with its category filter pre-applied.
4. **Picked for you** — `RecommendationCarousel` with `emphasize` styling (mesh gradient backdrop, animated `bg-gradient-pan`). Personalised feed from `recommendationService.forUser()`.
5. **Platform feature grid** — six glass cards explaining the cloud-native architecture. Stagger-revealed on scroll.
6. **CTA** — animated gradient panel pushing register / sign-in.

### Product card (`components/product/ProductCard.tsx`)

The single most-used surface in the app. It's worth understanding:

- **3D tilt** — driven by `useMotionValue` + `useSpring`. Hover position maps to a tilt range of ±6°. Skipped under reduced-motion.
- **Image zoom** — `whileHover scale: 1.06` over 600ms `easeOutExpo`.
- **AI score chip** — top-left when an `aiScore` is provided. Tooltip surfaces the rationale string from the recommendation service.
- **Tag badge** — top-right, accent-coloured.
- **Add-to-cart button** — bottom-right floating glass button. Stops propagation so it doesn't navigate when clicked. Optimistically dispatches `addCartItem`, opens the drawer, fires a success toast.
- **Stock pill** — pulsing dot + uppercase label. Renders as `Sold out` (danger) when `inStock=false`.
- **Card itself** — entire surface is a `<Link>` to the product detail page.

### Catalog (`pages/ProductsPage.tsx`)

- **URL-driven filters** — `q`, `category`, `sort`, `page` live in the URL via `useSearchParams`. Reload, share, or back-button without losing state.
- **Filter strip** — category chips + sort pills with shared `layoutId` animations.
- **Inline search** — submit-on-enter into the URL `q` param. Cmd+K opens the global overlay for incremental search instead.
- **Pagination** — chunky prev/next + page indicator. Driven by the API's `total / pageSize`.
- **Skeleton-on-empty** — first paint shows 12 product card skeletons in the same grid density, so layout doesn't shift on hydration.

### Product detail (`pages/ProductDetailPage.tsx`)

- **Two-column hero** — gallery on the left (with thumbnail strip), info on the right.
- **Active image cross-fade** — swapping a thumbnail keys a `motion.div` so the image cross-fades with a subtle scale.
- **Quantity stepper + add-to-cart** — opens the cart drawer on success.
- **Wishlist + share** — both fire toasts; share copies the URL to clipboard.
- **Trust strip** — three glass cards (delivery, returns, AI-curated) reinforce confidence.
- **Frequently-bought-with-this** — `RecommendationCarousel` wired to `recommendationService.similar(productId)`.

### Cart drawer (`components/cart/CartDrawer.tsx`)

The primary cart UX. Mounted once at the layout root; surfaced from anywhere via `dispatch(setCartDrawerOpen(true))`.

- Slide-in from right with body-scroll lock.
- Lazy-fetches the cart on first open, then stays warm.
- `<CartLineItem>` does optimistic +/- updates with a local `pending` flag; the slice is the source of truth.
- Empty state has its own CTA back into the catalog.
- Footer shows live subtotal/discount/tax/total and a checkout CTA secured by gateway/TLS messaging.

### Search overlay (`components/search/SearchOverlay.tsx`)

Command-palette style global search.

- Open with **⌘K / Ctrl+K** from anywhere (registered via `useKeyboardShortcut`).
- Debounced 140ms query through `productService.search()`.
- Up/Down/Enter keyboard navigation; Esc closes.
- Empty-state shows category hints; results show product card thumbnails inline with price.
- Footer line teases "AI semantic search · coming soon" — the architecture is ready: swap the search call for an AI semantic endpoint and the rest stays put.

### Toast system (`components/feedback/Toaster.tsx`)

Glass toasts in the bottom-right.

- Four variants: `info`, `success`, `warning`, `error` — only the top accent bar carries the colour.
- Auto-dismiss after `durationMs` (default 4.2s, errors get 6s).
- Stack with `layout` animation; new toasts slide in, dismissed ones slide out to the right.
- Use ergonomically via `useToast()`: `toast.success('Added', 'Open cart to checkout')`.

### Auth experience

- Login + register pages share the `AuthShell` two-pane layout (3D ornament left, form right).
- Inputs have animated focus glow and per-field error/hint slots.
- Form submit dispatches the auth slice thunks; rejected payloads surface inline as a danger banner.
- Successful login navigates back to the route the user came from (`location.state.from`).

---

## 4c. Transaction experience

The complete checkout-to-tracking flow lives on top of the customer-experience surfaces. The journey:

```
Cart drawer ─▶ /checkout (Review → Shipping → Delivery → Payment) ─▶ Confirmation ─▶ /orders/:id (Tracking)
```

### Multi-step checkout (`pages/CheckoutPage.tsx`)

A single route at `/checkout` orchestrates five steps via the `checkoutSlice`. Steps animate in/out with `<AnimatePresence>` — the URL stays at `/checkout` so the browser back button takes the user back to the cart, not to a previous step.

| Step | What it does |
|------|---------------|
| **Review** | Re-renders cart items via `<CartLineItem>` — quantities still adjustable. |
| **Shipping** | Saved-address picker on top, inline form below. Validation gates "Continue". |
| **Delivery** | Three glass radio cards: Express / Standard / Scheduled. Active state animates with shared `layoutId`. |
| **Payment** | Card / UPI / Wallet / COD with method-specific UI. Card method shows a live preview that updates as the user types. |
| **Confirmation** | Cinematic success screen — see below. |

Guard rails:
- Empty cart redirects to `/products` automatically.
- Reload during a hung payment resets `paymentStatus` to `idle` so the overlay doesn't stick.
- A power-user "jump to step" strip is rendered below the form for demo navigation.

### Checkout stepper + summary

- `CheckoutStepper` — pill-style nodes joined by a gradient rail that fills smoothly as steps complete. Past steps get a check; current step has a glowing accent ring. Mobile-aware (drops the labels under 640px).
- `CheckoutSummary` — sticky glass panel beside every non-confirmation step. Shows live cart thumbnails, totals (animated when they change), and a tiny trust strip (Gateway / Tracked / Instant).

### Payment UX

- **`PaymentCardPreview`** — live, animated card mockup (gradient mesh background, brand badge, monospace digits). Updates in real time as the user types name / number / expiry. Brand auto-detects from the BIN range purely for the visual badge — the real brand comes from the payment-service response.
- **`PaymentProcessingOverlay`** — full-screen glass card with concentric pulsing rings, rotating shield, and cycling status copy ("Tokenising card…", "Confirming with the payment-service…", "Reserving inventory…", "Finalising order…"). Failure renders a calm danger card with retry/cancel.
- **`processAndPlace` thunk** — single conversion-critical thunk that runs `paymentService.createIntent → paymentService.confirm → orderService.place`. The order is only placed if confirmation succeeds, so the user is never charged for an order that didn't land.
- **Failure simulation** — the mock payment confirmer fails ~6% of the time so the failure UX gets exercised every demo. Hitting **Try again** uses `forceSucceed: true` so the second attempt is deterministic.

### Confirmation step

- Two-burst canvas confetti (`components/visuals/Confetti.tsx`) — hand-rolled, ~160 particles, no library dependency. Auto-fades after 2.4s and skips entirely under reduced-motion.
- Hero card with a spring-bouncing success badge, gradient personalised greeting, and three summary stats (order #, ETA, total).
- Two CTAs: "Track this order" (deep-links to `/orders/:id`) and "Continue shopping".
- Below the hero: order items, ship-to card, and a post-purchase recommendation carousel seeded by the first ordered item (`recommendationService.similar`).
- The cart is cleared on mount (best-effort) so the next session starts fresh.

### Order timeline + tracking (`pages/OrderDetailPage.tsx`)

- **`OrderTimeline`** — vertical 4-stage timeline (Confirmed → Packed → Out for delivery → Delivered). The connecting rail starts as a faint white track; the active rail fills with the brand gradient and animates its height down to the current stage. Past stages are checked, current stage has a glowing accent ring.
- Cancelled orders short-circuit the timeline and render a single danger row.
- Tracking ID renders as a monospace pill with copy-to-clipboard. Etas render as relative + absolute times.
- Sticky right rail shows items, totals, and a "need help" entry point.
- Below the fold: AI "reorder these soon" carousel.

### Orders list (`pages/OrdersPage.tsx`)

Real list of orders with stacked thumbnails (overlapping rounded squares), animated stagger reveal, status badges that map to brand colours (`OUT_FOR_DELIVERY → accent`, `DELIVERED → success`, `CANCELLED → danger`), and click-through into `/orders/:id`.

### Cart upsells (`components/cart/CartUpsells.tsx`)

AI strip rendered inside both the cart drawer (horizontal scroll-snap) and the cart page (3-column grid). Seeds similarity from the first cart item. Tasteful — one nudge, not a wall of ads. Adding from the strip triggers the same optimistic-update toast flow as everywhere else.

### Transaction motion philosophy

- **Continuity above novelty.** The same easing (`cubic-bezier(0.16, 1, 0.3, 1)`) appears in every step transition, the stepper rail, the timeline rail, the payment overlay, and the confetti fade-out. The user feels one continuous narrative.
- **Trust beats sparkle on the payment surface.** The processing overlay is calm, not flashy. The failure card is clear, not alarming. Confetti is reserved for the moment the money has actually moved.
- **Reduced motion is respected on every step.** Confetti skips entirely; tilts and 3D ornaments fall back to flat layouts. The transaction is identical, just calmer.

---

## 4b. Mock fallback layer

The app must look polished even when the gateway is unreachable — for local dev without a backend, demo screenshots, design reviews, and Lighthouse runs.

`utils/mock.ts` exports believable catalog / cart / order / recommendation data. `services/*` modules wrap their fetches in `withMockFallback()`, which:

1. Tries the real call.
2. On a **network-level** failure (`status === 0`), returns the mock.
3. On a **real backend error** (4xx / 5xx), bubbles up — a true error should surface as one.

Mock cart manipulations (`addItem`, `updateItem`, etc.) mutate an in-memory cart so the drawer is interactive offline. The moment the gateway comes back, real responses transparently take over.

---

## 5. Animation architecture

Built on **Framer Motion**, with a centralised `animations/` module so the app's motion language stays consistent.

| Concern              | Where it lives                     | Used by                              |
|----------------------|------------------------------------|--------------------------------------|
| Easing curves        | `animations/variants.ts`           | every motion call                    |
| Page transitions     | `animations/PageTransition.tsx`    | `MainLayout` (auto-applied)          |
| Scroll reveal        | `animations/Reveal.tsx`            | drop-in around any element           |
| Stagger groups       | `animations/Stagger.tsx`           | grids, lists                         |
| Hero text            | `heroTextContainer/heroTextLine`   | hero copy on `HomePage`              |
| Drawer / sheet       | `slideInLeft`, `slideInRight`      | sidebar, future cart drawer          |

**Reduced-motion** is honoured globally via the CSS `prefers-reduced-motion` query and the `useReducedMotion` hook, which also short-circuits the 3D animation loop into `'demand'` mode.

---

## 6. 3D architecture (React Three Fiber)

Lightweight, never overloaded. The rule: **3D should be ornament, not infrastructure.**

| Module                    | Role                                                         |
|---------------------------|--------------------------------------------------------------|
| `three/SceneCanvas.tsx`   | The **only** `<Canvas>` instantiation. Caps DPR (1, 1.75), enables AdaptiveDpr/AdaptiveEvents, switches to `frameloop="demand"` when reduced motion is on. |
| `three/Lighting.tsx`      | Four named presets: `studio`, `product`, `ambient`, `neon`. Pick one — don't roll your own. |
| `three/ParticleField.tsx` | Single BufferGeometry, additive-blended Points. ~700 particles, GPU-rotated, zero per-frame allocations. |
| `three/FloatingGeometry.tsx` | Reusable distortion-shaded display mesh. Shapes: `icosa`, `torus`, `sphere`, `box`. |

The ambient backdrop is **lazy-imported** so users who don't need 3D never download the Three.js bundle. `VITE_ENABLE_3D=false` disables R3F entirely (zero canvas in the DOM).

---

## 7. API integration

### Single Axios client, gateway-only

`services/http.ts` exposes one Axios instance. Every per-domain service module imports it — no module spins up its own client. That gives us one place to wire:

- **Auth** — request interceptor injects `Authorization: Bearer <jwt>` from the persisted session.
- **Tracing** — every request gets an `X-Request-Id` (correlation id) for backend span linkage.
- **Error normalization** — both axios errors and unknown throws are normalized into a single `ApiError` shape.
- **Refresh** — single-flight refresh handler. Multiple in-flight 401s share one refresh promise so we never stampede the auth-service.

### Per-domain service modules

| Module                     | Surface                                          |
|----------------------------|--------------------------------------------------|
| `authService`              | `login`, `register`, `me`, `logout`, `refresh`   |
| `productService`           | `list`, `getBySlug`, `getById`, `search`, `categories` |
| `cartService`              | `get`, `addItem`, `updateItem`, `removeItem`, `clear` |
| `orderService`             | `list`, `get`, `place`, `cancel`                 |
| `paymentService`           | `createIntent`, `confirm`, `methods`             |
| `recommendationService`    | `forUser`, `similar`, `trending`                 |

### State

Redux Toolkit with feature-aligned slices:

```
auth · products · cart · orders · recommendations · ui
```

Slices use `createAsyncThunk` for network calls, with `pending / fulfilled / rejected` reducers and selectors colocated. Components consume via the typed `useAppSelector` / `useAppDispatch` hooks.

---

## 8. Auth foundation

- **Persistence** — JWT session in localStorage under `VITE_AUTH_STORAGE_KEY`. Wrapped by a safe-storage helper that no-ops in private mode / SSR.
- **Hydration** — `App` dispatches `hydrateAuth()` on first paint so a hard refresh keeps the user logged in without flashing the public state.
- **`<ProtectedRoute>`** — gate routes by auth and (optionally) role. Waits for `hydrated` before deciding so refreshes don't bounce real users to `/login`.
- **`useAuth()`** — single ergonomic hook with `login`, `register`, `logout`, `hasRole`, `hasAnyRole`, plus error and user state.
- **Refresh wiring** — `authSlice` registers a refresh handler with `services/http.ts`. The HTTP module retries a single 401'd request after a successful refresh.

---

## 9. Routing

`react-router-dom` v6 with **lazy-loaded routes**. Every page is its own bundle, served through the layout's `<Suspense fallback={<RouteFallback />}>`.

| Path                | Visibility    | Page                     |
|---------------------|---------------|--------------------------|
| `/`                 | public        | `HomePage`               |
| `/login`            | public        | `LoginPage`              |
| `/register`         | public        | `RegisterPage`           |
| `/products`         | public        | `ProductsPage`           |
| `/products/:slug`   | public        | `ProductDetailPage`      |
| `/recommendations`  | public        | `RecommendationsPage`    |
| `/cart`             | public        | `CartPage`               |
| `/orders`           | protected     | `OrdersPage`             |
| `/orders/:id`       | protected     | `OrderDetailPage` (tracking) |
| `/checkout`         | protected     | `CheckoutPage` (multi-step) |
| `/account`          | protected     | `AccountPage`            |
| `/admin`            | role: ADMIN   | `AdminPage`              |
| `*`                 | catch-all     | `NotFoundPage`           |

> Cart is now public — anonymous shoppers can build a cart locally; the
> protected `/checkout` route enforces auth at the conversion point.

---

## 10. Loading experience

- **Boot screen** — pre-hydration HTML/CSS card painted from `index.html`. No flash of unstyled content; React removes it on mount.
- **`RouteFallback`** — page-shaped skeleton silhouette (not a spinner). Navigation feels instant because content shape appears immediately.
- **`Skeleton`** — composable shimmer primitive (`text`, `avatar`, `thumb`, `card`, `pill`).
- **`FullPageLoader`** — calm full-screen card; used by `<ProtectedRoute>` while auth hydrates.
- **`Spinner`** — conic-gradient, GPU-only, no SVG.

---

## 11. Performance

- **Code splitting** — every route is a lazy chunk. Manual chunks in `vite.config.ts` for `react-vendor`, `three-vendor`, `motion-vendor`, `state-vendor`, `http-vendor`.
- **3D weight** — Three.js lives behind a lazy boundary. If `VITE_ENABLE_3D=false`, the bundle never loads.
- **DPR cap** — `[1, 1.75]` on the R3F canvas. Adaptive DPR + Adaptive Events scale down on stress.
- **Reduced motion** — kills ambient animations and switches the 3D loop to `demand` mode (no per-frame redraw).
- **Bundle hygiene** — `tailwind-merge` + `clsx` over runtime CSS-in-JS. No CSS-in-JS at runtime, no styled-components, no MUI.
- **AKS-ready** — pure static output (`vite build`). Drop into any CDN, Nginx pod, or Azure Static Web App.

---

## 12. Responsiveness

- **Mobile** (`< 768px`) — collapsed nav, single-column grids, 3D backdrop disabled by reduced-motion guard.
- **Tablet** (`768px – 1023px`) — two-up grids, navbar with all primary links, sidebar still in slide-in mode.
- **Desktop** (`≥ 1024px`) — full sidebar toggle, four-up product grids, larger hero presence with 3D ornament.

---

## 13. Roadmap

### Foundation phase ✅
- Design system, theme tokens, glass primitives
- Animation system (Framer Motion) + scroll reveal + stagger
- 3D foundation (R3F + Drei) — particles, lighting, geometry
- Routing with lazy-loaded routes + ProtectedRoute
- Redux store with all slices
- Axios gateway client + interceptors + refresh-ready
- Auth hydration + JWT persistence
- Layout system: navbar, footer, sidebar, main shell, container
- Loading experience: skeletons, route fallback, full-page loader

### Customer-experience phase ✅
- Cinematic homepage (hero, trending strip, categories, AI teaser, features, CTA)
- Product card with 3D tilt + AI score chip + optimistic add-to-cart
- Catalog page with URL-driven filters, sort, pagination, search input
- Product detail page with gallery, AI similar-products carousel, trust strip
- Slide-in cart drawer with optimistic +/- updates and live totals
- ⌘K command-palette search overlay (debounced, keyboard-navigable)
- Glass toast system (info/success/warning/error)
- Mock fallback layer — UI stays polished even when the gateway is down

### Transaction-experience phase ✅
- Multi-step checkout (Review → Shipping → Delivery → Payment → Confirmation)
- Animated stepper with gradient progress rail and shared `layoutId` highlighting
- Sticky checkout summary with live thumbnails and animated totals
- Premium shipping form with saved-address picker
- Three-card delivery selector (Express / Standard / Scheduled)
- Cinematic payment step: live card preview, UPI/Wallet/COD UIs, brand auto-detection
- Payment processing overlay (concentric pulse + cycling status copy)
- Failure recovery flow with retry / cancel
- Confetti-driven confirmation page with post-purchase recommendations
- Animated `OrderTimeline` with gradient progress rail
- Order detail page with tracking ID copy-to-clipboard + similar-products carousel
- Real orders list with status pills + stacked thumbnails
- AI upsells in cart drawer + cart page

### Next: AI deepening
- "Why this?" rationale popovers on every recommendation card
- True semantic search wired into the existing search overlay
- 3D GLTF product viewer on detail pages (via Drei)
- Personalised infinite feed on `/recommendations`

### Operational concerns (cross-cutting)
- Sentry / OTel correlation linking the X-Request-Id
- Feature-flag layer (LaunchDarkly / GrowthBook adapter)
- Lighthouse CI in pipeline
- Playwright E2E covering the golden checkout path
- A11y audit (axe) on every page

---

## 14. Browser support

The build targets `es2022` ([vite.config.ts](vite.config.ts)) and assumes evergreen browsers. We don't ship polyfills — adding them would inflate the bundle for the 99% who don't need them.

| Browser           | Supported                          |
|-------------------|-------------------------------------|
| Chrome / Edge     | ≥ 110                               |
| Firefox           | ≥ 110                               |
| Safari            | ≥ 16                                |
| iOS Safari        | ≥ 16                                |
| Android Chrome    | latest                              |
| Internet Explorer | **Not supported.** Won't even load. |

### Browser-API requirements

The codebase uses these without polyfills — verify they exist before targeting an older runtime:

- `crypto.randomUUID()` — toast IDs, request IDs
- `structuredClone()` — local mock cart deep copies
- `Intl.RelativeTimeFormat` — relative timestamps
- `IntersectionObserver` (via Framer Motion `whileInView`)
- `ResizeObserver` (via R3F `AdaptiveDpr` / `AdaptiveEvents`)
- `prefers-reduced-motion` media query
- `backdrop-filter: blur()` — glass surfaces (Safari, Chrome 76+, FF 103+)
- `mask-image` (linear-gradient + radial) — vignette and shimmer effects

### Graceful degradation

Things that are designed to fall back without breaking the experience:

| Capability missing | Fallback                                                              |
|--------------------|-----------------------------------------------------------------------|
| WebGL / R3F        | `VITE_ENABLE_3D=false` removes the canvas entirely.                   |
| Reduced motion     | All Framer animations short-circuit; 3D loop switches to `demand`; confetti is skipped. |
| `localStorage`     | `utils/storage.ts` no-ops in private mode / SSR; auth degrades to a per-tab session. |
| `clipboard.writeText` | Toasts catch the rejection and fall back to a calm message.        |
| Slow network       | Skeleton silhouettes appear immediately; real content swaps in.       |
| Backend down       | Mock fallback layer takes over — see [§4b](#4b-mock-fallback-layer).  |

---

## 15. Accessibility

Accessibility is a contract here, not a checklist. The patterns below are enforced across the codebase — please uphold them in new components.

### Keyboard

- **Every interactive element is reachable by Tab** — including the cart icon (`<button>`, not a styled `<div>`), the search trigger, and every product card.
- **`:focus-visible` ring** is set globally in [globals.css](src/styles/globals.css) — a 2px neon outline with a 3px offset, so the ring sits *outside* glass borders rather than getting blurred by them.
- **Command shortcuts** are documented inline in the search overlay footer (⌘K open, ↑↓ navigate, ⏎ open, Esc close). Shortcuts skip when the focus is inside an input — see [`useKeyboardShortcut`](src/hooks/useKeyboardShortcut.ts).
- **Modal traps** — the cart drawer, search overlay, and payment processing overlay all lock body scroll while open and dismiss on Esc / scrim click.
- **Form fields** use `<label>` linkage via `htmlFor` (the `Input` primitive auto-generates an ID if none is passed), so screen readers announce labels correctly.

### Semantics

- **Landmarks** — `<header>`, `<main>`, `<footer>`, `<aside>`, `<nav>`, `<ol>`/`<ul>` are used for actual layout regions. Don't replace them with `<div>`s.
- **Headings** are ordered: each page starts at `<h1>`, sections use `<h2>`. The `PageHeader` shared component enforces this.
- **`aria-label`** appears on icon-only buttons (cart, close, copy) — never `title`-only.
- **`aria-live="polite"`** on the toast host so updates are announced without interrupting the user.
- **`aria-hidden="true"`** on decorative SVG icons inside buttons that already have a label.

### Motion

- The CSS layer in [globals.css](src/styles/globals.css) collapses every transition / animation to ~0ms when `prefers-reduced-motion: reduce` is set.
- The [`useReducedMotion`](src/hooks/useReducedMotion.ts) hook is the JS-side counterpart — used to short-circuit:
  - the 3D ambient backdrop (no particles when reduced motion is on)
  - the R3F `frameloop` (`always` → `demand`)
  - product card 3D tilt
  - confetti emission

### Colour & contrast

The dark palette was chosen with WCAG-AA body-text contrast in mind:

| Surface             | Foreground         | Ratio    |
|---------------------|--------------------|----------|
| `ink-950` (canvas)  | `ink-50` (#f5f7fb) | 16.4 : 1 |
| `ink-950`           | `ink-200`          | 9.8 : 1  |
| `ink-950`           | `ink-300`          | 5.6 : 1  |
| Glass surface (`#0d1024 @ 55%` over canvas) | `ink-50` | ≥ 12 : 1 |

Status colours (`success`, `warning`, `danger`, `info`) are paired with both an icon and a label — never colour alone.

### Known gaps

To be closed in the operational phase:
- Automated `axe` audit per route in CI.
- Live screen-reader testing on the checkout flow.
- A high-contrast theme variant (currently single dark theme).

---

## 16. Security model

### Boundary

The frontend talks to **one** address: the API gateway (`config.api.baseUrl`). Direct service URLs are not allowed in code. All cross-cutting concerns live at that boundary:

| Concern              | Where it's enforced                                |
|----------------------|----------------------------------------------------|
| AuthN (JWT)          | Gateway validates the bearer token before routing. |
| AuthZ (roles)        | Gateway + downstream services. UI gates with `<ProtectedRoute roles=…>` for early redirects only. |
| Rate limiting        | Gateway.                                           |
| Audit logging        | Gateway.                                           |
| TLS termination      | Gateway / ingress.                                 |
| CORS                 | Gateway whitelist.                                 |
| Tracing              | `X-Request-Id` correlation header injected by [http.ts](src/services/http.ts). |

### Token handling

- JWT lives in `localStorage` under `VITE_AUTH_STORAGE_KEY`. We pick localStorage over an httpOnly cookie deliberately so the gateway can stay stateless, but you should be aware of the trade-off below.
- The token is attached as `Authorization: Bearer <jwt>` by the request interceptor — never appended to URLs.
- Refresh is single-flight: concurrent 401s share one refresh promise so we never stampede the auth-service.
- On refresh failure, the persisted session is wiped and the next protected route bounces to `/login`.

### Threat surface

| Vector                                | Mitigation                                                                                    |
|---------------------------------------|-----------------------------------------------------------------------------------------------|
| XSS stealing the JWT                  | No `dangerouslySetInnerHTML` in the codebase. CSP recommended at the gateway/edge (see Deployment). |
| CSRF                                  | Bearer tokens, not cookies. Not exploitable cross-site.                                       |
| Open redirect on `/login?from=…`      | The `from` value comes from `location.state`, not the URL — un-redirectable from outside.     |
| Card data exfiltration                | Card UI is a simulator; in production we would tokenise via the gateway and never touch the PAN here. |
| Mock data leaking into prod           | Mock fallback only fires on `status === 0` (network-level failure). Real prod errors bubble through. |
| Dependency supply chain               | `npm install` produces a deterministic tree from a committed `package-lock.json`. Renovate / Dependabot recommended. |

### Recommended gateway-side hardening

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` with a strict default + explicit allowlist for fonts.googleapis.com + the gateway origin
- `Referrer-Policy: strict-origin-when-cross-origin` (already set in `index.html`)
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

---

## 17. Deployment

The build output is **pure static assets** — `dist/` after `npm run build`. Drop it on any static host that can serve files and route SPA fallbacks to `index.html`.

### Output shape

```
dist/
├── index.html
├── favicon.svg
└── assets/
    ├── index-<hash>.css         # 47 kB / 9 kB gz
    ├── index-<hash>.js          # app shell, ~94 kB / 29 kB gz
    ├── react-vendor-<hash>.js   # 157 kB / 52 kB gz
    ├── motion-vendor-<hash>.js  # 117 kB / 39 kB gz
    ├── three-vendor-<hash>.js   # 820 kB / 221 kB gz   ← lazy-loaded
    ├── http-vendor-<hash>.js    #  42 kB / 17 kB gz
    ├── state-vendor-<hash>.js   #  35 kB / 13 kB gz
    └── …per-route chunks…       # most ≤ 10 kB
```

### Static host (Nginx / Azure Static Web Apps / Cloudflare Pages)

The only routing rule you need is **SPA fallback** — any unmatched path returns `/index.html`.

Nginx example:

```nginx
server {
  listen 80;
  root  /usr/share/nginx/html;

  # 1y cache on hashed assets, no cache on the entry HTML
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  location = /index.html {
    add_header Cache-Control "no-store";
  }

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Azure Static Web Apps `staticwebapp.config.json`:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/favicon.svg"]
  },
  "globalHeaders": {
    "Cache-Control": "no-store"
  },
  "routes": [
    { "route": "/assets/*", "headers": { "Cache-Control": "public, max-age=31536000, immutable" } }
  ]
}
```

### Containerised (the production runtime that ships with this repo)

The repo ships a real, multi-stage [`Dockerfile`](Dockerfile) and a real [`deploy/nginx.conf`](deploy/nginx.conf) — both already wired into [`docker-compose.platform.yml`](../docker-compose.platform.yml) at the workspace root. To start the whole platform (frontend + 6 backend services + 5 Postgres + Redis + gateway) in one command:

```bash
# from the workspace root
docker compose -f docker-compose.platform.yml up --build -d
# →  Frontend: http://localhost
# →  Gateway:  http://localhost:8080   (still exposed for direct curl/debugging)
# →  Vite:     run separately on :5173 if you want HMR
```

The container architecture:

```
┌─────────────────────────────────────────────────────┐
│ frontend-app container  (nginx:1.27-alpine, 75 MB)  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ /usr/share/nginx/html       (the dist/)      │   │
│  │   index.html  (no-store)                     │   │
│  │   assets/*   (Cache-Control: immutable, gz)  │   │
│  │   favicon.svg                                │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  /api/**           ──► proxy_pass  api-gateway:8080 │
│  /actuator/**      ──► proxy_pass  api-gateway:8080 │
│  /assets/*         ──► static                       │
│  everything else   ──► SPA fallback to /index.html  │
└──────────────────────────┬──────────────────────────┘
                           │ Docker DNS: api-gateway
                           ▼
                  ┌──────────────────────┐
                  │ api-gateway :8080    │
                  └────────────┬─────────┘
                               │
                               ▼
            6 microservices  +  Redis  +  5 Postgres
```

Key choices (all already implemented in this repo):

| Concern | Implementation |
|---|---|
| **Multi-stage** | `node:20-alpine` → `nginx:1.27-alpine`. Final image has no node_modules, no source, no `.env`, no Dockerfile, no tsbuildinfo. |
| **Deterministic install** | `npm ci --no-audit --no-fund` in the builder stage. |
| **Build args** | Every `VITE_*` is a `Dockerfile` `ARG` with a safe default. Override at build time: `docker compose build --build-arg VITE_API_BASE_URL=https://api.blinkit.example.com frontend-app`. |
| **SPA fallback** | `try_files $uri $uri/ /index.html` for all non-`/api`, non-`/assets` routes. |
| **`/assets/*` 404 (not SPA)** | A missing hashed asset returns 404 instead of HTML — otherwise browsers would parse `index.html` as a JS module and crash silently. |
| **Same-origin /api** | nginx `proxy_pass http://api-gateway:8080` over the Docker bridge network. No CORS preflights, gateway port does not need to be public. |
| **Auth header passthrough** | `proxy_set_header` does not touch `Authorization`; bearer tokens travel unchanged. |
| **Gzip** | Enabled for `text/*`, `application/javascript`, `application/json`, `image/svg+xml`, fonts. `Vary: Accept-Encoding`. |
| **Cache strategy** | `index.html` → `no-store`. Hashed `/assets/*` → `public, max-age=31536000, immutable`. |
| **Security headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`, `X-XSS-Protection: 0`, `server_tokens off`. |
| **Healthcheck** | `wget -qO- http://localhost/ \| grep -q '<title>Blinkit'` — proves nginx is binding and serving the real SPA. |
| **Host port** | Defaults to `80` (cleanest URL: `http://localhost`). Override with `FRONTEND_HOST_PORT` in `.env`. |

> **Build-time vs run-time env vars:** Vite inlines `VITE_*` at build time. The bundle that ships in the image is bound to the `VITE_API_BASE_URL` it was built with. To target a different gateway, rebuild with a new `--build-arg`. The empty default (`""`) is the one this image is built for: same-origin via the nginx proxy.

### CI/CD checklist

- [ ] `npm ci` (deterministic install)
- [ ] `npm run lint` — max-warnings 0
- [ ] `npm run build` — fails on TS errors
- [ ] Lighthouse CI budget for Performance ≥ 90, A11y ≥ 95
- [ ] Playwright smoke test on a deployed preview
- [ ] Image scan (e.g. Trivy) on the container
- [ ] Tag image with the commit SHA, not `latest`

---

## 18. Testing & verification

The codebase has **no automated tests yet** — that's the next phase. Today, verification is the manual + tooling baseline below.

### What's verified today

| Check               | Command            | Status |
|---------------------|--------------------|--------|
| TypeScript type-check | `npx tsc -b`     | ✅ Clean (0 errors) |
| Production build    | `npm run build`    | ✅ 2,676 modules, 41 chunks, ~21s |
| Dev-server boot     | `npm run dev`      | ✅ Ready in ~550ms |
| Bundle output       | `dist/` ≈ 1.5 MB total / 384 kB gz |  |
| Manual click-through| Cart → Checkout → Confetti → Tracking | ✅ End-to-end |

### Planned testing pyramid

```
  ▲     E2E (Playwright)        — golden checkout path, 5 steps
  │     ─────────────────
  │     Integration (Vitest + RTL) — slices, hooks, services
  │     ──────────────────────────
  │     Unit (Vitest)              — utils, validators, format
  ▼     ────────────────
```

### Recommended Vitest setup

```bash
npm i -D vitest @testing-library/react @testing-library/user-event jsdom
```

Add to [package.json](package.json):

```jsonc
{
  "scripts": {
    "test":        "vitest",
    "test:watch":  "vitest --watch",
    "test:cov":    "vitest run --coverage"
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
}));
```

### Recommended Playwright flows

1. **Happy-path checkout** — add product → open drawer → checkout → fill shipping → pick delivery → pay (forced succeed) → confirmation → track.
2. **Payment failure recovery** — same as above, force the random failure, hit Retry, succeed.
3. **Reduced motion** — emulate `prefers-reduced-motion: reduce`, verify confetti and tilt are skipped.
4. **Auth refresh** — expired token round-trip.

---

## 19. State management deep dive

### Slices at a glance

| Slice             | Owns                                                | Persistence              |
|-------------------|-----------------------------------------------------|--------------------------|
| `auth`            | session, user, hydrated flag, error                 | `localStorage`           |
| `products`        | catalog list, filters, byId cache                   | none                     |
| `cart`            | cart items, totals, status                          | server (gateway)         |
| `orders`          | list + byId                                         | server                   |
| `recommendations` | `forYou`, `trending`, `similar`                     | none                     |
| `checkout`        | step, address, delivery, payment method, payment status, placed order | none — wiped on `resetCheckout` |
| `ui`              | sidebar, cart drawer, search overlay, toasts        | none                     |

### Async thunk pattern

Every slice that talks to the gateway uses `createAsyncThunk` with a normalized rejection. Components don't `try/catch` thunks directly — they `.unwrap()` them when they need the resolved value, otherwise read state.

```ts
const result = await dispatch(login({ email, password })).unwrap();
//                                                       ^ throws ApiError on rejection
```

### Selectors

Selectors live next to the slice they read. There's no `reselect` yet — the state is small enough that referential-equality footguns don't justify the dependency. If a selector starts doing real work, port it to `createSelector` rather than memoising in components.

### Why no React Query / SWR

The trade-off is conscious:

- The gateway is the only contract — fewer moving parts than a typical multi-API SPA.
- We need optimistic mutations (cart +/-) to feel instant; that's first-class in RTK with `extraReducers`, awkward in React Query.
- The team already knows Redux Toolkit; a single mental model wins.

We may revisit this for the AI deepening phase if we add a lot of read-heavy AI surfaces.

### `processAndPlace` — the conversion-critical thunk

Located in [`checkoutSlice.ts`](src/store/slices/checkoutSlice.ts). The shape:

```
createIntent(amount)
        │
        ▼
confirm(intentId, forceSucceed?)
        │
        ▼ (only if status === 'succeeded')
placeOrder(payload + intentId)
```

If `confirm` rejects or returns a non-succeeded status, the order is **not placed**. The user is never charged for an order that didn't land — that's the whole reason this is a single thunk and not three separate dispatches in the component.

---

## 20. Backend integration contracts

The frontend assumes the gateway exposes the endpoints below. These shapes are documented in [src/types/domain.ts](src/types/domain.ts) and [src/services/](src/services/) — keep them in sync with the backend OpenAPI/proto definitions.

### Auth

| Method | Path                | Body                                      | Response       |
|--------|---------------------|-------------------------------------------|----------------|
| POST   | `/auth/login`       | `{ email, password }`                     | `AuthSession`  |
| POST   | `/auth/register`    | `{ name, email, password }`               | `AuthSession`  |
| POST   | `/auth/logout`      | —                                         | `void`         |
| POST   | `/auth/refresh`     | `{ refreshToken }`                        | `AuthSession`  |
| GET    | `/auth/me`          | —                                         | `User`         |

### Products

| Method | Path                          | Query                                                              | Response               |
|--------|-------------------------------|--------------------------------------------------------------------|------------------------|
| GET    | `/products`                   | `q? category? minPrice? maxPrice? sort? page? pageSize?`           | `Paginated<Product>`   |
| GET    | `/products/:slug`             | —                                                                  | `Product`              |
| GET    | `/products/id/:id`            | —                                                                  | `Product`              |
| GET    | `/products/search`            | `q, pageSize?`                                                     | `Paginated<Product>`   |
| GET    | `/products/categories`        | —                                                                  | `string[]`             |

### Cart

| Method  | Path                          | Body                            | Response  |
|---------|-------------------------------|---------------------------------|-----------|
| GET     | `/cart`                       | —                               | `Cart`    |
| POST    | `/cart/items`                 | `{ productId, quantity }`       | `Cart`    |
| PATCH   | `/cart/items/:productId`      | `{ quantity }`                  | `Cart`    |
| DELETE  | `/cart/items/:productId`      | —                               | `Cart`    |
| DELETE  | `/cart`                       | —                               | `Cart`    |

### Orders

| Method | Path                | Body                            | Response             |
|--------|---------------------|---------------------------------|----------------------|
| GET    | `/orders`           | (page, pageSize)                | `Paginated<Order>`   |
| GET    | `/orders/:id`       | —                               | `Order`              |
| POST   | `/orders`           | [`PlaceOrderPayload`](src/services/orderService.ts) | `Order` |
| POST   | `/orders/:id/cancel`| —                               | `Order`              |

### Payments

| Method | Path                                   | Body                | Response          |
|--------|----------------------------------------|---------------------|-------------------|
| POST   | `/payments/intent`                     | `{ amount }`        | `PaymentIntent`   |
| POST   | `/payments/intent/:id/confirm`         | —                   | `PaymentIntent`   |
| GET    | `/payments/methods`                    | —                   | `PaymentMethodSummary[]` |

### AI recommendations

| Method | Path                                          | Query        | Response             |
|--------|-----------------------------------------------|--------------|----------------------|
| GET    | `/ai/recommendations`                         | `limit?`     | `Recommendation[]`   |
| GET    | `/ai/recommendations/trending`                | `limit?`     | `Recommendation[]`   |
| GET    | `/ai/recommendations/similar/:productId`      | `limit?`     | `Recommendation[]`   |

### Common error envelope

All non-2xx responses are normalized by [`http.ts`](src/services/http.ts) into:

```ts
interface ApiError {
  status: number;          // 0 for network failure
  message: string;
  code?: string;           // backend-defined, e.g. PAYMENT_DECLINED
  details?: Record<string, unknown>;
}
```

Service callers should rely on `status` + `code`, never on parsing `message`.

### Headers we send

| Header              | Value                                  |
|---------------------|----------------------------------------|
| `Authorization`     | `Bearer <jwt>` when a session exists   |
| `Content-Type`      | `application/json`                     |
| `Accept`            | `application/json`                     |
| `X-Client`          | `Blinkit/<version>`                    |
| `X-Request-Id`      | `crypto.randomUUID()` per request      |

---

## 21. Troubleshooting

### `TS6137: Cannot import type declaration files`

You're using the old `@types/*` path alias. We renamed it to `@app-types/*` to avoid colliding with TypeScript's reserved `@types/...` namespace. Update the import:

```diff
- import type { Product } from '@types/domain';
+ import type { Product } from '@app-types/domain';
```

### `Module not found: Can't resolve '@…'`

You added a new alias and only updated one of the two config files. Aliases live in **both**:

- [tsconfig.app.json](tsconfig.app.json) — for the editor and `tsc`.
- [vite.config.ts](vite.config.ts) — for the bundler.

### Vite dev server reports a port conflict

Vite increments to the next free port automatically. If you want a fixed port, edit `server.port` in [vite.config.ts](vite.config.ts).

### Cart drawer is empty even though I added items

Check the network panel:

- If you see calls hitting `localhost:8080` → the backend is up; the cart-service responded with an empty cart. Auth might be missing or the user has no cart yet.
- If you see no network calls → the mock fallback is active. The local cart only persists for the tab — refresh wipes it. This is intentional; persisting a fake cart to localStorage would shadow real data when the gateway comes back.

### Confetti / tilt / animations don't play

Operating-system level setting: **Reduce Motion**. We respect it everywhere. To verify:

- macOS: System Settings → Accessibility → Display → Reduce motion.
- Windows: Settings → Accessibility → Visual effects → Animation effects.

### Build fails with `Type 'Promise<…>' is missing the following properties from type 'PaymentIntent'`

The `withMockFallback` signature accepts `() => T | Promise<T>`. If you're seeing this on an older copy of [src/utils/mock.ts](src/utils/mock.ts), update to the version where `fallback` is `() => T | Promise<T>` and the helper `await`s it.

### The 3D scene is blank / WebGL context lost

Some headless / virtualized environments don't expose a real WebGL context. Set `VITE_ENABLE_3D=false` in `.env` to remove the canvas entirely — the rest of the UI is unaffected.

### `crypto.randomUUID is not a function`

You're on a browser older than the ones we support — see [§14](#14-browser-support). Either upgrade or polyfill it:

```ts
if (!('randomUUID' in crypto)) {
  (crypto as Crypto & { randomUUID: () => string }).randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}
```

### Pre-commit hook is killing my workflow

There isn't one in this repo. If you're getting blocked by something, it's coming from a parent monorepo or a global git hook.

---

## 22. FAQ

**Why dark-only? Aren't you limiting the audience?**
The brand is "premium futuristic AI commerce". A light theme is on the roadmap (see Operational concerns) but it's not free — every glass surface and gradient was tuned for the dark canvas. Doing it half-heartedly would cheapen the dark theme too.

**Why React Three Fiber if 3D is just ornament?**
Because the few moments of 3D we use (hero, auth, 404, payment overlay) carry disproportionate signal — they're the parts a recruiter or investor screenshots. Hand-rolling a `<canvas>` for each would cost more than the 220 kB gzipped Three.js chunk.

**Why Redux Toolkit and not Zustand / Jotai / signals?**
Predictability, devtools, and team familiarity. The store is small enough that any state library would work; RTK's payoff is the thunk pattern + the ergonomics of `extraReducers` for optimistic mutations. We may revisit if a future phase wants finer-grained reactivity.

**Why no React Query?**
See [§19 — State management deep dive](#19-state-management-deep-dive).

**Can I add a new route?**
Yes — three steps:
1. Add the page module under `src/pages/`.
2. Add a path constant to [src/routes/paths.ts](src/routes/paths.ts).
3. Add a `<Route>` (with `lazy()`) inside [src/routes/AppRouter.tsx](src/routes/AppRouter.tsx).

If it's protected, wrap with `<ProtectedRoute>`. If it has its own layout, render outside `<MainLayout>`.

**Can I use this without the backend?**
Yes — that's the whole point of the mock fallback layer. Run `npm run dev` with no gateway running; every screen renders polished, the cart works, the checkout flows, payments simulate (with a 6% random failure for demo realism), confirmation animates, tracking shows mock progress.

**How do I demo the payment failure path?**
Just keep retrying until the random ~6% kicks in. Or add `forceSucceed: false` paths in dev tools. The retry button uses `forceSucceed: true` so the second attempt always succeeds.

**The `three-vendor` chunk is 220 kB gzipped — can I shrink it?**
Yes, three angles:
1. Tree-shake unused Drei helpers — most of the weight is Drei's helpers, not Three core.
2. Set `VITE_ENABLE_3D=false` in environments where 3D isn't needed.
3. Move R3F behind a "show 3D" toggle and don't import it on first paint at all.

**Where do toast / notification colours come from?**
The variant accent bar is the only colour cue — see [`Toaster.tsx`](src/components/feedback/Toaster.tsx). Tokens come from `success / warning / danger / info` in the Tailwind palette.

**What's the difference between `eyebrow` and `Badge`?**
`.eyebrow` (CSS class) is a section label — small caps, leading hairline, used at the top of headers. `<Badge>` is a status pill — coloured background, used inline with content. Don't mix them.

**How do I debug a thunk?**
Redux DevTools show every dispatched action including `pending / fulfilled / rejected` with payloads. `VITE_ENABLE_DEVTOOLS=true` (default) keeps them on. Look at the `meta.requestStatus` to see whether the thunk resolved or rejected.

---

## 23. Development workflow

### First-time setup

```bash
git clone <repo>
cd blinkit-clone/frontend-app
cp .env.example .env
npm install
npm run dev
```

### Branching

| Branch          | Purpose                                                  |
|-----------------|----------------------------------------------------------|
| `main`          | Always-deployable. Protected.                            |
| `feat/<scope>`  | Short-lived feature branches.                            |
| `fix/<scope>`   | Bug fixes.                                               |
| `chore/<scope>` | Tooling, deps, refactor.                                 |

### Commit messages

Conventional Commits. Keep the subject under 72 characters.

```
feat(checkout): add Express delivery option
fix(cart): drawer focus trap on Esc
chore(deps): bump framer-motion to 11.13
docs(readme): expand troubleshooting section
```

### Pull-request checklist

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (no warnings)
- [ ] `npm run build` produces a clean `dist/`
- [ ] Manual smoke test of any touched route
- [ ] Reduced-motion behaviour verified for any new animation
- [ ] Mobile breakpoint verified for any new layout
- [ ] Screenshot for any visual change
- [ ] README updated for any new public-facing convention or alias

### Code review focus

When reviewing transaction-layer changes, prioritise:
1. **Conversion paths.** Anything in `processAndPlace` deserves extra eyes.
2. **Optimistic UI rollback.** If you fire optimistically, what happens on rejection?
3. **Reduced-motion.** Any new animation must short-circuit.
4. **Error envelopes.** `ApiError.status === 0` should fall back to mock; everything else should bubble.
5. **Path aliases.** New imports should use the right alias (see [Path aliases](#path-aliases)).

---

## 24. Glossary

| Term                  | Meaning                                                                                  |
|-----------------------|------------------------------------------------------------------------------------------|
| **Gateway**           | The single API surface (`http://localhost:8080`) the frontend talks to. Routes to backend microservices. |
| **AI score**          | Confidence value (0..1) returned by the recommendation service. Surfaced in the UI as a chip. |
| **Mock fallback**     | The `withMockFallback` wrapper that returns local mock data when the gateway is unreachable (network status 0). |
| **Optimistic UI**     | Updating local state before the server confirms — used for cart +/-, add-to-cart, etc.    |
| **Stagger**           | Framer Motion technique where children animate in with a delay offset, used in product grids and feature lists. |
| **Glass / Glassmorphism** | The frosted, semi-transparent surfaces created by `backdrop-filter: blur()` + thin border + faint inner highlight. |
| **Hairline**          | A 1-pixel divider with a fading gradient — see `.hairline` in [globals.css](src/styles/globals.css). |
| **Eyebrow**           | A small uppercase label with a leading hairline, used above headings. See `.eyebrow`.    |
| **Sheen**             | A diagonal specular sweep on hover, applied via the `.sheen` utility — used on primary buttons. |
| **Reveal**            | A scroll-driven fade-up animation. The `<Reveal>` wrapper around any element triggers it on viewport entry. |
| **Skeleton**          | A shimmering placeholder of the eventual content shape. Used during loading instead of spinners. |
| **DPR cap**           | The maximum device-pixel-ratio applied to the R3F canvas. We cap at 1.75 to avoid Retina-on-iPad GPU pain. |
| **frameloop="demand"**| R3F mode where the scene only re-renders on changes (vs `always` which redraws every frame). Used under reduced-motion. |
| **Confetti**          | The hand-rolled canvas celebration in `components/visuals/Confetti.tsx`. Two-burst, palette-aware, reduced-motion-aware. |

---

## 25. Conventions

- **Tailwind first.** Reach for component CSS only when Tailwind genuinely can't express it.
- **One Axios client.** Per-domain modules import `http`; never call `axios.create` again.
- **Routes are typed.** Import from `@routes/paths` — do not write string literals.
- **Slices own their thunks.** Components use the hooks (`useAuth`, etc.), not the slice directly.
- **Three.js is ornament.** Never make UX dependent on the canvas rendering.
- **Reduced motion is a contract.** Animations must degrade gracefully.
- **Aliases over relative paths.** Prefer `@components/primitives/Button` over `../../primitives/Button`.
- **Co-locate by feature, not by type.** A new `cart` feature gets its own `components/cart/` folder, not scattered across `components/buttons/`, `components/forms/`, etc.
- **One default export per page module.** Lazy routes need it. Everything else should be named.
- **No barrel files except where they prevent obvious churn.** `services/index.ts` is fine; per-component barrels are not.
- **Comments earn their place.** Prefer naming and types over comments. When you do comment, explain the *why*, not the *what*.

---

## 26. Scripts

| Command              | Purpose                                       |
|----------------------|-----------------------------------------------|
| `npm run dev`        | Start the Vite dev server (HMR, fast).        |
| `npm run build`      | Type-check + build for production.            |
| `npm run preview`    | Serve the production bundle locally.          |
| `npm run lint`       | ESLint, max-warnings 0.                       |
| `npm run type-check` | TypeScript project references, pretty errors. |

### Useful one-offs

```bash
# Reinstall from a clean slate
rm -rf node_modules dist
npm ci

# Audit production deps only
npm audit --omit=dev

# Inspect the resolved Tailwind theme
npx tailwindcss -i ./src/styles/globals.css -o /tmp/tw.css --minify=false

# See what's in a chunk
npx vite-bundle-visualizer
```

---

## 27. License

Proprietary — internal to the Blinkit cloud-native platform team.
