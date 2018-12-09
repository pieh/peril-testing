
import { danger, warn } from 'danger';

export const shouldFormat = async () => {
  console.log('checking if should format')


  console.log(danger.github)
}


export default async () => {
  return shouldFormat()
};