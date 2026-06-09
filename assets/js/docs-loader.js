/* ============================================
   村庄改造吧官网 - 文档加载器 v2
   从 docs-index.json 解析目录结构
   动态加载 .md 文件并渲染为文档页面
   ============================================ */

(function () {
  'use strict';

  // 复用 Markdown 解析器
  class MarkdownParser {
    parse(md) {
      if (!md) return '';
      const lines = md.split('\n');
      let html = '';
      let inList = false;
      let listType = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') {
          if (inList) {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
            listType = '';
          }
          continue;
        }

        const h3Match = trimmed.match(/^### (.+)$/);
        if (h3Match) {
          if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; listType = ''; }
          html += `<h3>${this.inline(h3Match[1])}</h3>`;
          continue;
        }

        const h2Match = trimmed.match(/^## (.+)$/);
        if (h2Match) {
          if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; listType = ''; }
          html += `<h2>${this.inline(h2Match[1])}</h2>`;
          continue;
        }

        const h1Match = trimmed.match(/^# (.+)$/);
        if (h1Match) {
          if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; listType = ''; }
          html += `<h2>${this.inline(h1Match[1])}</h2>`;
          continue;
        }

        const ulMatch = trimmed.match(/^[-*] (.+)$/);
        if (ulMatch) {
          if (!inList || listType !== 'ul') {
            if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
            html += '<ul>';
            inList = true;
            listType = 'ul';
          }
          html += `<li>${this.inline(ulMatch[1])}</li>`;
          continue;
        }

        const olMatch = trimmed.match(/^\d+\. (.+)$/);
        if (olMatch) {
          if (!inList || listType !== 'ol') {
            if (inList) html += listType === 'ul' ? '</ul>' : '</ol>';
            html += '<ol>';
            inList = true;
            listType = 'ol';
          }
          html += `<li>${this.inline(olMatch[1])}</li>`;
          continue;
        }

        // 表格
        const tableMatch = trimmed.match(/^\|(.+)\|$/);
        if (tableMatch) {
          if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; listType = ''; }
          const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
          if (nextLine.match(/^\|[-:\s|]+\|$/)) {
            const cells = tableMatch[1].split('|').map(c => c.trim()).filter(c => c !== '');
            html += '<table><thead><tr>' + cells.map(c => `<th>${this.inline(c)}</th>`).join('') + '</tr></thead><tbody>';
            i++;
            continue;
          } else if (html.includes('<thead>') && html.endsWith('</tbody>') === false && html.endsWith('</table>') === false) {
            const cells = tableMatch[1].split('|').map(c => c.trim()).filter(c => c !== '');
            html += '<tr>' + cells.map(c => `<td>${this.inline(c)}</td>`).join('') + '</tr>';
            continue;
          }
        }
        if (html.includes('<thead>') && html.endsWith('</tbody>') === false && html.endsWith('</table>') === false && !tableMatch) {
          html += '</tbody></table>';
        }

        if (trimmed.match(/^---+$/)) {
          if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; listType = ''; }
          html += '<hr>';
          continue;
        }

        if (inList) {
          html += listType === 'ul' ? '</ul>' : '</ol>';
          inList = false;
          listType = '';
        }
        html += `<p>${this.inline(trimmed)}</p>`;
      }

      if (inList) {
        html += listType === 'ul' ? '</ul>' : '</ol>';
      }
      if (html.includes('<thead>') && html.endsWith('</tbody>') === false && html.endsWith('</table>') === false) {
        html += '</tbody></table>';
      }

      return html;
    }

    inline(text) {
      if (!text) return '';

      // Bilibili 视频嵌入 ![bilibili](BV号或链接)
      text = text.replace(/!\[bilibili\]\(([^)]+)\)/gi, function(match, url) {
        const bvMatch = url.match(/(?:BV|bv)([a-zA-Z0-9]+)/);
        const bvid = bvMatch ? 'BV' + bvMatch[1] : url;
        const loaderId = 'bili-loader-' + Math.random().toString(36).slice(2, 9);
        const iframeId = 'bili-iframe-' + Math.random().toString(36).slice(2, 9);
        return '<div class="bili-player-wrap">' +
               '<div class="bili-player-loader" id="' + loaderId + '">' +
               '<div class="bili-player-loader__icon"><span class="material-icons">play_circle</span></div>' +
               '<span class="bili-player-loader__text">正在加载视频...</span>' +
               '<div class="bili-player-loader__bar"></div></div>' +
               '<iframe id="' + iframeId + '" src="https://player.bilibili.com/player.html?bvid=' + bvid + '&page=1&high_quality=1&danmaku=0" ' +
               'allowfullscreen="true" scrolling="no" frameborder="no" ' +
               'onload="document.getElementById(\'' + loaderId + '\').classList.add(\'bili-player-loader--hidden\');' +
               'this.classList.add(\'bili-player--loaded\');"></iframe></div>';
      });

      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:var(--shape-medium);margin:var(--space-4) 0;">');
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
      return text;
    }
  }

  class DocsLoader {
    constructor() {
      this.indexPath = 'docs-index.json';
      this.contentPath = 'content/';
      this.sidebarEl = document.getElementById('docsSidebar');
      this.tocListEl = document.getElementById('toc-list');
      this.contentEl = document.querySelector('.docs-content');
      this.parser = new MarkdownParser();
      this.docIndex = null;
      this.currentDoc = null;
    }

    async load() {
      this.showLoader();
      try {
        const response = await fetch(this.indexPath);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        this.docIndex = await response.json();

        this.renderSidebar();
        await this.loadDocumentFromUrl();
      } catch (error) {
        console.error('加载文档索引失败:', error);
        this.hideLoader();
        if (this.contentEl) {
          this.contentEl.innerHTML = `
            <div class="card--filled" style="text-align:center;padding:var(--space-10);">
              <span class="material-icons" style="font-size:48px;color:var(--md-error);margin-bottom:var(--space-3);">error_outline</span>
              <h3 class="headline-small" style="margin-bottom:var(--space-2);">加载失败</h3>
              <p class="body-medium" style="color:var(--md-on-surface-variant);">文档索引加载失败，请稍后重试</p>
            </div>
          `;
        }
      }
    }

    renderSidebar() {
      if (!this.tocListEl || !this.docIndex || !this.docIndex.documents) return;

      let html = '<ul class="docs-sidebar__list">';

      this.docIndex.documents.forEach((doc, index) => {
        const docId = `doc-${index}`;
        const hasSubContent = Array.isArray(doc.content) && doc.content.length > 0;

        html += `
          <li class="docs-sidebar__item">
            <a href="#" class="docs-sidebar__link docs-sidebar__link--main" data-doc="${doc.page}" data-index="${index}">
              <span class="material-icons" style="font-size:18px;">description</span>
              ${this.escapeHtml(doc.title)}
            </a>
        `;

        if (hasSubContent) {
          html += '<ul class="docs-sidebar__sublist">';
          doc.content.forEach((sub, subIndex) => {
            html += `
              <li class="docs-sidebar__subitem">
                <a href="#" class="docs-sidebar__link docs-sidebar__link--sub" data-doc="${sub.page}" data-parent="${index}">
                  ${this.escapeHtml(sub.subtitle)}
                </a>
              </li>
            `;
          });
          html += '</ul>';
        }

        html += '</li>';
      });

      html += '</ul>';
      this.tocListEl.innerHTML = html;

      // 绑定点击事件
      this.tocListEl.querySelectorAll('.docs-sidebar__link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const page = link.dataset.doc;
          if (page) {
            this.loadDocument(page);
            // 更新 URL
            const url = new URL(window.location);
            url.searchParams.set('doc', page.replace('.md', ''));
            window.history.pushState({}, '', url);
          }
          // 移动端关闭侧边栏
          if (window.innerWidth <= 768) {
            this.sidebarEl.classList.remove('docs-sidebar--open');
          }
        });
      });
    }

    async loadDocumentFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const docParam = params.get('doc');

      if (docParam) {
        await this.loadDocument(docParam + '.md');
      } else if (this.docIndex && this.docIndex.documents && this.docIndex.documents.length > 0) {
        // 默认加载第一篇文档
        await this.loadDocument(this.docIndex.documents[0].page);
      }
    }

    async loadDocument(page) {
      if (!this.contentEl) return;

      this.contentEl.innerHTML = '<div style="text-align:center;padding:var(--space-10);"><p class="body-large" style="color:var(--md-on-surface-variant);">加载中...</p></div>';

      try {
        const response = await fetch(this.contentPath + page);
        if (!response.ok) {
          throw new Error(`文档 "${page}" 不存在或已被删除。`);
        }

        const mdContent = await response.text();
        const docMeta = this.findDocumentMeta(page);

        // 更新页面标题
        if (docMeta) {
          document.title = `${docMeta.title} - 文档中心 - 村庄改造吧`;
        }

        this.renderContent(mdContent, docMeta);
        this.updateActiveSidebar(page);

      } catch (error) {
        console.error('加载文档失败:', error);
        this.contentEl.innerHTML = `
          <div class="card--filled" style="text-align:center;padding:var(--space-10);">
            <span class="material-icons" style="font-size:48px;color:var(--md-error);margin-bottom:var(--space-3);">error_outline</span>
            <h3 class="headline-small" style="margin-bottom:var(--space-2);">加载失败</h3>
            <p class="body-medium" style="color:var(--md-on-surface-variant);">${this.escapeHtml(error.message)}</p>
          </div>
        `;
      }
    }

    findDocumentMeta(page) {
      if (!this.docIndex || !this.docIndex.documents) return null;

      for (const doc of this.docIndex.documents) {
        if (doc.page === page) {
          return { title: doc.title, isMain: true };
        }
        if (Array.isArray(doc.content)) {
          for (const sub of doc.content) {
            if (sub.page === page) {
              return { title: sub.subtitle, parentTitle: doc.title, isMain: false };
            }
          }
        }
      }
      return null;
    }

    renderContent(mdContent, docMeta) {
      let html = '';

      // 文档标题
      if (docMeta) {
        if (docMeta.isMain) {
          html += `<h1 class="headline-large" style="margin-bottom:var(--space-6);">${this.escapeHtml(docMeta.title)}</h1>`;
        } else {
          html += `
            <div style="margin-bottom:var(--space-2);">
              <span class="body-medium" style="color:var(--md-on-surface-variant);">${this.escapeHtml(docMeta.parentTitle)}</span>
            </div>
            <h1 class="headline-large" style="margin-bottom:var(--space-6);">${this.escapeHtml(docMeta.title)}</h1>
          `;
        }
      }

      // 渲染 Markdown
      html += `<div class="docs-markdown">${this.parser.parse(mdContent)}</div>`;

      this.contentEl.innerHTML = html;

      // 初始化段落入场动画
      this.initScrollAnimations();

      // 内容渲染完成后隐藏加载动画
      this.hideLoader();

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

    initScrollAnimations() {
      if (!this.contentEl) return;

      // 获取所有需要动画的元素：p, h2, h3, ul, ol, blockquote, .card--outlined
      const animateItems = this.contentEl.querySelectorAll(
        '.docs-markdown p, .docs-markdown h2, .docs-markdown h3, ' +
        '.docs-markdown ul, .docs-markdown ol, .docs-markdown blockquote, ' +
        '.docs-markdown .card--outlined, .docs-content > h1, .docs-content > .headline-large'
      );

      // 为每个元素添加动画类并设置递增延迟
      animateItems.forEach((item, index) => {
        item.classList.add('docs-animate-item');
        // 设置递增的transition-delay，形成序列动画效果
        const delay = index * 0.12; // 0.12秒间隔
        item.style.transitionDelay = `${delay}s`;
      });

      // 创建 Intersection Observer 监听元素进入视口
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('docs-animate-item--visible');
            // 动画触发后取消观察，避免重复触发
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1, // 元素10%可见时触发
        rootMargin: '0px 0px -20px 0px' // 提前20px触发
      });

      animateItems.forEach(item => observer.observe(item));
    }

    updateActiveSidebar(page) {
      if (!this.tocListEl) return;

      this.tocListEl.querySelectorAll('.docs-sidebar__link').forEach(link => {
        link.classList.remove('docs-sidebar__link--active');
        if (link.dataset.doc === page) {
          link.classList.add('docs-sidebar__link--active');
        }
      });
    }

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  }

  // 初始化
  const docsLoader = new DocsLoader();
  docsLoader.load();

  // 浏览器前进后退支持
  window.addEventListener('popstate', () => {
    docsLoader.loadDocumentFromUrl();
  });
})();