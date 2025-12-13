
import { useNavigate } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();

  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => {
      // In a real Next.js app this re-fetches server components.
      // Here we can't easily simulate it without context, but it's safe to no-op or window.location.reload()
    }
  };
}
