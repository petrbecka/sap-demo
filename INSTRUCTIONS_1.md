# CAP Demo on SAP BTP Trial (Cloud Foundry) without External DB  
**Tech stack:** Node.js CAP, SQLite, CSV mock data, MTA, Cloud Foundry

This guide shows how to build and deploy a CAP application to SAP BTP Cloud Foundry on a **trial** account **without PostgreSQL/HANA**, using only **SQLite** and **CSV seed data**. It’s tailored for training / demo scenarios.

---

## 1. Goal

At the end you will have:

- A **CAP (Cloud Application Programming Model)** service (Node.js)
- Using **SQLite file** as the database (`db/demo.db`)
- Data loaded from **CSV files** in `db/data`
- Application packaged as an **MTA (`.mtar`)**
- Application deployed to **SAP BTP Cloud Foundry (trial)**
- No external DB service (no HANA, no PostgreSQL)

This fits within the limitations of a BTP trial (no PostgreSQL entitlements, small quotas).

---

## 2. Prerequisites

### 2.1 Local / BAS environment

Make sure you have:

```bash
node -v           # ideally LTS (e.g. 18+)
npm -v
cf --version
```

Install CAP tooling and MTA build tool globally:

```bash
npm install -g @sap/cds-dk mbt
```

You can run these either:

- locally on your machine, or  
- in the **SAP Business Application Studio** terminal (in a Full Stack / CAP dev space).

### 2.2 BTP / Cloud Foundry

You need:

- a **BTP subaccount** with **Cloud Foundry** enabled  
- an **org** and **space**  
- a **trial** plan is OK, we DO NOT need any DB entitlements

Check target from CLI:

```bash
cf login              # log in to your trial
cf target             # check org / space
```

We will not create any CF DB services (no `postgresql-db`, no `hana`).

---

## 3. Create a CAP Project (CLI only)

In an empty folder:

```bash
mkdir cap-demo
cd cap-demo

cds init . --add mta
```

### What happens

- `cds init .` creates a basic CAP project structure:
  - `db/` – data model
  - `srv/` – service definitions
  - `app/` – (optional) UI modules
  - `package.json` – Node project metadata
- `--add mta` adds a basic **`mta.yaml`** descriptor so we can build an MTA later.

At this point you have a generic CAP project with MTA support, but no DB configured yet.

---

## 4. Configure SQLite as Database

We use `@cap-js/sqlite` as database adapter and a simple file `db/demo.db` to store data.

### 4.1 Install SQLite adapter

```bash
npm add @cap-js/sqlite
```

This adds the SQLite adapter as a dependency.

### 4.2 Configure CAP to use SQLite (file-based)

Open `package.json` and add (or adjust) the `cds.requires.db` section so it looks roughly like this:

```jsonc
{
  "dependencies": {
    "@sap/cds": "...",
    "@cap-js/sqlite": "..."
  },
  "cds": {
    "requires": {
      "db": {
        "kind": "sqlite",
        "credentials": {
          "url": "db/demo.db"
        }
      }
    }
  }
}
```

**What this means**

- `kind: "sqlite"` tells CAP to use the SQLite adapter.
- `credentials.url: "db/demo.db"` tells CAP to use a file `db/demo.db` (created on deploy).

No HANA / PostgreSQL configuration is needed.

---

## 5. Define Data Model and Service

### 5.1 Data model in `db/schema.cds`

Create or edit `db/schema.cds`:

```cds
namespace my.bookshop;

entity Books {
  key ID   : UUID;
      title: String(111);
      stock: Integer;
}
```

This defines one entity `Books` under the namespace `my.bookshop`.

### 5.2 Service in `srv/service.cds`

Create or edit `srv/service.cds`:

```cds
using my.bookshop as my from '../db/schema';

service CatalogService {
  entity Books as projection on my.Books;
}
```

This exposes `Books` via a service `CatalogService`, which will later be available at e.g. `/catalog/Books` when the app is running.

---

## 6. Add CSV Mock Data

CAP can automatically load CSV data if you follow naming conventions.

### 6.1 Create data folder and CSV file

Create file: `db/data/my.bookshop-Books.csv`

Example content:

```csv
ID;title;stock
1;Wuthering Heights;12
2;Jane Eyre;11
3;The Raven;333
```

Notes:

- File name pattern: `<namespace>-<Entity>.csv`
  - Namespace: `my.bookshop`
  - Entity: `Books`
  - File name: `my.bookshop-Books.csv`
- Separator can be `;` or `,` (configure if needed; `;` works well with European locales).

### 6.2 Local test: create SQLite DB and load CSV

Run:

```bash
npm install             # if you haven’t run it yet
cds deploy --to sqlite:db/demo.db
```

What happens:

