import { PageTinaProvider } from '../context/TinaVisualEditing.jsx';
import { SubpageLayout } from '../layout/SubpageLayout.jsx';
import { Blogs } from '../sections/Blogs.jsx';

export function BlogsPage() {
  return (
    <PageTinaProvider docKey="blogsPage">
      <SubpageLayout>
        <Blogs />
      </SubpageLayout>
    </PageTinaProvider>
  );
}
