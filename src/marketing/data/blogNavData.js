/** Nav mega-menu sections (HubSpot-style) + blog page filter categories. */

export const BLOG_NAV_SECTIONS = [
  {
    id: 'blogs',
    label: 'Blogs',
    cards: [
      { title: 'Marketing', description: 'Resources and ideas to put modern makers ahead of the curve', href: '/blogs?cat=Marketing' },
      { title: 'Sales', description: 'Strategies to help you elevate your sales efforts', href: '/blogs?cat=Sales' },
      { title: 'Branding', description: 'Build a brand that ships before the window closes', href: '/blogs?cat=Branding' },
      { title: 'Website', description: 'Tutorials and how-tos to build better launches online', href: '/blogs?cat=Website' },
    ],
  },
  {
    id: 'topics',
    label: 'Topics',
    cards: [
      { title: 'Smart CRM', description: 'Managing contacts, pipelines, and relationships at scale', href: '/blogs?cat=Marketing' },
      { title: 'Marketing Automation', description: 'Personalize campaigns, nurture leads, and drive growth', href: '/blogs?cat=Marketing' },
      { title: 'Sales Enablement', description: 'Align marketing and sales, close deals faster', href: '/blogs?cat=Sales' },
      { title: 'Customer Service', description: 'Deliver seamless support and memorable experiences', href: '/blogs?cat=Sales' },
      { title: 'Website & Content', description: 'High-performing sites and content that convert', href: '/blogs?cat=Website' },
      { title: 'Data & Analytics', description: 'Measure performance and turn data into action', href: '/blogs?cat=Trends' },
      { title: 'AI & Automation', description: 'Use AI to streamline work and scale smarter efforts', href: '/blogs?cat=Trends' },
      { title: '(e)commerce & Payments', description: 'Selling online and optimizing the digital buying experience', href: '/blogs?cat=Ecommerce' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    cards: [
      { title: 'Loop Playbook', description: 'Our methodology for modern growth strategies', href: '/blogs?cat=Trends' },
      { title: 'Case Studies', description: 'Success stories from makers using Futura Nota', href: '/blogs?cat=Validation' },
      { title: 'Newsletters', description: 'Subscribe to industry signals in your inbox', href: '/blogs' },
      { title: 'Company News', description: 'Latest updates from Futura Nota', href: '/blogs' },
      { title: 'Resources & Templates', description: 'Free tools and templates for your next window', href: '/blogs' },
    ],
  },
];

/** Sidebar filters on /blogs — labels as shown in UI. */
export const BLOG_PAGE_CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: 'Trends', label: 'Trends' },
  { id: 'Marketing', label: 'Marketing' },
  { id: 'Sales', label: 'Sales' },
  { id: 'Branding', label: 'Branding' },
  { id: 'Website', label: 'Website' },
  { id: 'Ecommerce', label: '(e)commerce' },
  { id: 'Validation', label: 'Validation' },
];

export const BLOG_ARTICLES = [
  { cat: ['Trends', 'Marketing'], title: 'How to read a launch campaign before it lands', author: 'Editorial', read: '8 min', feat: true },
  { cat: ['Ecommerce'], title: 'Physical products that are quietly selling out this quarter', author: 'Rossmery', read: '5 min', feat: false },
  { cat: ['Validation'], title: 'The coffee-and-cup playbook: companion products, explained', author: 'Editorial', read: '7 min', feat: false },
  { cat: ['Trends'], title: 'DTC drops worth watching — and the gaps they leave open', author: 'Rossmery', read: '5 min', feat: false },
  { cat: ['Marketing', 'Branding'], title: 'Brand voice for makers: say less, ship more', author: 'Editorial', read: '6 min', feat: false },
  { cat: ['Sales'], title: 'Pricing companion products when the window is short', author: 'Rossmery', read: '4 min', feat: false },
  { cat: ['Website'], title: 'Landing pages that convert before launch day', author: 'Editorial', read: '9 min', feat: false },
  { cat: ['Marketing', 'Sales'], title: 'Outbound that respects the launch calendar', author: 'Rossmery', read: '6 min', feat: false },
];
