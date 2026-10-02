(function() {
    "use strict";

    const ENGINES = {
        bing: 'https://www.bing.com/search?q=',
        baidu: 'https://www.baidu.com/s?wd=',
        sogou: 'https://www.sogou.com/web?query=',
        google: 'https://www.google.com/search?q=',
        yahoo: 'https://search.yahoo.com/search?p=',
        bilibili: 'https://search.bilibili.com/all?keyword=',
        duckduckgo: 'https://duckduckgo.com/?q='
    };

    const defaultShortcuts = [
        { name: 'GitHub', url: 'https://github.com', icon: 'code' },
        { name: 'Bilibili', url: 'https://www.bilibili.com', icon: 'tv' },
        { name: 'Google', url: 'https://www.google.com', icon: 'public' },
        { name: 'YouTube', url: 'https://www.youtube.com', icon: 'play_arrow' }
    ];

    let shortcuts = (function() {
        try {
            const saved = localStorage.getItem('uniestart_shortcuts');
            return saved ? JSON.parse(saved) : defaultShortcuts;
        } catch(e) { return defaultShortcuts; }
    })();

    let currentEngine = localStorage.getItem('uniestart_engine') || 'bing';
    let openTarget = localStorage.getItem('uniestart_target') || '_blank';
    let isBgBlurred = localStorage.getItem('uniestart_blur') === '1';
    let isGreetingShow = localStorage.getItem('uniestart_greeting') !== '0';
    let theme = localStorage.getItem('uniestart_theme') || 'dark';

    let editingTileIndex = -1;
    let activeTileIndex = -1;

    // DOM 引用
    const wallpaperLayer = document.getElementById('wallpaperLayer');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const engineOptions = document.querySelectorAll('.desktop-capsule .engine-option');
    const navIndicator = document.getElementById('navIndicator');

    const greetingHeader = document.getElementById('greetingHeader');
    const greetingTitle = document.getElementById('greetingHeaderTitle');

    const customMenu = document.getElementById('customContextMenu');
    const menuHoverIndicator = document.getElementById('menuHoverIndicator');
    const menuTileDivider = document.getElementById('menuTileDivider');
    const menuEditTile = document.getElementById('menuEditTile');
    const menuDeleteTile = document.getElementById('menuDeleteTile');

    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const settingsDrawer = document.getElementById('settingsDrawer');

    // --- 问候语 ---
    function updateGreeting() {
        const hour = new Date().getHours();
        let text = 'Good evening!';
        if (hour >= 5 && hour < 12) text = 'Good morning!';
        else if (hour >= 12 && hour < 18) text = 'Good afternoon!';
        greetingTitle.textContent = text;
    }

    // --- 滑动指示条定位 ---
    function moveIndicator(element, animate = true) {
        if (!element || !navIndicator) return;
        const left = element.offsetLeft;
        const width = element.offsetWidth;

        if (!animate) navIndicator.style.transition = 'none';
        navIndicator.style.left = left + 'px';
        navIndicator.style.width = width + 'px';
        if (!animate) {
            requestAnimationFrame(() => {
                navIndicator.style.transition = 'left 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            });
        }
    }

    function setActiveEngine(key, animate = true) {
        if (!ENGINES[key]) return;
        currentEngine = key;
        localStorage.setItem('uniestart_engine', key);
        engineOptions.forEach(opt => {
            const match = opt.dataset.engine === key;
            opt.classList.toggle('active', match);
            if (match) moveIndicator(opt, animate);
        });
    }

    engineOptions.forEach(opt => {
        opt.addEventListener('click', function() {
            setActiveEngine(this.dataset.engine, true);
            searchInput.focus();
        });
    });

    // --- 搜索执行（智能网址直达） ---
    function performSearch() {
        const q = searchInput.value.trim();
        if (!q) return;

        const isUrl = /^https?:\/\//i.test(q) || /^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(:\d+)?(\/.*)?$/i.test(q);
        if (isUrl) {
            const dest = /^https?:\/\//i.test(q) ? q : 'https://' + q;
            if (openTarget === '_blank') window.open(dest, '_blank');
            else window.location.href = dest;
            return;
        }

        const url = ENGINES[currentEngine] + encodeURIComponent(q);
        if (openTarget === '_blank') window.open(url, '_blank');
        else window.location.href = url;
    }

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

    // --- 壁纸操作 ---
    function setWallpaper(force = false) {
        const cached = localStorage.getItem('uniestart_wp');
        if (cached && !force) {
            wallpaperLayer.style.backgroundImage = `url(${cached})`;
            return;
        }
        const url = 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN' + (force ? `&t=${Date.now()}` : '');
        const img = new Image();
        img.onload = () => {
            wallpaperLayer.style.backgroundImage = `url(${url})`;
            localStorage.setItem('uniestart_wp', url);
        };
        img.src = url;
    }

    function downloadBg() {
        const bg = window.getComputedStyle(wallpaperLayer).backgroundImage;
        if (!bg || bg === 'none') return;
        const url = bg.replace(/url\(['"]?/g, '').replace(/['"]?\)/g, '');
        fetch(url).then(r => r.blob()).then(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'wallpaper.jpg';
            a.click();
        }).catch(() => window.open(url, '_blank'));
    }

    // --- 快捷磁贴网格渲染（完全静止的暗黑毛玻璃卡片） ---
    let draggedIdx = null;
    function renderShortcuts() {
        const container = document.getElementById('shortcutsContainer');
        container.innerHTML = '';

        shortcuts.forEach((item, index) => {
            const card = document.createElement('a');
            card.className = 'shortcut-card';
            card.href = item.url;
            card.target = openTarget;
            card.draggable = true;

            const hostname = item.url.replace(/^https?:\/\//i, '').split('/')[0] || 'localhost';
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;

            card.innerHTML = `
                <div class="shortcut-icon-wrapper">
                    <img src="${faviconUrl}" alt="${item.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div class="shortcut-icon-fallback" style="display:none;"><span class="material-symbols-outlined">${item.icon || 'public'}</span></div>
                </div>
                <div class="shortcut-title">${item.name}</div>
            `;

            // 拖拽排序
            card.addEventListener('dragstart', () => { draggedIdx = index; card.classList.add('dragging'); });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedIdx = null;
                document.querySelectorAll('.shortcut-card').forEach(c => c.classList.remove('drag-over'));
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== index) card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (draggedIdx !== null && draggedIdx !== index) {
                    const moved = shortcuts.splice(draggedIdx, 1)[0];
                    shortcuts.splice(index, 0, moved);
                    localStorage.setItem('uniestart_shortcuts', JSON.stringify(shortcuts));
                    renderShortcuts();
                }
            });

            // 磁贴右键专属菜单
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                activeTileIndex = index;
                showContextMenu(e.clientX, e.clientY, true);
            });

            container.appendChild(card);
        });

        // 新建快捷卡片（完全静止的暗黑毛玻璃质感）
        const addBtn = document.createElement('div');
        addBtn.className = 'shortcut-card';
        addBtn.innerHTML = `
            <div class="shortcut-icon-wrapper">
                <span class="material-symbols-outlined" style="font-size:24px; color:inherit;">add</span>
            </div>
            <div class="shortcut-title">添加快捷</div>
        `;
        addBtn.addEventListener('click', openAddTileModal);
        container.appendChild(addBtn);
    }

    // --- 快捷磁贴弹窗 ---
    const tileModal = document.getElementById('tileModal');
    function openAddTileModal() {
        editingTileIndex = -1;
        document.getElementById('tileModalTitle').textContent = '添加快捷方式';
        document.getElementById('tileName').value = '';
        document.getElementById('tileUrl').value = '';
        tileModal.classList.add('active');
    }
    function openEditTileModal(idx) {
        editingTileIndex = idx;
        const it = shortcuts[idx];
        document.getElementById('tileModalTitle').textContent = '修改快捷方式';
        document.getElementById('tileName').value = it.name;
        document.getElementById('tileUrl').value = it.url;
        tileModal.classList.add('active');
    }

    document.getElementById('tileCancelBtn').addEventListener('click', () => tileModal.classList.remove('active'));
    document.getElementById('tileSaveBtn').addEventListener('click', () => {
        const name = document.getElementById('tileName').value.trim();
        let url = document.getElementById('tileUrl').value.trim();
        if (!name || !url) return;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

        if (editingTileIndex === -1) shortcuts.push({ name, url, icon: 'public' });
        else { shortcuts[editingTileIndex].name = name; shortcuts[editingTileIndex].url = url; }

        localStorage.setItem('uniestart_shortcuts', JSON.stringify(shortcuts));
        renderShortcuts();
        tileModal.classList.remove('active');
    });

    // --- 右键与长按菜单 ---
    function showContextMenu(x, y, isTile = false) {
        const w = window.innerWidth, h = window.innerHeight;
        if (x + 200 > w) x = w - 210;
        if (y + 200 > h) y = h - 210;

        const targetX = Math.max(10, x);
        const targetY = Math.max(10, y);
        const isAlreadyVisible = customMenu.classList.contains('show');

        if (!isAlreadyVisible) {
            // 首次展开时，禁止位置滑动动画，避免从上次旧位置飞过来
            customMenu.classList.add('no-move-anim');
            customMenu.style.left = `${targetX}px`;
            customMenu.style.top = `${targetY}px`;
            // 强制回流后恢复过渡，使得后续在开启状态下右键可以平滑滑动
            void customMenu.offsetWidth;
            customMenu.classList.remove('no-move-anim');
        } else {
            // 菜单已经在显示中，更新 left 和 top 会触发平滑滑动动画
            customMenu.style.left = `${targetX}px`;
            customMenu.style.top = `${targetY}px`;
        }

        menuTileDivider.style.display = isTile ? 'block' : 'none';
        menuEditTile.style.display = isTile ? 'flex' : 'none';
        menuDeleteTile.style.display = isTile ? 'flex' : 'none';

        hideMenuIndicator(false);
        customMenu.classList.add('show');
    }

    function hideContextMenu() {
        customMenu.classList.remove('show');
        hideMenuIndicator(false);
    }

    // 菜单项滑动高亮跟随
    function moveMenuIndicator(target, animate = true) {
        if (!target || !menuHoverIndicator) return;
        const top = target.offsetTop;
        const height = target.offsetHeight;

        if (!animate) menuHoverIndicator.style.transition = 'none';
        menuHoverIndicator.style.top = `${top}px`;
        menuHoverIndicator.style.height = `${height}px`;
        menuHoverIndicator.classList.add('active');

        if (!animate) {
            requestAnimationFrame(() => {
                menuHoverIndicator.style.transition = 'top 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.16s ease';
            });
        }
    }

    function hideMenuIndicator(animate = true) {
        if (!menuHoverIndicator) return;
        menuHoverIndicator.classList.remove('active');
        if (!animate) {
            menuHoverIndicator.style.transition = 'none';
            requestAnimationFrame(() => {
                menuHoverIndicator.style.transition = 'top 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.16s ease';
            });
        }
    }

    customMenu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            const hasActiveIndicator = menuHoverIndicator.classList.contains('active');
            moveMenuIndicator(item, hasActiveIndicator);
        });
    });

    customMenu.addEventListener('mouseleave', () => {
        hideMenuIndicator(true);
    });

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        activeTileIndex = -1;
        showContextMenu(e.clientX, e.clientY, false);
    });
    document.addEventListener('click', (e) => {
        if (!customMenu.contains(e.target)) hideContextMenu();
    });

    // 移动端长按适配
    (function() {
        let timer = null, startX, startY;
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            timer = setTimeout(() => {
                const tile = e.target.closest('.shortcut-card');
                const isTile = !!tile;
                if (navigator.vibrate) navigator.vibrate(30);
                showContextMenu(startX, startY, isTile);
            }, 500);
        }, { passive: true });
        document.addEventListener('touchmove', () => clearTimeout(timer), { passive: true });
        document.addEventListener('touchend', () => clearTimeout(timer), { passive: true });
    })();

    document.getElementById('menuSettings').addEventListener('click', openSidebar);
    document.getElementById('menuReload').addEventListener('click', () => window.location.reload());
    document.getElementById('menuDownloadBg').addEventListener('click', downloadBg);
    menuEditTile.addEventListener('click', () => { if (activeTileIndex !== -1) openEditTileModal(activeTileIndex); });
    menuDeleteTile.addEventListener('click', () => {
        if (activeTileIndex !== -1) {
            shortcuts.splice(activeTileIndex, 1);
            localStorage.setItem('uniestart_shortcuts', JSON.stringify(shortcuts));
            renderShortcuts();
        }
    });

    // --- 侧边栏设置抽屉控制 ---
    function openSidebar() {
        hideContextMenu();
        sidebarOverlay.classList.add('show');
        settingsDrawer.classList.add('open');
    }
    function closeSidebar() {
        sidebarOverlay.classList.remove('show');
        settingsDrawer.classList.remove('open');
    }

    document.getElementById('drawerCloseBtn').addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // 主题应用逻辑（深色/浅色/跟随系统）
    function applyTheme(th) {
        theme = th;
        document.body.setAttribute('data-theme', th);
        localStorage.setItem('uniestart_theme', th);
        settingTheme.value = th;
    }

    const settingTheme = document.getElementById('settingTheme');
    settingTheme.addEventListener('change', (e) => applyTheme(e.target.value));

    // 系统色彩变化响应
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        if (theme === 'auto') applyTheme('auto');
    });

    const toggleBlur = document.getElementById('toggleBlur');
    toggleBlur.checked = isBgBlurred;
    wallpaperLayer.classList.toggle('blurred', isBgBlurred);
    toggleBlur.addEventListener('change', (e) => {
        isBgBlurred = e.target.checked;
        wallpaperLayer.classList.toggle('blurred', isBgBlurred);
        localStorage.setItem('uniestart_blur', isBgBlurred ? '1' : '0');
    });

    const toggleGreeting = document.getElementById('toggleGreeting');
    toggleGreeting.checked = isGreetingShow;
    greetingHeader.classList.toggle('hidden', !isGreetingShow);
    toggleGreeting.addEventListener('change', (e) => {
        isGreetingShow = e.target.checked;
        greetingHeader.classList.toggle('hidden', !isGreetingShow);
        localStorage.setItem('uniestart_greeting', isGreetingShow ? '1' : '0');
    });

    const settingTarget = document.getElementById('settingTarget');
    settingTarget.value = openTarget;
    settingTarget.addEventListener('change', (e) => {
        openTarget = e.target.value;
        localStorage.setItem('uniestart_target', openTarget);
        renderShortcuts();
    });

    document.getElementById('btnRefreshWallpaper').addEventListener('click', () => setWallpaper(true));
    document.getElementById('btnDownloadWallpaper').addEventListener('click', downloadBg);

    // 全局按键监听与 Esc 关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
            hideContextMenu();
            tileModal.classList.remove('active');
            return;
        }
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
        if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;

        searchInput.focus();
        searchInput.value += e.key;
        e.preventDefault();
    });

    window.addEventListener('resize', () => {
        const activeOption = document.querySelector('.desktop-capsule .engine-option.active');
        if (activeOption) moveIndicator(activeOption, false);
    });

    // 初始化
    applyTheme(theme);
    updateGreeting();
    setWallpaper(false);
    renderShortcuts();
    setActiveEngine(currentEngine, false);
    setTimeout(() => { searchInput.focus(); }, 200);
})();