- CAP creates `db/demo.db` SQLite file.
- Generates DB schema based on CDS model.
- Loads CSV data from `db/data/*.csv` into the corresponding tables.

You can verify the configuration with:

```bash
cds env requires.db
```

It should show something like:

```js
{
  impl: '@cap-js/sqlite',
  kind: 'sqlite',
  credentials: { url: 'db/demo.db' }
}
```

### 6.3 Optional: run locally

```bash
cds watch
```

- Starts the CAP server with live reload.
- Visit the printed URL, e.g. `http://localhost:4004/catalog/Books` to see sample data.

---

## 7. Simplify `mta.yaml` for SQLite-only Cloud Foundry Deploy

We now create a very simple MTA that:

- has a single Node.js module (the CAP app)
- uses **no external DB services**
- during build, creates the SQLite database (`db/demo.db`) so it is packaged inside the `.mtar`.

### 7.1 Example `mta.yaml`

Replace your `mta.yaml` with the following (adapt IDs/names if needed):

```yaml
_schema-version: 3.3.0
ID: cap-demo
version: 1.0.0
description: "A simple CAP project."
parameters:
  enable-parallel-deployments: true

build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm ci
        - npx cds deploy --to sqlite:db/demo.db

modules:
  - name: cap-demo-srv
    type: nodejs
    path: .
    parameters:
      instances: 1
      buildpack: nodejs_buildpack
    build-parameters:
      builder: npm-ci
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}
```

### Explanation

- **`before-all`**  
  - `npm ci` installs dependencies in a deterministic way.  
  - `npx cds deploy --to sqlite:db/demo.db` creates / updates `db/demo.db` and loads CSV data.  
  - The resulting `db/demo.db` file is included in the `.mtar`.

- **`modules` → `cap-demo-srv`**  
  - Single Node.js module, running from `path: .` (project root).  
  - Uses `nodejs_buildpack`.  
  - Provides service URL via `srv-url` (used by approuter or other consumers).  
  - **No `requires` section for DB**: there is no CF DB service; we use local SQLite file only.

- **No `resources` section**  
  - We do NOT define any CF managed services (no HANA, no PostgreSQL).  
  - This avoids trial entitlement issues.

---

## 8. Build the MTA

From the project root:

```bash
mbt build
```

What happens:

- Cloud MTA Build Tool reads `mta.yaml`.
- Executes `before-all` (installs deps, deploys to SQLite → `db/demo.db`).  
- Packages the app into `mta_archives/cap-demo_1.0.0.mtar` (name depends on `ID` and `version`).

You can inspect the `.mtar` (it’s just a zip archive) to see that `db/demo.db` is included.

---

## 9. Deploy to Cloud Foundry (Trial)

### 9.1 Login and target

```bash
cf login
cf target            # ensure correct org / space
```

### 9.2 Deploy the MTA

```bash
cf deploy mta_archives/cap-demo_1.0.0.mtar
```

During deploy:

- A new app `cap-demo-srv` is created (or updated if already deployed).
- No services are created (no DB).  
- A route is created and attached to the app (unless you change that behavior).

After success, list apps:

```bash
cf apps
```

You should see `cap-demo-srv` with a state `started` and a route like:

```text
cap-demo-srv  started  1/1  256M  ...  cap-demo-srv-<hash>.<domain>
```

Open the route in browser and navigate to `/catalog/Books` to see the CSV data coming from SQLite in Cloud Foundry.

---

## 10. Summary / Checklist

**Local setup**

- [ ] `cds init . --add mta`
- [ ] `npm add @cap-js/sqlite`
- [ ] `package.json` → `cds.requires.db.kind = "sqlite"`, `url = "db/demo.db"`
- [ ] `db/schema.cds` with entities
- [ ] `srv/service.cds` exposing entities via service
- [ ] `db/data/<namespace>-<Entity>.csv` with mock data
- [ ] `cds deploy --to sqlite:db/demo.db` (local test)

**MTA**

- [ ] `mta.yaml` with single `cap-demo-srv` module and `path: .`
- [ ] `build-parameters.before-all` executing `npm ci` and `npx cds deploy --to sqlite:db/demo.db`
- [ ] No `resources` section (no external DB services)

**Build & deploy**

- [ ] `mbt build` → creates `.mtar`
- [ ] `cf login`, `cf target`
- [ ] Cleanup old routes/apps if route quota exceeded
- [ ] `cf deploy mta_archives/cap-demo_1.0.0.mtar`
- [ ] Open app route → `/catalog/Books`

This gives you a **clean, repeatable demo** of CAP on BTP trial, based on **SQLite + CSV + MTA**, bez závislosti na HANA nebo PostgreSQL a bez problémů s trial entitlements.
