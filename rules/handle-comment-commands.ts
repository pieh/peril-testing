import { danger, peril } from "danger";
import * as path from "path";
import { CLIEngine } from "eslint";
import * as Prettier from "prettier";
import * as octokit from "@octokit/rest"
import * as childProcess from "child_process"
import * as fs from "fs-extra"
import { DH_NOT_SUITABLE_GENERATOR } from "constants";

type FileData = {
  filename: string;
  status: string;
};

type getFilesReponse = {
  data: FileData[];
};

type BranchInfo = {
  repo: string;
  owner: string;
  ref: string;
  sha: string;
};

type PRInfo = {
  base: BranchInfo;
  head: BranchInfo;
  files: string[];
};

type FileTask = {
  filename: string;
  formatter: string;
};

type ErrorDetail = {
  msg: string;
  line: Number;
  endLine: Number;
};

type EslintMessage = {
  message: string;
  line: Number;
  endLine: Number;
};

type IntermediateFormatResult = {
  status: string;
  output?: string;
  errorDetails?: ErrorDetail[];
};

interface FormatResult extends IntermediateFormatResult {
  filename: string;
  sha?: string;
}

const getBranchInfo = (responseFragment: any) => {
  const [owner, repo] = responseFragment.repo.full_name.split("/");
  return {
    repo,
    owner,
    ref: responseFragment.ref,
    sha: responseFragment.sha
  };
};

const getBaseOwnerAndRepo = () => {
  const [owner, repo] = danger.github.repository.full_name.split("/");
  return {
    owner,
    repo
  };
};

const getPRInfo = async (number: Number): Promise<PRInfo> => {
  console.log(`grabing branch data for PR #${number}`);

  const prData = await danger.github.api.pullRequests.get({
    ...getBaseOwnerAndRepo(),
    number
  });

  const filesData: getFilesReponse = await danger.github.api.pullRequests.getFiles(
    {
      ...getBaseOwnerAndRepo(),
      number
    }
  );

  return {
    base: getBranchInfo(prData.data.base),
    head: getBranchInfo(prData.data.head),
    files: filesData.data
      .filter(fileData => fileData.status !== `removed`)
      .map(fileData => fileData.filename)
  };
};

const grabFileContent = async (branch: BranchInfo, path: string) => {
  const args = {
    ...branch,
    path
  };

  const response = await danger.github.api.repos.getContent(args);
  const buffer = Buffer.from(response.data.content, response.data.encoding);
  const content = buffer.toString();

  return {
    content,
    sha: response.data.sha
  };
};

const configureFormatter = async (prInfo: PRInfo) => {
  const eslintConfig = JSON.parse(
    (await grabFileContent(prInfo.base, `.eslintrc.json`)).content
  );
  const prettierConfig = JSON.parse(
    (await grabFileContent(prInfo.base, `.prettierrc`)).content
  );

  // need to let eslint know about prettier settings
  eslintConfig.rules[`prettier/prettier`] = [
    `error`,
    prettierConfig,
    {
      usePrettierrc: false
    }
  ];

  const cli = new CLIEngine({
    baseConfig: eslintConfig,
    fix: true
  });

  const eslintFormat = (
    task: FileTask,
    content: string
  ): IntermediateFormatResult => {
    const report = cli.executeOnText(content, task.filename);
    const result = report.results[0];

    const errorDetails =
      result.messages &&
      result.messages.length > 0 &&
      result.messages.map((eslintMessage: EslintMessage) => {
        return {
          msg: eslintMessage.message,
          line: eslintMessage.line,
          endLine: eslintMessage.endLine
        };
      });

    if (result.output && content !== result.output) {
      // create details

      return {
        status: `needUpdate`,
        output: result.output,
        errorDetails
      };
    }

    return {
      status: `skip`,
      errorDetails
    };
  };
  const prettierFormat = async (
    task: FileTask,
    content: string
  ): Promise<IntermediateFormatResult> => {
    const finfo = await Prettier.getFileInfo(task.filename);
    try {
      const formattedText = await Prettier.format(content, {
        ...prettierConfig,
        parser: finfo.inferredParser
      });

      if (formattedText !== content) {
        return {
          status: `needUpdate`,
          output: formattedText
        };
      }

      return {
        status: `skip`
      };
    } catch (e) {
      return {
        status: `formatError`,
        errorDetails: [
          { msg: e.toString(), line: e.loc.start.line, endLine: e.loc.end.line }
        ]
      };
    }
  };

  const formatters: { [index: string]: Function } = {
    eslint: eslintFormat,
    prettier: prettierFormat
  };

  return async (task: FileTask): Promise<FormatResult> => {
    const formatter = formatters[task.formatter];
    if (formatter) {
      const { content, sha } = await grabFileContent(
        prInfo.head,
        task.filename
      );

      const formatResult = await formatter(task, content);

      formatResult.filename = task.filename;
      formatResult.sha = sha;

      return formatResult;
    }

    return {
      status: `skip`,
      filename: task.filename
    };
  };
};

