export const languages = {
  zh: '中文',
  en: 'English',
};

export const defaultLang = 'zh';

export const ui = {
  zh: {
    // 导航
    'nav.home': '首页',
    'nav.blog': '博客',
    'nav.about': '关于',

    // 首页
    'home.welcome': '欢迎',
    'home.description': '一个简约的个人博客，分享关于技术、生活和一切有趣事物的想法。',
    'home.recentPosts': '最新文章',
    'home.viewAll': '查看全部',
    'home.noPosts': '暂无文章，敬请期待！',

    // 博客
    'blog.title': '博客',
    'blog.all': '全部',
    'blog.noPosts': '暂无文章，敬请期待！',
    'blog.noCategory': '该分类暂无文章。',

    // 分类
    'category.tech': '技术',
    'category.life': '生活',
    'category.thoughts': '随想',
    'category.tutorial': '教程',
    'category.reading': '阅读',

    // 评论
    'comment.title': '评论',
    'comment.identity': '你的匿名身份：',
    'comment.placeholder': '分享你的想法...',
    'comment.submit': '提交',
    'comment.submitting': '提交中...',
    'comment.delete': '删除',
    'comment.empty': '暂无评论，来分享你的想法吧！',

    // 管理
    'admin.title': '管理员登录',
    'admin.token': '访问令牌',
    'admin.tokenPlaceholder': '请输入管理员令牌',
    'admin.login': '登录',
    'admin.logout': '登出',
    'admin.loggedIn': '已登录',
    'admin.loggedInDesc': '你现在可以删除博客文章中的评论。',
    'admin.goToBlog': '前往博客',
    'admin.invalidToken': '无效的令牌',

    // 关于
    'about.title': '关于',
    'about.hello': '你好！欢迎来到我的个人博客。',
    'about.intro': '我是一名热爱创造的开发者。这个博客是我分享技术见解、生活经历和学习心得的地方。',
    'about.contact': '联系方式',
    'about.contactDesc': '欢迎在任何文章下留言，或通过社交媒体与我联系。',

    // 页脚
    'footer.rights': '保留所有权利。',
  },
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.blog': 'Blog',
    'nav.about': 'About',

    // Home
    'home.welcome': 'Welcome',
    'home.description': 'A minimal personal blog where I share thoughts on technology, life, and everything in between.',
    'home.recentPosts': 'Recent Posts',
    'home.viewAll': 'View all',
    'home.noPosts': 'No posts yet. Check back soon!',

    // Blog
    'blog.title': 'Blog',
    'blog.all': 'All',
    'blog.noPosts': 'No posts yet. Check back soon!',
    'blog.noCategory': 'No posts in this category yet.',

    // Categories
    'category.tech': 'Tech',
    'category.life': 'Life',
    'category.thoughts': 'Thoughts',
    'category.tutorial': 'Tutorial',
    'category.reading': 'Reading',

    // Comments
    'comment.title': 'Comments',
    'comment.identity': 'Your anonymous identity:',
    'comment.placeholder': 'Share your thoughts...',
    'comment.submit': 'Submit',
    'comment.submitting': 'Submitting...',
    'comment.delete': 'Delete',
    'comment.empty': 'No comments yet. Be the first to share your thoughts!',

    // Admin
    'admin.title': 'Admin Login',
    'admin.token': 'Access Token',
    'admin.tokenPlaceholder': 'Enter your admin token',
    'admin.login': 'Login',
    'admin.logout': 'Logout',
    'admin.loggedIn': 'Admin Logged In',
    'admin.loggedInDesc': 'You can now delete comments on blog posts.',
    'admin.goToBlog': 'Go to Blog',
    'admin.invalidToken': 'Invalid token',

    // About
    'about.title': 'About',
    'about.hello': 'Hello! Welcome to my personal blog.',
    'about.intro': "I'm a developer passionate about building things. This blog is where I share my thoughts on technology, life experiences, and interesting things I learn along the way.",
    'about.contact': 'Contact',
    'about.contactDesc': 'Feel free to leave a comment below any post, or connect with me on social media.',

    // Footer
    'footer.rights': 'All rights reserved.',
  },
} as const;

export type Lang = keyof typeof ui;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof typeof ui[typeof defaultLang]): string {
    return ui[lang][key] || ui[defaultLang][key];
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  if (lang === defaultLang) {
    return path;
  }
  return `/${lang}${path}`;
}
