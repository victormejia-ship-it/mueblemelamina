import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-xl font-bold">No encontrado</h1>
      <p className="mt-2 text-muted">El proyecto o la página no existe en este workspace.</p>
      <Link href="/proyectos" className="mt-4 inline-block text-accent underline">Volver a mis proyectos</Link>
    </div>
  );
}
