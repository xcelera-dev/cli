# xcelera CLI

A CLI for running Lighthouse performance audits using xcelera.dev

## Usage

Commands are `xcelera <noun> <verb>`. Run `xcelera help` for the full list, or
`xcelera help audit run` for one command's options.

The token comes from `--token` or the `XCELERA_TOKEN` environment variable.
`XCELERA_API_URL` overrides the API host (default `https://xcelera.dev`).

### `audit run`

Starts an audit and exits as soon as it is scheduled. `--wait` blocks until the
audit finishes and prints its scores, Core Web Vitals and top opportunities —
exiting non-zero if the audit fails or the wait times out.

```bash
# Schedule an audit and return immediately
xcelera audit run --ref myapp-com-dashboard --token your-api-token

# Wait for the result (default timeout 600s)
xcelera audit run --ref myapp-com-dashboard --wait --timeout 900

# Machine-readable output for scripting
xcelera audit run --ref myapp-com-dashboard --wait --json
```

`xcelera audit` on its own defaults to `xcelera audit run`.

### `audit get`

Fetches an existing audit without starting anything. A bare `--ref` returns the
latest succeeded audit for that page.

```bash
xcelera audit get --ref myapp-com-dashboard
xcelera audit get --ref myapp-com-dashboard --pr 42
xcelera audit get --ref myapp-com-dashboard --git-hash a1b2c3d
xcelera audit get --audit-id ah7n75i5uxk6fce9wanzeq8d --json
```

### `page list`

Lists every tracked page with the scores of its latest audit. This is how you
find the refs the audit commands take.

`--csv` prints the same rows without the rating icons, for a spreadsheet.

```bash
xcelera page list
xcelera page list --json
xcelera page list --csv > pages.csv
```

### `page create`

Registers a page and prints its ref. Registration is an upsert: the same url and
device returns the page that already exists, so a deploy script can call it on
every run. An existing page keeps its own name, settings and schedule.

`--device` and `--region` default to your organization settings. Device is part
of a page's identity — the same url as mobile and desktop is two pages.

```bash
xcelera page create --url https://example.com
xcelera page create --url https://example.com --name Home --device desktop
```

### `page archive`

Archives a page so it is no longer audited or listed. The page and its history
are kept, but the CLI cannot unarchive it.

```bash
xcelera page archive --ref myapp-com-dashboard
```

Together the page and audit commands script a preview-environment loop:

```bash
ref=$(xcelera page create --url "$PREVIEW_URL" --json | jq -r .ref)
xcelera audit run --ref "$ref" --wait
xcelera page archive --ref "$ref"
```

### Errors

Every failure prints a stable `code` alongside the message and a hint:

```text
✗ Unable to fetch audit :(
 ↳ [page_not_found] No page found for ref "nope".
 ↳ Call list_pages to see valid refs.
```

Match on the code, never the message.

### Authenticated Pages

For pages behind login, you can pass authentication credentials:

```bash
# With session cookie
xcelera audit run --ref myapp-com-dashboard --cookie "session=abc123"

# With bearer token header
xcelera audit run --ref myapp-com-admin \
  --header "Authorization: Bearer eyJhbG..."

# Multiple cookies
xcelera audit run --ref myapp-com-dashboard \
  --cookie "session=abc123" --cookie "csrf=xyz"

# With Netscape cookie file (cookies.txt)
xcelera audit run --ref myapp-com-dashboard \
  --cookie-file ./cookies.txt

```

### GitHub Action Usage

```yaml
- name: Lighthouse Performance Audit
  uses: xcelera/cli@v1
  with:
    ref: myapp-com-dashboard
    token: ${{ secrets.XCELERA_TOKEN }}
```

To block the workflow on the result, set `wait`. The step fails if the audit
fails or does not finish inside `timeout` seconds, and the audit id is exposed
as the `auditId` output.

```yaml
- name: Lighthouse Performance Audit
  id: audit
  uses: xcelera/cli@v1
  with:
    ref: myapp-com-dashboard
    token: ${{ secrets.XCELERA_TOKEN }}
    wait: "true"
    timeout: "900"

- run: echo "Audited as ${{ steps.audit.outputs.auditId }}"
```

For authenticated pages in CI:

```yaml
# With session cookie
- name: Lighthouse Audit (Cookie Auth)
  uses: xcelera/cli@v1
  with:
    ref: myapp-com-dashboard
    token: ${{ secrets.XCELERA_TOKEN }}
    cookie: "session=value"

# With Netscape cookie file (cookies.txt)
- name: Lighthouse Audit (Cookie File Auth)
  uses: xcelera/cli@v1
  with:
    ref: myapp-com-dashboard
    token: ${{ secrets.XCELERA_TOKEN }}
    cookie-file: ./cookies.txt

# With bearer token header
- name: Lighthouse Audit (Bearer Auth)
  uses: xcelera/cli@v1
  with:
    ref: myapp-com-admin
    token: ${{ secrets.XCELERA_TOKEN }}
    header: "Authorization: Bearer eybDfd..."

# With full auth JSON (multiple cookies/headers)
- name: Lighthouse Audit (Full Auth)
  uses: xcelera/cli@v1
  with:
    ref: myapp-com-dashboard
    token: ${{ secrets.XCELERA_TOKEN }}
    auth: '{"cookies":[{"name":"session","value":"session_value"},{"name":"csrf","value":"csrf_value"}]}'
```

## Setup

### 1. Get Your API Token

1. Go to [Xcelera Settings](https://xcelera.dev/settings/api-tokens)
2. Create a new API token
3. Copy the token value

### 2. Add Token to GitHub Secrets

1. Go to your repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Create a new repository secret named `XCELERA_TOKEN`
4. Paste your API token as the value

## Development

GitHub Actions are pinned to specific commits. e.g.
`uses: super-linter/super-linter/slim@7bba2eeb89d01dc9bfd93c497477a57e72c83240 # v8.2.0`

To update the pinned versions, run the following command:

```bash
pinact run -u
```
