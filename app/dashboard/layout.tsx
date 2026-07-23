import DashboardLayout from '@/components/layout/DashboardLayout';

// Layout do segmento /dashboard: a sidebar (DashboardLayout) fica AQUI, então
// persiste entre o loading.tsx e o page.tsx (não remonta). O page.tsx pôde
// virar Server Component (SSR dos dados) sem levar a sidebar junto.
export default function DashboardSegmentLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
