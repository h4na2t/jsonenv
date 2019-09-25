const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const NEWLINE = '\n'
const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/
const RE_NEWLINES = /\\n/g
const NEWLINES_MATCH = /\n|\r|\r\n/

function log (message /*: string */) {
  console.log(`[dotenv][DEBUG] ${message}`)
}

function deflateKeys(json) {
  return Object.keys(deflate(json, '', true))
}

/**
 * Deflates the given JSON structure into an object in the format <key>=<value>
 * where key is a string constructed from traversing the json hierarchy, and value is the bottom most string value for
 * that particular hierarchy traversal.
 *
 * @param json
 * @param prefix
 * @returns {Array}
 */
function deflate(json, prefix, keysOnly = false) {
  let result = {}
  const keys = Object.keys(json)
  keys.forEach(function (key) {
    let _prefix
    const value = json[key]
    const valueKeys = Object.keys(json[key])
    
    if (value && typeof value === 'object' && valueKeys.length > 0) {
      const currPrefix = key.concat('.')
      _prefix = prefix ? prefix.concat(currPrefix) : currPrefix
      result = { ...result, ...deflate(value, _prefix, keysOnly) }
    } else {
      _prefix = prefix ? prefix.concat(key) : key
      result[_prefix] = value
    }
  })
  
  return result
}

/**
 * Inflates the given array of lines into a JSON structure. Example:
 *  lines = [
 *      'KEYA.KEY1=Value A1',
 *      'KEYA.KEY2=Value A2',
 *      'KEYB.KEY2.KEY3=Value A23'
 *  ]
 *
 *  result in
 *
 *  {
 *      KEYA: {
 *          KEY1:'Value A1',
 *          KEY2:'Value A2'
 *      },
 *      KEYB: {
 *          KEY2: {
 *              KEY3: 'Value A23'
 *          }
 *      }
 *  }
 *
 * @param keys An array of keys whose concatenation reconstructs the original key in the properties file
 * @param value The value to insert at the bottom most key
 * @param result The JSON object to append to
 * @returns {{}}
 */
function _inflateItem(keys, value, result) {
  let key = keys[0]
  const number = Number(key)
  if (!isNaN(number) && Object.keys(result).length === 0) {
    result = []
    key = number
  }
  
  if (keys.length === 1) {
    result[key] = value
  } else {
    result[key] = _inflateItem(keys.slice(1), value, result[key] || {})
  }
  
  return result
}

function inflate (obj = {}) {
  const result = {}
  
  for (const key in obj) {
    const value = obj[key]
    const keys = key.trim().split('.')
    _inflateItem(keys, value, result)
  }
  
  return result
}

function parse (src /*: string | Buffer */, options /*: ?DotenvParseOptions */) /*: DotenvParseOutput */ {
  return dotenv.parse(src, options)
}

function config (conf = {}, options /*: ?DotenvConfigOptions */) /*: DotenvConfigOutput */ {
  let { parsed = {}} = dotenv.config(options)
  let envKeys = Object.keys(parsed)
  let mergedConfig = merge(conf, envKeys)
  
  for(let key in mergedConfig) {
    conf[key] = mergedConfig[key]
  }
  
  return conf
}

function merge(conf = {}, envKeys) {
  const envConfig = {}
  const keys = deflateKeys(conf)
  if(!envKeys) {
    envKeys = Object.keys(process.env).filter(envKey => {
      for (const key in keys) {
        if (envKey.startsWith(`${key}.`)) {
          return true
        }
      }
    })
  }
  
  const allKeys = keys.concat(envKeys)
  for (const key of allKeys) {
    const envValue = process.env[key]
    if (envValue !== undefined) {
      envConfig[key] = envValue
    }
  }
  
  const envJson = inflate(envConfig)
  return mergeEnvObject(conf, envJson)
}

function mergeEnvObject(defaultJson = {}, envValue) {
  if (envValue === null || envValue === undefined) return defaultJson
  
  const result = {}
  if ((typeof envValue) !== 'object') {
    if ((typeof envValue) === 'string') {
      const tmp = JSON.parse(envValue)
      if ((typeof tmp) === 'object') {
        envValue = tmp
      } else {
        throw new Error('Invalid json string')
      }
    } else {
      throw new Error('Properties type doesn\'t matched')
    }
  }
  
  const keys = [...new Set([...Object.keys(defaultJson), ...Object.keys(envValue)])]
  for (const key of keys) {
    const dj = defaultJson[key]
    const ej = envValue[key]
    result[key] = mergeEnvJsonValue(dj, ej)
  }
  
  return result
}

function mergeEnvJsonValue(defaultValue, envValue, defaultType) {
  let result = defaultValue
  if (envValue) {
    const typeOfDj = (defaultValue !== null && defaultValue !== undefined ? typeof defaultValue : defaultType) || typeof envValue
    if (typeOfDj === 'array' || Array.isArray(defaultValue)) {
      result = mergeEnvArray(defaultValue, envValue)
    } else if (typeOfDj === 'object') {
      result = mergeEnvObject(defaultValue, envValue)
    } else if (typeOfDj === 'boolean') {
      const value = JSON.parse(envValue)
      if (value === true || value === false) {
        result = value
      } else {
        throw new Error('Properties type doesn\'t matched')
      }
    } else if (typeOfDj === 'number') {
      const value = Number(envValue)
      if (isNaN(value)) {
        throw new Error('Properties type doesn\'t matched')
      }
      result = value
    } else if (!typeOfDj) {
      const strValue = envValue.toString().trim()
      const number = Number(strValue)
      if (!isNaN(number)) {
        result = number
      } else {
        try {
          if (strValue.startsWith('{') || strValue.startsWith('[')) {
            result = JSON.parse(strValue)
          } else if (strValue.toLowerCase() === 'true') {
            result = true
          } else if (strValue.toLowerCase() === 'false') {
            result = false
          } else {
            result = strValue
          }
        } catch (e) {
          // do nothing just let keep default value
        }
      }
    } else {
      result = envValue
    }
  }
  
  return result
}

function mergeEnvArray(defaultJson = [], envValue) {
  if (envValue === null || envValue === undefined) return defaultJson
  
  let result = []
  if (!Array.isArray(envValue)) {
    if ((typeof envValue) === 'string') {
      const tmp = JSON.parse(envValue)
      if (Array.isArray(tmp)) {
        envValue = tmp
      } else {
        throw new Error('Invalid json array string')
      }
    } else {
      throw new Error('Properties type doesn\'t matched')
    }
  }
  
  if (defaultJson.length > 0) {
    const valueType = typeof defaultJson[0]
    if (envValue.length > defaultJson.length) {
      result = envValue.map((value, i) => mergeEnvJsonValue(defaultJson[i], value, valueType))
    } else {
      result = defaultJson.map((defaultValue, i) => mergeEnvJsonValue(defaultValue, envValue[i], valueType))
    }
  } else {
    result = envValue
  }
  
  return result
}

module.exports.parse = parse
module.exports.config = config
module.exports.merge = merge
