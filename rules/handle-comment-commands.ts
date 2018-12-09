
import { danger, warn } from 'danger';
import * as path from 'path'

const getBranchInformation = (responseFragment: any) => {
  const [repo, owner] = responseFragment.repo.full_name.split('/')
  return {
    repo,
    owner,
    ref: responseFragment.ref
  }
}

const getPRInfo = async (number: Number) => {
  console.log(`grabing branch data for PR #${number}`)

  const [mainOwner, repo] = danger.github.repository.full_name.split('/')
  const prData = await danger.github.api.pullRequests.get({
    owner: mainOwner,
    repo,
    number,
  })

  const filesData = await danger.github.api.pullRequests.getFiles({
    owner: mainOwner,
    repo,
    number,
  })

  console.log('files', filesData)

  return {
    base: getBranchInformation(prData.data.base),
    head: getBranchInformation(prData.data.head)
  }
}

export const shouldFormat = async () => {
  if (!danger.github.issue.pull_request) {
    // this is issue, not PR
    console.log(`NOT PR`)
    return
  }

  if (!danger.github.comment.body.includes(`format`)) {
    console.log(`comment doesn't include "format"`)
    return
  }

  const PRInfo = await getPRInfo(danger.github.issue.number)

  console.log(PRInfo)
}


export default async () => {
  return shouldFormat()
};