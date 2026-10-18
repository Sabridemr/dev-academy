import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="mt-4 text-lg">Sayfa bulunamadı · Page not found</p>
      <Link href="/" className="btn-primary mt-6">
        DevAcademy
      </Link>
    </div>
  );
}
