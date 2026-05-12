import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
export const Select = forwardRef(({ className, children, ...props }, ref) => (_jsx("select", { ref: ref, className: cn('adm-input', className), ...props, children: children })));
Select.displayName = 'Select';
