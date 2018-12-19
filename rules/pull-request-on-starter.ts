import { danger } from "danger"

// TODO: Improve comment
export const comment = (username: string) => `
Hey, @${username}
Thank you for your pull request!
We've moved all our starters over to [this repo][monorepo]. Please reopen this there. 
Thanks again!
[monorepo]: https://github.com/gatsbyjs/gatsby
`

export const closePullRequestAndComment = async () => {
  const gh = danger.github
  const api = gh.api

  // Details about the repo.
  const owner = gh.thisPR.owner
  const repo = gh.thisPR.repo
  const number = gh.thisPR.number

  // Details about the collaborator.
  const username = gh.pr.user.login

  // Leave a comment redirecting the collaborator to the monorepo
  // And close this pull request
  await api.pulls.update({
    owner,
    repo,
    number,
    body: comment(username),
    state: "closed",
  })
}

export default async () => {
  await closePullRequestAndComment()
}