import type { Metadata } from 'next';
import { Dashboard } from '@/components/Dashboard';

export const metadata: Metadata = { title: 'Mis proyectos' };
export default function ProjectsPage() { return <Dashboard />; }
