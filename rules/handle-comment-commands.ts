
import { danger, warn } from 'danger';

export const shouldFormat = async () => {
  if (danger.github.issue.pull_request) {
    // this is issue, not PR
    return
  }
  console.log('checking if should format')


  console.log(danger.github)
}


export default async () => {
  return shouldFormat()
};