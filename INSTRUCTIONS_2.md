# CAP Demo – Approuter, XSUAA a Frontendové aplikace (Display/Admin)

Tento návod navazuje na backendovou část (CAP + SQLite + MTA) a zaměřuje se **jen na tři oblasti**:

1. **XSUAA (xs-security.json)** – scopes, role-templates, role collections  
2. **Approuter** – přihlášení uživatele, routování, ochrana endpointů  
3. **Dvě frontendové appky (Display / Admin)** – statické UI, omezení přístupu podle rolí

Cílový stav:  
Uživatelé mají rozdílná oprávnění a podle nich vidí / nevidí části UI:

- `DisplayRole` → `/display/...`
- `AdminRole` → `/display/...` + `/admin/...`

---

## 1. Přidání XSUAA (autentizace + scopes/roles)

### 1.1 Generování XSUAA konfigurace

V rootu CAP projektu spusť:

```bash
cds add xsuaa --for production
```

Tento příkaz udělá dvě klíčové věci:

1. Přidá do projektu podporu pro XSUAA (zápis v `package.json`, konfigurace `cds`).  
2. Vygeneruje soubor **`xs-security.json`** – bezpečnostní deskriptor, kde definujeme *scopes* a *role-templates*.

> `xs-security.json` se použije při vytváření XSUAA služby v rámci MTA deploye.

---

### 1.2 Definice scopes a rolí v `xs-security.json`

Otevři soubor `xs-security.json` a uprav ho do podoby (příklad pro Display/Admin demo):

```json
{
  "xsappname": "cap-demo-${org}-${space}",
  "tenant-mode": "dedicated",
  "scopes": [
    {
      "name": "$XSAPPNAME.Display",
      "description": "Access to display UI and basic services"
    },
    {
      "name": "$XSAPPNAME.Admin",
      "description": "Access to admin UI and admin operations"
    }
  ],
  "role-templates": [
    {
      "name": "DisplayRole",
      "description": "Role for end users of display app",
      "scope-references": [
        "$XSAPPNAME.Display"
      ]
    },
    {
      "name": "AdminRole",
      "description": "Role for administrators (includes Display)",
      "scope-references": [
        "$XSAPPNAME.Display",
        "$XSAPPNAME.Admin"
      ]
    }
  ]
}
```

**Význam:**

- `xsappname` – základ pro generování názvu XSUAA instance (doplní se org/space).  
- `scopes` – jemnější oprávnění (např. „umí číst display app“).  
- `role-templates` – „balíčky“ scopes, které pak v BTP Cockpitu mapuješ do **Role Collections** a těm přiřazuješ uživatele.

Na školení:  
Ukážeš, že DisplayRole má **jen** Display scope, zatímco AdminRole má oba (Display + Admin).  

---

## 2. Přidání Approuteru

### 2.1 Generování approuteru

V rootu projektu spusť:

```bash
cds add approuter --for production
```

Příkaz vytvoří např. v `app/router`:

- `package.json` – Node.js metadata pro `@sap/approuter`  
- `xs-app.json` – routing konfigurace (upravíme)  
- `default-env.json` – lokální nastavení destinací (pro lokální testy; pro produkční MTA ho většinou z balíčku vyřadíme)

Zároveň aktualizuje `mta.yaml` – přidá **approuter modul** a napojí ho na XSUAA.

### 2.2 Instalace závislostí approuteru

```bash
npm install --prefix app/router
```

Tím se do `app/router/node_modules` nainstaluje `@sap/approuter` a další dépendence.

---

## 3. Dvě frontendové aplikace (Display / Admin)

Frontend na školení uděláme schválně „hloupý“ – čisté HTML uvnitř approuteru jako **statický obsah**. Stačí nám ukázat:

- rozdíl viditelnosti `/display` vs `/admin` podle scope  
- že approuter chrání statický obsah i backend endpointy

### 3.1 Struktura souborů pro frontend

Vytvoř adresáře a soubory:

```text
app/
  router/
    package.json
    xs-app.json
    resources/
      display/
        index.html
      admin/
        index.html
```

#### `app/router/resources/display/index.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Display App</title>
  </head>
  <body>
    <h1>Display UI</h1>
    <p>Vidí každý uživatel s rolí DisplayRole nebo AdminRole.</p>
    <ul>
      <li><a href="/display/index.html">Display app</a></li>
      <li><a href="/admin/index.html">Admin app</a></li>
      <li><a href="/srv/catalog/Books">CAP service – Books</a></li>
    </ul>
  </body>
