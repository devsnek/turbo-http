const CHAR_UPPER = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
]

const CHAR_LOWER = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
]

const LOOKUP_FILL0 = [
  '\0', '', '', '', '', '', '', '',
  '', '', '', '', '', '', '', '',
  '', '', '', '', '', '', '', '',
  '', '', '', '', '', '', '', '',
  ' ', '!', '"', '#', '$', '%', '&', '\'',
  '', '', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7',
  '8', '9', ':', ';', '<', '=', '>', '?',
  '@'
]

const LOOKUP_FILL1 = [ '[', '\\', ']', '^', '_', '`' ]
const LOOKUP_FILL2 = [ '{', '|', '}', '~', '' ]

const codeLookupNormal = [ ...LOOKUP_FILL0, ...CHAR_UPPER, ...LOOKUP_FILL1, ...CHAR_LOWER, ...LOOKUP_FILL2 ]
const codeLookupLower = [ ...LOOKUP_FILL0, ...CHAR_LOWER, ...LOOKUP_FILL1, ...CHAR_LOWER, ...LOOKUP_FILL2 ]
const codeLookupUpper = [ ...LOOKUP_FILL0, ...CHAR_UPPER, ...LOOKUP_FILL1, ...CHAR_UPPER, ...LOOKUP_FILL2 ]

const STATE_METHOD = 0
const STATE_VERSION_MAJOR = 1
const STATE_VERSION_MINOR = 2
const STATE_PATH = 3
const STATE_HEADER_KEY = 4
const STATE_HEADER_VALUE = 5
const STATE_BODY = 6

const HEADER_CONTENT_LENGTH = 'content-length'

const kOnHeadersComplete = 0
const kOnBody = 1
const kOnMessageComplete = 2

function noop (a = 1, b = 2, c = 3) {}

class HttpParser {
  constructor () {
    this.info = {
      method: '',
      path: '',
      headers: {},
      versionMajor: undefined,
      versionMinor: undefined
    }
    this.state = STATE_METHOD
    this.headerKey = ''
    this.headerValue = ''
    this.nextCouldHaveSpace = false
    this.bodyLength = 0
    this.bodyOffset = 0
    this[kOnHeadersComplete] = noop
    this[kOnBody] = noop
    this[kOnMessageComplete] = noop
  }

  execute (buffer) {
    if (this.state === STATE_BODY) {
      this.handleBody(buffer, 0)
    } else {
      const len = buffer.length
      for (var i = 0; i < len; i++) {
        const char = buffer[i]
        if (this.state === STATE_METHOD) {
          if (char === 0x20) {
            this.state = STATE_PATH
          } else {
            this.info.method += codeLookupUpper[char]
          }
        } else if (this.state === STATE_PATH) {
          if (char === 0x20) {
            this.state = STATE_VERSION_MAJOR
          } else {
            this.info.path += codeLookupNormal[char]
          }
        } else if (this.state === STATE_VERSION_MAJOR) {
          if (char === 0x2e) {
            this.state = STATE_VERSION_MINOR
          } else if (char !== 0x48 && char !== 0x54 && char !== 0x50 && char !== 0x2f) {
            this.info.versionMajor = codeLookupNormal[char]
          }
        } else if (this.state === STATE_VERSION_MINOR) {
          if (char === 0x0d && buffer[i + 1] === 0x0a) {
            this.state = STATE_HEADER_KEY
            i++
          } else {
            this.info.versionMinor = codeLookupNormal[char]
          }
        } else if (this.state === STATE_HEADER_KEY) {
          if (char === 0x3a) {
            if (buffer[i + 1] === 0x20) { i++ }
            this.state = STATE_HEADER_VALUE
          } else if (this.nextCouldHaveSpace && char === 0x20) {
            this.nextCouldHaveSpace = false
          } else {
            this.headerKey += codeLookupLower[char]
          }
        } else if (this.state === STATE_HEADER_VALUE) {
          if (char === 0x0d && buffer[i + 1] === 0x0a) {
            this.info.headers[this.headerKey] = this.headerValue
            if (this.headerKey === HEADER_CONTENT_LENGTH) {
              this.bodyLength = +this.headerValue
            }
            this.headerKey = ''
            this.headerValue = ''
            if (buffer[i + 2] === 0x0d && buffer[i + 3] === 0x0a) {
              this.state = STATE_BODY
              i += 3
              this[kOnHeadersComplete](this.info)
            } else {
              this.state = STATE_HEADER_KEY
              i++
            }
          } else if (this.nextCouldHaveSpace && char === 0x20) {
            this.nextCouldHaveSpace = false
          } else {
            this.headerValue += codeLookupLower[char]
          }
        } else if (this.state === STATE_BODY) {
          this.handleBody(buffer, i)
          break
        }
      }
    }
    this.nextCouldHaveSpace = this.state === STATE_HEADER_VALUE && this.headerValue.length === 0
  }

  handleBody (buffer, offset) {
    const slice = buffer.slice(offset, buffer.length)
    const len = slice.len
    this[kOnBody](slice, this.bodyOffset, len)
    this.bodyOffset += len
    if (this.bodyOffset >= this.bodyLength) {
      this[kOnMessageComplete]()
      this.state = STATE_METHOD
    }
  }
}

HttpParser.kOnHeadersComplete = kOnHeadersComplete
HttpParser.kOnBody = kOnBody
HttpParser.kOnMessageComplete = kOnMessageComplete

module.exports = HttpParser
