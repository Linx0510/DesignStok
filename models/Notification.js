const db = require('../config/database');

class Notification {
    static async create(userId, message) {
        const query = 'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING *';
        const result = await db.query(query, [userId, message]);
        return result.rows[0];
    }

    static async findByUser(userId) {
        const query = 'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC';
        const result = await db.query(query, [userId]);
        return result.rows;
    }

    static async markAsRead(id) {
        const query = 'UPDATE notifications SET is_read = TRUE WHERE id = $1';
        await db.query(query, [id]);
    }

    static async markAllAsRead(userId) {
        const query = 'UPDATE notifications SET is_read = TRUE WHERE user_id = $1';
        await db.query(query, [userId]);
    }
}

module.exports = Notification;