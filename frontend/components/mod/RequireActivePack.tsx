'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import Button from '@/components/ui/Button';
import { useActivePack } from '@/lib/mods/active-pack';

interface RequireActivePackProps {
  children: ReactNode;
  title?: string;
}

export default function RequireActivePack({ children, title }: RequireActivePackProps) {
  const { activePack, ready } = useActivePack();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">正在检查模组包...</div>
      </div>
    );
  }

  if (!activePack) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">需要先选择模组包</h1>
          <p className="text-gray-600 mb-6">{title ?? '创建内容前必须先选定一个模组包。'}</p>
          <Button>
            <Link href="/mods">前往模组包管理</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
