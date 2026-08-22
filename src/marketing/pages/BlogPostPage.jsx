import { Link, useParams } from 'react-router-dom';
import { BlogPostTinaProvider, useBlogPostTina } from '../context/TinaVisualEditing.jsx';
import { SubpageLayout } from '../layout/SubpageLayout.jsx';
import { getBlogArticleBySlug } from '../lib/content.js';
import { PATHS } from '../lib/paths.js';
import { BlogPost } from '../sections/BlogPost.jsx';

function BlogPostContent() {
  const { slug } = useParams();
  const tina = useBlogPostTina();
  const article = tina?.article ?? (slug ? getBlogArticleBySlug(slug) : null);

  if (tina?.loading && !article) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">Loading…</p>
        </div>
      </section>
    );
  }

  if (!article) {
    return (
      <section className="section">
        <div className="container">
          <h1 className="h2">Article not found</h1>
          <p className="muted">No post matches &ldquo;{slug}&rdquo;.</p>
          <Link to={PATHS.blogs} className="link-arrow" style={{ marginTop: 16 }}>
            Back to blogs <span className="arrow">→</span>
          </Link>
        </div>
      </section>
    );
  }

  return <BlogPost article={article} />;
}

export function BlogPostPage() {
  const { slug } = useParams();

  return (
    <BlogPostTinaProvider slug={slug}>
      <SubpageLayout>
        <BlogPostContent />
      </SubpageLayout>
    </BlogPostTinaProvider>
  );
}
