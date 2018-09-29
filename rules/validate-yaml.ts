import { danger, message } from 'danger';
import fs from 'fs'

export const validateYaml = () => {
  message(`files ${danger.git.modified_files.join(', ')}`)
  if (!(`test.yaml` in danger.git.modified_files)) {
    return
  }
  
  const fileContent = fs.readFileSync(`test.yaml`).toString();
  message(`test ${fileContent}`)
};

export default async () => {
  validateYaml()
};