import React from 'react';
import {
  BookOpen,
  CheckSquare,
  Database,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import {NavigationTab} from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  activeTodoCount: number;
  knowHowCount: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenBackup: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeTodoCount,
  knowHowCount,
  isDark,
  onToggleTheme,
  onOpenBackup,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{className?: string}>;
    count?: number;
  }[] = [
    {
      id: NavigationTab.TODOS,
      label: 'Görevler (Todo)',
      icon: CheckSquare,
      count: activeTodoCount,
    },
    {
      id: NavigationTab.KNOW_HOW,
      label: 'Know-How',
      icon: BookOpen,
      count: knowHowCount,
    },
    {
      id: NavigationTab.SEARCH_TAGS,
      label: 'Arama / Etiketler',
      icon: Search,
    },
  ];

  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Brand header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-5 dark:border-zinc-800">
        <span className="text-base font-bold tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap shrink-0">
          Dizin
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Menüyü kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 space-y-1 p-3" aria-label="Ana menü">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800'
                  : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && (
                <span className="ml-2 font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom utility actions */}
      <div className="space-y-1 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            onOpenBackup();
            onCloseMobile();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100 whitespace-nowrap"
        >
          <Database className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span className="truncate">Yedekle / Geri Yükle</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100 whitespace-nowrap"
        >
          <span className="flex items-center gap-2.5 truncate">
            {isDark ? (
              <Sun className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-zinc-500" />
            )}
            <span className="truncate">{isDark ? 'Aydınlık Mod' : 'Karanlık Mod'}</span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block lg:shrink-0">{sidebarContent}</aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-zinc-950/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
