import * as Joi from 'joi'
import { danger } from 'danger';

// const customJoi = Joi.extend(joi: Anysch => ({
//   base: joi.string(),
//   name: 'string',
//   rules: [
//     {

//     }
//   ]
// }))


export default Joi.array().items(
  Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string(),
  })
)