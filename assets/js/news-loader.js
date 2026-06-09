/* ============================================
  * 村庄改造吧官网 - 动态列表加载器 v3
   自动扫描 news/content/ 目录下的 .json 文件
   支持多标签筛选和封面图片展示
   ============================================ */

(function () {
  'use strict';

  class NewsLoader {
    constructor(options) {
      this.container = document.getElementById(options.containerId || 'news-container');
      this.contentPath = options.contentPath || 'content/';
      this.limit = options.limit || 10;
      this.currentPage = 1;
      this.allNews = [];
      this.filteredNews = [];
      this.activeTag = 'all';
      this.paginationContainer = document.getElementById(options.paginationId || 'pagination');
      this.filtersContainer = document.getElementById(options.filtersId || 'newsFilters');
    }

    async load() {
      if (!this.container) return;

      this.showLoader();
      try {
        // 1. 扫描 content 目录，获取所有 .json 文件列表
        const jsonFiles = await this.scanContentDirectory();

        // 2. 并行加载所有 JSON 元数据
        const newsItems = await Promise.all(
          jsonFiles.map(async (filename) => {
            try {
              const response = await fetch(this.contentPath + filename);
              if (!response.ok) return null;
              const meta = await response.json();
              // 文件名（不含扩展名）作为 ID
              meta.id = filename.replace('.json', '');
              // 封面图路径（如果有）
              meta.image = this.contentPath + meta.id + '.png';
              return meta;
            } catch (e) {
              console.warn('加载动态元数据失败:', filename, e);
              return null;
            }
          })
        );

        // 过滤掉加载失败的
        this.allNews = newsItems.filter(item => item !== null);

        // 3. 排序：日期从新到旧，同一天按标题首字母
        this.allNews.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (dateB - dateA !== 0) return dateB - dateA;
          return (a.title || '').localeCompare(b.title || '', 'zh-CN');
        });

        this.filteredNews = [...this.allNews];
        this.buildTagFilters();
        this.render();
        this.hideLoader();
      } catch (error) {
        console.error('加载动态失败:', error);
        this.hideLoader();
        this.container.innerHTML = `
          <div class="card--filled" style="text-align:center;padding:var(--space-10);">
            <span class="material-icons" style="font-size:48px;color:var(--md-error);margin-bottom:var(--space-3);">error_outline</span>
            <h3 class="headline-small" style="margin-bottom:var(--space-2);">加载失败</h3>
            <p class="body-medium" style="color:var(--md-on-surface-variant);">请稍后重试，或联系管理员</p>
          </div>
        `;
      }
    }

    async scanContentDirectory() {
      // 方法：尝试获取目录列表
      // 由于前端无法直接读取目录，我们使用以下策略：
      // 1. 尝试获取一个已知的索引文件（如果存在）
      // 2. 如果失败，使用预定义的文件名列表（基于已知的文章）
      // 3. 或者通过 fetch 探测常见文件名

      try {
        // 尝试获取目录列表（某些服务器支持）
        const response = await fetch(this.contentPath);
        if (response.ok) {
          const text = await response.text();
          // 解析 HTML 目录列表，提取 .json 文件名
          const matches = text.match(/href="([^"]+\.json)"/g);
          if (matches && matches.length > 0) {
            return matches.map(m => m.replace('href="', '').replace('"', ''));
          }
        }
      } catch (e) {
        // 目录列表不可用，使用备用方案
      }

      // 备用方案：预定义的文件名列表
      // 这些文件名基于 content 目录下已知的文章
      return [
        'world-tree-expo.json',
        'monicup-design-competition.json',
        'winter-sports-games.json',
        'monicup-architecture-competition.json',
        'new-year-message.json'
      ];
    }

    buildTagFilters() {
      if (!this.filtersContainer) return;

      // 收集所有不重复的标签
      const tagSet = new Set();
      this.allNews.forEach(item => {
        if (Array.isArray(item.tag)) {
          item.tag.forEach(t => tagSet.add(t));
        }
      });

      // 构建筛选按钮
      let html = `
        <button class="chip chip--filter chip--filter--active" data-tag="all">
          <span class="material-icons" style="font-size:18px;">layers</span>
          全部
        </button>
      `;

      const tagIcons = {
        '公告': 'campaign',
        '动态': 'newspaper',
        '活动': 'event',
        '访谈': 'record_voice_over',
        '政策': 'policy'
      };

      tagSet.forEach(tag => {
        const icon = tagIcons[tag] || 'label';
        html += `
          <button class="chip chip--filter" data-tag="${tag}">
            <span class="material-icons" style="font-size:18px;">${icon}</span>
            ${tag}
          </button>
        `;
      });

      this.filtersContainer.innerHTML = html;

      // 绑定筛选事件
      this.filtersContainer.querySelectorAll('.chip--filter[data-tag]').forEach(chip => {
        chip.addEventListener('click', () => {
          const tag = chip.dataset.tag;
          this.filtersContainer.querySelectorAll('.chip--filter').forEach(c => c.classList.remove('chip--filter--active'));
          chip.classList.add('chip--filter--active');
          this.filterByTag(tag);
        });
      });
    }

    filterByTag(tag) {
      this.activeTag = tag;
      if (tag === 'all') {
        this.filteredNews = [...this.allNews];
      } else {
        this.filteredNews = this.allNews.filter(
          item => Array.isArray(item.tag) && item.tag.includes(tag)
        );
      }
      this.currentPage = 1;
      this.render();
    }

    render() {
      const start = (this.currentPage - 1) * this.limit;
      const paginatedNews = this.filteredNews.slice(start, start + this.limit);

      if (paginatedNews.length === 0) {
        this.container.innerHTML = `
          <div class="card--filled" style="text-align:center;padding:var(--space-10);">
            <span class="material-icons" style="font-size:48px;color:var(--md-on-surface-variant);margin-bottom:var(--space-3);">article</span>
            <h3 class="headline-small" style="margin-bottom:var(--space-2);">暂无动态</h3>
            <p class="body-medium" style="color:var(--md-on-surface-variant);">此分类下暂无内容</p>
          </div>
        `;
        if (this.paginationContainer) this.paginationContainer.innerHTML = '';
        return;
      }

      const html = paginatedNews.map((item, index) => this.renderNewsCard(item, index)).join('');
      this.container.innerHTML = html;

      // 初始化卡片滑入动画
      this.initCardAnimations();

      this.renderPagination();
    }

    renderNewsCard(item, index) {
      const detailUrl = `article.html?article=${encodeURIComponent(item.id)}`;
      const tagsHtml = Array.isArray(item.tag)
        ? item.tag.map(t => `<span class="chip label-small" style="background:var(--md-primary-container);color:var(--md-on-primary-container);">${t}</span>`).join('')
        : '';

      // 计算递增的动画延迟
      const delay = index * 0.15;

      return `
        <article class="card--elevated news-card-new" style="transition-delay: ${delay}s;">
          <div class="news-card-new__body">
            <div class="news-card-new__tags">${tagsHtml}</div>
            <h3 class="news-card-new__title">
              <a href="${detailUrl}" style="text-decoration:none;color:inherit;">${this.escapeHtml(item.title)}</a>
            </h3>
            <div class="news-card-new__meta">
              <span class="news-card-new__meta-item">
                <span class="material-icons">calendar_today</span>
                ${item.date}
              </span>
              ${item.author ? `
                <span class="news-card-new__meta-item">
                  <span class="material-icons">person</span>
                  ${this.escapeHtml(item.author)}
                </span>
              ` : ''}
            </div>
            <p class="news-card-new__profile">${this.escapeHtml(item.profile || '')}</p>
            <div class="news-card-new__actions">
              <a href="${detailUrl}" class="btn btn--text md-state-layer">
                阅读全文
                <span class="material-icons">arrow_forward</span>
              </a>
            </div>
          </div>
          <div class="news-card-new__image">
            <img src="${item.image || ''}" alt="${this.escapeHtml(item.title)}" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>
        </article>
      `;
    }

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    renderPagination() {
      if (!this.paginationContainer) return;

      const totalPages = Math.ceil(this.filteredNews.length / this.limit);
      if (totalPages <= 1) {
        this.paginationContainer.innerHTML = '';
        return;
      }

      let html = '';

      // 上一页
      html += `<button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''}
        onclick="window.newsLoader.goToPage(${this.currentPage - 1})">
        <span class="material-icons">chevron_left</span>
      </button>`;

      // 页码
      const maxVisible = 5;
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      if (startPage > 1) {
        html += `<button class="pagination__btn" onclick="window.newsLoader.goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding:0 4px;color:var(--md-on-surface-variant);">...</span>`;
      }

      for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination__btn ${i === this.currentPage ? 'pagination__btn--active' : ''}"
          onclick="window.newsLoader.goToPage(${i})">${i}</button>`;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding:0 4px;color:var(--md-on-surface-variant);">...</span>`;
        html += `<button class="pagination__btn" onclick="window.newsLoader.goToPage(${totalPages})">${totalPages}</button>`;
      }

      // 下一页
      html += `<button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''}
        onclick="window.newsLoader.goToPage(${this.currentPage + 1})">
        <span class="material-icons">chevron_right</span>
      </button>`;

      this.paginationContainer.innerHTML = html;
    }

    goToPage(page) {
      const totalPages = Math.ceil(this.filteredNews.length / this.limit);
      if (page < 1 || page > totalPages) return;
      this.currentPage = page;
      this.render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showLoader() {
      const loader = document.querySelector('.page-loader');
      if (loader) {
        loader.classList.add('page-loader--active');
        document.body.style.overflow = 'hidden';
      }
    }

    hideLoader() {
      const loader = document.querySelector('.page-loader');
      if (loader) {
        loader.classList.remove('page-loader--active');
        document.body.style.overflow = '';
      }
    }

    initCardAnimations() {
      if (!this.container) return;

      const cards = this.container.querySelectorAll('.news-card-new');
      if (cards.length === 0) return;

      // 创建 Intersection Observer 监听卡片进入视口
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('news-card-new--visible');
            // 动画触发后取消观察
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1, // 卡片10%可见时触发
        rootMargin: '0px 0px -30px 0px' // 提前30px触发
      });

      cards.forEach(card => observer.observe(card));
    }
  }

  // 初始化
  const newsContainer = document.getElementById('news-container');
  if (newsContainer) {
    const contentPath = newsContainer.dataset.content || 'content/';
    const limit = parseInt(newsContainer.dataset.limit) || 10;
    const paginationId = newsContainer.dataset.pagination || 'pagination';

    const loader = new NewsLoader({
      containerId: 'news-container',
      contentPath: contentPath,
      limit: limit,
      paginationId: paginationId,
      filtersId: 'newsFilters'
    });

    window.newsLoader = loader;
    loader.load();
  }
})();