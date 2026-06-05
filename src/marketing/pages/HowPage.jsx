import { PageTinaProvider } from '../context/TinaVisualEditing.jsx';
import { SubpageLayout } from '../layout/SubpageLayout.jsx';
import { HowItWorks } from '../sections/HowItWorks.jsx';

export function HowPage() {
  return (
    <PageTinaProvider docKey="how">
      <SubpageLayout>
        <HowItWorks />
      </SubpageLayout>
    </PageTinaProvider>
  );
}
