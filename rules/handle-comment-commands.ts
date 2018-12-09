
import { danger, warn } from 'danger';
import * as path from 'path'

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

  // 
  const number = danger.github.issue.number

  console.log(`grabing branch data for PR #${number}`)

  const [owner, repo] = danger.github.repository.full_name.split('/')

  const prData = await danger.github.api.pullRequests.get({
    owner,
    repo,
    number,
  })
  


  console.log(prData)
}


export default async () => {
  return shouldFormat()
};