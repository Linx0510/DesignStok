const db = require('../config/database');

class Tag {
    static async findAll() {
        const query = `
            SELECT t.*, COUNT(wt.work_id) as works_count
            FROM tags t
            LEFT JOIN work_tags wt ON t.id = wt.tag_id
            GROUP BY t.id
            ORDER BY works_count DESC
        `;
        const result = await db.query(query);
        return result.rows;
    }

    static async findByName(name) {
        const query = 'SELECT * FROM tags WHERE name = $1';
        const result = await db.query(query, [name]);
        return result.rows[0];
    }

    static async getPopular(limit = 10) {
        const query = `
            SELECT t.name, COUNT(wt.work_id) as count
            FROM tags t
            JOIN work_tags wt ON t.id = wt.tag_id
            JOIN works w ON wt.work_id = w.id
            WHERE w.status = 'approved'
            GROUP BY t.id
            ORDER BY count DESC
            LIMIT $1
        `;
        const result = await db.query(query, [limit]);
        return result.rows;
    }
}

module.exports = Tag;