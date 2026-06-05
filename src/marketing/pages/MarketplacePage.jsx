import { PageTinaProvider } from '../context/TinaVisualEditing.jsx';
import { SubpageLayout } from '../layout/SubpageLayout.jsx';
import { Marketplace } from '../sections/Marketplace.jsx';

export function MarketplacePage() {
  return (
    <PageTinaProvider docKey="marketplace">
      <SubpageLayout>
        <Marketplace />
      </SubpageLayout>
    </PageTinaProvider>
  );
}
