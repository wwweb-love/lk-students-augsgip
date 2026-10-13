const jwt = require('jsonwebtoken')
const config = require('../config')

module.exports = {
  generate(data) {
    return jwt.sign(data, config.jwtSecret, { expiresIn: '30d' })
  },
  verify(token) {
    return jwt.verify(token, config.jwtSecret)
  },
}
