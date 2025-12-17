# xcelera CLI

A CLI for running Lighthouse performance audits using xcelera.dev

## Usage

### CLI Usage

```bash
# Basic audit
xcelera audit --url https://example.com --token your-api-token
```

### Authenticated Pages

For pages behind login, you can pass authentication credentials:

```bash
# With session cookie
xcelera audit --url https://myapp.com/dashboard --cookie "session=abc123"

# With bearer token header
xcelera audit --url https://api.myapp.com/admin \
  --header "Authorization: Bearer eyJhbG..."

# Multiple cookies
xcelera audit --url https://myapp.com/dashboard \
  --cookie "session=abc123" --cookie "csrf=xyz"

# Full auth JSON (multiple cookies and custom headers)
xcelera audit --url https://myapp.com/dashboard \
  --auth '{"cookies":[{"name":"session","value":"abc123"}],"headers":{"X-Custom":"value"}}'

# Using environment variable
export XCELERA_AUTH='{"cookies":[{"name":"session","value":"abc123"}]}'
xcelera audit --url https://myapp.com/dashboard
```

### GitHub Action Usage

```yaml
- name: Lighthouse Performance Audit
  uses: xcelera/cli@v1
  with:
    url: https://example.com
    token: ${{ secrets.XCELERA_TOKEN }}
```

For authenticated pages in CI:

```yaml
# With session cookie
- name: Lighthouse Audit (Cookie Auth)
  uses: xcelera/cli@v1
  with:
    url: https://example.com/dashboard
    token: ${{ secrets.XCELERA_TOKEN }}
    cookie: "session=value"

# With bearer token header
- name: Lighthouse Audit (Bearer Auth)
  uses: xcelera/cli@v1
  with:
    url: https://example.com/admin
    token: ${{ secrets.XCELERA_TOKEN }}
    header: "Authorization: Bearer eybDfd..."

# With full auth JSON (multiple cookies/headers)
- name: Lighthouse Audit (Full Auth)
  uses: xcelera/cli@v1
  with:
    url: https://example.com/dashboard
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
