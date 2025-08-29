        class UltimatePerfectIPTVPlayer {
            constructor() {
                // Connection properties
                this.serverUrl = '';
                this.macAddress = '';
                this.isConnected = false;
                
                // Data storage
                this.channels = [];
                this.genres = new Map(); // genre_id -> genre_name
                this.vodCategories = [];
                this.vodItems = [];
                this.seriesCategories = [];
                this.seriesItems = [];
                this.episodes = [];
                this.selectedSeriesId = null;
                this.selectedSeriesName = null;
                this.epgData = {}; // Store EPG data
                this.currentStreamUrl = ''; // Store current stream URL
                this.recentlyWatched = []; // Recently watched items
                this.favorites = []; // Favorite items
                
                // Current content data for search/filter
                this.currentContent = [];
                this.filteredContent = [];
                
                // UI state
                this.currentTab = 'live';
                this.currentCategory = 'all';
                this.currentView = 'grid';
                this.selectedCategoryId = null;
                this.selectedSeriesId = null;
                this.navigationStack = []; // For back navigation
                this.scrollMode = 'grid'; // 'grid' or 'page'
                this.isSearching = false;
                
                // Pagination
                this.currentPage = 1;
                this.itemsPerPage = 50;
                this.hasMoreItems = false;
                this.isLoading = false;
                this.loadingMore = false;
                
                // Player management
                this.videoPlayer = null;
                this.mpegtsPlayer = null;
                this.currentStreamController = null; // For aborting requests
                
                // Favorites and recent
                this.favorites = new Set();
                this.recent = [];
                
                this.init();
            }

            init() {
                this.setupEventListeners();
                this.setupInfiniteScroll();
                this.loadStoredData();
                
                // Video section starts visible
                
                this.showConnectionModal();
            }

            setupInfiniteScroll() {
                // Create intersection observer for better infinite scroll
                this.scrollObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && this.hasMoreItems && !this.loadingMore) {
                            this.loadMoreContent();
                        }
                    });
                }, {
                    root: null,
                    rootMargin: '100px',
                    threshold: 0.1
                });
            }

            setupEventListeners() {
                // Connection form
                document.getElementById('connection-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.connect();
                });
                
                // Tab switching
                document.querySelectorAll('.nav-pill').forEach(pill => {
                    pill.addEventListener('click', (e) => {
                        const tab = e.currentTarget.dataset.tab;
                        this.switchTab(tab);
                    });
                });
                
                // Search - Main content
                let searchTimeout;
                document.getElementById('search-input').addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.performSearch(e.target.value);
                    }, 300);
                });
                
                document.getElementById('search-btn').addEventListener('click', () => {
                    const query = document.getElementById('search-input').value;
                    this.performSearch(query);
                });
                
                document.getElementById('clear-search').addEventListener('click', () => {
                    document.getElementById('search-input').value = '';
                    this.performSearch('');
                });
                
                // Search - Categories
                let categorySearchTimeout;
                document.getElementById('category-search').addEventListener('input', (e) => {
                    clearTimeout(categorySearchTimeout);
                    categorySearchTimeout = setTimeout(() => {
                        this.filterCategories(e.target.value);
                    }, 300);
                });
                
                // View toggle
                document.getElementById('grid-view').addEventListener('click', () => this.setView('grid'));
                document.getElementById('list-view').addEventListener('click', () => this.setView('list'));
                
                // Player controls
                document.getElementById('copy-link').addEventListener('click', () => this.copyStreamLink());
                document.getElementById('minimize-player').addEventListener('click', () => this.minimizePlayer());
                document.getElementById('restore-player').addEventListener('click', () => this.restorePlayer());
                document.getElementById('pip-player').addEventListener('click', () => this.togglePictureInPicture());
                document.getElementById('fullscreen-player').addEventListener('click', () => this.toggleFullscreen());
                document.getElementById('stop-player').addEventListener('click', () => this.stopPlayer());
                
                // Navigation
                document.getElementById('back-btn').addEventListener('click', () => this.navigateBack());
                
                // Load more
                document.getElementById('load-more-btn').addEventListener('click', () => this.loadMoreContent());
                
                // Refresh categories
                document.getElementById('refresh-categories').addEventListener('click', () => this.refreshCategories());
                
                // Disconnect
                document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnect());
                
                // Scroll mode toggle
                document.getElementById('toggle-scroll-mode').addEventListener('click', () => this.toggleScrollMode());
                
                // Infinite scroll for content grid
                document.getElementById('content-grid-view').addEventListener('scroll', (e) => {
                    if (this.scrollMode === 'grid') {
                        this.handleScroll(e);
                    }
                });
                
                // Infinite scroll for full page
                window.addEventListener('scroll', () => {
                    if (this.scrollMode === 'page') {
                        this.handlePageScroll();
                    }
                });
                
                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => this.handleKeyboard(e));
            }

            showConnectionModal() {
                document.getElementById('connection-modal').classList.remove('hidden');
            }

            hideConnectionModal() {
                document.getElementById('connection-modal').classList.add('hidden');
            }

            async connect() {
                const connectBtn = document.querySelector('#connection-form button');
                const connectText = document.getElementById('connect-text');
                
                this.serverUrl = document.getElementById('server-url').value.trim();
                this.macAddress = document.getElementById('mac-address').value.trim();
                
                if (!this.serverUrl || !this.macAddress) {
                    this.showToast('Please fill in all fields', 'error');
                    return;
                }
                
                connectBtn.disabled = true;
                connectText.textContent = 'Connecting...';
                this.updateConnectionStatus('connecting');
                
                try {
                    // Test connection
                    const accountData = await this.fetchAccountInfo();
                    
                    // Load genres for proper channel mapping
                    await this.loadGenres();
                    
                    // Load initial content based on current tab
                    await this.loadTabContent();
                    
                    this.isConnected = true;
                    this.updateConnectionStatus('connected');
                    this.hideConnectionModal();
                    this.displayAccountInfo(accountData);
                    
                    this.showToast('Successfully connected!', 'success');
                    
                } catch (error) {
                    console.error('Connection error:', error);
                    this.updateConnectionStatus('disconnected');
                    this.showToast(`Connection failed: ${error.message}`, 'error');
                } finally {
                    connectBtn.disabled = false;
                    connectText.textContent = 'Connect to Server';
                }
            }

            async fetchAccountInfo() {
                const url = `${this.serverUrl}/server/load.php?type=account_info&action=get_main_info&mac=${this.macAddress}&JsHttpRequest=1-xml`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                return data.js || {};
            }

            updateConnectionStatus(status) {
                const indicator = document.getElementById('status-indicator');
                const statusText = document.getElementById('connection-status');
                
                indicator.className = 'status-indicator';
                
                switch (status) {
                    case 'connected':
                        indicator.classList.add('status-connected');
                        statusText.textContent = 'Connected';
                        break;
                    case 'connecting':
                        indicator.classList.add('status-connecting');
                        statusText.textContent = 'Connecting...';
                        break;
                    default:
                        indicator.classList.add('status-disconnected');
                        statusText.textContent = 'Disconnected';
                }
            }

            displayAccountInfo(accountData) {
                const accountInfo = document.getElementById('account-info');
                const accountDetails = document.getElementById('account-details');
                const disconnectBtn = document.getElementById('disconnect-btn');
                
                accountInfo.classList.remove('hidden');
                disconnectBtn.classList.remove('hidden');
                
                // Video section remains visible
                
                if (accountData.phone) {
                    const expiryDate = new Date(accountData.phone);
                    if (!isNaN(expiryDate.getTime())) {
                        const now = new Date();
                        const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                        
                        let statusClass = '';
                        if (daysLeft <= 3) statusClass = 'text-danger';
                        else if (daysLeft <= 7) statusClass = 'text-warning';
                        
                        accountDetails.innerHTML = `<span class="${statusClass}">Expires: ${expiryDate.toLocaleDateString()}</span>`;
                    }
                }
            }

            // GENRE LOADING: First load genres to map IDs to names
            async loadGenres() {
                try {
                    const url = `${this.serverUrl}/server/load.php?type=itv&action=get_genres&mac=${this.macAddress}&JsHttpRequest=1-xml`;
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.js && Array.isArray(data.js)) {
                        this.genres.clear();
                        data.js.forEach(genre => {
                            this.genres.set(genre.id, genre.title);
                        });
                        console.log('Loaded genres:', this.genres);
                    }
                } catch (error) {
                    console.error('Error loading genres:', error);
                }
            }

            // TAB SWITCHING
            switchTab(tabName) {
                // Update nav pills
                document.querySelectorAll('.nav-pill').forEach(pill => {
                    pill.classList.remove('active');
                });
                document.getElementById(`${tabName}-tab`).classList.add('active');
                
                this.currentTab = tabName;
                this.currentCategory = 'all';
                this.selectedCategoryId = null;
                this.currentPage = 1;
                this.navigationStack = [];
                
                // Clear search
                document.getElementById('search-input').value = '';
                document.getElementById('category-search').value = '';
                this.isSearching = false;
                
                // Hide breadcrumb
                document.getElementById('breadcrumb-nav').classList.add('hidden');
                
                // Update sidebar title
                const sidebarTitle = document.getElementById('sidebar-title');
                switch (tabName) {
                    case 'live':
                        sidebarTitle.textContent = 'GENRES';
                        break;
                    case 'movies':
                    case 'series':
                        sidebarTitle.textContent = 'CATEGORIES';
                        break;
                }
                
                // Clear previous content arrays to force fresh load
                switch (tabName) {
                    case 'live':
                        // Keep channels for live TV
                        break;
                    case 'movies':
                        this.vodItems = [];
                        break;
                    case 'series':
                        this.seriesItems = [];
                        break;
                }
                
                // Load content for the new tab
                this.loadTabContent();
            }

            async loadTabContent() {
                this.showLoading();
                
                try {
                    switch (this.currentTab) {
                        case 'live':
                            await this.loadChannels();
                            this.updateLiveCategories();
                            break;
                        case 'movies':
                            await this.loadVodCategories();
                            break;
                        case 'series':
                            await this.loadSeriesCategories();
                            break;
                    }
                } catch (error) {
                    this.showNoContent();
                    this.showToast(`Error loading ${this.currentTab}: ${error.message}`, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            // LIVE TV: Load channels and update categories
            async loadChannels(page = 1, append = false) {
                const url = `${this.serverUrl}/server/load.php?type=itv&action=get_all_channels&mac=${this.macAddress}&JsHttpRequest=1-xml`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.js && data.js.data) {
                    this.channels = data.js.data;
                    this.currentContent = this.channels;
                    this.displayContent();
                    console.log('Loaded channels:', this.channels.length);
                } else {
                    throw new Error('No channel data received');
                }
            }

            updateLiveCategories() {
                const container = document.getElementById('categories-container');
                container.innerHTML = '';
                
                // Store original categories for search
                this.originalCategories = [];
                
                // Add "All" category
                const allItem = this.createCategoryItem('all', 'All Channels', this.channels.length);
                container.appendChild(allItem);
                this.originalCategories.push({ id: 'all', name: 'All Channels', count: this.channels.length });
                
                // Count channels by genre
                const genreCounts = new Map();
                this.channels.forEach(channel => {
                    const genreId = channel.tv_genre_id;
                    if (genreId) {
                        genreCounts.set(genreId, (genreCounts.get(genreId) || 0) + 1);
                    }
                });
                
                // Create category items for each genre
                genreCounts.forEach((count, genreId) => {
                    const genreName = this.getGenreName(genreId);
                    const categoryItem = this.createCategoryItem(genreId, genreName, count);
                    container.appendChild(categoryItem);
                    this.originalCategories.push({ id: genreId, name: genreName, count });
                });
            }

            getGenreName(genreId) {
                return this.genres.get(genreId) || `Genre ${genreId}`;
            }

            // VOD: Load categories
            async loadVodCategories() {
                const url = `${this.serverUrl}/server/load.php?type=vod&action=get_categories&mac=${this.macAddress}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.js) {
                    this.vodCategories = data.js;
                    this.currentContent = this.vodCategories;
                    this.originalCategories = this.vodCategories.map(cat => ({
                        id: cat.id,
                        name: cat.title,
                        count: '?'
                    }));
                    this.updateVodCategories();
                    this.displayCategoryCards();
                } else {
                    throw new Error('No VOD categories received');
                }
            }

            updateVodCategories() {
                const container = document.getElementById('categories-container');
                container.innerHTML = '';
                
                // Add "All" option first
                const allItem = this.createCategoryItem('*', 'All Movies', '?');
                container.appendChild(allItem);
                
                // Then add individual categories
                this.vodCategories.forEach(category => {
                    const categoryItem = this.createCategoryItem(category.id, category.title, '?');
                    container.appendChild(categoryItem);
                });
            }

            displayCategoryCards() {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = '';
                
                const categoriesToShow = this.isSearching ? this.filteredContent : this.currentContent;
                
                categoriesToShow.forEach(category => {
                    const card = this.createCategoryCard(category, this.currentTab);
                    grid.appendChild(card);
                });
                
                this.showGridView();
            }

            createCategoryCard(category, type) {
                const card = document.createElement('div');
                card.className = 'content-card fade-in';
                
                const icon = type === 'movies' ? 'fa-film' : 'fa-tv';
                const color = type === 'movies' ? 'var(--primary)' : 'var(--accent)';
                
                card.innerHTML = `
                    <div class="card-header">
                        <i class="fas ${icon} fa-3x" style="color: ${color};"></i>
                        <div class="card-info">
                            <h6>${category.title}</h6>
                            <div class="subtitle">${type === 'movies' ? 'Movie' : 'Series'} Category</div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-primary w-100" onclick="app.loadCategoryItems('${category.id}', '${category.title}', '${type}')">
                            <i class="fas fa-folder-open me-2"></i>
                            Browse ${type === 'movies' ? 'Movies' : 'Series'}
                        </button>
                    </div>
                `;
                
                return card;
            }

            async loadCategoryItems(categoryId, categoryTitle, type) {
                // Push current state to navigation stack
                this.navigationStack.push({
                    type: 'categories',
                    tab: this.currentTab,
                    previousCategory: this.currentCategory
                });
                
                // Update breadcrumb
                this.showBreadcrumb(`${categoryTitle}`);
                
                // Update selected category in sidebar - ensure proper syncing
                this.currentCategory = categoryId;
                this.selectedCategoryId = categoryId;
                this.selectCategory(categoryId);
                
                // Clear any search to show all items in category
                document.getElementById('search-input').value = '';
                this.isSearching = false;
                
                if (type === 'movies') {
                    await this.loadVodItems(categoryId, categoryTitle);
                } else if (type === 'series') {
                    await this.loadSeriesItems(categoryId, categoryTitle);
                }
            }

            async loadVodItems(categoryId, categoryTitle, page = 1, append = false) {
                if (this.isLoading && !append) return;
                
                this.isLoading = true;
                if (!append) {
                    this.showLoading();
                    this.currentPage = 1;
                } else {
                    document.getElementById('load-more-spinner').classList.remove('hidden');
                }
                
                try {
                    const url = `${this.serverUrl}/server/load.php?action=get_ordered_list&category=${categoryId}&p=${page}&type=vod&sortby=added&mac=${this.macAddress}`;
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.js && data.js.data) {
                        const items = data.js.data;
                        
                        if (append) {
                            this.vodItems = this.vodItems.concat(items);
                        } else {
                            this.vodItems = items;
                            this.selectedCategoryId = categoryId;
                        }
                        
                        this.currentContent = this.vodItems;
                        this.displayContent();
                        // If we got any items, assume there might be more pages
                        this.hasMoreItems = items.length > 0;
                        this.updateLoadMoreButton();
                    }
                } catch (error) {
                    this.showToast(`Error loading movies: ${error.message}`, 'error');
                } finally {
                    this.isLoading = false;
                    this.hideLoading();
                    document.getElementById('load-more-spinner').classList.add('hidden');
                }
            }

            // SERIES: Load categories
            async loadSeriesCategories() {
                const url = `${this.serverUrl}/server/load.php?type=series&action=get_categories&mac=${this.macAddress}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.js) {
                    this.seriesCategories = data.js;
                    this.currentContent = this.seriesCategories;
                    this.originalCategories = this.seriesCategories.map(cat => ({
                        id: cat.id,
                        name: cat.title,
                        count: '?'
                    }));
                    this.updateSeriesCategories();
                    this.displayCategoryCards();
                } else {
                    throw new Error('No series categories received');
                }
            }

            updateSeriesCategories() {
                const container = document.getElementById('categories-container');
                container.innerHTML = '';
                
                // Add "All" option first
                const allItem = this.createCategoryItem('*', 'All Series', '?');
                container.appendChild(allItem);
                
                // Then add individual categories
                this.seriesCategories.forEach(category => {
                    const categoryItem = this.createCategoryItem(category.id, category.title, '?');
                    container.appendChild(categoryItem);
                });
            }

            async loadSeriesItems(categoryId, categoryTitle, page = 1, append = false) {
                if (this.isLoading && !append) return;
                
                this.isLoading = true;
                if (!append) {
                    this.showLoading();
                    this.currentPage = 1;
                } else {
                    document.getElementById('load-more-spinner').classList.remove('hidden');
                }
                
                try {
                    const url = `${this.serverUrl}/server/load.php?type=series&action=get_ordered_list&category=${categoryId}&p=${page}&mac=${this.macAddress}`;
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.js && data.js.data) {
                        const items = data.js.data;
                        
                        if (append) {
                            this.seriesItems = this.seriesItems.concat(items);
                        } else {
                            this.seriesItems = items;
                            this.selectedCategoryId = categoryId;
                        }
                        
                        this.currentContent = this.seriesItems;
                        this.displayContent();
                        // If we got any items, assume there might be more pages
                        this.hasMoreItems = items.length > 0;
                        this.updateLoadMoreButton();
                    }
                } catch (error) {
                    this.showToast(`Error loading series: ${error.message}`, 'error');
                } finally {
                    this.isLoading = false;
                    this.hideLoading();
                    document.getElementById('load-more-spinner').classList.add('hidden');
                }
            }

            // NAVIGATION
            showBreadcrumb(text) {
                const breadcrumbNav = document.getElementById('breadcrumb-nav');
                const breadcrumbText = document.getElementById('breadcrumb-text');
                
                breadcrumbNav.classList.remove('hidden');
                breadcrumbText.textContent = text;
            }

            hideBreadcrumb() {
                document.getElementById('breadcrumb-nav').classList.add('hidden');
            }

            navigateBack() {
                if (this.navigationStack.length === 0) return;
                
                const previousState = this.navigationStack.pop();
                
                if (previousState.type === 'categories') {
                    // Go back to categories
                    this.hideBreadcrumb();
                    
                    // Restore previous category or default to 'all'
                    this.currentCategory = previousState.previousCategory || 'all';
                    this.selectedCategoryId = null;
                    this.selectCategory(this.currentCategory);
                    
                    // Clear search when going back
                    document.getElementById('search-input').value = '';
                    this.isSearching = false;
                    
                    switch (this.currentTab) {
                        case 'movies':
                            this.currentContent = this.vodCategories;
                            this.vodItems = []; // Clear items to show categories
                            this.displayCategoryCards();
                            break;
                        case 'series':
                            this.currentContent = this.seriesCategories;
                            this.seriesItems = []; // Clear items to show categories
                            this.episodes = []; // Clear episodes
                            this.displayCategoryCards();
                            break;
                        case 'live':
                            // For live TV, we stay with current content
                            this.displayContent();
                            break;
                    }
                } else if (previousState.type === 'series-items') {
                    // Go back from episodes to series items
                    this.showBreadcrumb(`Back to Series`);
                    
                    // Clear search when going back
                    document.getElementById('search-input').value = '';
                    this.isSearching = false;
                    
                    // Restore series items view
                    this.selectedSeriesId = null;
                    this.selectedSeriesName = null;
                    this.episodes = []; // Clear episodes
                    this.currentContent = this.seriesItems;
                    this.displayContent();
                    
                    // Update breadcrumb to show we're back in series items
                    const categoryName = this.seriesCategories.find(cat => cat.id === this.selectedCategoryId)?.title || 'Series';
                    this.showBreadcrumb(categoryName);
                }
            }

            // CATEGORY MANAGEMENT
            createCategoryItem(id, name, count) {
                const item = document.createElement('div');
                item.className = `category-item ${id === this.currentCategory ? 'active' : ''}`;
                item.dataset.categoryId = id;
                
                item.innerHTML = `
                    <div class="category-name">${name}</div>
                    <div class="category-count">${count}</div>
                `;
                
                item.addEventListener('click', () => {
                    if (this.currentTab === 'live') {
                        this.selectCategory(id);
                    } else if ((this.currentTab === 'movies' || this.currentTab === 'series') && this.navigationStack.length === 0) {
                        // In category view, clicking sidebar category loads items
                        this.loadCategoryItems(id, name, this.currentTab === 'movies' ? 'movies' : 'series');
                    } else {
                        // In items view, just highlight the category
                        this.selectCategory(id);
                    }
                });
                
                return item;
            }

            selectCategory(categoryId) {
                // Update active category
                document.querySelectorAll('.category-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                const selectedItem = document.querySelector(`[data-category-id="${categoryId}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('active');
                }
                
                this.currentCategory = categoryId;
                this.selectedCategoryId = categoryId;
                
                // Clear search when changing category
                if (!this.isSearching) {
                    document.getElementById('search-input').value = '';
                }
                
                // Apply filtering based on current tab
                switch (this.currentTab) {
                    case 'live':
                        this.filterContent();
                        break;
                    case 'movies':
                        // For movies/series, if we're in items view, this should filter current items
                        if (this.navigationStack.length > 0 && this.vodItems.length > 0) {
                            this.displayContent();
                        }
                        break;
                    case 'series':
                        // For movies/series, if we're in items view, this should filter current items  
                        if (this.navigationStack.length > 0 && (this.seriesItems.length > 0 || this.currentContent.length > 0)) {
                            this.displayContent();
                        }
                        break;
                }
            }

            filterCategories(searchTerm) {
                const container = document.getElementById('categories-container');
                container.innerHTML = '';
                
                const term = searchTerm.toLowerCase();
                
                this.originalCategories.forEach(cat => {
                    if (cat.name.toLowerCase().includes(term)) {
                        const item = this.createCategoryItem(cat.id, cat.name, cat.count);
                        container.appendChild(item);
                    }
                });
            }

            filterContent() {
                if (this.currentTab === 'live') {
                    this.displayContent();
                }
            }

            // SEARCH FUNCTIONALITY
            async performSearch(query) {
                const searchTerm = query.toLowerCase().trim();
                this.isSearching = searchTerm !== '';
                
                if (!this.isSearching) {
                    this.filteredContent = [];
                    
                    // When clearing search, show appropriate content
                    if ((this.currentTab === 'movies' || this.currentTab === 'series') && this.navigationStack.length === 0) {
                        // In category view, show category cards
                        this.displayCategoryCards();
                    } else {
                        // In content view or live TV, show regular content
                        this.displayContent();
                    }
                    return;
                }
                
                switch (this.currentTab) {
                    case 'live':
                        // Filter channels based on selected genre/category
                        let channelsToSearch = this.channels;
                        
                        // If a genre is selected, only search within that genre
                        if (this.selectedCategoryId && this.selectedCategoryId !== 'all') {
                            channelsToSearch = this.channels.filter(channel => 
                                channel.tv_genre_id === this.selectedCategoryId
                            );
                        }
                        
                        // Now search within the filtered channels
                        this.filteredContent = channelsToSearch.filter(channel =>
                            channel.name.toLowerCase().includes(searchTerm)
                        );
                        this.displayContent();
                        break;
                        
                    case 'movies':
                        // Search movies from server
                        await this.searchMoviesFromServer(searchTerm);
                        break;
                        
                    case 'series':
                        // Search series from server
                        await this.searchSeriesFromServer(searchTerm);
                        break;
                }
            }
            
            async searchMoviesFromServer(searchTerm) {
                try {
                    // If no category selected, search categories instead
                    if (!this.selectedCategoryId || this.navigationStack.length === 0) {
                        // Search for categories matching the term
                        this.filteredContent = this.vodCategories.filter(cat =>
                            cat.title.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        this.displayCategoryCards();
                        return;
                    }
                    
                    // Use selected category or * for all
                    const categoryId = this.selectedCategoryId || '*';
                    const url = `${this.serverUrl}/server/load.php?action=get_ordered_list&category=${categoryId}&p=1&type=vod&sortby=added&search=${encodeURIComponent(searchTerm)}&mac=${this.macAddress}`;
                    console.log('Searching movies with URL:', url);
                    
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data.js && data.js.data) {
                        this.filteredContent = data.js.data.map(item => ({
                            id: item.id,
                            name: item.name,
                            poster: item.screenshot_uri || item.icon || '',
                            cmd: item.cmd,
                            type: 'vod'
                        }));
                        console.log(`Found ${this.filteredContent.length} movies matching "${searchTerm}"`);
                    } else {
                        this.filteredContent = [];
                    }
                    
                    this.displayContent();
                } catch (error) {
                    console.error('Error searching movies:', error);
                    this.showToast('Error searching movies', 'error');
                    this.filteredContent = [];
                    this.displayContent();
                }
            }
            
            async searchSeriesFromServer(searchTerm) {
                try {
                    // If no category selected, search categories instead
                    if (!this.selectedCategoryId || this.navigationStack.length === 0) {
                        // Search for categories matching the term
                        this.filteredContent = this.seriesCategories.filter(cat =>
                            cat.title.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        this.displayCategoryCards();
                        return;
                    }
                    
                    // Use selected category or * for all
                    const categoryId = this.selectedCategoryId || '*';
                    const url = `${this.serverUrl}/server/load.php?type=series&action=get_ordered_list&category=${categoryId}&mac=${this.macAddress}&search=${encodeURIComponent(searchTerm)}`;
                    console.log('Searching series with URL:', url);
                    
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data.js && data.js.data) {
                        this.filteredContent = data.js.data.map(item => ({
                            id: item.id,
                            name: item.name,
                            poster: item.screenshot_uri || item.icon || '',
                            cmd: item.cmd,
                            type: 'series'
                        }));
                        console.log(`Found ${this.filteredContent.length} series matching "${searchTerm}"`);
                    } else {
                        this.filteredContent = [];
                    }
                    
                    this.displayContent();
                } catch (error) {
                    console.error('Error searching series:', error);
                    this.showToast('Error searching series', 'error');
                    this.filteredContent = [];
                    this.displayContent();
                }
            }
            

            // CONTENT DISPLAY
            displayContent() {
                let items = [];
                
                if (this.isSearching) {
                    items = this.filteredContent;
                } else {
                    switch (this.currentTab) {
                        case 'live':
                            items = this.getFilteredChannels();
                            break;
                        case 'movies':
                            items = this.vodItems;
                            break;
                        case 'series':
                            // Use currentContent if we have episodes loaded, otherwise use seriesItems
                            if (this.currentContent.length > 0 && this.currentContent[0].type === 'episode') {
                                console.log('Using episodes from currentContent:', this.currentContent.length);
                                items = this.currentContent; // Episodes
                            } else {
                                console.log('Using series items:', this.seriesItems.length);
                                items = this.seriesItems; // Series items
                            }
                            break;
                    }
                }
                
                console.log('displayContent items:', items.length, items);
                
                if (items.length === 0) {
                    console.log('No items to display, showing no content');
                    this.showNoContent();
                    return;
                }
                
                this.hideNoContent();
                
                if (this.currentView === 'grid') {
                    console.log('Displaying grid content');
                    this.displayGridContent(items);
                } else {
                    console.log('Displaying table content');
                    this.displayTableContent(items);
                }
            }

            getFilteredChannels() {
                let filtered = this.channels;
                
                // Filter by category/genre
                if (this.currentCategory !== 'all') {
                    filtered = this.channels.filter(channel => 
                        channel.tv_genre_id === this.currentCategory
                    );
                }
                
                return filtered;
            }

            displayGridContent(items) {
                const grid = document.getElementById('content-grid');
                
                if (!this.loadingMore) {
                    grid.innerHTML = '';
                }
                
                items.forEach(item => {
                    const card = this.createContentCard(item);
                    grid.appendChild(card);
                });
                
                this.showGridView();
            }

            displayTableContent(items) {
                const tbody = document.getElementById('table-body');
                const header = document.getElementById('table-header');
                
                // Set table headers
                this.setTableHeaders(header);
                
                if (!this.loadingMore) {
                    tbody.innerHTML = '';
                }
                
                items.forEach(item => {
                    const row = this.createContentRow(item);
                    tbody.appendChild(row);
                });
                
                this.showTableView();
            }

            createContentCard(item) {
                switch (this.currentTab) {
                    case 'live':
                        return this.createChannelCard(item);
                    case 'movies':
                        return this.createVodCard(item);
                    case 'series':
                        if (item.type === 'episode') {
                            return this.createEpisodeCard(item);
                        } else {
                            return this.createSeriesCard(item);
                        }
                }
            }

            createChannelCard(channel) {
                const card = document.createElement('div');
                card.className = 'content-card fade-in';
                
                const logoUrl = this.buildLogoUrl(channel.logo);
                const genreName = this.getGenreName(channel.tv_genre_id);
                
                card.innerHTML = `
                    <div class="card-header">
                        <img src="${logoUrl}" alt="${channel.name}" class="card-logo" 
                             onerror="this.style.display='none'">
                        <div class="card-info">
                            <h6>${channel.name}</h6>
                            <div class="subtitle">${genreName} • #${channel.number || channel.id}</div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-primary" onclick="app.playChannel('${channel.id}', '${channel.cmd}', '${channel.name}')">
                            <i class="fas fa-play me-2"></i>Play
                        </button>
                        <button class="btn btn-outline" onclick="app.toggleFavorite('${channel.id}', '${channel.cmd}', '${channel.name}', 'live')">
                            <i class="fas fa-heart ${this.isFavorite(channel.id, 'live') ? 'text-danger' : ''}"></i>
                        </button>
                    </div>
                `;
                
                return card;
            }

            createVodCard(movie) {
                const card = document.createElement('div');
                card.className = 'content-card fade-in';
                
                const posterUrl = this.buildPosterUrl(movie.screenshot);
                
                card.innerHTML = `
                    <div class="card-header">
                        <img src="${posterUrl}" alt="${movie.name}" class="card-logo" 
                             onerror="this.style.display='none'">
                        <div class="card-info">
                            <h6>${movie.name}</h6>
                            <div class="subtitle">Movie • ${movie.year || 'Unknown'}</div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-primary" onclick="app.playVod('${movie.cmd}', '${movie.name}')">
                            <i class="fas fa-play me-2"></i>Play
                        </button>
                        <button class="btn btn-outline" onclick="app.toggleFavorite('${movie.id}', '${movie.cmd}', '${movie.name}', 'vod')">
                            <i class="fas fa-heart ${this.isFavorite(movie.id, 'vod') ? 'text-danger' : ''}"></i>
                        </button>
                    </div>
                `;
                
                return card;
            }

            createSeriesCard(series) {
                const card = document.createElement('div');
                card.className = 'content-card fade-in';
                
                const posterUrl = this.buildPosterUrl(series.screenshot);
                
                card.innerHTML = `
                    <div class="card-header">
                        <img src="${posterUrl}" alt="${series.name}" class="card-logo" 
                             onerror="this.style.display='none'">
                        <div class="card-info">
                            <h6>${series.name}</h6>
                            <div class="subtitle">TV Series • ID: ${series.id}</div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-primary" onclick="app.loadEpisodes('${series.id}', '${series.name}')">
                            <i class="fas fa-list me-2"></i>Episodes
                        </button>
                        <button class="btn btn-outline" onclick="app.toggleFavorite('${series.id}', '${series.cmd}', '${series.name}', 'series')">
                            <i class="fas fa-heart ${this.isFavorite(series.id, 'series') ? 'text-danger' : ''}"></i>
                        </button>
                    </div>
                `;
                
                return card;
            }

            createEpisodeCard(episode) {
                const card = document.createElement('div');
                card.className = 'content-card fade-in';
                
                const posterUrl = this.buildPosterUrl(episode.screenshot);
                
                card.innerHTML = `
                    <div class="card-header">
                        <img src="${posterUrl}" alt="${episode.name}" class="card-logo" 
                             onerror="this.style.display='none'">
                        <div class="card-info">
                            <h6>${episode.name}</h6>
                            <div class="subtitle">${episode.seriesName}</div>
                            ${episode.rating_imdb ? `<small class="text-warning">⭐ ${episode.rating_imdb}</small>` : ''}
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-primary" onclick="app.playEpisode('${episode.cmd.replace(/'/g, "\\'")}', '${episode.name.replace(/'/g, "\\'")}', '${episode.seriesName.replace(/'/g, "\\'")}')">
                            <i class="fas fa-play me-2"></i>Play
                        </button>
                        <button class="btn btn-outline" onclick="app.toggleFavorite('${episode.id}', '${episode.name.replace(/'/g, "\\'")}', 'episode')">
                            <i class="fas fa-star"></i>
                        </button>
                    </div>
                `;
                
                return card;
            }

            setTableHeaders(header) {
                switch (this.currentTab) {
                    case 'live':
                        header.innerHTML = `
                            <th>Logo</th>
                            <th>Number</th>
                            <th>Name</th>
                            <th>Genre</th>
                            <th>Actions</th>
                        `;
                        break;
                    case 'movies':
                        header.innerHTML = `
                            <th>Poster</th>
                            <th>Title</th>
                            <th>Year</th>
                            <th>Actions</th>
                        `;
                        break;
                    case 'series':
                        // Check if we're showing episodes or series
                        if (this.currentContent.length > 0 && this.currentContent[0].type === 'episode') {
                            header.innerHTML = `
                                <th>Poster</th>
                                <th>Episode</th>
                                <th>Series</th>
                                <th>Rating</th>
                                <th>Actions</th>
                            `;
                        } else {
                            header.innerHTML = `
                                <th>Poster</th>
                                <th>Title</th>
                                <th>Info</th>
                                <th>Actions</th>
                            `;
                        }
                        break;
                }
            }

            createContentRow(item) {
                switch (this.currentTab) {
                    case 'live':
                        return this.createChannelRow(item);
                    case 'movies':
                        return this.createVodRow(item);
                    case 'series':
                        if (item.type === 'episode') {
                            return this.createEpisodeRow(item);
                        } else {
                            return this.createSeriesRow(item);
                        }
                }
            }

            createChannelRow(channel) {
                const row = document.createElement('tr');
                row.className = 'fade-in';
                
                const logoUrl = this.buildLogoUrl(channel.logo);
                const genreName = this.getGenreName(channel.tv_genre_id);
                
                row.innerHTML = `
                    <td><img src="${logoUrl}" alt="${channel.name}" class="card-logo" onerror="this.style.display='none'"></td>
                    <td>${channel.number || channel.id}</td>
                    <td>${channel.name}</td>
                    <td>${genreName}</td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-primary btn-sm" onclick="app.playChannel('${channel.id}', '${channel.cmd}', '${channel.name}')">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="app.toggleFavorite('${channel.id}', '${channel.name}', 'live')">
                                <i class="fas fa-star"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                return row;
            }

            createVodRow(movie) {
                const row = document.createElement('tr');
                row.className = 'fade-in';
                
                const posterUrl = this.buildPosterUrl(movie.screenshot);
                
                row.innerHTML = `
                    <td><img src="${posterUrl}" alt="${movie.name}" class="card-logo" onerror="this.style.display='none'"></td>
                    <td>${movie.name}</td>
                    <td>${movie.year || 'Unknown'}</td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-primary btn-sm" onclick="app.playVod('${movie.cmd}', '${movie.name}')">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="app.toggleFavorite('${movie.id}', '${movie.name}', 'vod')">
                                <i class="fas fa-star"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                return row;
            }

            createSeriesRow(series) {
                const row = document.createElement('tr');
                row.className = 'fade-in';
                
                const posterUrl = this.buildPosterUrl(series.screenshot);
                
                row.innerHTML = `
                    <td><img src="${posterUrl}" alt="${series.name}" class="card-logo" onerror="this.style.display='none'"></td>
                    <td>${series.name}</td>
                    <td>Series ID: ${series.id}</td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-primary btn-sm" onclick="app.loadEpisodes('${series.id}', '${series.name}')">
                                <i class="fas fa-list"></i>
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="app.toggleFavorite('${series.id}', '${series.name}', 'series')">
                                <i class="fas fa-star"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                return row;
            }

            createEpisodeRow(episode) {
                const row = document.createElement('tr');
                row.className = 'fade-in';
                
                const posterUrl = this.buildPosterUrl(episode.screenshot);
                
                row.innerHTML = `
                    <td><img src="${posterUrl}" alt="${episode.name}" class="card-logo" onerror="this.style.display='none'"></td>
                    <td>${episode.name}</td>
                    <td>${episode.seriesName}</td>
                    <td>${episode.rating_imdb ? `⭐ ${episode.rating_imdb}` : 'N/A'}</td>
                    <td>
                        <div class="d-flex gap-2">
                            <button class="btn btn-primary btn-sm" onclick="app.playEpisode('${episode.cmd.replace(/'/g, "\\'")}', '${episode.name.replace(/'/g, "\\'")}', '${episode.seriesName.replace(/'/g, "\\'")}')">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="app.toggleFavorite('${episode.id}', '${episode.name.replace(/'/g, "\\'")}', 'episode')">
                                <i class="fas fa-star"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                return row;
            }

            buildLogoUrl(logoPath) {
                if (!logoPath) return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIGZpbGw9IiM2NjYiIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHBhdGggZD0iTTggMTVBNyA3IDAgMSAxIDggMWE3IDcgMCAwIDEgMCAxNFptMC0xMEE2IDYgMCAxIDAgOCAxNGE2IDYgMCAwIDAtNi02eiIvPjwvc3ZnPg==';
                
                if (logoPath.startsWith('http')) {
                    return logoPath;
                } else if (logoPath.startsWith('/')) {
                    return this.serverUrl + logoPath;
                } else {
                    return this.serverUrl + '/' + logoPath;
                }
            }

            buildPosterUrl(posterPath) {
                return this.buildLogoUrl(posterPath); // Same logic
            }

            // SCROLL MODE MANAGEMENT
            toggleScrollMode() {
                const body = document.body;
                const scrollIcon = document.getElementById('scroll-icon');
                const scrollText = document.getElementById('scroll-text');
                const videoSection = document.getElementById('video-section');
                
                if (this.scrollMode === 'grid') {
                    this.scrollMode = 'page';
                    body.classList.add('full-page-scroll');
                    scrollIcon.className = 'fas fa-file-alt';
                    scrollText.textContent = 'Page Scroll';
                    
                    // In page scroll mode, keep video player in fixed position (no changes needed)
                    // The video player is already positioned fixed in upper right corner
                } else {
                    this.scrollMode = 'grid';
                    body.classList.remove('full-page-scroll');
                    scrollIcon.className = 'fas fa-arrows-alt-v';
                    scrollText.textContent = 'Grid Scroll';
                    
                    // In grid scroll mode, keep video player in fixed position (no changes needed)
                    // The video player remains in upper right corner for both modes
                }
                
                this.showToast(`Switched to ${this.scrollMode} scroll mode`, 'info');
            }

            // INFINITE SCROLL AND PAGINATION
            handleScroll(e) {
                const container = e.target;
                const { scrollTop, scrollHeight, clientHeight } = container;
                
                console.log('Scroll detected - scrollTop:', scrollTop, 'scrollHeight:', scrollHeight, 'clientHeight:', clientHeight);
                console.log('hasMoreItems:', this.hasMoreItems, 'loadingMore:', this.loadingMore);
                
                if (scrollTop + clientHeight >= scrollHeight - 100) {
                    console.log('Triggering loadMoreContent');
                    this.loadMoreContent();
                }
            }

            handlePageScroll() {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const docHeight = document.documentElement.offsetHeight;
                
                if (scrollTop + windowHeight >= docHeight - 100) {
                    this.loadMoreContent();
                }
            }

            async loadMoreContent() {
                if (this.loadingMore || !this.hasMoreItems) return;
                
                this.loadingMore = true;
                this.currentPage++;
                
                switch (this.currentTab) {
                    case 'movies':
                        // Use * for all categories if none selected
                        const movieCategory = this.selectedCategoryId || '*';
                        await this.loadVodItems(movieCategory, '', this.currentPage, true);
                        break;
                    case 'series':
                        // Use * for all categories if none selected
                        const seriesCategory = this.selectedCategoryId || '*';
                        await this.loadSeriesItems(seriesCategory, '', this.currentPage, true);
                        break;
                }
                
                this.loadingMore = false;
            }

            updateLoadMoreButton() {
                const container = document.getElementById('load-more-container');
                const loadMoreBtn = document.getElementById('load-more-btn');
                
                if (this.hasMoreItems && !this.isLoading) {
                    container.classList.remove('hidden');
                    // Start observing the load more button for infinite scroll
                    if (this.scrollObserver && loadMoreBtn) {
                        this.scrollObserver.observe(loadMoreBtn);
                    }
                } else {
                    container.classList.add('hidden');
                    // Stop observing when no more items
                    if (this.scrollObserver && loadMoreBtn) {
                        this.scrollObserver.unobserve(loadMoreBtn);
                    }
                }
            }

            // PLAYER MANAGEMENT
            async playChannel(channelId, cmd, name) {
                try {
                    this.showToast('Loading stream...', 'info');
                    
                    const streamUrl = await this.fetchStreamUrl(cmd, 'live');
                    if (streamUrl) {
                        this.playStream(streamUrl, name, 'Live TV');
                        this.addToRecentlyWatched({ id: channelId, name, type: 'live', cmd });
                    }
                } catch (error) {
                    console.error('Error playing channel:', error);
                    this.showToast(`Error playing channel: ${error.message}`, 'error');
                }
            }

            async playVod(cmd, name) {
                try {
                    this.showToast('Loading movie...', 'info');
                    
                    const streamUrl = await this.fetchStreamUrl(cmd, 'vod');
                    if (streamUrl) {
                        this.playStream(streamUrl, name, 'Movie');
                        this.addToRecentlyWatched({ id: cmd, name, type: 'vod', cmd });
                    }
                } catch (error) {
                    console.error('Error playing movie:', error);
                    this.showToast(`Error playing movie: ${error.message}`, 'error');
                }
            }

            async playEpisode(cmd, episodeName, seriesName) {
                try {
                    console.log(`Playing episode: ${episodeName} (${cmd}) from series: ${seriesName}`);
                    this.showToast('Loading episode...', 'info');
                    
                    const streamUrl = await this.fetchStreamUrl(cmd, 'episode');
                    if (streamUrl) {
                        console.log('Episode stream URL:', streamUrl);
                        this.playStream(streamUrl, episodeName, `Episode - ${seriesName}`);
                        this.addToRecentlyWatched({ 
                            id: cmd, 
                            name: episodeName, 
                            type: 'series', 
                            cmd
                        });
                        this.showToast('Episode started playing', 'success');
                    } else {
                        throw new Error('No stream URL received');
                    }
                } catch (error) {
                    console.error('Error playing episode:', error);
                    this.showToast(`Error playing episode: ${error.message}`, 'error');
                }
            }

            async loadEpisodes(seriesId, seriesName) {
                console.log(`Loading episodes for series: ${seriesId} - ${seriesName}`);
                this.showToast('Loading episodes...', 'info');
                
                // Push current state to navigation stack
                this.navigationStack.push({
                    type: 'series-items',
                    tab: this.currentTab,
                    seriesId: seriesId,
                    seriesName: seriesName
                });
                
                // Update breadcrumb
                this.showBreadcrumb(`${seriesName} Episodes`);
                
                this.showLoading();
                
                try {
                    const url = `${this.serverUrl}/server/load.php?movie_id=${seriesId}&type=series&action=get_ordered_list&sortby=added&p=1&mac=${this.macAddress}`;
                    console.log('Episode request URL:', url);
                    
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    console.log('Episode response data:', data);
                    
                    if (data.js && data.js.data) {
                        this.episodes = data.js.data; // Store seasons data
                        this.selectedSeriesId = seriesId;
                        this.selectedSeriesName = seriesName;
                        
                        // Convert seasons/episodes to flat episode list for display
                        const flatEpisodes = this.flattenEpisodes(this.episodes, seriesName);
                        
                        if (flatEpisodes.length === 0) {
                            throw new Error('No episodes found in the series data');
                        }
                        
                        console.log('Setting currentContent to episodes:', flatEpisodes);
                        this.currentContent = flatEpisodes;
                        
                        // Clear any search to show all episodes
                        this.isSearching = false;
                        this.filteredContent = [];
                        
                        console.log('Calling displayContent for episodes...');
                        this.displayContent();
                        
                        this.showToast(`Loaded ${flatEpisodes.length} episodes`, 'success');
                    } else {
                        console.warn('Invalid episode response structure:', data);
                        throw new Error('No episode data received from server');
                    }
                } catch (error) {
                    console.error('Error loading episodes:', error);
                    this.showToast(`Error loading episodes: ${error.message}`, 'error');
                    this.showNoContent();
                    
                    // Remove the failed navigation from stack
                    if (this.navigationStack.length > 0) {
                        this.navigationStack.pop();
                    }
                } finally {
                    this.hideLoading();
                }
            }
            
            flattenEpisodes(seasons, seriesName) {
                const episodes = [];
                
                console.log('Flattening episodes from seasons:', seasons);
                
                if (!seasons || !Array.isArray(seasons)) {
                    console.warn('Invalid seasons data:', seasons);
                    return episodes;
                }
                
                seasons.forEach((season, seasonIndex) => {
                    console.log(`Processing season ${seasonIndex}:`, season);
                    
                    if (season.series && Array.isArray(season.series)) {
                        season.series.forEach(episodeNum => {
                            episodes.push({
                                id: `${season.id}:${episodeNum}`,
                                seasonId: season.id,
                                episodeNum: episodeNum,
                                name: `Season ${season.name || season.id} Episode ${episodeNum}`,
                                seriesName: seriesName,
                                cmd: `/media/${season.id}:${episodeNum}.mpg`,
                                screenshot: season.screenshot_uri || '',
                                description: season.description || '',
                                year: season.year || '',
                                rating_imdb: season.rating_imdb || '',
                                actors: season.actors || '',
                                director: season.director || '',
                                type: 'episode'
                            });
                        });
                    } else {
                        console.warn(`Season ${season.id} has no episodes or invalid series data:`, season.series);
                    }
                });
                
                console.log(`Flattened ${episodes.length} episodes`);
                
                return episodes.sort((a, b) => {
                    // Sort by season first, then by episode
                    if (a.seasonId !== b.seasonId) {
                        return parseInt(a.seasonId) - parseInt(b.seasonId);
                    }
                    return parseInt(a.episodeNum) - parseInt(b.episodeNum);
                });
            }

            async fetchStreamUrl(cmd, type = 'live') {
                // Cancel any existing request
                if (this.currentStreamController) {
                    this.currentStreamController.abort();
                }
                
                // Create new AbortController for this request
                this.currentStreamController = new AbortController();
                
                let url;
                if (type === 'live') {
                    url = `${this.serverUrl}/portal.php?type=itv&action=create_link&cmd=${encodeURIComponent(cmd)}&mac=${this.macAddress}`;
                } else if (type === 'episode') {
                    // Extract episode info from cmd - handle both formats
                    // Format 1: "/media/7060:1:1.mpg" (series:season:episode)  
                    // Format 2: "/media/307:19:4.mpg" (series:season:episode)
                    let episodeMatch = cmd.match(/\/media\/(\d+):(\d+):(\d+)\.mpg/);
                    let episodeId, seasonId, seriesId;
                    
                    if (episodeMatch) {
                        // Three-part format: series:season:episode
                        seriesId = episodeMatch[1];
                        seasonId = episodeMatch[2]; 
                        episodeId = episodeMatch[3];
                    } else {
                        // Try two-part format: season:episode (where season already includes series)
                        episodeMatch = cmd.match(/\/media\/([^:]+):(\d+)\.mpg/);
                        if (episodeMatch) {
                            seasonId = episodeMatch[1]; // This already includes series ID
                            episodeId = episodeMatch[2];
                        } else {
                            throw new Error(`Invalid episode command format: ${cmd}`);
                        }
                    }
                    
                    console.log(`Episode details: seasonId=${seasonId}, episodeId=${episodeId}, cmd=${cmd}`);
                    url = `${this.serverUrl}/server/load.php?series=${episodeId}&action=create_link&disable_ad=1&type=vod&cmd=${encodeURIComponent(cmd)}&mac=${this.macAddress}`;
                } else {
                    // VOD
                    url = `${this.serverUrl}/server/load.php?action=create_link&cmd=${encodeURIComponent(cmd)}&type=vod&mac=${this.macAddress}&disable_ad=1`;
                }
                
                console.log(`Fetching stream from: ${url}`);
                
                const response = await fetch(url, {
                    signal: this.currentStreamController.signal
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('Stream response data:', data);
                
                if (!data.js || !data.js.cmd) {
                    console.error('Invalid response structure:', data);
                    throw new Error('No stream command received');
                }
                
                // Extract stream URL
                const cmdString = data.js.cmd;
                const urlMatch = cmdString.match(/https?:\/\/[^\s]+/);
                
                if (urlMatch) {
                    return urlMatch[0];
                } else {
                    throw new Error('No valid stream URL found');
                }
            }

            playStream(url, title, type = '') {
                // Video section is always visible
                const videoSection = document.getElementById('video-section');
                
                // Store current stream URL for copying
                this.currentStreamUrl = url;
                
                // Update title
                document.getElementById('current-title').textContent = title;
                document.getElementById('current-subtitle').textContent = type;
                
                // Initialize player if needed
                if (!this.videoPlayer) {
                    this.initializePlayer();
                }
                
                // Stop existing players
                this.stopPlayer(false); // Don't show toast
                
                // Determine stream type and play
                if (url.includes('.ts') || url.includes('live') || type === 'Live TV') {
                    this.playLiveStream(url);
                } else if (type.includes('Episode')) {
                    this.playEpisodeStream(url);
                } else {
                    this.playVodStream(url);
                }
            }

            playLiveStream(url) {
                if (typeof mpegts !== 'undefined' && mpegts.getFeatureList().mseLivePlayback) {
                    try {
                        this.mpegtsPlayer = mpegts.createPlayer({
                            type: 'mse',
                            isLive: true,
                            url: url
                        });
                        
                        const videoElement = this.videoPlayer.el().querySelector('video');
                        this.mpegtsPlayer.attachMediaElement(videoElement);
                        this.mpegtsPlayer.load();
                        this.mpegtsPlayer.play();
                        
                    } catch (error) {
                        console.warn('MPEGTS failed, falling back to Video.js:', error);
                        this.videoPlayer.src({ src: url, type: 'application/x-mpegURL' });
                        this.videoPlayer.play();
                    }
                } else {
                    this.videoPlayer.src({ src: url, type: 'application/x-mpegURL' });
                    this.videoPlayer.play();
                }
            }

            playVodStream(url) {
                const type = url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
                this.videoPlayer.src({ src: url, type: type });
                this.videoPlayer.play();
            }
            
            playEpisodeStream(url) {
                // Episodes are typically MP4 or TS streams
                const type = url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
                this.videoPlayer.src({ src: url, type: type });
                this.videoPlayer.play();
            }

            initializePlayer() {
                // Check if player is already initialized and working
                if (this.videoPlayer && !this.videoPlayer.isDisposed()) {
                    return; // Player already exists and is functional
                }
                
                // Dispose existing player if it exists but is disposed
                if (this.videoPlayer) {
                    try {
                        this.videoPlayer.dispose();
                    } catch (error) {
                        console.warn('Error disposing existing player:', error);
                    }
                }
                
                // Initialize new player
                try {
                    this.videoPlayer = videojs('video-player', {
                        fluid: true,
                        responsive: true,
                        playbackRates: [0.5, 1, 1.25, 1.5, 2],
                        controls: true,
                        preload: 'auto'
                    });
                } catch (error) {
                    console.error('Error initializing video player:', error);
                    this.showToast('Error initializing video player', 'error');
                }
            }

            // STOP PLAYER: Clean termination of all streams and requests
            stopPlayer(showToast = true) {
                // Cancel any pending stream requests
                if (this.currentStreamController) {
                    this.currentStreamController.abort();
                    this.currentStreamController = null;
                }
                
                // Stop MPEGTS player first
                if (this.mpegtsPlayer) {
                    try {
                        this.mpegtsPlayer.unload();
                        this.mpegtsPlayer.detachMediaElement();
                        this.mpegtsPlayer.destroy();
                    } catch (error) {
                        console.warn('Error destroying MPEGTS player:', error);
                    }
                    this.mpegtsPlayer = null;
                }
                
                // Stop Video.js player
                if (this.videoPlayer) {
                    try {
                        this.videoPlayer.pause();
                        this.videoPlayer.src(''); // Clear source
                    } catch (error) {
                        console.warn('Error stopping video player:', error);
                    }
                }
                
                // Video section remains visible even when stopped
                
                // Update UI
                document.getElementById('current-title').textContent = 'Stream stopped';
                document.getElementById('current-subtitle').textContent = 'Player ready';
                
                if (showToast) {
                    this.showToast('Stream stopped', 'info');
                }
            }

            copyStreamLink() {
                if (!this.currentStreamUrl) {
                    this.showToast('No stream URL available', 'warning');
                    return;
                }
                
                // Copy to clipboard
                navigator.clipboard.writeText(this.currentStreamUrl).then(() => {
                    this.showToast('Stream URL copied to clipboard!', 'success');
                    console.log('Stream URL:', this.currentStreamUrl);
                }).catch(err => {
                    console.error('Failed to copy URL:', err);
                    this.showToast('Failed to copy URL', 'error');
                });
            }
            
            minimizePlayer() {
                const videoSection = document.getElementById('video-section');
                videoSection.classList.add('minimized');
                document.getElementById('minimize-player').style.display = 'none';
                document.getElementById('restore-player').style.display = 'inline-flex';
            }

            restorePlayer() {
                const videoSection = document.getElementById('video-section');
                videoSection.classList.remove('minimized');
                document.getElementById('minimize-player').style.display = 'inline-flex';
                document.getElementById('restore-player').style.display = 'none';
            }

            async togglePictureInPicture() {
                if (!this.videoPlayer) return;
                
                const videoElement = this.videoPlayer.el().querySelector('video');
                
                try {
                    if (document.pictureInPictureElement) {
                        await document.exitPictureInPicture();
                        this.showToast('Exited Picture-in-Picture', 'info');
                    } else {
                        await videoElement.requestPictureInPicture();
                        this.showToast('Entered Picture-in-Picture', 'success');
                    }
                } catch (error) {
                    console.error('PiP error:', error);
                    this.showToast('Picture-in-Picture not supported', 'warning');
                }
            }
            
            toggleFullscreen() {
                if (this.videoPlayer) {
                    if (this.videoPlayer.isFullscreen()) {
                        this.videoPlayer.exitFullscreen();
                    } else {
                        this.videoPlayer.requestFullscreen();
                    }
                }
            }

            // VIEW MANAGEMENT
            setView(viewType) {
                document.querySelectorAll('.view-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.getElementById(`${viewType}-view`).classList.add('active');
                
                this.currentView = viewType;
                this.displayContent();
            }

            showGridView() {
                document.getElementById('content-grid-view').classList.remove('hidden');
                document.getElementById('content-table-view').classList.add('hidden');
            }

            showTableView() {
                document.getElementById('content-grid-view').classList.add('hidden');
                document.getElementById('content-table-view').classList.remove('hidden');
            }

            // LOADING STATES
            showLoading() {
                document.getElementById('loading-state').classList.remove('hidden');
                document.getElementById('content-grid-view').classList.add('hidden');
                document.getElementById('content-table-view').classList.add('hidden');
                document.getElementById('no-content-state').classList.add('hidden');
            }

            hideLoading() {
                document.getElementById('loading-state').classList.add('hidden');
            }

            showNoContent() {
                document.getElementById('no-content-state').classList.remove('hidden');
                document.getElementById('content-grid-view').classList.add('hidden');
                document.getElementById('content-table-view').classList.add('hidden');
            }

            hideNoContent() {
                document.getElementById('no-content-state').classList.add('hidden');
            }

            // FAVORITES AND RECENT
            toggleFavorite(id, name, type) {
                const key = `${type}-${id}`;
                
                if (this.favorites.has(key)) {
                    this.favorites.delete(key);
                    this.showToast('Removed from favorites', 'info');
                } else {
                    this.favorites.add(key);
                    this.showToast('Added to favorites', 'success');
                }
                
                this.saveFavorites();
            }

            addToRecent(item) {
                this.recent = this.recent.filter(r => r.id !== item.id);
                this.recent.unshift(item);
                this.recent = this.recent.slice(0, 10);
                this.saveRecent();
            }

            loadStoredData() {
                const storedFavorites = localStorage.getItem('ultimate-iptv-favorites');
                if (storedFavorites) {
                    this.favorites = new Set(JSON.parse(storedFavorites));
                }
                
                const storedRecent = localStorage.getItem('ultimate-iptv-recent');
                if (storedRecent) {
                    this.recent = JSON.parse(storedRecent);
                }
            }

            saveFavorites() {
                localStorage.setItem('ultimate-iptv-favorites', JSON.stringify([...this.favorites]));
            }

            saveRecent() {
                localStorage.setItem('ultimate-iptv-recent', JSON.stringify(this.recent));
            }

            // UTILITY FUNCTIONS
            refreshCategories() {
                this.loadTabContent();
            }

            disconnect() {
                this.isConnected = false;
                this.stopPlayer();
                this.updateConnectionStatus('disconnected');
                
                // Reset data
                this.channels = [];
                this.vodCategories = [];
                this.seriesCategories = [];
                this.genres.clear();
                
                // Hide UI elements and reset video section
                document.getElementById('account-info').classList.add('hidden');
                document.getElementById('disconnect-btn').classList.add('hidden');
                // Video section remains visible
                
                this.showConnectionModal();
                this.showToast('Disconnected from server', 'info');
            }

            handleKeyboard(e) {
                // Global shortcuts
                switch (e.key) {
                    case ' ':  // Spacebar
                        if (this.videoPlayer && !e.target.matches('input')) {
                            e.preventDefault();
                            if (this.videoPlayer.paused()) {
                                this.videoPlayer.play();
                            } else {
                                this.videoPlayer.pause();
                            }
                        }
                        break;
                    case 'Escape':
                        if (this.videoPlayer) {
                            this.stopPlayer();
                        }
                        break;
                    case 'ArrowLeft':
                        if (this.videoPlayer && !e.target.matches('input')) {
                            e.preventDefault();
                            this.videoPlayer.currentTime(this.videoPlayer.currentTime() - 10);
                        }
                        break;
                    case 'ArrowRight':
                        if (this.videoPlayer && !e.target.matches('input')) {
                            e.preventDefault();
                            this.videoPlayer.currentTime(this.videoPlayer.currentTime() + 10);
                        }
                        break;
                }
                
                // Ctrl/Cmd shortcuts
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key) {
                        case '1':
                            e.preventDefault();
                            this.switchTab('live');
                            break;
                        case '2':
                            e.preventDefault();
                            this.switchTab('movies');
                            break;
                        case '3':
                            e.preventDefault();
                            this.switchTab('series');
                            break;
                        case 'f':
                            e.preventDefault();
                            this.toggleFullscreen();
                            break;
                        case 'c':
                            e.preventDefault();
                            this.copyStreamLink();
                            break;
                        case 's':
                            e.preventDefault();
                            this.stopPlayer();
                            break;
                        case 'b':
                            e.preventDefault();
                            this.navigateBack();
                            break;
                    }
                }
                
                // ESC key for back navigation
                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (this.navigationStack.length > 0) {
                        this.navigateBack();
                    }
                }
            }

            showToast(message, type = 'info') {
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                
                const icon = {
                    'success': 'fa-check-circle',
                    'error': 'fa-exclamation-circle',
                    'warning': 'fa-exclamation-triangle',
                    'info': 'fa-info-circle'
                }[type] || 'fa-info-circle';
                
                toast.innerHTML = `
                    <i class="fas ${icon}"></i>
                    <span>${message}</span>
                    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--text-muted); margin-left: auto;">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                
                container.appendChild(toast);
                
                setTimeout(() => toast.classList.add('show'), 100);
                
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, 5000);
            }
            
            // CLEANUP AND ERROR HANDLING
            cleanup() {
                // Clean up intersection observer
                if (this.scrollObserver) {
                    this.scrollObserver.disconnect();
                    this.scrollObserver = null;
                }
                
                // Stop all media playback
                this.stopPlayer(false);
                
                // Dispose video player
                if (this.videoPlayer) {
                    try {
                        this.videoPlayer.dispose();
                    } catch (error) {
                        console.warn('Error disposing video player:', error);
                    }
                    this.videoPlayer = null;
                }
                
                // Clear all timers and intervals
                // (Add any specific timers here if needed)
            }
            
            // Global error handler
            handleGlobalError(error) {
                console.error('Global error:', error);
                this.showToast('An unexpected error occurred. Please refresh the page.', 'error');
            }
            
            // RECENTLY WATCHED FUNCTIONALITY
            loadRecentlyWatched() {
                const stored = localStorage.getItem('iptv_recently_watched');
                this.recentlyWatched = stored ? JSON.parse(stored) : [];
                this.updateRecentlyWatchedDisplay();
            }
            
            addToRecentlyWatched(item) {
                // Remove if already exists
                this.recentlyWatched = this.recentlyWatched.filter(r => r.id !== item.id || r.type !== item.type);
                
                // Add to beginning
                this.recentlyWatched.unshift({
                    ...item,
                    timestamp: Date.now()
                });
                
                // Keep only last 10 items
                this.recentlyWatched = this.recentlyWatched.slice(0, 10);
                
                // Save to localStorage
                localStorage.setItem('iptv_recently_watched', JSON.stringify(this.recentlyWatched));
                this.updateRecentlyWatchedDisplay();
            }
            
            updateRecentlyWatchedDisplay() {
                const container = document.getElementById('recently-watched-container');
                const section = document.getElementById('recently-watched-section');
                
                if (this.recentlyWatched.length === 0) {
                    section.style.display = 'none';
                    return;
                }
                
                section.style.display = 'block';
                const html = this.recentlyWatched.map(item => {
                    const icon = item.type === 'live' ? 'broadcast-tower' : item.type === 'vod' ? 'film' : 'tv';
                    const timeAgo = this.getTimeAgo(item.timestamp);
                    
                    return `
                        <div class="recent-item" onclick="app.playRecentItem('${item.id}', '${item.cmd}', '${item.name}', '${item.type}')">
                            <div class="recent-item-icon">
                                <i class="fas fa-${icon}"></i>
                            </div>
                            <div class="recent-item-info">
                                <h6>${item.name}</h6>
                                <small>${timeAgo}</small>
                            </div>
                        </div>
                    `;
                }).join('');
                
                container.innerHTML = html;
            }
            
            playRecentItem(id, cmd, name, type) {
                if (type === 'live') {
                    this.playChannel(cmd, name);
                } else if (type === 'vod') {
                    this.playMovie(id, cmd, name);
                } else {
                    this.playEpisode(cmd, name);
                }
            }
            
            // FAVORITES FUNCTIONALITY
            loadFavorites() {
                const stored = localStorage.getItem('iptv_favorites');
                this.favorites = stored ? JSON.parse(stored) : [];
                this.updateFavoritesDisplay();
            }
            
            toggleFavorite(id, cmd, name, type) {
                const existingIndex = this.favorites.findIndex(f => f.id === id && f.type === type);
                
                if (existingIndex !== -1) {
                    // Remove from favorites
                    this.favorites.splice(existingIndex, 1);
                    this.showToast('Removed from favorites', 'info');
                } else {
                    // Add to favorites
                    this.favorites.push({
                        id: id,
                        cmd: cmd,
                        name: name,
                        type: type,
                        timestamp: Date.now()
                    });
                    this.showToast('Added to favorites', 'success');
                }
                
                // Save to localStorage
                localStorage.setItem('iptv_favorites', JSON.stringify(this.favorites));
                this.updateFavoritesDisplay();
            }
            
            isFavorite(id, type) {
                return this.favorites.some(f => f.id === id && f.type === type);
            }
            
            updateFavoritesDisplay() {
                const container = document.getElementById('favorites-container');
                const section = document.getElementById('favorites-section');
                
                if (this.favorites.length === 0) {
                    section.style.display = 'none';
                    return;
                }
                
                section.style.display = 'block';
                const html = this.favorites.map(item => {
                    const icon = item.type === 'live' ? 'broadcast-tower' : item.type === 'vod' ? 'film' : 'tv';
                    
                    return `
                        <div class="favorite-item" onclick="app.playFavoriteItem('${item.id}', '${item.cmd}', '${item.name}', '${item.type}')">
                            <div class="favorite-item-icon">
                                <i class="fas fa-${icon}"></i>
                            </div>
                            <div class="favorite-item-info">
                                <h6>${item.name}</h6>
                                <small><i class="fas fa-heart text-danger"></i> Favorite</small>
                            </div>
                        </div>
                    `;
                }).join('');
                
                container.innerHTML = html;
            }
            
            playFavoriteItem(id, cmd, name, type) {
                if (type === 'live') {
                    this.playChannel(cmd, name);
                } else if (type === 'vod') {
                    this.playMovie(id, cmd, name);
                } else {
                    this.playEpisode(cmd, name);
                }
            }
            
            // UTILITY FUNCTIONS
            getTimeAgo(timestamp) {
                const now = Date.now();
                const diff = now - timestamp;
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);
                
                if (days > 0) return `${days}d ago`;
                if (hours > 0) return `${hours}h ago`;
                if (minutes > 0) return `${minutes}m ago`;
                return 'Just now';
            }
        }

        // Initialize the application
        const app = new UltimatePerfectIPTVPlayer();
        window.app = app;
        
        // Load persistent data
        app.loadRecentlyWatched();
        app.loadFavorites();
        
        // Global error handling
        window.addEventListener('error', (e) => {
            app.handleGlobalError(e.error);
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            app.handleGlobalError(e.reason);
            e.preventDefault(); // Prevent the default browser behavior
        });
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            app.cleanup();
        });
