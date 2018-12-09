
import { danger, warn } from 'danger';
import * as path from 'path'
import { CLIEngine } from 'eslint'

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
  const [owner, repo] = responseFragment.repo.full_name.split('/')
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

// let elintConfig = null
// let prettierConfig = null

// const configs = new Map()

// const getConfig = async (configFileName:string) => {
//   if (configs.has(configFileName)) {
//     return configs.get(configFileName)
//   }

//   danger.github.api.repos.getContent()
// }

// const eslintFormat = async (filename: string) => {
//   console.log('eslint formatting', filename)

//   const { ...esconfig } = JSON.parse(
//     fs.readFileSync(`./wat-eslintrc`, { encoding: `utf-8` })
//   )
//   const prettierconfig = JSON.parse(
//     fs.readFileSync(`./wat-prettierrc`, { encoding: `utf-8` })
//   )

//   esconfig.rules[`prettier/prettier`] = [`error`, prettierconfig]

//   var cli = new CLIEngine({
//     baseConfig: esconfig,
//     fix: true,
//   })

//   const fileName = `foo.js`
//   const text = fs.readFileSync(fileName, { encoding: `utf-8` })
//   const report = cli.executeOnText(text, `fileName`)
//   console.log(report.results[0])
// }

const prettierFormat = (filename: string) => {
  console.log('prettier formatting', filename)
}

const getEslintFormatter = PRInfo => {

}

const grabFileContent = async (branch: BranchInfo, path: string) => {
  const args  ={
    ...branch,
    path,
  }

  const response = await danger.github.api.repos.getContent(args)
  const buffer = Buffer.from(response.data.content, response.data.encoding)
  const content = buffer.toString()

  return content
} 

const configureFormatter = async (prInfo: PRInfo) => {
  const eslintConfig = JSON.parse(await grabFileContent(prInfo.base, `.eslintrc.json`))
  const prettierConfig = JSON.parse(await grabFileContent(prInfo.base, `.prettierrc`))

  // need to let eslint know about prettier settings
  eslintConfig.rules[`prettier/prettier`] = [`error`, prettierConfig, {
    "usePrettierrc": false
  }]

  const cli = new CLIEngine({
    baseConfig: eslintConfig,
    fix: true,
  })

  return async task => {
    if (task.formatter === `eslint`) {
      const content = await grabFileContent(prInfo.head, task.filename)
      const report = cli.executeOnText(content, task.filename)

      const result = report.results[0]
      if (content !== result.output) {
        console.log(`${task.filename}: NEED UPDATE`)
      } else {
        console.log(`${task.filename}: OK`)
      }

      if (task.filename === `packages/gatsby/src/utils/cache.js`) {
        console.log('BEFORE:\n---')
        console.log(content)
        console.log('AFTER:\n---')
        console.log(result.output)
      }

      return
    }


    console.log('no formatter')
  }
}

const extToFormatter: { [index:string] : string } = {
  ".js": `eslint`,
  ".md": `prettier`,
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
  console.log(PRInfo)

  if (PRInfo.base.ref !== `master`) {
    console.log('PR against non-master branch')
    return
  }

  // Assign formatters (based on file extension) and filter out files that
  // aren't linted/formatted
  const fileTasks = PRInfo.files.map(filename => {
    return {
      filename,
      formatter: extToFormatter[path.extname(filename)]
    }
  }).filter(tasks => tasks.formatter)

  if (fileTasks.length === 0) {
    console.log('No files to format')
    return
  }

  // create formatters
  console.log('creating formatter')
  const formatter = await configureFormatter(PRInfo)

  console.log('formatting')
  // Format files
  const formatResults = await Promise.all(fileTasks.map(async task => {
    await formatter(task)
    // const formatterFunction = 
    // return await task.formatter(task.filename)
  }))
}


export default async () => {
  return shouldFormat()
};