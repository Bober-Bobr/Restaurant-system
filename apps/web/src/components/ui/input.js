import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
export const Input = forwardRef(({ className, ...props }, ref) => (_jsx("input", { ref: ref, className: cn('flex h-11 w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50', className), ...props })));
Input.displayName = 'Input';
