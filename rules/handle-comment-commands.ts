
import { danger, warn } from 'danger';
import * as path from 'path'

type FileData = {
  filename: string,
  status: string,
}

type getFilesReponse = {
  data: FileData[]
}

const getBranchInfo = (responseFragment: any) => {
  const [repo, owner] = responseFragment.repo.full_name.split('/')
  return {
    repo,
    owner,
    ref: responseFragment.ref
  }
}

const getBaseOwnerAndRepo = () => {
  const [owner, repo] = danger.github.repository.full_name.split('/')
  return {
    owner,
    repo
  }
}

const getPRInfo = async (number: Number) => {
  console.log(`grabing branch data for PR #${number}`)

  // const [mainOwner, repo] = danger.github.repository.full_name.split('/')
  const prData = await danger.github.api.pullRequests.get({
    ...getBaseOwnerAndRepo(),
    number,
  })
  
  const filesData: getFilesReponse = await danger.github.api.pullRequests.getFiles({
    ...getBaseOwnerAndRepo(),
    number,
  })

  return {
    base: getBranchInfo(prData.data.base),
    head: getBranchInfo(prData.data.head),
    files: filesData.data.filter(fileData => fileData.status !== `removed`).map(fileData => fileData.filename)
  }
}

const eslintFormat = () => {}
const prettierFormat = () => {}

const extToFormatter = {
  ".js": eslintFormat,
  ".md": prettierFormat,
}

export const shouldFormat = async () => {
  if (!danger.github.issue.pull_request) {
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