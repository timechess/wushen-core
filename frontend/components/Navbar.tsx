'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    if (path === '/mods') {
      return pathname === '/mods';
    }
    if (path === '/editor') {
      return pathname === '/editor' || pathname.startsWith('/editor/');
    }
    return pathname.startsWith(path);
  };

  const navItems = [
    { href: '/', label: '工作台' },
    { href: '/mods', label: '模组包' },
    { href: '/mods/order', label: '模组排序' },
    { href: '/editor', label: '内容编辑' },
    { href: '/battle', label: '战斗测试' },
    { href: '/cultivation', label: '修行测试' },
  ];

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-1">
            <Link
              href="/"
              className="text-xl font-bold text-gray-800 hover:text-gray-600 transition-colors"
            >
              武神 Mod 编辑器
            </Link>
          </div>
          <div className="flex items-center space-x-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive(item.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
