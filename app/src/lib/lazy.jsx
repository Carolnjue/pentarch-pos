// Code-splitting helper: const Page = lazy(() => import('./Page.jsx'))
import { useEffect, useState } from 'preact/hooks';
import { SkeletonRows } from '../ui/kit.jsx';

export function lazy(loader) {
  let Comp = null, promise = null;
  const load = () => (promise ||= loader().then((m) => { Comp = m.default; return Comp; }));
  function Lazy(props) {
    const [, force] = useState(0);
    useEffect(() => { if (!Comp) load().then(() => force((n) => n + 1)); }, []);
    if (!Comp) return <div class="page"><SkeletonRows n={7} /></div>;
    return <Comp {...props} />;
  }
  Lazy.preload = load;
  return Lazy;
}