</html>
```

#### `app/router/resources/admin/index.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Admin App</title>
  </head>
  <body>
    <h1>Admin UI</h1>
    <p>Vidí pouze uživatelé s rolí AdminRole (scope $XSAPPNAME.Admin).</p>
    <ul>
      <li><a href="/display/index.html">Zpět na Display app</a></li>
      <li><a href="/srv/catalog/Books">CAP service – Books</a></li>
    </ul>
  </body>
</html>
```

> V praxi bys sem dal Fiori/React/Vue – ale pro demo je statické HTML nejrychlejší a nejčitelnější.

---

## 4. Routing + scopes v `xs-app.json` (approuter)

Teď musíme approuteru říct:

- kde bere statické soubory (`localDir`)  
- kam routuje backend (`destination`)  
- jaká scopes jsou potřeba pro různé cesty

Otevři `app/router/xs-app.json` a uprav například takto:

```json
{
  "welcomeFile": "/display/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/display/(.*)$",
      "localDir": "resources",
      "target": "display/$1",
      "authenticationType": "xsuaa",
      "scope": [
        "$XSAPPNAME.Display",
        "$XSAPPNAME.Admin"
      ]
    },
    {
      "source": "^/admin/(.*)$",
      "localDir": "resources",
      "target": "admin/$1",
      "authenticationType": "xsuaa",
      "scope": [
        "$XSAPPNAME.Admin"
      ]
    },
    {
      "source": "^/srv/(.*)$",
      "target": "/$1",
      "destination": "srv-api",
      "authenticationType": "xsuaa",
      "scope": [
        "$XSAPPNAME.Display",
        "$XSAPPNAME.Admin"
      ]
    }
  ]
}
```

### Co tu je důležité

- `welcomeFile` – po otevření root URL approuteru (`/`) se zobrazí `display/index.html`.  
- `authenticationMethod: "route"` – každá route sama říká, zda a jak chránit přístup.  
- `localDir: "resources"` – statický obsah leží v `app/router/resources`.  
- `target: "display/$1"` / `target: "admin/$1"` – přemapování URL `^/display/(.*)$` → `resources/display/$1`.  
- `authenticationType: "xsuaa"` – route je chráněná XSUAA (uživatel se musí přihlásit).  
- `scope: [...]` – seznam scopes, z nichž alespoň jedna musí být v JWT tokenu, jinak dostane 403.

Na školení ukážeš:

- Uživatel s DisplayRole:  
  - `/display/index.html` → OK  
  - `/admin/index.html` → 403 (nemá Admin scope)  
- Uživatel s AdminRole:  
  - `/display/index.html` → OK  
  - `/admin/index.html` → OK  

---

## 5. Zapojení do MTA (srv modul, approuter modul, XSUAA resource)

### 5.1 Srv modul (CAP + SQLite)

V `mta.yaml` by pro backend modul mělo být něco jako:

```yaml
modules:
  - name: cap-demo-srv
    type: nodejs
    path: .
    parameters:
      instances: 1
      buildpack: nodejs_buildpack
    build-parameters:
      builder: npm-ci
    requires:
      - name: cap-demo-auth        # XSUAA služba (binding)
    provides:
      - name: srv-api              # poskytuje srv-url pro approuter
        properties:
          srv-url: ${default-url}
```

### 5.2 Approuter modul

Approuter modul v `mta.yaml`:

```yaml
  - name: cap-demo-approuter
    type: approuter.nodejs
    path: app/router
    parameters:
      keep-existing-routes: true
      disk-quota: 256M
      memory: 256M
    build-parameters:
      builder: npm-ci
    requires:
      - name: cap-demo-auth        # binding na XSUAA
      - name: srv-api              # destination na CAP service
        group: destinations
        properties:
          name: srv-api
          url: ~{srv-url}
          forwardAuthToken: true
