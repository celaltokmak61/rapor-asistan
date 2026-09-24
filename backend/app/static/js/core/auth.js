// ==========================================================================
// Kimlik doğrulama
// İki Rol Mimarisi: 'admin' (Kokpit + Admin Paneli) & 'user' (Yalnızca Kokpit)
// ==========================================================================

const AuthModule = {
    STORAGE_KEY: 'rapor_asistan_auth_user',

    getUser() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    setUser(user) {
        if (user) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(this.STORAGE_KEY);
        }
    },

    isLoggedIn() {
        const user = this.getUser();
        return !!(user && user.username && user.role);
    },

    isAdmin() {
        const user = this.getUser();
        return !!(user && user.role === 'admin');
    },

    async login(username, password) {
        const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.detail || json.error || 'Giriş başarısız oldu.');
        }

        this.setUser(json.user);
        return json.user;
    },

    logout() {
        this.setUser(null);
        window.location.href = '/';
    },

    initPageAuth(pageType = 'cockpit') {
        const user = this.getUser();

        // 1. Admin Sayfası Güvenlik Kilidi
        if (pageType === 'admin') {
            if (!user) {
                alert('Admin paneline erişmek için lütfen önce giriş yapın.');
                window.location.href = '/';
                return;
            }
            if (user.role !== 'admin') {
                alert('⛔ Bu sayfaya yalnızca Sistem Yöneticisi (Admin) erişebilir!');
                window.location.href = '/';
                return;
            }

            // Admin sayfasındaki profil etiketini güncelle
            const adminUserBadge = document.getElementById('adminUserBadge');
            if (adminUserBadge) {
                adminUserBadge.innerHTML = `👤 <strong>${user.full_name || user.username}</strong> <span class="badge badge-green" style="margin-left:6px;">ADMIN</span>`;
            }
            return;
        }

        // 2. Ana Kokpit Sayfası Güvenlik & Giriş Ekranı
        const loginOverlay = document.getElementById('loginModalOverlay');
        const btnAdmin = document.getElementById('btnAdminPanel');
        const userBadge = document.getElementById('navUserBadge');

        if (!user) {
            // Giriş yapılmamış -> Login Ekranını Göster
            if (loginOverlay) loginOverlay.style.display = 'flex';
            if (btnAdmin) btnAdmin.style.display = 'none';
            if (userBadge) userBadge.style.display = 'none';
        } else {
            // Giriş yapılmış -> Login Ekranını Kapat, Kullanıcı Bilgisini Yaz
            if (loginOverlay) loginOverlay.style.display = 'none';
            
            // Admin Paneli Butonu SADECE admin rolüne görünür!
            if (btnAdmin) {
                btnAdmin.style.display = (user.role === 'admin') ? 'inline-flex' : 'none';
            }

            if (userBadge) {
                userBadge.style.display = 'inline-flex';
                const roleBadgeClass = user.role === 'admin' ? 'badge-green' : 'badge-mint';
                const roleLabel = user.role === 'admin' ? '👑 Admin' : '👤 User';
                userBadge.innerHTML = `
                    <span style="color:#f8fafc; font-weight:600; font-size:12.5px;">${user.full_name || user.username}</span>
                    <span class="badge ${roleBadgeClass}" style="font-size:10px; padding:2px 6px;">${roleLabel}</span>
                    <button class="btn-logout-icon" onclick="AuthModule.logout()" title="Oturumu Kapat">🚪</button>
                `;
            }
        }
    }
};

window.AuthModule = AuthModule;
window.logoutUser = () => AuthModule.logout();
