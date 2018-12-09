
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
  const prNumber = danger.github.issue.number

  console.log(`grabing branch data for PR #${prNumber}`)

  


  console.log(danger.github)
}


export default async () => {
  return shouldFormat()
};