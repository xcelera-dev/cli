# xcelera CLI

A CLI for running Lighthouse performance audits using xcelera.dev

## Usage

### GitHub Action Usage

```yaml
- name: Lighthouse Performance Audit
  uses: xcelera/cli@v1
  with:
    url: https://example.com
    token: ${{ secrets.XCELERA_TOKEN }}
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
