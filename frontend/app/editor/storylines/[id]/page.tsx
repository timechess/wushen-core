import ClientPage from './ClientPage';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function Page() {
  return <ClientPage />;
}
