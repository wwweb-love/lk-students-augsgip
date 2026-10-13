// Убирает bcrypt-хеш пароля из данных, отдаваемых клиенту
function safeUser(user) {
  if (!user) return null
  const { password, ...rest } = user
  return rest
}

module.exports = safeUser
