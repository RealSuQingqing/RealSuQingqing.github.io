/* ============================================
   村庄改造吧官网 - 文档目录生成与高亮
   ============================================ */

(function () {
  'use strict';

  class DocsTOC {
    constructor(options) {
      this.tocContainer = document.getElementById(options.tocId || 'toc-list');
      this.contentArea = document.querySelector(options.contentSelector || '.docs-content');
      this.observer = null;
      this.headings = [];
    }

    generate() {
      if (!this.tocContainer || !this.contentArea) return;

      this.headings = this.contentArea.querySelectorAll('h2, h3');

      if (this.headings.length === 0) {
        this.tocContainer.innerHTML = '<p class="body-small" style="color:var(--md-on-surface-variant);padding:var(--space-3);">暂无目录</p>';
        return;
      }

      const fragment = document.createDocumentFragment();

      this.headings.forEach((heading, index) => {
        // 确保 heading 有 id
        if (!heading.id) {
          heading.id = 'section-' + index + '-' + heading.textContent
            .trim()
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fff]+/g, '-')
            .replace(/^-|-$/g, '');
        }

        const isSub = heading.tagName === 'H3';

        const item = document.createElement('div');
        item.className = 'docs-sidebar__item' + (isSub ? ' docs-sidebar__item--level-2' : '');
        item.dataset.target = heading.id;

        const link = document.createElement('a');
        link.className = 'docs-sidebar__link';
        link.href = '#' + heading.id;
        link.textContent = heading.textContent;
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.scrollToHeading(heading);
        });

        item.appendChild(link);
        fragment.appendChild(item);
      });

      this.tocContainer.innerHTML = '';
      this.tocContainer.appendChild(fragment);
      this.initObserver();
    }

    scrollToHeading(heading) {
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-bar-height')) || 64;
      const top = heading.getBoundingClientRect().top + window.scrollY - offset - 16;
      window.scrollTo({ top, behavior: 'smooth' });

      // 移动端关闭侧边栏
      const sidebar = document.querySelector('.docs-sidebar');
      if (sidebar) {
        sidebar.classList.remove('docs-sidebar--open');
      }
    }

    initObserver() {
      const options = {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0
      };

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.setActive(entry.target.id);
          }
        });
      }, options);

      this.headings.forEach(h => this.observer.observe(h));
    }

    setActive(id) {
      if (!id) return;

      // 移除所有高亮
      const items = this.tocContainer.querySelectorAll('.docs-sidebar__item');
      items.forEach(item => {
        item.classList.remove('docs-sidebar__item--active');
      });

      // 添加新活跃
      const activeItem = this.tocContainer.querySelector(`[data-target="${id}"]`);
      if (activeItem) {
        activeItem.classList.add('docs-sidebar__item--active');
      }
    }
  }

  // 初始化
  const tocContainer = document.getElementById('toc-list');
  if (tocContainer) {
    const toc = new DocsTOC({
      tocId: 'toc-list',
      contentSelector: '.docs-content'
    });
    toc.generate();
  }
})();