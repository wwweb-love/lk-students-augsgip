// Аватар пользователя по роли: Guest → guest.png, Student → student.png,
// Teacher → teacher.png, Admin → admin.png (лежат в public/image)
const AVATARS = ['guest', 'student', 'teacher', 'admin']

export function avatarFor(role) {
  const key = String(role || '').toLowerCase()
  return `/image/${AVATARS.includes(key) ? key : 'guest'}.png`
}
