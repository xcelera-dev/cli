# xcelera CLI

A CLI for running Lighthouse performance audits using xcelera.dev

## Usage

### CLI Usage

```bash
# Basic audit
xcelera audit --ref https://example.com --token your-api-token
```

### Authenticated Pages

For pages behind login, you can pass authentication credentials:

```bash
# With session cookie
xcelera audit --ref myapp-com-dashboard --cookie "session=abc123"

# With bearer token header
xcelera audit --ref myapp-com-admin \
  --header "Authorization: Bearer eyJhbG..."

# Multiple cookies
xcelera audit --ref myapp-com-dashboard \
  --cookie "session=abc123" --cookie "csrf=xyz"

# With Netscape cookie file (cookies.txt)
xcelera audit --ref myapp-com-dashboard \
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
