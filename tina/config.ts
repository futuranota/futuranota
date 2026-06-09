import { defineConfig } from 'tinacms';

const branch =
  process.env.TINA_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.GITHUB_BRANCH ||
  'main';


const linkFields = [
  { type: 'string' as const, name: 'label', label: 'Label' },
  { type: 'string' as const, name: 'path', label: 'Path' },
];

const blogCardFields = [
  { type: 'string' as const, name: 'title', label: 'Title' },
  { type: 'string' as const, name: 'description', label: 'Description' },
  { type: 'string' as const, name: 'href', label: 'Link' },
];

/** Vite marketing site — side-by-side preview in Tina admin */
const PREVIEW_BASE = process.env.TINA_PREVIEW_URL || 'http://localhost:5173';

const MARKETING_ROUTES: Record<string, string> = {
  site: '/',
  home: '/',
  horizon: '/horizon',
  how: '/how',
  marketplace: '/marketplace',
  'blogs-page': '/blogs',
};

function marketingPreviewUrl(context: {
  branch: string;
  collection?: { name?: string };
  document?: { _sys?: { relativePath?: string; filename?: string } };
}) {
  const rel = context.document?._sys?.relativePath ?? '';
  const stem = rel.replace(/\.json$/i, '');
  const key = stem || context.document?._sys?.filename || '';

  if (context.collection?.name === 'blog' || key.startsWith('blogs/') || key.includes('blogs/')) {
    const slug = key.replace(/^blogs\//, '');
    return { url: `${PREVIEW_BASE}/blogs/${slug}` };
  }

  return { url: `${PREVIEW_BASE}${MARKETING_ROUTES[key] ?? '/'}` };
}

/** Site path shown in Tina admin when opening a document for visual preview */
function collectionRouter(path: string) {
  return () => path;
}

function blogPostRouter(context: {
  document?: { _sys?: { relativePath?: string; filename?: string } };
}) {
  const rel = context.document?._sys?.relativePath ?? '';
  const stem = rel.replace(/\.json$/i, '') || context.document?._sys?.filename?.replace(/\.json$/i, '') || '';
  return stem ? `/blogs/${stem}` : '/blogs';
}

const collectionUi = {
  allowedActions: { create: false, delete: false },
} as const;

export default defineConfig({
  branch,
  clientId: process.env.TINA_PUBLIC_CLIENT_ID || null,
  token: process.env.TINA_TOKEN || null,
  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },
  media: {
    tina: {
      mediaRoot: 'uploads',
      publicFolder: 'public',
    },
    
  },
  search: {
    tina: {
      indexerToken: process.env.TINA_SEARCH_TOKEN,
      stopwordLanguages: ['eng', 'spa'],
    },
  },
  ui: {
    previewUrl: marketingPreviewUrl,
  },
  schema: {
    collections: [
      {
        name: 'site',
        label: 'Site (nav & footer)',
        path: 'content/marketing',
        format: 'json',
        match: { include: 'site' },
        ui: {
          ...collectionUi,
          router: collectionRouter('/'),
        },
        fields: [
          {
            type: 'object',
            name: 'nav',
            label: 'Navigation',
            fields: [
              {
                type: 'object',
                name: 'links',
                label: 'Nav links',
                list: true,
                fields: linkFields,
              },
            ],
          },
          {
            type: 'object',
            name: 'footer',
            label: 'Footer',
            fields: [
              {
                type: 'object',
                name: 'columns',
                label: 'Columns',
                list: true,
                fields: [
                  { type: 'string', name: 'heading', label: 'Heading' },
                  {
                    type: 'string',
                    name: 'links',
                    label: 'Link labels',
                    list: true,
                  },
                ],
              },
              { type: 'string', name: 'newsletterPlaceholder', label: 'Newsletter placeholder' },
              { type: 'string', name: 'trendsLine', label: 'Trends line' },
            ],
          },
          {
            type: 'object',
            name: 'blogNavSections',
            label: 'Blog mega-menu sections',
            list: true,
            fields: [
              { type: 'string', name: 'id', label: 'ID' },
              { type: 'string', name: 'label', label: 'Section label' },
              {
                type: 'object',
                name: 'cards',
                label: 'Cards',
                list: true,
                fields: blogCardFields,
              },
            ],
          },
        ],
      },
      {
        name: 'home',
        label: 'Home page',
        path: 'content/marketing',
        format: 'json',
        match: { include: 'home' },
        ui: { ...collectionUi, router: collectionRouter('/') },
        fields: [
          {
            type: 'object',
            name: 'hero',
            label: 'Hero',
            fields: [
              {
                type: 'object',
                name: 'maker',
                label: 'Maker tab',
                fields: [
                  { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
                  { type: 'string', name: 'titleLead', label: 'Title line 1' },
                  { type: 'string', name: 'titleAccent', label: 'Title line 2 (accent)' },
                  { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
                  { type: 'string', name: 'primaryCta', label: 'Primary CTA' },
                  { type: 'string', name: 'secondaryCta', label: 'Secondary CTA' },
                  { type: 'string', name: 'trustChip', label: 'Trust chip' },
                ],
              },
              {
                type: 'object',
                name: 'founder',
                label: 'Founder tab',
                fields: [
                  { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
                  { type: 'string', name: 'pre', label: 'Title prefix' },
                  { type: 'string', name: 'accent', label: 'Title accent' },
                  { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
                ],
              },
              {
                type: 'object',
                name: 'frame',
                label: 'Frame mock',
                fields: [
                  { type: 'string', name: 'detectedLabel', label: 'Detected label' },
                  { type: 'string', name: 'ago', label: 'Time ago' },
                  { type: 'string', name: 'campaignName', label: 'Campaign name' },
                  { type: 'string', name: 'windowLabel', label: 'Window label' },
                  { type: 'number', name: 'windowProgress', label: 'Window progress %' },
                  { type: 'string', name: 'opens', label: 'Opens' },
                  { type: 'string', name: 'closes', label: 'Closes' },
                  {
                    type: 'object',
                    name: 'nodes',
                    label: 'Nodes',
                    list: true,
                    fields: [
                      { type: 'string', name: 'hash', label: 'Hash tag' },
                      { type: 'string', name: 'text', label: 'Text' },
                    ],
                  },
                ],
              },
              {
                type: 'object',
                name: 'features',
                label: 'Feature strip',
                list: true,
                fields: [
                  { type: 'string', name: 'num', label: 'Number' },
                  { type: 'string', name: 'title', label: 'Title' },
                  { type: 'string', name: 'body', label: 'Body', ui: { component: 'textarea' } },
                ],
              },
            ],
          },
          {
            type: 'object',
            name: 'directory',
            label: 'Directory section',
            fields: [
              { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
              { type: 'string', name: 'title', label: 'Title' },
              { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
              {
                type: 'object',
                name: 'cards',
                label: 'Cards',
                list: true,
                fields: [
                  { type: 'string', name: 'slug', label: 'Slug' },
                  { type: 'string', name: 'num', label: 'Number' },
                  { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
                  { type: 'string', name: 'title', label: 'Title' },
                  { type: 'string', name: 'blurb', label: 'Blurb', ui: { component: 'textarea' } },
                  { type: 'string', name: 'cta', label: 'CTA' },
                  { type: 'number', name: 'span', label: 'Grid span' },
                  { type: 'string', name: 'tags', label: 'Tags', list: true },
                ],
              },
            ],
          },
          {
            type: 'object',
            name: 'pricing',
            label: 'Pricing',
            fields: [
              { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
              { type: 'string', name: 'title', label: 'Title' },
              { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
              { type: 'string', name: 'trust', label: 'Trust line' },
              {
                type: 'object',
                name: 'plans',
                label: 'Plans',
                list: true,
                fields: [
                  { type: 'string', name: 'id', label: 'ID (free | pro)' },
                  { type: 'string', name: 'name', label: 'Name' },
                  { type: 'string', name: 'shortName', label: 'Short name (card label)' },
                  { type: 'string', name: 'desc', label: 'Description', ui: { component: 'textarea' } },
                  { type: 'string', name: 'bullets', label: 'Bullet list', list: true },
                  { type: 'string', name: 'secondaryCta', label: 'Secondary CTA (Pro)' },
                  { type: 'string', name: 'price', label: 'Price' },
                  { type: 'string', name: 'priceLabel', label: 'Price label (Free)' },
                  { type: 'string', name: 'priceSuffix', label: 'Price suffix (/mo)' },
                  { type: 'string', name: 'originalPrice', label: 'Original price' },
                  { type: 'string', name: 'billingNote', label: 'Billing note' },
                  { type: 'string', name: 'badge', label: 'Badge' },
                  { type: 'string', name: 'cta', label: 'CTA' },
                  {
                    type: 'object',
                    name: 'featureGroups',
                    label: 'Feature groups',
                    list: true,
                    fields: [
                      { type: 'string', name: 'title', label: 'Group title' },
                      { type: 'string', name: 'items', label: 'Items (legacy)', list: true },
                      {
                        type: 'object',
                        name: 'features',
                        label: 'Features',
                        list: true,
                        fields: [
                          { type: 'string', name: 'title', label: 'Feature title' },
                          { type: 'string', name: 'tagline', label: 'Tagline', ui: { component: 'textarea' } },
                          { type: 'string', name: 'detail', label: 'Detail', ui: { component: 'textarea' } },
                          { type: 'boolean', name: 'locked', label: 'Locked on this plan' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'object',
            name: 'finalCta',
            label: 'Final CTA',
            fields: [
              { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
              { type: 'string', name: 'title', label: 'Title' },
              { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
              { type: 'string', name: 'primaryCta', label: 'Primary CTA' },
              { type: 'string', name: 'secondaryCta', label: 'Secondary CTA' },
              { type: 'string', name: 'trust', label: 'Trust bullets', list: true },
            ],
          },
        ],
      },
      {
        name: 'horizon',
        label: 'Horizon page',
        path: 'content/marketing',
        format: 'json',
        match: { include: 'horizon' },
        ui: { ...collectionUi, router: collectionRouter('/horizon') },
        fields: [
          {
            type: 'object',
            name: 'header',
            label: 'Header',
            fields: [
              { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
              { type: 'string', name: 'title', label: 'Title' },
              { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
              { type: 'string', name: 'linkLabel', label: 'Link label' },
            ],
          },
          {
            type: 'object',
            name: 'opportunities',
            label: 'Horizon kits',
            list: true,
            fields: [
              { type: 'string', name: 'tag', label: 'Tag' },
              { type: 'string', name: 'title', label: 'Title', isTitle: true, required: true },
              { type: 'string', name: 'desc', label: 'Description', ui: { component: 'textarea' } },
              { type: 'string', name: 'org', label: 'Org lines', list: true },
              { type: 'boolean', name: 'free', label: 'Free kit' },
              { type: 'string', name: 'price', label: 'Price label' },
              {
                type: 'string',
                name: 'kitType',
                label: 'Kit type',
                options: [
                  { label: 'Website + plugin', value: 'website-plugin' },
                  { label: 'Instructions only', value: 'instructions' },
                ],
              },
              { type: 'string', name: 'includes', label: 'Includes', list: true },
              { type: 'string', name: 'rating', label: 'Rating' },
              { type: 'number', name: 'reviews', label: 'Review count' },
              { type: 'string', name: 'downloads', label: 'Downloads' },
              { type: 'boolean', name: 'trend', label: 'Trending' },
              { type: 'boolean', name: 'hot', label: 'Best seller' },
              { type: 'string', name: 'downloadUrl', label: 'Download URL' },
              { type: 'string', name: 'previewUrl', label: 'Preview URL' },
              { type: 'string', name: 'blogSlug', label: 'Blog slug (Read button)' },
            ],
          },
        ],
      },
      {
        name: 'how',
        label: 'How it works',
        path: 'content/marketing',
        format: 'json',
        match: { include: 'how' },
        ui: { ...collectionUi, router: collectionRouter('/how') },
        fields: [
          {
            type: 'object',
            name: 'header',
            label: 'Header',
            fields: [
              { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
              { type: 'string', name: 'title', label: 'Title' },
              { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
            ],
          },
          {
            type: 'object',
            name: 'video',
            label: 'Video block',
            fields: [
              { type: 'string', name: 'label', label: 'Label' },
              { type: 'string', name: 'duration', label: 'Duration' },
            ],
          },
          {
            type: 'object',
            name: 'steps',
            label: 'Steps',
            list: true,
            fields: [
              { type: 'string', name: 'num', label: 'Number' },
              { type: 'string', name: 'title', label: 'Title', isTitle: true, required: true },
              { type: 'string', name: 'body', label: 'Body', ui: { component: 'textarea' } },
            ],
          },
        ],
      },
      {
        name: 'marketplace',
        label: 'Marketplace',
        path: 'content/marketing',
        format: 'json',
        match: { include: 'marketplace' },
        ui: { ...collectionUi, router: collectionRouter('/marketplace') },
        fields: [
          {
            type: 'object',
            name: 'header',
            label: 'Header',
            fields: [
              { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
              { type: 'string', name: 'title', label: 'Title' },
              { type: 'string', name: 'lead', label: 'Lead', ui: { component: 'textarea' } },
              { type: 'string', name: 'linkLabel', label: 'Link label' },
            ],
          },
          {
            type: 'object',
            name: 'products',
            label: 'Products',
            list: true,
            fields: [
              { type: 'string', name: 'title', label: 'Title', isTitle: true, required: true },
              { type: 'string', name: 'desc', label: 'Description', ui: { component: 'textarea' } },
              { type: 'string', name: 'price', label: 'Price' },
              { type: 'string', name: 'rating', label: 'Rating' },
              { type: 'number', name: 'reviews', label: 'Review count' },
              { type: 'string', name: 'includes', label: 'Includes', list: true },
              { type: 'boolean', name: 'free', label: 'Free sample' },
              { type: 'boolean', name: 'hot', label: 'Best seller' },
            ],
          },
        ],
      },
      {
        name: 'blogsPage',
        label: 'Blogs page',
        path: 'content/marketing',
        format: 'json',
        match: { include: 'blogs-page' },
        ui: { ...collectionUi, router: collectionRouter('/blogs') },
        fields: [
          {
            type: 'object',
            name: 'wall',
            label: 'Wall header',
            fields: [
              { type: 'string', name: 'eyebrow', label: 'Eyebrow' },
              { type: 'string', name: 'title', label: 'Title' },
              { type: 'string', name: 'viewAllLabel', label: 'View all label' },
            ],
          },
          {
            type: 'object',
            name: 'categories',
            label: 'Categories',
            list: true,
            fields: [
              { type: 'string', name: 'id', label: 'ID' },
              { type: 'string', name: 'label', label: 'Label' },
            ],
          },
        ],
      },
      {
        name: 'blog',
        label: 'Blog articles',
        path: 'content/marketing/blogs',
        format: 'json',
        ui: {
          allowedActions: { create: true, delete: true },
          router: blogPostRouter,
        },
        fields: [
          { type: 'string', name: 'slug', label: 'Slug (optional — defaults to filename)' },
          { type: 'string', name: 'title', label: 'Title', isTitle: true, required: true },
          { type: 'string', name: 'author', label: 'Author' },
          { type: 'string', name: 'read', label: 'Read time' },
          { type: 'boolean', name: 'feat', label: 'Featured on home' },
          { type: 'string', name: 'cat', label: 'Categories', list: true },
          { type: 'string', name: 'excerpt', label: 'Excerpt', ui: { component: 'textarea' } },
          { type: 'string', name: 'body', label: 'Body', ui: { component: 'textarea' } },
        ],
      },
    ],
  },
});