```

**Vysvětlení:**

- `type: approuter.nodejs` – speciální typ modulu pro `@sap/approuter`.  
- `requires: cap-demo-auth` – approuter má binding na XSUAA službu (přihlášení uživatele).  
- `requires: srv-api` – přebírá `srv-url` z backend modulu → vytváří destination `srv-api`, kterou používáme v `xs-app.json` (`"destination": "srv-api"`).  
- `forwardAuthToken: true` – JWT token je předán dál do backendu; CAP pak umí vynucovat role v CDS anotacích.

### 5.3 XSUAA resource

V `mta.yaml` máš XSUAA resource:

```yaml
resources:
  - name: cap-demo-auth
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json
      config:
        xsappname: cap-demo-${org}-${space}
        tenant-mode: dedicated
```

**Vysvětlení:**

- `service: xsuaa` – typ služby v CF marketplace.  
- `service-plan: application` – běžný plán pro aplikační XSUAA.  
- `path: ./xs-security.json` – konfigurace bezpečnosti (scopes, role-templates).  
- `xsappname` – přebíjí hodnotu z `xs-security.json`, často se používá `${org}-${space}` pro unikátnost.

---

## 6. Build + deploy

Předpokládáme, že už máš v `build-parameters.before-all` generování SQLite DB z backendového návodu, například:

```yaml
build-parameters:
  before-all:
    - builder: custom
      commands:
        - npm ci
        - npx cds deploy --to sqlite:db/demo.db
```

### 6.1 Build MTA

```bash
mbt build
```

- Vytvoří `.mtar` (např. `mta_archives/cap-demo_1.0.0.mtar`)
- Obsahuje backend, approuter, XSUAA deskriptor a SQLite DB (`db/demo.db`).

### 6.2 Deploy na Cloud Foundry

```bash
cf login
cf target              # ověř org/space
cf deploy mta_archives/cap-demo_1.0.0.mtar
```

Deployment:

- vytvoří XSUAA instanci podle `xs-security.json`
- vytvoří a spustí `cap-demo-srv` (CAP backend)  
- vytvoří a spustí `cap-demo-approuter` (UI + gateway)  

Po dokončení získáš URL approuteru, např.:

```text
https://cap-demo-approuter-<hash>.<domain>
```

Otevři ji v prohlížeči – přesměruje tě na login a pak na `/display/index.html`.

---

## 7. Přiřazení rolí v BTP Cockpitu

Aby demo dávalo smysl, musíš přidělit role:

1. V BTP Cockpitu otevři svůj subaccount.  
2. V menu **Security → Roles** uvidíš role templates `DisplayRole` a `AdminRole`.  
3. V **Security → Role Collections** vytvoř např.:
   - `cap-demo-display-rc` → přidej `DisplayRole`  
   - `cap-demo-admin-rc` → přidej `AdminRole`  
4. V **Security → Users** přiřaď:
   - sobě `cap-demo-admin-rc`  
   - testovacímu uživateli `cap-demo-display-rc`

Nyní:

- Uživatel s `cap-demo-display-rc` → vidí `/display`, ale ne `/admin`.  
- Uživatel s `cap-demo-admin-rc` → vidí `/display` i `/admin`.

To je ideální moment na školení ukázat flow: login → JWT → scopes → approuter → CAP.

---

## 8. Shrnutí – rychlý „cheat-sheet“

1. **XSUAA**  
   - `cds add xsuaa`  
   - Upravit `xs-security.json` (Display & Admin scopes + role-templates).  

2. **Approuter**  
   - `cds add approuter`  
   - `npm install app/router`  

3. **Frontend**  
   - `app/router/resources/display/index.html`  
   - `app/router/resources/admin/index.html`  

4. **Routing (`xs-app.json`)**  
   - `/display` → scope `$XSAPPNAME.Display` nebo `$XSAPPNAME.Admin`  
   - `/admin` → scope `$XSAPPNAME.Admin`  
   - `/srv/...` → destination `srv-api`, scopes Display/Admin  

5. **MTA (`mta.yaml`)**  
   - Modul `cap-demo-srv` (backend, provides `srv-api`)  
   - Modul `cap-demo-approuter` (requires `srv-api` + `cap-demo-auth`)  
   - Resource `cap-demo-auth` (xsuaa + xs-security.json)  

6. **Build & deploy**  
   - `mbt build`  
   - `cf deploy ...mtar`  
   - Role collections + přiřazení uživatelům v BTP Cockpitu

Tím máš kompletní demo, které ukazuje **full stack**: CAP backend, approuter, dvě frontendové appky a řízení přístupu přes XSUAA scopes a role.
