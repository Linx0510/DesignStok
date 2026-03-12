// Добавление в избранное
document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const workId = btn.dataset.workId;
        
        try {
            const response = await fetch(`/works/${workId}/favorite`, {
                method: btn.dataset.favorited === 'true' ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const isFavorited = btn.dataset.favorited === 'true';
                btn.dataset.favorited = (!isFavorited).toString();
                btn.classList.toggle('favorited');
                
                const countSpan = btn.querySelector('.favorite-count');
                if (countSpan) {
                    let count = parseInt(countSpan.textContent);
                    count = isFavorited ? count - 1 : count + 1;
                    countSpan.textContent = count;
                }
            }
        } catch (error) {
            console.error('Ошибка:', error);
        }
    });
});

// Бесконечная прокрутка
let loading = false;
let page = 1;

window.addEventListener('scroll', () => {
    if (loading) return;
    
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    if (scrollTop + clientHeight >= scrollHeight - 100) {
        loadMore();
    }
});

async function loadMore() {
    loading = true;
    page++;
    
    try {
        const response = await fetch(`/works/search?page=${page}${window.location.search}`);
        const html = await response.text();
        
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        const newWorks = temp.querySelector('.works-grid');
        if (newWorks) {
            document.querySelector('.works-grid').appendChild(newWorks);
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
    } finally {
        loading = false;
    }
}

// Отметка уведомлений как прочитанных
document.querySelectorAll('.mark-read').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const notificationId = btn.dataset.notificationId;
        
        try {
            await fetch(`/notifications/${notificationId}/read`, {
                method: 'POST'
            });
            
            const notification = btn.closest('.notification');
            notification.classList.add('read');
        } catch (error) {
            console.error('Ошибка:', error);
        }
    });
});

// Отметить все как прочитанные
const markAllBtn = document.querySelector('.mark-all-read');
if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
        try {
            await fetch('/notifications/read-all', {
                method: 'POST'
            });
            
            document.querySelectorAll('.notification').forEach(n => {
                n.classList.add('read');
            });
        } catch (error) {
            console.error('Ошибка:', error);
        }
    });
}

// Валидация форм на клиенте
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
        const password = form.querySelector('#password');
        const confirmPassword = form.querySelector('#confirmPassword');
        
        if (password && confirmPassword && password.value !== confirmPassword.value) {
            e.preventDefault();
            alert('Пароли не совпадают');
        }
        
        const file = form.querySelector('input[type="file"]');
        if (file && file.files[0]) {
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.files[0].size > maxSize) {
                e.preventDefault();
                alert('Файл слишком большой. Максимальный размер 5MB');
            }
        }
    });
});