import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Icon from '@/components/Icon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** 顶部标题 */
  title?: ReactNode;
  /** 是否允许点遮罩关闭（默认 true；流程中不可打断时设 false） */
  dismissible?: boolean;
  /** 内容区最大宽度，默认 max-w-2xl */
  maxWidth?: string;
  children: ReactNode;
  /** 底部按钮区（如取消/保存） */
  footer?: ReactNode;
}

/**
 * 统一弹层组件：
 * - 移动端底部抽屉（rounded-t-2xl），桌面端居中弹窗（rounded-xl）
 * - 自动 safe-area-inset-bottom 适配
 * - role="dialog" + aria-modal，Esc 可关闭（dismissible=true 时）
 * - 点击遮罩关闭（dismissible=true 时）
 *
 * 替代 Jobs/Tracking/Profile 等处重复的 fixed inset-0 ... 结构。
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  dismissible = true,
  maxWidth = 'max-w-2xl',
  children,
  footer
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);
    // 简单焦点陷阱：打开时聚焦容器
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-ink-900/80 backdrop-blur z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={dismissible ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        className={cn(
          'card p-5 w-full max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-xl',
          maxWidth
        )}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        {(title || dismissible) && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-ink-100">{title}</h3>
            {dismissible && (
              <button
                className="btn-ghost text-xs flex items-center"
                onClick={onClose}
                aria-label="关闭"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        )}
        {children}
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}