const extToFormatter: { [index: string]: string } = {
  ".js": `eslint`,
  ".md": `prettier`,
  ".yml": `prettier`,
  ".yaml": `prettier`,
  ".css": `prettier`,
  ".scss": `prettier`
};

const createCommenter = (PRInfo: PRInfo) => {
  let previousBody: string = ''
  let comment_id: Number = 0
  
  const commentArgs = {
    owner: PRInfo.base.owner,
    repo: PRInfo.base.repo,
    number: danger.github.issue.number,
  }



  return async (content:string) => {
    let body = content

    const listItemContent = content.split(`\n`).map((line, index) => index === 0 ? `* ${line}`: `  ${line}`).join('\n')

    if (previousBody !== null) {
      body = listItemContent
    } else {
      body = `${previousBody}\n${listItemContent}`
    }

    if (comment_id) {
      const createCommentArgs = {
        ...danger,commentArgs,
        body,
      }
      console.log("create comment args", createCommentArgs);
      const commentData = (await danger.github.api.issues.createComment(createCommentArgs)).data;
      console.log('created comment', commentData)
      comment_id = commentData.id
    } else {
      const createCommentArgs = {
        ...danger,commentArgs,
        body,
        comment_id
      }

      console.log("update comment args", createCommentArgs);
      const commentData = (await danger.github.api.issues.editComment(createCommentArgs)).data
      console.log("updated comment", commentData);
    }

    previousBody = body
  }
}

const createCommit = async (
  changedFiles: FormatResult[],
  PRBranchInfo: BranchInfo,
  comment: Function
) => {
  const repoCloneDir = path.join(process.cwd(), `_pr_clone_${danger.github.issue.number}`)
  try {
    const mdListOfChangedFiles = changedFiles.map(fileData => `* \`fileData.filename\``).join('\n')
    comment(`We can format files:\n${mdListOfChangedFiles}\nand format is in progress`)


    const cloneCmd = ({ accessToken }: { accessToken: string }) => `git clone --single-branch --branch ${PRBranchInfo.ref} https://${accessToken}@github.com/${PRBranchInfo.owner}/${PRBranchInfo.repo}.git ${repoCloneDir}`

    console.log(`cloning "${cloneCmd({ accessToken: '<access_token>'})}"`)
    childProcess.execSync(cloneCmd({ accessToken: peril.env.GITHUB_ACCESS_TOKEN} ))

    const gitExecCommandsArg = {
      cwd: repoCloneDir
    }

    await Promise.all(changedFiles.map(async fileData => {
      await fs.outputFile(path.join(repoCloneDir, fileData.filename), fileData.output)
      const gitAddCmd  = `git add ${fileData.filename}`
      console.log(`changed ${fileData.filename} and staging: ${gitAddCmd}`)
      await childProcess.execSync(gitAddCmd, gitExecCommandsArg)
    }))

    childProcess.execSync(`git config user.email "misiek.piechowiak@gmail.com"`, gitExecCommandsArg)
    childProcess.execSync(`git config user.name "pieh-peril-test"`, gitExecCommandsArg)
    

    const commitCmd = `git commit --author="pieh-peril-test<misiek.piechowiak@gmail.com>"  -m "chore: format"`
    console.log(`commiting: ${commitCmd}`)
    childProcess.execSync(commitCmd, gitExecCommandsArg)

    const pushCmd = `git push origin ${PRBranchInfo.ref}`
    console.log(`pushing: ${pushCmd}`)
    childProcess.execSync(pushCmd, gitExecCommandsArg)

    comment(`Format complete`)
  } catch(e) {
    comment(`Something bad happened :(`)
    console.log('error', e)
  }
  // cleanup - delete directory
  const cleanupCmd = `rm -rf ${repoCloneDir}`
  console.log(`cleanup: "${cleanupCmd}"`)
  childProcess.execSync(cleanupCmd)

  /*
  try {
    // console.log("authenticating octokit with token that can push")
    // const githubClient = new octokit()

    // githubClient.authenticate({
    //   type: 'token',
    //   token: peril.env.GITHUB_ACCESS_TOKEN,
    // })
    // peril.env.GITHUB_ACCESS_TOKEN:

    // console.log("creating commit", {
    //   changedFiles,
    //   PRBranchInfo
    // });

    const oldTreeArgs = {
      owner: PRBranchInfo.owner,
      repo: PRBranchInfo.repo,
      tree_sha: PRBranchInfo.sha
    };
    
    console.log("old tree args", oldTreeArgs);

    const tree = (await githubClient.gitdata.getTree(oldTreeArgs)).data;

    console.log("old tree data", tree);

    const newTreeArgs = {
      owner: PRBranchInfo.owner,
      repo: PRBranchInfo.repo,
      tree: changedFiles.map(fileData => {
        return {
          path: fileData.filename,
          mode: "100644",
          type: "blob",
          content: fileData.output
        };
      }),
      base_tree: tree.sha
    };

    console.log("new tree args", newTreeArgs);

    const newTree = (await githubClient.gitdata.createTree(newTreeArgs))
      .data;

    console.log("new tree data", newTree);

    const commitArgs = {
      owner: PRBranchInfo.owner,
      repo: PRBranchInfo.repo,
      message: "chore: format",
      tree: newTree.sha,
      parents: [PRBranchInfo.sha]
    };

    console.log("new commit args", commitArgs);

    const commit = (await githubClient.gitdata.createCommit(commitArgs))
      .data;

    console.log("new commit data", commit);

    // update branch to point to new commit
    const updateRefArgs = {
      owner: PRBranchInfo.owner,
      repo: PRBranchInfo.repo,
      ref: `heads/${PRBranchInfo.ref}`,
      sha: commit.sha,
      force: false
    };

    console.log("update ref args", updateRefArgs);

    const refUpdate = (await githubClient.gitdata.updateReference(
      updateRefArgs
    )).data;

    console.log("update ref data", refUpdate);
    // console.log('tree', tree)
  } catch (e) {
    console.log(":(", e);
  }
  */
};

