import { PageTinaProvider } from '../context/TinaVisualEditing.jsx';
import { SubpageLayout } from '../layout/SubpageLayout.jsx';
import { Horizon } from '../sections/Horizon.jsx';

export function HorizonPage() {
  return (
    <PageTinaProvider docKey="horizon">
      <SubpageLayout>
        <Horizon />
      </SubpageLayout>
    </PageTinaProvider>
  );
}
