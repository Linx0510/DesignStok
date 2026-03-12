const db = require('../config/database');

class Work {
    static async create(userId, title, description, imagePath, tags = []) {
        // Начинаем транзакцию
        await db.query('BEGIN');
        
        try {
            // Вставляем работу
            const workQuery = 'INSERT INTO works (user_id, title, description, image_path) VALUES ($1, $2, $3, $4) RETURNING id';
            const workResult = await db.query(workQuery, [userId, title, description, imagePath]);
            const workId = workResult.rows[0].id;
            
            // Добавляем теги
            for (const tagName of tags) {
                // Проверяем существует ли тег
                let tagQuery = 'SELECT id FROM tags WHERE name = $1';
                let tagResult = await db.query(tagQuery, [tagName]);
                
                let tagId;
                if (tagResult.rows.length === 0) {
                    // Создаем новый тег
                    tagQuery = 'INSERT INTO tags (name) VALUES ($1) RETURNING id';
                    tagResult = await db.query(tagQuery, [tagName]);
                    tagId = tagResult.rows[0].id;
                } else {
                    tagId = tagResult.rows[0].id;
                }
                
                // Связываем работу с тегом
                await db.query('INSERT INTO work_tags (work_id, tag_id) VALUES ($1, $2)', [workId, tagId]);
            }
            
            await db.query('COMMIT');
            return workId;
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    }

    static async findAll(status = 'approved', limit = 20, offset = 0) {
        const query = `
            SELECT w.*, u.username, u.avatar_path,
                   array_agg(DISTINCT t.name) as tags,
                   COUNT(DISTINCT f.user_id) as favorites_count
            FROM works w
            JOIN users u ON w.user_id = u.id
            LEFT JOIN work_tags wt ON w.id = wt.work_id
            LEFT JOIN tags t ON wt.tag_id = t.id
            LEFT JOIN favorites f ON w.id = f.work_id
            WHERE w.status = $1
            GROUP BY w.id, u.id
            ORDER BY w.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(query, [status, limit, offset]);
        return result.rows;
    }

    static async findById(id) {
        // Увеличиваем счетчик просмотров
        await db.query('UPDATE works SET views_count = views_count + 1 WHERE id = $1', [id]);
        
        const query = `
            SELECT w.*, u.username, u.avatar_path, u.bio as user_bio,
                   array_agg(DISTINCT t.name) as tags,
                   COUNT(DISTINCT f.user_id) as favorites_count
            FROM works w
            JOIN users u ON w.user_id = u.id
            LEFT JOIN work_tags wt ON w.id = wt.work_id
            LEFT JOIN tags t ON wt.tag_id = t.id
            LEFT JOIN favorites f ON w.id = f.work_id
            WHERE w.id = $1
            GROUP BY w.id, u.id
        `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }

    static async search(query, limit = 20, offset = 0) {
        const searchQuery = `
            SELECT w.*, u.username, u.avatar_path,
                   array_agg(DISTINCT t.name) as tags
            FROM works w
            JOIN users u ON w.user_id = u.id
            LEFT JOIN work_tags wt ON w.id = wt.work_id
            LEFT JOIN tags t ON wt.tag_id = t.id
            WHERE w.status = 'approved' 
              AND (w.title ILIKE $1 OR w.description ILIKE $1 OR t.name ILIKE $1)
            GROUP BY w.id, u.id
            ORDER BY w.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(searchQuery, [`%${query}%`, limit, offset]);
        return result.rows;
    }

    static async updateStatus(id, status, reason = null) {
        const query = 'UPDATE works SET status = $1 WHERE id = $2 RETURNING user_id';
        const result = await db.query(query, [status, id]);
        
        if (reason && status === 'rejected') {
            // Создаем уведомление для пользователя
            await db.query(
                'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
                [result.rows[0].user_id, `Ваша работа была отклонена. Причина: ${reason}`]
            );
        }
        
        return result.rows[0];
    }

    static async delete(id, reason = null) {
        const work = await this.findById(id);
        if (work) {
            await db.query('DELETE FROM works WHERE id = $1', [id]);
            
            if (reason) {
                await db.query(
                    'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
                    [work.user_id, `Ваша работа была удалена. Причина: ${reason}`]
                );
            }
        }
    }
}

module.exports = Work;