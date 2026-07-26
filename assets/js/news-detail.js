/* ============================================
   村庄改造吧官网 - 动态详情加载器
   从 URL 参数读取文章 ID，加载对应的 .md 和 .json 文件
   支持 Markdown 渲染、封面图片展示和错误处理
   ============================================ */

(function () {
  'use strict';

  // 生成缩略图路径（将任意扩展名替换为 _thumb.webp）
  function getThumbUrl(url) {
    var base = url.split('?')[0];
    var lastDot = base.lastIndexOf('.');
    if (lastDot === -1) return base + '_thumb.webp';
    return base.substring(0, lastDot) + '_thumb.webp';
  }

  // 构建渐进加载图片的 HTML
  function buildProgressiveImage(url, alt, centered) {
    var thumb = getThumbUrl(url);
    var wrapperStart = centered ? '<div style="text-align:center;"><div class="img-progressive">' : '<div class="img-progressive">';
    return wrapperStart +
      '<img src="' + thumb + '" class="img-progressive__thumb" alt="' + alt + '" onerror="this.style.display=\'none\'" onload="this.parentElement.classList.add(\'img-progressive--thumb-loaded\')">' +
      '<img src="' + url + '" class="img-progressive__hd" alt="' + alt + '" loading="lazy" onload="var p=this.parentElement;p.classList.add(\'img-progressive--loaded\');var t=p.querySelector(\'.img-progressive__thumb\');if(!t||t.offsetParent===null){this.style.position=\'relative\';this.style.top=\'auto\';this.style.left=\'auto\';}" onerror="this.style.display=\'none\'">' +
      (centered ? '</div></div>' : '</div>');
  }

  // 简单的 Markdown 到 HTML 转换器
  class MarkdownParser {
    parse(md) {
      if (!md) return '';
      const lines = md.split('\n');
      let html = '';
      let inList = false;
      let listType = '';
      let inBlockquote = false;
      let blockquoteLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 引用块
        const blockquoteMatch = trimmed.match(/^>(.*)$/);
        if (blockquoteMatch) {
          if (inList) {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
            listType = '';
          }
          if (!inBlockquote) {
            inBlockquote = true;
            blockquoteLines = [];
          }
          blockquoteLines.push(blockquoteMatch[1].trim());
          continue;
        }

        // 空行：关闭列表；仍在引用块内则作为段落分隔
        if (trimmed === '') {
          if (inList) {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
            listType = '';
          }
          if (inBlockquote) {
            blockquoteLines.push('');
          }
          continue;
        }

        // 退出引用块
        if (inBlockquote) {
          html += this.renderBlockquote(blockquoteLines);
          inBlockquote = false;
          blockquoteLines = [];
        }

        // 标题
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

        // 无序列表
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

        // 有序列表
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
          // 检查下一行是否是分隔符
          const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
          if (nextLine.match(/^\|[-:\s|]+\|$/)) {
            // 这是表头行，下一行是分隔符
            const cells = tableMatch[1].split('|').map(c => c.trim()).filter(c => c !== '');
            html += '<table><thead><tr>' + cells.map(c => `<th>${this.inline(c)}</th>`).join('') + '</tr></thead><tbody>';
            i++; // 跳过分隔符行
            continue;
          } else if (html.includes('<thead>') && html.endsWith('</tbody>') === false && html.endsWith('</table>') === false) {
            // 数据行（在tbody开启后，table关闭前）
            const cells = tableMatch[1].split('|').map(c => c.trim()).filter(c => c !== '');
            html += '<tr>' + cells.map(c => `<td>${this.inline(c)}</td>`).join('') + '</tr>';
            continue;
          }
        }
        // 如果表格结束（非表格行且之前有未闭合的表格）
        if (html.includes('<thead>') && html.endsWith('</tbody>') === false && html.endsWith('</table>') === false && !tableMatch) {
          html += '</tbody></table>';
        }

        // 水平线
        if (trimmed.match(/^---+$/)) {
          if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; listType = ''; }
          html += '<hr>';
          continue;
        }

        // 普通段落
        if (inList) {
          html += listType === 'ul' ? '</ul>' : '</ol>';
          inList = false;
          listType = '';
        }
        html += `<p>${this.inline(trimmed)}</p>`;
      }

      // 关闭未闭合的列表
      if (inList) {
        html += listType === 'ul' ? '</ul>' : '</ol>';
      }
      // 关闭未闭合的表格
      if (html.includes('<thead>') && html.endsWith('</tbody>') === false && html.endsWith('</table>') === false) {
        html += '</tbody></table>';
      }
      // 关闭未闭合的引用块
      if (inBlockquote) {
        html += this.renderBlockquote(blockquoteLines);
      }

      return html;
    }

    renderBlockquote(lines) {
      const paragraphs = [];
      let current = [];
      lines.forEach(function(line) {
        if (line === '') {
          if (current.length) {
            paragraphs.push(current.join(' '));
            current = [];
          }
        } else {
          current.push(line);
        }
      });
      if (current.length) {
        paragraphs.push(current.join(' '));
      }
      const content = paragraphs.map(function(p) {
        return '<p>' + this.inline(p) + '</p>';
      }, this).join('');
      return '<blockquote>' + content + '</blockquote>';
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
               '<iframe id="' + iframeId + '" src="https://player.bilibili.com/player.html?bvid=' + bvid + '&page=1&high_quality=1&danmaku=0&autoplay=0" ' +
               'allowfullscreen="true" scrolling="no" frameborder="no" ' +
               'onload="document.getElementById(\'' + loaderId + '\').classList.add(\'bili-player-loader--hidden\');' +
               'this.classList.add(\'bili-player--loaded\');"></iframe></div>';
      });

      // 图片 ![alt](url) - 将相对路径转换为基于 content/ 目录的绝对路径
      // 支持居中语法: !![alt](url) 或 ![alt](url){center}
      text = text.replace(/!!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, url) {
        // 居中图片语法 !![]()
        if (url.match(/^https?:\/\//)) {
          return buildProgressiveImage(url, alt, true);
        }
        return buildProgressiveImage('content/' + url, alt, true);
      });
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)\{center\}/g, function(match, alt, url) {
        // 居中图片语法 ![](){center}
        if (url.match(/^https?:\/\//)) {
          return buildProgressiveImage(url, alt, true);
        }
        return buildProgressiveImage('content/' + url, alt, true);
      });
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, url) {
        // 普通图片语法 ![]()
        if (url.match(/^https?:\/\//)) {
          return buildProgressiveImage(url, alt, false);
        }
        return buildProgressiveImage('content/' + url, alt, false);
      });

      // 链接 [text](url)
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

      // 粗体 **text**
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      // 斜体 *text*
      text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

      // 行内代码 `code`
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

      return text;
    }
  }

  class NewsDetail {
    constructor() {
      this.articleId = this.getArticleId();
      this.headerEl = document.getElementById('newsDetailHeader');
      this.contentEl = document.getElementById('newsDetailContent');
      this.parser = new MarkdownParser();
    }

    getArticleId() {
      const params = new URLSearchParams(window.location.search);
      const article = params.get('article');
      if (article) return article;

      // 降级：尝试从 hash 获取
      const hash = window.location.hash.replace('#', '');
      if (hash) return hash;

      return null;
    }

    async load() {
      if (!this.articleId) {
        this.showError('未指定文章ID。请从动态列表中选择一篇动态。');
        return;
      }

      if (!this.headerEl || !this.contentEl) return;

      // 显示全局加载动画
      this.showLoader();

      try {
        // 从 news-index.json 加载文章列表
        const indexRes = await fetch('news-index.json');
        if (!indexRes.ok) {
          throw new Error('无法加载动态索引');
        }
        const indexData = await indexRes.json();
        const newsList = indexData.news || [];

        // 查找当前文章
        const meta = newsList.find(item => item.file.replace('.md', '') === this.articleId);
        if (!meta) {
          throw new Error(`文章 "${this.articleId}" 不存在或已被删除。`);
        }

        // 加载 Markdown 内容
        const mdRes = await fetch(`content/${this.articleId}.md`);
        const mdContent = mdRes.ok ? await mdRes.text() : '';

        // 更新页面标题和 meta 信息
        this.updatePageMeta(meta);

        this.renderHeader(meta);
        this.renderContent(mdContent, meta);

      } catch (error) {
        console.error('加载文章失败:', error);
        this.hideLoader();
        this.showError(error.message || '加载失败，请稍后重试。');
      }
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

    updatePageMeta(meta) {
      const currentUrl = `https://realsuqingqing.github.io/news/article.html?article=${this.articleId}`;
      
      // 更新标题
      document.title = `${meta.title} - 村庄改造吧`;
      
      // 更新 meta description
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute('content', meta.profile || meta.title);
      
      // 更新 Canonical URL
      const canonicalEl = document.getElementById('canonicalLink');
      if (canonicalEl) canonicalEl.setAttribute('href', currentUrl);
      
      // 更新 Open Graph
      const ogUrl = document.getElementById('ogUrl');
      const ogTitle = document.getElementById('ogTitle');
      const ogDesc = document.getElementById('ogDesc');
      if (ogUrl) ogUrl.setAttribute('content', currentUrl);
      if (ogTitle) ogTitle.setAttribute('content', meta.title);
      if (ogDesc) ogDesc.setAttribute('content', meta.profile || meta.title);
      
      // 更新 Twitter Card
      const twitterTitle = document.getElementById('twitterTitle');
      const twitterDesc = document.getElementById('twitterDesc');
      if (twitterTitle) twitterTitle.setAttribute('content', meta.title);
      if (twitterDesc) twitterDesc.setAttribute('content', meta.profile || meta.title);
      
      // 注入结构化数据
      const schemaEl = document.getElementById('articleSchema');
      if (schemaEl) {
        const schema = {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": meta.title,
          "description": meta.profile || meta.title,
          "url": currentUrl,
          "datePublished": meta.date,
          "author": {
            "@type": "Organization",
            "name": meta.author || "村庄改造吧"
          },
          "publisher": {
            "@type": "Organization",
            "name": "村庄改造吧",
            "logo": {
              "@type": "ImageObject",
              "url": "https://realsuqingqing.github.io/assets/images/icons/common_123_icon.png"
            }
          }
        };
        schemaEl.textContent = JSON.stringify(schema);
      }
    }

    renderHeader(meta) {
      const tagsHtml = Array.isArray(meta.tag)
        ? meta.tag.map(t => `<span class="chip" style="background:var(--md-primary-container);color:var(--md-on-primary-container);margin-right:var(--space-2);">${t}</span>`).join('')
        : '';

      this.headerEl.innerHTML = `
        <div style="margin-bottom:var(--space-4);">${tagsHtml}</div>
        <h1 class="news-detail__title headline-large">${this.escapeHtml(meta.title)}</h1>
        <div class="news-detail__meta">
          <span><span class="material-icons" style="font-size:16px;vertical-align:middle;">calendar_today</span> ${meta.date}</span>
          <span><span class="material-icons" style="font-size:16px;vertical-align:middle;">person</span> ${this.escapeHtml(meta.author || '')}</span>
        </div>
      `;
    }

    renderContent(mdContent, meta) {
      let html = '';

      // 检查是否有封面图片
      const imagePath = `content/${this.articleId}.png`;
      html += `<img src="${imagePath}" alt="${this.escapeHtml(meta.title)}" class="news-detail__image" onerror="this.style.display='none'">`;

      // 渲染 Markdown 内容
      html += this.parser.parse(mdContent);

      this.contentEl.innerHTML = html;

      // 为表格添加样式类
      this.contentEl.querySelectorAll('table').forEach(table => {
        table.classList.add('news-detail__table');
      });

      // 内容渲染完成后添加浮入动画
      const children = this.contentEl.querySelectorAll(':scope > *');
      children.forEach(function (child, index) {
        child.style.animationDelay = (index * 0.06) + 's';
        child.classList.add('fade-in-up');
      });

      // 图片和视频也参与浮入动画
      const mediaItems = this.contentEl.querySelectorAll('.img-progressive, .bili-player-wrap');
      mediaItems.forEach(function (item) {
        item.classList.add('fade-in-up');
      });

      // 内容渲染完成后隐藏加载动画
      this.hideLoader();
    }

    showError(message) {
      if (this.headerEl) {
        this.headerEl.innerHTML = '';
      }
      if (this.contentEl) {
        this.contentEl.innerHTML = `
          <div class="card--filled" style="text-align:center;padding:var(--space-10);">
            <span class="material-icons" style="font-size:48px;color:var(--md-error);margin-bottom:var(--space-3);">error_outline</span>
            <h3 class="headline-small" style="margin-bottom:var(--space-2);">加载失败</h3>
            <p class="body-medium" style="color:var(--md-on-surface-variant);">${this.escapeHtml(message)}</p>
            <a href="./" class="btn btn--filled md-state-layer" style="margin-top:var(--space-4);">
              <span class="material-icons">arrow_back</span>
              返回动态列表
            </a>
          </div>
        `;
      }
    }

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  }

  // 初始化
  const detail = new NewsDetail();
  detail.load();
})();