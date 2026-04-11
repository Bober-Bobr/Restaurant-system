import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
const variantClasses = {
    default: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
    accent: 'bg-accent text-white hover:bg-violet-600',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-700 hover:bg-slate-100',
    outline: 'border border-slate-200 text-slate-900 hover:bg-slate-50'
};
const sizeClasses = {
    default: 'h-11 px-5 py-2.5 text-sm',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-12 px-6 text-base'
};
export const Button = forwardRef(({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (_jsx("button", { ref: ref, type: type, className: cn('inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', variantClasses[variant], sizeClasses[size], className), ...props }));
});
Button.displayName = 'Button';
