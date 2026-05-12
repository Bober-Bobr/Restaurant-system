import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
export const Input = forwardRef(({ className, ...props }, ref) => (_jsx("input", { ref: ref, className: cn('adm-input', className), ...props })));
Input.displayName = 'Input';
