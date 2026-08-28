# KEFE Visualiser

**KEFE Visualiser** is a browser-based lyric video visualiser for creating animated, music-synchronised lyric visuals.

Create lyric videos with modular visual effects, custom backgrounds, typography, and export tools — all from the KEFE Visualiser interface.

**Live application:**
https://tezzaaaaaa.github.io/Kefe/

---

## Features

### Lyric visualisation

KEFE Visualiser uses independent effect modules to render animated lyrics.

Current production effects include:

* **Brat** — Brat-inspired typography treatment
* **Eternal Sunshine** — handwritten-style lyric treatment
* **Aurora** — marker and colour treatment
* **Typewriter** — character-by-character lyric reveal
* **Instagram Lyrics** — Instagram Stories Music-inspired lyric treatment
* **Story Fade** — fade-up lyric treatment

The effects system is modular, allowing individual renderers to be maintained independently while sharing common timing, typography, and drawing utilities.

### Visual customisation

The application includes support for:

* Lyric typography
* Background presets
* Effect-specific controls
* Responsive visual layouts
* Custom visual treatments
* Bricolage Grotesque typography
* KEFE branding and visual assets

### Image enhancement

KEFE also includes an integrated image-enhancement interface for preparing visual assets used within the application.

### Video export

The project contains a dedicated export system for encoding and generating video output, including:

* Export UI
* Video encoding
* FFmpeg worker support
* Audio/video processing

### Membership system

The project includes a server-side membership architecture with support for:

* User authentication
* Membership tiers
* Entitlements
* Billing
* Stripe integration
* SQLite database storage
* JWT authentication
* Secure password hashing

---

## Technology

### Frontend

* HTML
* CSS
* JavaScript
* Canvas-based visual effects
* Modular effect registry
* Web Workers for processing/export tasks

### Backend

* Node.js
* Express
* SQLite
* `better-sqlite3`
* JWT
* `bcryptjs`
* Stripe
* `cookie-parser`
* `dotenv`

Node.js **18 or newer** is required.

---

## Project structure

```text
Kefe/
├── index.html
├── app.js
├── styles.css
├── typography.css
├── typography.js
├── ui-polish.css
├── design-refresh.css
├── auth-ui.css
├── auth-ui.js
├── background-presets.js
├── background-presets.css
├── preview-layout.css
├── kefe-logo.svg
│
├── effects/
│   ├── aurora.js
│   ├── brat.js
│   ├── core.js
│   ├── eternal-sunshine.js
│   ├── instagram-lyrics.js
│   ├── story-fade.js
│   ├── typewriter.js
│   ├── effect-app-fx.js
│   ├── effect-selector.css
│   ├── presets.json
│   ├── effect-app-public-catalog.json
│   └── README.md / EFFECT-APP-IMPLEMENTATION.md
│
├── export/
│   ├── index.js
│   ├── encoder.js
│   ├── ffmpeg-worker.js
│   └── ui.js
│
├── server/
│   ├── index.js
│   ├── auth.js
│   ├── billing.js
│   ├── db.js
│   └── entitlements.js
│
├── fonts/
│   ├── archivo-narrow/
│   ├── bricolage-grotesque/
│   ├── courier-prime/
│   ├── homemade-apple/
│   ├── inter-tight/
│   ├── momo-trust-display/
│   └── open-sans/
│
├── vendor/ffmpeg/worker.js
│
├── image-enhancer.html
├── image-enhancer.js
├── image-enhancer.css
│
├── .env.example
├── package.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── DEPLOY.md
├── EFFECT_TYPOGRAPHY.md
└── THIRD-PARTY-LICENSES.md
```

---

## Running KEFE Visualiser locally

Clone the repository:

```bash
git clone git@github.com:Tezzaaaaaa/Kefe.git
cd Kefe
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

The development server is provided by:

```text
server/index.js
```

The project also provides the `npm run dev` script, which currently starts the same server.

---

## Environment configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the required environment variables in `.env` before using server-side authentication and billing functionality.

**Never commit real secrets, API keys, Stripe keys, database credentials, or other private credentials to Git.**

---

## Deployment

The frontend is designed to work with static hosting such as GitHub Pages.

The repository currently has GitHub Pages enabled with the application published at:

https://tezzaaaaaa.github.io/Kefe/

The Node.js backend is separate from static GitHub Pages hosting and must be deployed to a server/runtime capable of running Node.js.

See [`DEPLOY.md`](DEPLOY.md) for deployment information.

---

## Effects architecture

KEFE's production lyric effects are maintained as independent modules.

Each renderer follows the shared application contract:

```text
(ctx, width, height, style, lines, time)
```

The effects register through the KEFE effect registry, allowing the main application to dispatch effects without embedding every renderer directly into the application.

Shared functionality is maintained in:

```text
effects/core.js
```

Effect registration and dispatch are handled by the effect registry.

Preset definitions are maintained through the project's preset files.

More detailed information is available in:

* [`effects/README.md`](effects/README.md)
* [`effects/EFFECT-APP-IMPLEMENTATION.md`](effects/EFFECT-APP-IMPLEMENTATION.md)
* [`EFFECT_TYPOGRAPHY.md`](EFFECT_TYPOGRAPHY.md)

---

## Typography

KEFE includes **Bricolage Grotesque** — the production face for the Aurora
effect — as part of its visual typography system.

Font files and licensing information are included in:

```text
fonts/bricolage-grotesque/
```

See [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) and the included font licence files for licensing information.

---

## Development documentation

Additional project documentation is available in the repository:

| Document                                                   | Purpose                           |
| ---------------------------------------------------------- | --------------------------------- |
| [`CHANGELOG.md`](CHANGELOG.md)                             | Project changes and updates       |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                       | Contribution guidance             |
| [`DEPLOY.md`](DEPLOY.md)                                   | Deployment information            |
| [`DESIGN-SYSTEM-CHECKLIST.md`](DESIGN-SYSTEM-CHECKLIST.md) | Design-system checks              |
| [`EFFECT_TYPOGRAPHY.md`](EFFECT_TYPOGRAPHY.md)             | Effect typography guidance        |
| [`effects/README.md`](effects/README.md)                   | Effect-system documentation       |
| [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md)       | Third-party licensing information |

---

## Project status

KEFE Visualiser is an actively developed project.

The `main` branch contains the current production codebase.

---

## Licence

The repository includes third-party assets and libraries with their respective licences.

Refer to [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md) and the licence files distributed with individual assets for licensing details.

