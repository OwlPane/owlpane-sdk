/** Reads the CI system's own variables so pipeline spans carry repo, branch and commit without flags. */
export function detectCi(env = process.env) {
  if (env.GITHUB_ACTIONS === 'true') {
    return {
      system: 'github-actions',
      repo: `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY}`,
      branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || '',
      sha: env.GITHUB_SHA || '',
      runId: env.GITHUB_RUN_ID || '',
      pipeline: env.GITHUB_WORKFLOW || '',
    }
  }
  if (env.GITLAB_CI === 'true') {
    return { system: 'gitlab-ci', repo: env.CI_PROJECT_URL || '', branch: env.CI_COMMIT_REF_NAME || '', sha: env.CI_COMMIT_SHA || '', runId: env.CI_PIPELINE_ID || '', pipeline: env.CI_PROJECT_NAME || '' }
  }
  if (env.CIRCLECI === 'true') {
    return { system: 'circleci', repo: env.CIRCLE_REPOSITORY_URL || '', branch: env.CIRCLE_BRANCH || '', sha: env.CIRCLE_SHA1 || '', runId: env.CIRCLE_WORKFLOW_ID || '', pipeline: env.CIRCLE_JOB || '' }
  }
  if (env.BUILDKITE === 'true') {
    return { system: 'buildkite', repo: env.BUILDKITE_REPO || '', branch: env.BUILDKITE_BRANCH || '', sha: env.BUILDKITE_COMMIT || '', runId: env.BUILDKITE_BUILD_ID || '', pipeline: env.BUILDKITE_PIPELINE_SLUG || '' }
  }
  if (env.JENKINS_URL) {
    return { system: 'jenkins', repo: env.GIT_URL || '', branch: env.GIT_BRANCH || '', sha: env.GIT_COMMIT || '', runId: env.BUILD_ID || '', pipeline: env.JOB_NAME || '' }
  }
  return { system: 'local', repo: '', branch: '', sha: '', runId: String(Date.now()), pipeline: '' }
}
