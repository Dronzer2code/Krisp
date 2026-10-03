import { useRoute } from './router';
import Home from './screens/Home';

export default function App() {
  const route = useRoute();
  switch (route.name) {
    case 'home':
    default:
      return <Home />;
  }
}
