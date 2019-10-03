# jsonenv
Loads and inject environment variables from .env into json configuration for nodejs projects.

## Install

```bash
# with npm
npm install @h4na2t/jsonenv

# or with Yarn
yarn add @h4na2t/jsonenv
```

## Usage

This jsonenv library usage 100% compatible as [`dotenv`](https://github.com/motdotla/dotenv). Create a `.env` file in the root directory of your project. Add
environment-specific variables on new lines in the form of `NAME=VALUE`. `NAME` is sprawling configuration path in the json configure object.

For example:

```dosini
db.mysql.host=localhost
db.mysql.user=root
db.mysql.pass=s1mpl3
```

Assumption you have a config.js file at the root of you application would look like this:

```javascript
const config = {
  db: {
    mysql: {
      host: "",
      user: "",
      pass: ""
    }
  }
}

module.exports = config 
```
Now you can using jsonenv to inject value defined in your `.env` file into config:

```javascript
const config = {
  db: {
    mysql: {
      host: "localhost",
      user: "root",
      pass: "s1mpl3"
    }
  }
}

require('@h4na2t/jsonenv').config(config)

module.exports = config
```

After configured your `config` object now has the values you defined in your `.env` file.

```javascript
const db = require('db')
const config = require('./config')
db.connect({
  host: config.db.mysql.host,
  username: config.db.mysql.user,
  password: config.db.mysql.pass
})
```

## Config

`config` will read your `.env` file, parse the contents, inject value into jsonConfig and assign it to
[`process.env`](https://nodejs.org/docs/latest/api/process.html#process_process_env),
and return an Object containing the loaded content or throw an exception if it failed.

```js
const jsonenv = require('@h4na2t/jsonenv')
const finalConfig = jsonenv.config(config)
```

You can additionally, pass options to `config`.

### Options

#### Path

Default: `path.resolve(process.cwd(), '.env')`

You may specify a custom path if your file containing environment variables is located elsewhere.

```js
require('@h4na2t/jsonenv').config(configObj, { path: '/full/custom/path/to/your/env/vars' })
```

#### Encoding

Default: `utf8`

You may specify the encoding of your file containing environment variables.

```js
require('@h4na2t/jsonenv').config(configObj, { encoding: 'latin1' })
```

#### Debug

Default: `false`

You may turn on logging to help debug why certain keys or values are not being set as you expect.

```js
require('@h4na2t/jsonenv').config(configObj, { debug: process.env.DEBUG })
```

## Parse

The engine which parses the contents of your file containing environment
variables is available to use. It accepts a String or Buffer and will return
an Object with the parsed keys and values.

```js
const jsonenv = require('@h4na2t/jsonenv')
const buf = Buffer.from('path.to=basic')
const config = jsonenv.parse(buf) // will return an object
console.log(typeof config, config) // object { "path.to" : 'basic' }
```

### Options

#### Debug

Default: `false`

You may turn on logging to help debug why certain keys or values are not being set as you expect.

```js
const jsonenv = require('@h4na2t/jsonenv')
const buf = Buffer.from('hello world')
const opt = { debug: true }
const config = jsonenv.parse(buf, opt)
// expect a debug message because the buffer is not in KEY=VAL form
```

### Rules
The parsing engine currently supports the following rules:

- default value type is string
- type of property defined in default config object passed to function `config` will be reference first. Ex: the property port in config file is number `{ db: { port: 1234 }}` and in the .env is `db.port=3306`. We going to try to parse db.port into number automatically. If property not defined, we will try to parse value into number or boolean first, if can't, we going to using type string as default. If you want using number or boolean as text please wrap the value inner quotes.
- `BASIC=basic` becomes `{BASIC: 'basic'}`
- `path.to.field=basic` becomes `{ path: {to: { field: 'basic' } } }`
- `path.to.array.[number]=basic` becomes `{ path: {to: { array: ['basic'] } } }`. If multiple lines same `path.to.array` but difference `number` all values going to add an array. Ex: `path.to.array.0=basic0`, `path.to.array.1=basic1` becomes `{ path: {to: { array: ['basic0', 'basic2'] } } }`
- empty lines are skipped
- lines beginning with `#` are treated as comments
- empty values become empty strings (`EMPTY=` becomes `{EMPTY: ''}`)
- inner quotes are maintained (think JSON) `JSON={"foo": "bar"}` becomes default value`{JSON:"{\"foo\": \"bar\"}"` or becomes `{JSON:{foo: "bar"}}` if you defined key `JSON` as object in config object, Ex: `config = {JSON: {}}`. Similar to the case of arrays.
- whitespace is removed from both ends of unquoted values (see more on [`trim`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim)) (`FOO=  some value  ` becomes `{FOO: 'some value'}`)
- single and double quoted values are escaped (`SINGLE_QUOTE='quoted'` becomes `{SINGLE_QUOTE: "quoted"}`)
- single and double quoted values maintain whitespace from both ends (`FOO="  some value  "` becomes `{FOO: '  some value  '}`)
- double quoted values expand new lines (`MULTILINE="new\nline"` becomes

```
{MULTILINE: 'new
line'}
```

License
-------

May be freely distributed under the [BSD 2-Clause](https://raw.githubusercontent.com/h4na2t/jsonenv/master/LICENSE)