const fixF = str => {
  return str.replace(/\u001b\[[0-9]+m/g, "");
};

export const shouldFormat = async () => {
  try {
    if (!danger.github.issue.pull_request) {
      console.log(`NOT PR`);
      return;
    }

    if (!danger.github.comment.body.includes(`format`)) {
      console.log(`comment doesn't include "format"`);
      return;
    }

    // Grab branches information and list of files in PR
    const PRInfo = await getPRInfo(danger.github.issue.number);
    console.log(PRInfo);

    if (PRInfo.base.ref !== `master`) {
      console.log("PR against non-master branch");
      return;
    }

    // Assign formatters (based on file extension) and filter out files that
    // aren't linted/formatted
    const fileTasks: FileTask[] = PRInfo.files
      .map(filename => {
        return {
          filename,
          formatter: extToFormatter[path.extname(filename)]
        };
      })
      .filter(tasks => tasks.formatter);

    if (fileTasks.length === 0) {
      console.log("No files to format");
      return;
    }

    // Create formatters
    const formatter = await configureFormatter(PRInfo);

    // Format files
    const formatResults = await Promise.all(fileTasks.map(formatter));

    console.log("formatResults", formatResults);

    const comment = createCommenter(PRInfo)

    // show inline message about files that can't be fully autofixed
    const filesThatCantBeFullyFixes = formatResults.filter(
      fileResult => !!fileResult.errorDetails
    );

    if (filesThatCantBeFullyFixes.length > 0) {
      const msg = filesThatCantBeFullyFixes
        .map(fileResult => {
          const errorsInFile = fileResult.errorDetails
            .map(errorDetail => {
              const lineNumber =
                errorDetail.endLine && errorDetail.endLine !== errorDetail.line
                  ? `${errorDetail.line} - ${errorDetail.endLine}`
                  : errorDetail.line;

              return `Line ${lineNumber}:\n${errorDetail.msg}`;
            })
            .join(`\n\n`);

          return (
            `\`${fileResult.filename}\`:\n` +
            `\`\`\`\n` +
            fixF(errorsInFile) +
            `\n\`\`\``
          );
        })
        .join(`\n\n`);

      comment(`We can't automatically fix at least some errors in:\n${msg}`)
      // const createCommentArgs = {
      //   owner: PRInfo.base.owner,
      //   repo: PRInfo.base.repo,
      //   number: danger.github.issue.number,
      //   body: msg
      // };

      // console.log("create comment args", createCommentArgs);

      // const commentData = (await danger.github.api.issues.createComment(createCommentArgs)).data;
      // console.log('created comment', commentData)
    }
  } catch (e) {
    console.log("err", e);
  }

  const filesThatCanBeUpdated = formatResults.filter(
    fileResult => fileResult.status === `needUpdate`
  );
  if (filesThatCanBeUpdated.length > 0) {
    console.log("creating commit");
    await createCommit(filesThatCanBeUpdated, PRInfo.head, comment);
  }
};

export default async () => {
  return await shouldFormat();
};
