// models/User.js
const db = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    static async findByEmail(email) {
        try {
            console.log('🔍 Поиск пользователя по email:', email);
            // PostgreSQL синтаксис - используем $1 вместо ?
            const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            console.log('✅ Результат поиска:', result.rows[0] || 'Не найден');
            return result.rows[0];
        } catch (error) {
            console.error('Ошибка в findByEmail:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            console.log('🔍 Поиск пользователя по id:', id);
            // PostgreSQL синтаксис - используем $1 вместо ?
            const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
            return result.rows[0];
        } catch (error) {
            console.error('Ошибка в findById:', error);
            throw error;
        }
    }

    static async create(username, email, password) {
        try {
            console.log('📝 Создание пользователя:', email);
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // PostgreSQL синтаксис - используем $1, $2, $3 вместо ?
            // RETURNING * для получения созданной записи
            const result = await db.query(
                'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
                [username, email, hashedPassword, 'user']
            );
            
            console.log('✅ Пользователь создан:', result.rows[0].id);
            return result.rows[0];
        } catch (error) {
            console.error('Ошибка в create:', error);
            throw error;
        }
    }


    static async updateProfile(userId, { username, bio, avatar_path }) {
        const fields = [];
        const values = [];

        if (typeof username !== 'undefined') {
            fields.push(`username = $${fields.length + 1}`);
            values.push(username);
        }

        if (typeof bio !== 'undefined') {
            fields.push(`bio = $${fields.length + 1}`);
            values.push(bio);
        }

        if (avatar_path) {
            fields.push(`avatar_path = $${fields.length + 1}`);
            values.push(avatar_path);
        }

        if (fields.length === 0) {
            return this.findById(userId);
        }

        values.push(userId);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${fields.length + 1} RETURNING *`;
        const result = await db.query(query, values);
        return result.rows[0];
    }

    static async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }

    static async updatePassword(userId, newPassword) {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const result = await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
            [passwordHash, userId]
        );

        return result.rows[0];
    }
}

module.exports = User;
