import { defineConfig, markdown } from 'sourcey'

export default defineConfig({
  name: 'rpgjs-patches',
  siteUrl: 'https://jonbogaty.com',
  baseUrl: '/rpgjs-patches',
  theme: {
    preset: 'default',
    colors: {
      primary: '#1c3a52',
      light: '#377eb7',
      dark: '#0d1b26',
    },
    fonts: {
      sans: 'system-ui, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    layout: {
      sidebar: '17rem',
      toc: '18rem',
      content: '46rem',
    },
    css: ['./brand.css'],
  },
  favicon: './assets/favicon.svg',
  repo: 'https://github.com/jbcom/rpgjs-patches',
  editBranch: 'main',
  editBasePath: 'docs',
  prettyUrls: 'slash',
  navbar: {
    links: [
      { type: 'github', href: 'https://github.com/jbcom/rpgjs-patches' },
      { type: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/rpgjs-patches' },
    ],
  },
  footer: {
    links: [
      {
        type: 'link',
        label: 'MIT License',
        href: 'https://github.com/jbcom/rpgjs-patches/blob/main/LICENSE',
      },
      {
        type: 'link',
        label: 'Security',
        href: 'https://github.com/jbcom/rpgjs-patches/security/policy',
      },
    ],
  },
  navigation: {
    tabs: [
      {
        tab: 'Documentation',
        slug: '',
        source: markdown({
          groups: [
            {
              group: 'Getting Started',
              pages: ['introduction', 'getting-started'],
            },
            {
              group: 'Reference',
              pages: ['API', 'ARCHITECTURE', 'COMPATIBILITY'],
            },
            {
              group: 'Project',
              pages: ['contributing', 'release-history'],
            },
          ],
        }),
      },
    ],
  },
})
