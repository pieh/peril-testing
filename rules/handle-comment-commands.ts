
import { danger, warn } from 'danger';
import * as path from 'path'

type FileData = {
  filename: string,
  status: string,
}

type getFilesReponse = {
  data: FileData[]
}

type BranchInfo = {
  repo: string,
  owner: string,
  ref: string,
}

type PRInfo = {
  base: BranchInfo,
  head: BranchInfo,
  files: string[],
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

const getPRInfo = async (number: Number): Promise<PRInfo> => {
  console.log(`grabing branch data for PR #${number}`)

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

const memoizedConfigs = new Map()

const eslintFormat = (filename: string) => {
  console.log('eslint formatting', filename)
}

const prettierFormat = (filename: string) => {
  console.log('prettier formatting', filename)
}

const extToFormatter: { [index:string] : Function } = {
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

  // Grab branches information and list of files in PR
  const PRInfo = await getPRInfo(danger.github.issue.number)

  // Assign formatters (based on file extension) and filter out files that
  // aren't linted/formatted
  const fileTasks = PRInfo.files.map(filename => {
    return {
      filename,
      formatter: extToFormatter[path.extname(filename)]
    }
  }).filter(tasks => tasks.formatter)

  // Format files
  const formatResults = await Promise.all(fileTasks.map(async task => {
    return await task.formatter(task.filename)
  }))



  console.log(PRInfo)
}


export default async () => {
  return shouldFormat()
};