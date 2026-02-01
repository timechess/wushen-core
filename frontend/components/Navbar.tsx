'use client';

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

  const gameItems = [
    { href: '/game', label: '游戏大厅' },
    { href: '/game/completed', label: '完成角色' },
  ];

  const editorItems = [
    { href: '/mods', label: '模组包' },
    { href: '/mods/order', label: '排序' },
    { href: '/editor', label: '内容编辑' },
    { href: '/character', label: '敌人' },
    { href: '/battle', label: '战斗测试' },
    { href: '/cultivation', label: '修行测试' },
  ];

  const linkClass = (path: string) =>
    `nav-pill ${isActive(path) ? 'nav-pill-active' : ''}`;

  return (
    <nav className="nav-shell">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="nav-brand">
              武神·工坊
            </a>
            <span className="panel-kicker">WUSHEN CORE</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a href="/" className={linkClass('/')}>
              工作台
            </a>

            <div className="nav-divider hidden lg:block" />

            <div className="flex flex-wrap items-center gap-2">
              <span className="nav-group-title">游戏</span>
              {gameItems.map((item) => (
                <a key={item.href} href={item.href} className={linkClass(item.href)}>
                  {item.label}
                </a>
              ))}
            </div>

            <div className="nav-divider hidden lg:block" />

            <div className="flex flex-wrap items-center gap-2">
              <span className="nav-group-title">编辑</span>
              {editorItems.map((item) =>
                item.href === '/mods/order' ? (
                  <a key={item.href} href="/mods/order/" className={linkClass(item.href)}>
                    {item.label}
                  </a>
                ) : (
                  <a key={item.href} href={item.href} className={linkClass(item.href)}>
                    {item.label}
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
