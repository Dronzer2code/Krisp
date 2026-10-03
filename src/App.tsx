import { lazy, Suspense } from 'react';
import { useRoute } from './router';
import Home from './screens/Home';

// Dev-only screens are dropped from production builds (import.meta.env.DEV is statically false).
const MagentaSmoke = import.meta.env.DEV ? lazy(() => import('./screens/MagentaSmoke')) : null;
const AudioSmoke = import.meta.env.DEV ? lazy(() => import('./screens/AudioSmoke')) : null;
const KitDemo = import.meta.env.DEV ? lazy(() => import('./screens/KitDemo')) : null;

export default function App() {
  const route = useRoute();
  switch (route.name) {
    case 'dev-magenta':
      if (MagentaSmoke) return <Suspense fallback={null}><MagentaSmoke /></Suspense>;
      return <Home />;
    case 'kit':
      if (KitDemo) return <Suspense fallback={null}><KitDemo /></Suspense>;
      return <Home />;
    case 'dev-audio':
      if (AudioSmoke) return <Suspense fallback={null}><AudioSmoke /></Suspense>;
      return <Home />;
    case 'home':
    default:
      return <Home />;
  }
}
