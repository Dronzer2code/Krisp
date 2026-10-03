import { lazy, Suspense } from 'react';
import { useRoute } from './router';
import Home from './screens/Home';
import { Announcer } from './screens/workspace/Announcer';
import { PasscodeGate } from './screens/workspace/PasscodeGate';

const Workspace = lazy(() => import('./screens/Workspace'));

// Dev-only screens are dropped from production builds (import.meta.env.DEV is statically false).
const MagentaSmoke = import.meta.env.DEV ? lazy(() => import('./screens/MagentaSmoke')) : null;
const AudioSmoke = import.meta.env.DEV ? lazy(() => import('./screens/AudioSmoke')) : null;
const KitDemo = import.meta.env.DEV ? lazy(() => import('./screens/KitDemo')) : null;

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case 'workspace':
      return <Workspace key={route.id === 'new' ? 'new' : route.id} id={route.id} />;
    case 'kit':
      return KitDemo ? <KitDemo /> : <Home />;
    case 'dev-magenta':
      return MagentaSmoke ? <MagentaSmoke /> : <Home />;
    case 'dev-audio':
      return AudioSmoke ? <AudioSmoke /> : <Home />;
    case 'home':
    default:
      return <Home />;
  }
}

export default function App() {
  return (
    <>
      <Suspense fallback={<p className="label p-s5" role="status">Loading…</p>}>
        <Screen />
      </Suspense>
      <PasscodeGate />
      <Announcer />
    </>
  );
}
