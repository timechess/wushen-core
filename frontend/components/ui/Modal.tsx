import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  contentClassName = '',
  bodyClassName = '',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal 内容容器 */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className={`relative inline-block w-full max-w-4xl transform overflow-hidden rounded-2xl bg-[var(--app-surface)] text-left align-bottom shadow-xl transition-all sm:my-8 sm:align-middle border border-[var(--app-border)] ${contentClassName}`}
        >
          {/* Modal 头部和内容 */}
          <div className="bg-[var(--app-surface)] px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-[var(--app-ink)]">{title}</h3>
              <button
                onClick={onClose}
                className="text-[var(--app-ink-faint)] hover:text-[var(--app-ink)] focus:outline-none"
              >
                <span className="sr-only">关闭</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={`mt-2 max-h-[60vh] overflow-y-auto ${bodyClassName}`}>
              {children}
            </div>
          </div>
          
          {/* Modal 底部 */}
          {footer && (
            <div className="bg-[var(--app-surface-muted)] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2 border-t border-[var(--app-border)]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
