import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { MembersScreen } from '@app/web-platform';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getI18n()).t('members.title') };
}

export default function Page(): ReactNode {
    return <MembersScreen />;
}
