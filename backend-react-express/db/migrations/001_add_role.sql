-- Миграция: роли пользователей
-- Admin | Teacher | Student | Guest

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'Student'
  CHECK (role IN ('Admin', 'Teacher', 'Student', 'Guest'));

-- Администратор
UPDATE students SET role = 'Admin' WHERE id = 1;
