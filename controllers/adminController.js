const Work = require('../models/Work');
const User = require('../models/User');
const db = require('../config/database');


async function complaintsStatusColumnExists() {
    const result = await db.query(`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'complaints' AND column_name = 'status'
        )
    `);

    return result.rows[0].exists;
}

exports.getDashboard = async (req, res) => {
    try {
        // Статистика
        const stats = {};
        
        // Количество пользователей
        const usersCount = await db.query('SELECT COUNT(*) FROM users');
        stats.users = usersCount.rows[0].count;
        
        // Количество новых пользователей за сегодня
        const todayUsers = await db.query(`
            SELECT COUNT(*) FROM users 
            WHERE DATE(created_at) = CURRENT_DATE
        `);
        stats.newUsersToday = todayUsers.rows[0].count;
        
        // Количество работ по статусам
        const worksStats = await db.query(`
            SELECT status, COUNT(*) 
            FROM works 
            GROUP BY status
        `);
        stats.works = {
            pending: 0,
            approved: 0,
            rejected: 0
        };
        worksStats.rows.forEach(row => {
            stats.works[row.status] = parseInt(row.count);
        });
        
        // Количество работ за сегодня
        const todayWorks = await db.query(`
            SELECT COUNT(*) FROM works 
            WHERE DATE(created_at) = CURRENT_DATE
        `);
        stats.worksToday = todayWorks.rows[0].count;
        
        // Количество открытых жалоб
        const complaintsCount = await db.query("SELECT COUNT(*) FROM complaints WHERE status = 'open'");
        stats.openComplaints = complaintsCount.rows[0].count;
        
        // Количество непрочитанных уведомлений
        const unreadNotifications = await db.query(`
            SELECT COUNT(*) FROM notifications WHERE is_read = FALSE
        `);
        stats.unreadNotifications = unreadNotifications.rows[0].count;
        
        // Последние 10 пользователей
        const recentUsers = await db.query(`
            SELECT id, username, email, created_at, role
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        // Последние 10 работ
        const recentWorks = await db.query(`
            SELECT w.*, u.username
            FROM works w
            JOIN users u ON w.user_id = u.id
            ORDER BY w.created_at DESC 
            LIMIT 10
        `);
        
        // Топ популярных тегов
        const popularTags = await db.query(`
            SELECT t.name, COUNT(wt.work_id) as count
            FROM tags t
            JOIN work_tags wt ON t.id = wt.tag_id
            GROUP BY t.id
            ORDER BY count DESC
            LIMIT 10
        `);
        
        // Активность по дням (последние 7 дней)
        const activity = await db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM works
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        
        res.render('admin/dashboard', {
            title: 'Панель администратора',
            stats,
            recentUsers: recentUsers.rows,
            recentWorks: recentWorks.rows,
            popularTags: popularTags.rows,
            activity: activity.rows,
            user: req.session.userId ? await User.findById(req.session.userId) : null,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.getModeration = async (req, res) => {
    try {
        const filter = req.query.filter || 'pending';
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        
        let whereClause = '';
        let countWhereClause = '';
        let queryParams = [limit, offset];
        
        if (filter === 'pending') {
            whereClause = "WHERE w.status = 'pending'";
            countWhereClause = "WHERE status = 'pending'";
        } else if (filter === 'approved') {
            whereClause = "WHERE w.status = 'approved'";
            countWhereClause = "WHERE status = 'approved'";
        } else if (filter === 'rejected') {
            whereClause = "WHERE w.status = 'rejected'";
            countWhereClause = "WHERE status = 'rejected'";
        }
        
        const pendingWorks = await db.query(`
            SELECT w.*, u.username, u.email, u.avatar_path,
                   array_agg(DISTINCT t.name) as tags
            FROM works w
            JOIN users u ON w.user_id = u.id
            LEFT JOIN work_tags wt ON w.id = wt.work_id
            LEFT JOIN tags t ON wt.tag_id = t.id
            ${whereClause}
            GROUP BY w.id, u.id
            ORDER BY w.created_at DESC
            LIMIT $1 OFFSET $2
        `, queryParams);
        
        // Получаем общее количество для пагинации
        const countResult = await db.query(`
            SELECT COUNT(*) FROM works ${countWhereClause}
        `);
        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);
        
        res.render('admin/moderation', {
            title: 'Модерация работ',
            works: pendingWorks.rows,
            currentPage: page,
            totalPages,
            filter,
            user: req.session.userId ? await User.findById(req.session.userId) : null,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.approveWork = async (req, res) => {
    try {
        const workId = req.params.id;
        await Work.updateStatus(workId, 'approved');
        
        // Добавляем уведомление пользователю
        const work = await Work.findById(workId);
        await db.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
            [work.user_id, 'Ваша работа была одобрена и опубликована!']
        );
        
        if (req.xhr) {
            res.json({ success: true, message: 'Работа одобрена' });
        } else {
            req.flash('success', 'Работа одобрена');
            res.redirect('/admin/moderation');
        }
    } catch (error) {
        console.error(error);
        if (req.xhr) {
            res.status(500).json({ success: false, message: 'Ошибка при одобрении работы' });
        } else {
            req.flash('error', 'Ошибка при одобрении работы');
            res.redirect('/admin/moderation');
        }
    }
};

exports.rejectWork = async (req, res) => {
    try {
        const { reason } = req.body;
        const workId = req.params.id;
        
        if (!reason) {
            if (req.xhr) {
                return res.status(400).json({ success: false, message: 'Укажите причину отклонения' });
            } else {
                req.flash('error', 'Укажите причину отклонения');
                return res.redirect('/admin/moderation');
            }
        }
        
        await Work.updateStatus(workId, 'rejected', reason);
        
        if (req.xhr) {
            res.json({ success: true, message: 'Работа отклонена' });
        } else {
            req.flash('success', 'Работа отклонена');
            res.redirect('/admin/moderation');
        }
    } catch (error) {
        console.error(error);
        if (req.xhr) {
            res.status(500).json({ success: false, message: 'Ошибка при отклонении работы' });
        } else {
            req.flash('error', 'Ошибка при отклонении работы');
            res.redirect('/admin/moderation');
        }
    }
};

exports.getComplaints = async (req, res) => {
    try {
        const filter = req.query.filter || 'open';
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const hasStatusColumn = await complaintsStatusColumnExists();

        let whereClause = '';
        let countWhereClause = '';

        if (hasStatusColumn) {
            if (filter === 'open') {
                whereClause = "WHERE c.status = 'open'";
                countWhereClause = "WHERE status = 'open'";
            } else if (filter === 'closed') {
                whereClause = "WHERE c.status = 'closed'";
                countWhereClause = "WHERE status = 'closed'";
            }
        }

        const statusSelect = hasStatusColumn ? 'c.*' : "c.*, 'open'::text AS status";

        const complaints = await db.query(`
            SELECT ${statusSelect},
                   u1.username as reporter_name,
                   u2.username as work_owner_name,
                   u2.id as work_owner_id,
                   w.title as work_title,
                   w.image_path,
                   w.id as work_id
            FROM complaints c
            LEFT JOIN users u1 ON c.reporter_user_id = u1.id
            JOIN works w ON c.work_id = w.id
            JOIN users u2 ON w.user_id = u2.id
            ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await db.query(`
           SELECT COUNT(*) FROM complaints ${countWhereClause}
        `);
        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);

        res.render('admin/complaints', {
            title: 'Жалобы',
            complaints: complaints.rows,
            totalCount,
            currentPage: page,
            totalPages,
            filter,
            user: req.session.userId ? await User.findById(req.session.userId) : null,
            path: req.path
        });
    } catch (error) {
        console.error('Ошибка загрузки жалоб:', error.message);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.closeComplaint = async (req, res) => {
    try {
        const hasStatusColumn = await complaintsStatusColumnExists();

        if (hasStatusColumn) {
            await db.query("UPDATE complaints SET status = 'closed' WHERE id = $1", [req.params.id]);
        }

        if (req.xhr) {
            res.json({ success: true, message: 'Жалоба закрыта' });
        } else {
            req.flash('success', 'Жалоба закрыта');
            res.redirect('/admin/complaints');
        }
    } catch (error) {
        console.error('Ошибка закрытия жалобы:', error.message);
        if (req.xhr) {
            res.status(500).json({ success: false, message: 'Ошибка при закрытии жалобы' });
        } else {
            req.flash('error', 'Ошибка при закрытии жалобы');
            res.redirect('/admin/complaints');
        }
    }
};

exports.deleteWork = async (req, res) => {
    try {
        const { reason } = req.body;
        const workId = req.params.id;
        
        if (!reason) {
            if (req.xhr) {
                return res.status(400).json({ success: false, message: 'Укажите причину удаления' });
            } else {
                req.flash('error', 'Укажите причину удаления');
                return res.redirect('/admin/complaints');
            }
        }
        
        // Получаем информацию о работе перед удалением
        const work = await Work.findById(workId);
        
        await Work.delete(workId, reason);
        
        // Закрываем связанные жалобы
        await db.query("UPDATE complaints SET status = 'closed' WHERE work_id = $1", [workId]);
        
        // Уведомление владельцу работы
        await db.query(
            'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
            [work.user_id, `Ваша работа "${work.title}" была удалена. Причина: ${reason}`]
        );
        
        if (req.xhr) {
            res.json({ success: true, message: 'Работа удалена' });
        } else {
            req.flash('success', 'Работа удалена');
            res.redirect('/admin/complaints');
        }
    } catch (error) {
        console.error(error);
        if (req.xhr) {
            res.status(500).json({ success: false, message: 'Ошибка при удалении работы' });
        } else {
            req.flash('error', 'Ошибка при удалении работы');
            res.redirect('/admin/complaints');
        }
    }
};

exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        
        let query = `
            SELECT u.id, u.username, u.email, u.role, u.created_at,
                   COUNT(DISTINCT w.id) as works_count
            FROM users u
            LEFT JOIN works w ON u.id = w.user_id AND w.status = 'approved'
        `;
        
        let countQuery = 'SELECT COUNT(*) FROM users';
        let queryParams = [];
        let countParams = [];
        
        if (search) {
            query += ` WHERE u.username ILIKE $1 OR u.email ILIKE $1`;
            countQuery += ` WHERE username ILIKE $1 OR email ILIKE $1`;
            queryParams = [`%${search}%`, limit, offset];
            countParams = [`%${search}%`];
        } else {
            queryParams = [limit, offset];
        }
        
        query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
        
        const users = await db.query(query, queryParams);
        
        const countResult = await db.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);
        
        res.render('admin/users', {
            title: 'Управление пользователями',
            users: users.rows,
            currentPage: page,
            totalPages,
            search,
            user: req.session.userId ? await User.findById(req.session.userId) : null,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const userId = req.params.id;
        
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Недопустимая роль' });
        }
        
        await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
        
        res.json({ success: true, message: 'Роль пользователя обновлена' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при обновлении роли' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Нельзя удалить самого себя
        if (parseInt(userId) === req.session.userId) {
            return res.status(400).json({ success: false, message: 'Нельзя удалить свой аккаунт' });
        }
        
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        
        res.json({ success: true, message: 'Пользователь удален' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Ошибка при удалении пользователя' });
    }
};

exports.getSettings = async (req, res) => {
    try {
        // Получаем настройки из базы (можно создать отдельную таблицу settings)
        const settings = await db.query('SELECT * FROM settings LIMIT 1');
        
        res.render('admin/settings', {
            title: 'Настройки',
            settings: settings.rows[0] || {},
            user: req.session.userId ? await User.findById(req.session.userId) : null,
            path: req.path
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('500', { title: 'Ошибка сервера' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { site_name, site_description, items_per_page, allow_registrations } = req.body;
        
        // Проверяем, есть ли уже настройки
        const exists = await db.query('SELECT COUNT(*) FROM settings');
        
        if (parseInt(exists.rows[0].count) > 0) {
            await db.query(
                'UPDATE settings SET site_name = $1, site_description = $2, items_per_page = $3, allow_registrations = $4, updated_at = CURRENT_TIMESTAMP',
                [site_name, site_description, items_per_page, allow_registrations === 'on']
            );
        } else {
            await db.query(
                'INSERT INTO settings (site_name, site_description, items_per_page, allow_registrations) VALUES ($1, $2, $3, $4)',
                [site_name, site_description, items_per_page, allow_registrations === 'on']
            );
        }
        
        req.flash('success', 'Настройки сохранены');
        res.redirect('/admin/settings');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Ошибка при сохранении настроек');
        res.redirect('/admin/settings');
    }
};
