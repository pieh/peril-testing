import { danger, message } from 'danger';
import fs from 'fs'

export const validateYaml = () => {
  message(`files ${danger.git.modified_files.join(', ')}`)
  if (!(danger.git.modified_files.includes("test.yaml"))) {
    return
  }
  
  const fileContent = fs.readFileSync("test.yaml").toString();
  message(`test ${fileContent}`)
};

export default async () => {
  validateYaml()
};