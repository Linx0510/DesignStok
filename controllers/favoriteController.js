const db = require('../config/database');
const Work = require('../models/Work');
const Notification = require('../models/Notification');

class FavoriteController {
    // Получить избранное пользователя
    async getUserFavorites(req, res) {
        try {
            const userId = req.params.userId || req.session.userId;
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;
            
            const query = `
                SELECT w.*, 
                       u.username, 
                       u.avatar_path,
                       array_agg(DISTINCT t.name) as tags,
                       f.created_at as favorited_at
                FROM favorites f
                JOIN works w ON f.work_id = w.id
                JOIN users u ON w.user_id = u.id
                LEFT JOIN work_tags wt ON w.id = wt.work_id
                LEFT JOIN tags t ON wt.tag_id = t.id
                WHERE f.user_id = $1 AND w.status = 'approved'
                GROUP BY w.id, u.id, f.created_at
                ORDER BY f.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const result = await db.query(query, [userId, limit, offset]);
            
            // Получаем общее количество
            const countResult = await db.query(
                'SELECT COUNT(*) FROM favorites WHERE user_id = $1',
                [userId]
            );
            const totalCount = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalCount / limit);
            
            if (req.xhr) {
                return res.json({
                    success: true,
                    favorites: result.rows,
                    currentPage: page,
                    totalPages,
                    hasMore: page < totalPages
                });
            }
            
            res.render('favorites', {
                title: 'Мое избранное',
                favorites: result.rows,
                currentPage: page,
                totalPages,
                user: req.session.userId ? await require('../models/User').findById(req.session.userId) : null
            });
            
        } catch (error) {
            console.error('Ошибка при получении избранного:', error);
            if (req.xhr) {
                res.status(500).json({ success: false, message: 'Ошибка при загрузке избранного' });
            } else {
                res.status(500).render('500', { title: 'Ошибка сервера' });
            }
        }
    }

    // Добавить в избранное
    async addToFavorites(req, res) {
        try {
            const { workId } = req.body;
            const userId = req.session.userId;
            
            // Проверяем, существует ли работа
            const work = await Work.findById(workId);
            if (!work) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Работа не найдена' 
                });
            }
            
            // Проверяем, не добавлена ли уже работа
            const checkQuery = 'SELECT * FROM favorites WHERE user_id = $1 AND work_id = $2';
            const checkResult = await db.query(checkQuery, [userId, workId]);
            
            if (checkResult.rows.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Работа уже в избранном' 
                });
            }
            
            // Добавляем в избранное
            await db.query(
                'INSERT INTO favorites (user_id, work_id) VALUES ($1, $2)',
                [userId, workId]
            );
            
            // Получаем обновленное количество избранного
            const countResult = await db.query(
                'SELECT COUNT(*) FROM favorites WHERE work_id = $1',
                [workId]
            );
            const favoritesCount = parseInt(countResult.rows[0].count);
            
            res.json({ 
                success: true, 
                message: 'Добавлено в избранное',
                favoritesCount 
            });
            
        } catch (error) {
            console.error('Ошибка при добавлении в избранное:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Ошибка при добавлении в избранное' 
            });
        }
    }

    // Удалить из избранного
    async removeFromFavorites(req, res) {
        try {
            const { workId } = req.params;
            const userId = req.session.userId;
            
            const result = await db.query(
                'DELETE FROM favorites WHERE user_id = $1 AND work_id = $2 RETURNING *',
                [userId, workId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Работа не найдена в избранном' 
                });
            }
            
            // Получаем обновленное количество избранного
            const countResult = await db.query(
                'SELECT COUNT(*) FROM favorites WHERE work_id = $1',
                [workId]
            );
            const favoritesCount = parseInt(countResult.rows[0].count);
            
            res.json({ 
                success: true, 
                message: 'Удалено из избранного',
                favoritesCount 
            });
            
        } catch (error) {
            console.error('Ошибка при удалении из избранного:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Ошибка при удалении из избранного' 
            });
        }
    }

    // Проверить, добавлена ли работа в избранное
    async checkFavorite(req, res) {
        try {
            const { workId } = req.params;
            const userId = req.session.userId;
            
            if (!userId) {
                return res.json({ isFavorited: false });
            }
            
            const result = await db.query(
                'SELECT * FROM favorites WHERE user_id = $1 AND work_id = $2',
                [userId, workId]
            );
            
            res.json({ isFavorited: result.rows.length > 0 });
            
        } catch (error) {
            console.error('Ошибка при проверке избранного:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Ошибка при проверке' 
            });
        }
    }

    // Получить количество избранного для работы
    async getFavoritesCount(req, res) {
        try {
            const { workId } = req.params;
            
            const result = await db.query(
                'SELECT COUNT(*) FROM favorites WHERE work_id = $1',
                [workId]
            );
            
            res.json({ count: parseInt(result.rows[0].count) });
            
        } catch (error) {
            console.error('Ошибка при получении количества:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Ошибка при получении количества' 
            });
        }
    }
}

module.exports = new FavoriteController();