/* ============================================
   村庄改造吧官网 - 全局交互脚本
   导航、滚动、响应式菜单
   ============================================ */

(function () {
  'use strict';

  // ============================================
  // 1. App Bar 滚动效果
  // ============================================
  const appBar = document.querySelector('.app-bar');
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (appBar) {
    let lastScrollY = 0;

    function onScroll() {
      const scrollY = window.scrollY;

      if (scrollY > 4) {
        appBar.classList.add('app-bar--scrolled');
      } else {
        appBar.classList.remove('app-bar--scrolled');
      }

      lastScrollY = scrollY;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ============================================
  // 2. 移动端菜单
  // ============================================
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function () {
      navLinks.classList.toggle('app-bar__nav--open');
      const isOpen = navLinks.classList.contains('app-bar__nav--open');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    // 点击导航链接后关闭菜单
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('app-bar__nav--open');
        if (menuToggle) {
          menuToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // 点击外部关闭菜单
    document.addEventListener('click', function (e) {
      if (!navLinks.contains(e.target) && !menuToggle.contains(e.target)) {
        navLinks.classList.remove('app-bar__nav--open');
        if (menuToggle) {
          menuToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('app-bar__nav--open')) {
        navLinks.classList.remove('app-bar__nav--open');
        if (menuToggle) {
          menuToggle.setAttribute('aria-expanded', 'false');
          menuToggle.focus();
        }
      }
    });
  }

  // ============================================
  // 3. 文档页侧边栏切换
  // ============================================
  const sidebarToggle = document.getElementById('sidebarToggle');
  const docsSidebar = document.querySelector('.docs-sidebar');

  if (sidebarToggle && docsSidebar) {
    sidebarToggle.addEventListener('click', function () {
      docsSidebar.classList.toggle('docs-sidebar--open');
    });

    // 点击文档内容区关闭侧边栏
    const docsContent = document.querySelector('.docs-content');
    if (docsContent) {
      docsContent.addEventListener('click', function () {
        docsSidebar.classList.remove('docs-sidebar--open');
      });
    }
  }

  // ============================================
  // 4. 平滑滚动到锚点
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-bar-offset')) || 76;
        const top = target.getBoundingClientRect().top + window.scrollY - offset - 16;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ============================================
  // 5. 当前页面导航高亮
  // ============================================
  function highlightCurrentNav() {
    var currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    var navItems = document.querySelectorAll('.app-bar__nav-link');

    navItems.forEach(function (item) {
      var href = item.getAttribute('href');
      if (!href) return;

      // 使用 URL 构造函数将相对路径解析为绝对路径
      var resolved = new URL(href, window.location.origin + window.location.pathname);
      var resolvedPath = resolved.pathname.replace(/\/$/, '') || '/';

      if (resolvedPath === currentPath) {
        item.classList.add('app-bar__nav-link--active');
      } else {
        item.classList.remove('app-bar__nav-link--active');
      }
    });

    // 特殊处理：动态详情页 (article.html) 也高亮"动态"
    if (currentPath.endsWith('/news/article.html')) {
      navItems.forEach(function (item) {
        var href = item.getAttribute('href');
        if (!href) return;
        var resolved = new URL(href, window.location.origin + window.location.pathname);
        var resolvedPath = resolved.pathname.replace(/\/$/, '') || '/';
        if (resolvedPath === '/news' || resolvedPath.endsWith('/news/')) {
          item.classList.add('app-bar__nav-link--active');
        }
      });
    }
  }

  highlightCurrentNav();

  // ============================================
  // 6. 图片懒加载 (备用，浏览器原生支持)
  // ============================================
  if ('loading' in HTMLImageElement.prototype) {
    // 浏览器原生支持，使用 loading="lazy" 属性即可
  } else {
    // Fallback: 使用 IntersectionObserver
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    if (lazyImages.length > 0) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
            }
            observer.unobserve(img);
          }
        });
      });
      lazyImages.forEach(function (img) {
        observer.observe(img);
      });
    }
  }

  // ============================================
  // 7. 动画入场
  // ============================================
  const animatedElements = document.querySelectorAll('.animate-in');
  if (animatedElements.length > 0) {
    const animObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, index) {
        if (entry.isIntersecting) {
          // 为每个元素添加延迟
          setTimeout(function () {
            entry.target.style.animationDelay = '0s';
          }, index * 100);
          animObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    animatedElements.forEach(function (el) {
      el.style.animationDelay = '0.3s';
      animObserver.observe(el);
    });
  }

  // ============================================
  // 6. 页面切换加载动画
  // ============================================
  const PageLoader = {
    loader: null,
    minDisplayTime: 400, // 最小显示时间(ms)
    startTime: 0,

    init() {
      // 创建加载动画DOM
      this.loader = document.createElement('div');
      this.loader.className = 'page-loader';
      this.loader.setAttribute('role', 'status');
      this.loader.setAttribute('aria-live', 'polite');
      this.loader.setAttribute('aria-label', '页面加载中');
      this.loader.innerHTML = `
        <div class="page-loader__spinner"></div>
        <p class="page-loader__text">加载中...</p>
      `;
      document.body.appendChild(this.loader);

      // 拦截所有内部链接点击
      this.interceptLinks();

      // 监听页面加载完成
      window.addEventListener('load', () => this.hide());

      // 处理浏览器后退/前进按钮
      window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
          this.hide();
        }
      });
    },

    show() {
      this.startTime = Date.now();
      this.loader.classList.add('page-loader--active');
      document.body.style.overflow = 'hidden';
    },

    hide() {
      const elapsed = Date.now() - this.startTime;
      const remaining = Math.max(0, this.minDisplayTime - elapsed);

      setTimeout(() => {
        this.loader.classList.remove('page-loader--active');
        document.body.style.overflow = '';
      }, remaining);
    },

    interceptLinks() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // 只拦截内部页面链接
        const isInternalLink = !href.startsWith('http') &&
                               !href.startsWith('//') &&
                               !href.startsWith('#') &&
                               !href.startsWith('mailto:') &&
                               !href.startsWith('tel:');

        // 排除新窗口打开的链接
        const isNewWindow = link.target === '_blank' ||
                           e.ctrlKey || e.metaKey || e.shiftKey;

        if (isInternalLink && !isNewWindow) {
          this.show();

          // 设置超时处理，防止加载卡住
          setTimeout(() => {
            if (this.loader.classList.contains('page-loader--active')) {
              this.hide();
              console.warn('页面加载超时');
            }
          }, 10000); // 10秒超时
        }
      });
    }
  };

  // 初始化加载动画
  PageLoader.init();

})();