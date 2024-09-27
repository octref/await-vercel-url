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

    const interval = parseInt(core.getInput('interval'), 10)
    const retries = parseInt(core.getInput('retries'), 10)
    const delay = parseInt(core.getInput('delay'), 10)
    if (isNaN(interval) || isNaN(retries) || isNaN(delay)) {
      core.setFailed('interval, retries and delay must be numbers')
    }

    const octokit = github.getOctokit(ghToken)

    const owner = github.context.repo.owner
    const repo = github.context.repo.repo

    // Determine SHA from PR or push
    let sha

    if (github.context.eventName === 'pull_request') {
      const prSha = github.context.payload.pull_request?.head?.sha
      if (!prSha) {
        core.setFailed('No pull request SHA found')
        return
      }

      sha = prSha
      core.info(
        `Using SHA from ${yellow('pull_request')} context: ${yellow(sha)}`
      )
    } else if (github.context.eventName === 'push') {
      sha = github.context.sha

      core.info(`Using SHA from ${yellow('push')} context: ${yellow(sha)}`)
    } else {
      core.setFailed('This action only supports push and pull_request events')
    }

    core.info(
      `Checking at ${yellow(interval.toString())} interval for ${yellow(retries.toString())} times`
    )
    if (delay > 0) {
      core.info(`Delaying for ${delay}s`)
      await wait(delay * 1000)
    }

    let targetDeployment
    let targetUrl

    for (let i = 0; i < retries; i++) {
      try {
        // Fetch deployment matching SHA
        if (!targetDeployment) {
          const deployments = await octokit.rest.repos.listDeployments({
            owner,
            repo,
            sha
          })

          core.debug(`Processing deployments:`)
          core.debug(JSON.stringify(deployments, null, 2))

          const deployment = deployments.data.find(d => {
            return d.creator?.login === VERCEL_ACTOR_NAME
          })

          if (deployment) {
            targetDeployment = deployment
            core.info(`Found deployment matching SHA`)
          } else {
            core.info(
              `No matching deployment found. Retrying in ${interval}s. (${i + 1} / ${retries})`
            )
          }
        }

        // Fetch deployment status and target URL
        if (targetDeployment) {
          const deploymentStatuses =
            await octokit.rest.repos.listDeploymentStatuses({
              owner,
              repo,
              deployment_id: targetDeployment.id
            })

          core.debug(`Processing deployment status:`)
          core.debug(JSON.stringify(deploymentStatuses, null, 2))

          const deploymentStatus = deploymentStatuses.data[0]

          if (deploymentStatus?.state === 'success') {
            targetUrl = deploymentStatus.target_url
            core.info(`Found target URL: ${yellow(targetUrl)}`)
            break
          } else {
            if (!deploymentStatus) {
              core.info(
                `No matching deployment status found. Retrying in ${interval}s. (${i + 1} / ${retries})`
              )
            } else {
              core.info(
                `Deployment status is ${deploymentStatus.state}. Retrying in ${interval}s. (${i + 1} / ${retries})`
              )
            }
          }
        }
      } catch (e: any) {
        core.info(
          `An error occurred. Retrying in ${interval}s. (${i + 1} / ${retries})`
        )
        core.error(e)
      }

      await wait(interval * 1000)
    }

    if (!targetDeployment) {
      core.setFailed('No deployment found')
      return
    }

    if (!targetUrl) {
      core.setFailed('No target URL found')
      return
    }

    core.setOutput('url', targetUrl)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

const COLOR_YELLOW = '\x1b[33m'
const COLOR_RESET = '\x1b[0m'
function yellow(text: string): string {
  return `${COLOR_YELLOW}${text}${COLOR_RESET}`
}
