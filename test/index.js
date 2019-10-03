const jsonenv = require('@h4na2t/jsonenv')

let config = {
}

jsonenv.config(config, { path: 'test/.env'})

console.log(config)