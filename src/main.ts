import * as core from '@actions/core'
import * as github from '@actions/github'
import { wait } from './wait'

const VERCEL_ACTOR_NAME = 'vercel[bot]'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ghToken = core.getInput('gh_token', {
      required: true
    })
    if (!ghToken) {
      core.setFailed('gh_token is required')
    }

    const interval = Number(core.getInput('interval'))
    const retries = Number(core.getInput('retries'))

    const octokit = github.getOctokit(ghToken)

    const owner = github.context.repo.owner
    const repo = github.context.repo.repo

    // Determine SHA from push or PR
    let sha

    if (github.context.sha) {
      sha = github.context.sha

      core.info(`Using SHA from context: ${sha}`)
    } else if (github.context.payload && github.context.payload.pull_request) {
      const pull_number = github.context.payload.pull_request.number
      if (!pull_number) {
        core.setFailed('No pull request number was found')
        return
      }

      const currentPR = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number
      })

      sha = currentPR.data.head.sha

      core.info(`Using SHA from PR context: ${sha}`)
    } else {
      core.setFailed('No SHA found on context')
    }

    // Fetch deployment matching SHA
    let targetDeployment

    for (let i = 0; i < retries; i++) {
      try {
        const deployments = await octokit.rest.repos.listDeployments({
          owner,
          repo,
          sha
        })

        const deployment =
          deployments.data.length > 0 &&
          deployments.data.find(d => {
            return d.creator?.login === VERCEL_ACTOR_NAME
          })

        if (deployment) {
          targetDeployment = deployment
          break
        } else {
          core.info(
            `Could not find deployment matching SHA. Retrying. (${i + 1} / ${retries})`
          )
        }
      } catch (e: any) {
        core.info(
          `Could not find deployment matching SHA. Retrying. (${i + 1} / ${retries})`
        )

        core.error(e)
      }

      await wait(interval * 1000)
    }

    if (!targetDeployment) {
      core.setFailed('No deployment found')
      return
    } else {
      core.info(
        `Found deployment matching SHA:\n${JSON.stringify(targetDeployment, null, 2)}`
      )
    }

    // Wait for the target URL
    let targetUrl

    for (let i = 0; i < retries; i++) {
      try {
        const deploymentStatuses =
          await octokit.rest.repos.listDeploymentStatuses({
            owner,
            repo,
            deployment_id: targetDeployment.id
          })

        const deploymentStatus = deploymentStatuses.data[0]

        if (deploymentStatus && deploymentStatus.state === 'success') {
          targetUrl = deploymentStatus.target_url
          break
        } else {
          core.info(
            `Could not find deployment status. Retrying. (${i + 1} / ${retries})`
          )
        }
      } catch (e: any) {
        core.info(
          `Could not find deployment status. Retrying. (${i + 1} / ${retries})`
        )
        core.error(e)
      }

      await wait(interval * 1000)
    }

    if (!targetUrl) {
      core.setFailed('No target URL found')
      return
    } else {
      core.info(`Found target URL: ${targetUrl}`)
    }

    core.setOutput('url', targetUrl)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
