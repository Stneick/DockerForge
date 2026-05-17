import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface SortableWorkbenchTabProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
    id: string;
    children: ReactNode;
}

/** Sortable shell — mirrors Unistream `SortableMetadataTab`. */
export const SortableWorkbenchTab = forwardRef<HTMLDivElement, SortableWorkbenchTabProps>(
    ({ id, children, className, style, ...rest }, forwardedRef) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
            useSortable({ id });

        const combinedStyle = {
            ...style,
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.7 : 1,
        };

        return (
            <div
                ref={(node) => {
                    setNodeRef(node);
                    if (typeof forwardedRef === 'function') {
                        forwardedRef(node);
                    } else if (forwardedRef) {
                        forwardedRef.current = node;
                    }
                }}
                style={combinedStyle}
                data-tab-chip
                className={cn(
                    className,
                    'max-w-[220px] shrink-0 cursor-grab active:cursor-grabbing',
                )}
                {...attributes}
                {...listeners}
                {...rest}
            >
                {children}
            </div>
        );
    },
);

SortableWorkbenchTab.displayName = 'SortableWorkbenchTab';
