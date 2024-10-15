# 🔗 Await Vercel URL

GitHub Action to wait for the Vercel Preview URL.

Based on [patrickedqvist/wait-for-vercel-preview](https://github.com/patrickedqvist/wait-for-vercel-preview) and [actions/typescript-action](https://github.com/actions/typescript-action).

## Configuration

#### `gh_token`: **Required**

You can use [`${{ secrets.GITHUB_TOKEN }}`](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication).

#### `vercel_project_name`: Optional

The name of your Vercel project. Used to find the correct deployment when your repository is connected to multiple Vercel projects, which can trigger multiple deployments for a single event.

#### `interval`: Optional, defaults to `15`

How often (in seconds) to check if the preview URL is available.

#### `retries`: Optional, defaults to `20`

How many times to check if the preview URL is available before failing.

#### `delay`: Optional, defaults to `0`

How many seconds to wait before starting to check. This is useful for slow builds. For example, if your project build takes at least `2m30s`, set this value to `150` (seconds).

## Usage

```yaml
steps:
  - name: Wait for Vercel Preview URL
    uses: octref/await-vercel-url@v0.3.9
    id: waitForVercel
    with:
      gh_token: ${{ secrets.GITHUB_TOKEN }}
      vercel_project_name: 'web' # your Vercel project name
      interval: 15 # check every 15 seconds
      retries: 60 # perform 60 checks before failing
      delay: 150 # if your build takes at least 150 seconds to finish
```

## Features

- Support for monorepo setup with multiple Vercel projects  
- Support for both `push` and `pull_request` events  
- Informative and highlighted logs  
- Verbose logs including GitHub API responses when [`ACTIONS_STEP_DEBUG`](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/troubleshooting-workflows/enabling-debug-logging) secrets/variables is set to `true`


## Todo

- [ ] License
- [ ] Tests